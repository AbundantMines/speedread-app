// Warpreader Extension — Popup Reader (v2 with auth, sync, sparkline)

// ── RSVP Core ────────────────────────────────────────────────────────────────
const ORP_TABLE = [0,0,0,0,1,1,1,2,2,2,3,3,3,4,4,4];

function getORP(w) {
  const clean = w.replace(/[^a-zA-Z0-9]/g, '');
  return ORP_TABLE[Math.min(clean.length, ORP_TABLE.length - 1)];
}

function delay(w, wpm) {
  const base = 60000 / wpm;
  let mult = 1;
  if (/[.!?]$/.test(w))    mult = 2.8;
  else if (/[,;:]/.test(w)) mult = 1.6;
  else if (w.length > 10)   mult = 1.3;
  else if (w.length <= 2)   mult = 0.7;
  return Math.max(base * mult, 50);
}

// ── State ─────────────────────────────────────────────────────────────────────
let words = [], idx = 0, wpm = 300, playing = false, timer = null;
// Restore preferred WPM immediately
chrome.storage.sync.get(['defaultWPM'], (r) => { if (r.defaultWPM) { wpm = r.defaultWPM; } });
let currentUser = null, currentPlan = 'free';
let authPanelOpen = false, authMode = 'signin';
let sessionStartWPM = null; // track WPM at session start for sync

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const wordRow     = $('word-row');
const wordBefore  = $('word-before');
const wordORP     = $('word-orp');
const wordAfter   = $('word-after');
const idleText    = $('idle-text');
const progressFill = $('progress-fill');
const progressPos  = $('progress-pos');
const progressPct  = $('progress-pct');
const playBtn     = $('play-btn');
const wpmSlider   = $('wpm-slider');
const wpmVal      = $('wpm-val');
const authPanel   = $('auth-panel');
const authFormWrap = $('auth-form-wrap');
const signedInWrap = $('signed-in-wrap');
const limitBanner = $('limit-banner');
const sparkWrap   = $('sparkline-wrap');
const sparkSVG    = $('sparkline-svg');
const avatarEl    = $('avatar-initial');
const planBadge   = $('plan-badge');

// ── RSVP Display ─────────────────────────────────────────────────────────────
function showWord(w) {
  if (!w) return;
  const o = getORP(w);
  wordBefore.textContent = w.slice(0, o);
  wordORP.textContent = w[o] || '';
  wordAfter.textContent = w.slice(o + 1);
  wordRow.style.display = 'flex';
  idleText.style.display = 'none';
}

function updateProgress() {
  if (!words.length) return;
  const pct = ((idx / words.length) * 100).toFixed(1);
  progressFill.style.width = pct + '%';
  progressPct.textContent = pct + '%';
  progressPos.textContent = `${idx + 1} / ${words.length} words`;
}

function togglePlay() {
  if (!words.length) return;
  if (playing) {
    playing = false;
    clearTimeout(timer);
    playBtn.textContent = '▶ Play';
    // On pause/finish, sync WPM if logged in
    syncWPMSession();
  } else {
    playing = true;
    if (idx >= words.length) idx = 0;
    sessionStartWPM = wpm;
    playBtn.textContent = '⏸';
    tick();
  }
}

function tick() {
  if (!playing || idx >= words.length) {
    playing = false;
    playBtn.textContent = '▶ Play';
    if (idx >= words.length) {
      syncWPMSession();
      idx = 0;
    }
    return;
  }
  showWord(words[idx]);
  updateProgress();
  timer = setTimeout(() => { idx++; tick(); }, delay(words[idx], wpm));
}

function jump(d) {
  const was = playing;
  if (was) { playing = false; clearTimeout(timer); }
  idx = Math.max(0, Math.min(words.length - 1, idx + d));
  if (words.length) { showWord(words[idx]); updateProgress(); }
  if (was) { playing = true; tick(); }
}

function setWPM(v) {
  wpm = v;
  wpmVal.textContent = v;
  chrome.storage.sync.set({ defaultWPM: v });
}

function loadText(text) {
  words = text.split(/\s+/).filter(w => w.length > 0);
  idx = 0;
  playing = false;
  clearTimeout(timer);
  playBtn.textContent = '▶ Play';
  if (words.length) { showWord(words[0]); updateProgress(); }
}

// ── Source actions ────────────────────────────────────────────────────────────
async function extractPage() {
  const gateOk = await checkReadGate();
  if (!gateOk) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' }, (resp) => {
      if (chrome.runtime.lastError) {
        idleText.textContent = 'Cannot extract this page.';
        idleText.style.display = 'block';
        wordRow.style.display = 'none';
        return;
      }
      if (resp?.text) {
        loadText(resp.text);
        WarpAuth.incrementUsage();
      } else {
        idleText.textContent = 'Could not extract text from this page.';
        idleText.style.display = 'block';
        wordRow.style.display = 'none';
      }
    });
  } catch (e) {
    idleText.textContent = 'Error extracting page.';
    idleText.style.display = 'block';
    wordRow.style.display = 'none';
  }
}

async function useSelection() {
  const gateOk = await checkReadGate();
  if (!gateOk) return;
  chrome.storage.local.get(['pendingText'], (r) => {
    if (r.pendingText) {
      loadText(r.pendingText);
      chrome.storage.local.remove('pendingText');
      WarpAuth.incrementUsage();
    } else {
      idleText.textContent = 'No selected text — right-click and choose "Speed Read This".';
      idleText.style.display = 'block';
      wordRow.style.display = 'none';
    }
  });
}

async function openFullReader() {
  // Store current words in local storage for reader page
  chrome.storage.local.set({
    readerWords: words.join(' '),
    readerIdx: idx,
    readerWPM: wpm
  }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
  });
}

function openInApp() {
  const text = words.join(' ');
  if (text.length > 0) {
    // Copy to clipboard and open app — URL param is too long for full text
    navigator.clipboard.writeText(text).catch(() => {});
  }
  chrome.tabs.create({ url: 'https://warpreader.com/app.html' });
}

// ── Pro gating ────────────────────────────────────────────────────────────────
async function checkReadGate() {
  const result = await WarpAuth.canRead(currentPlan);
  if (!result.allowed) {
    limitBanner.classList.add('show');
    return false;
  }
  limitBanner.classList.remove('show');
  return true;
}

function openUpgrade() {
  chrome.tabs.create({ url: 'https://warpreader.com/app.html?plan=pro_annual' });
}

// ── WPM sync & sparkline ──────────────────────────────────────────────────────
async function syncWPMSession() {
  if (!currentUser || !sessionStartWPM) return;
  await WarpAuth.saveWPMSession(currentUser.id, sessionStartWPM);
  sessionStartWPM = null;
  // Refresh sparkline
  loadSparkline();
}

async function loadSparkline() {
  if (!currentUser) return;
  const history = await WarpAuth.fetchWPMHistory(currentUser.id);
  if (!history || history.length < 2) return;

  const vals = history.map(h => h.wpm || h.wpm_score || 0).filter(v => v > 0);
  if (vals.length < 2) return;

  sparkWrap.style.display = 'flex';
  renderSparkline(vals.slice(-10));
}

function renderSparkline(vals) {
  const W = 380, H = 36, pad = 4;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const xStep = (W - pad * 2) / (vals.length - 1);

  const pts = vals.map((v, i) => {
    const x = pad + i * xStep;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  sparkSVG.innerHTML = `
    <polyline
      points="${pts}"
      fill="none"
      stroke="#c9a84c"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    ${vals.map((v, i) => {
      const x = pad + i * xStep;
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#c9a84c"/>`;
    }).join('')}
  `;
}

// ── Auth UI ───────────────────────────────────────────────────────────────────
function toggleAuthPanel() {
  authPanelOpen = !authPanelOpen;
  authPanel.classList.toggle('open', authPanelOpen);
}

function switchTab(mode) {
  authMode = mode;
  $('tab-signin').classList.toggle('active', mode === 'signin');
  $('tab-signup').classList.toggle('active', mode === 'signup');
  $('auth-submit-btn').textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
  $('auth-msg').textContent = '';
  $('auth-msg').className = 'auth-msg';
}

async function doAuth() {
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  const msgEl = $('auth-msg');

  if (!email || !password) {
    msgEl.textContent = 'Please enter email and password.';
    msgEl.className = 'auth-msg error';
    return;
  }

  $('auth-submit-btn').textContent = 'Please wait…';
  $('auth-submit-btn').disabled = true;

  let result;
  if (authMode === 'signin') {
    result = await WarpAuth.signIn(email, password);
  } else {
    result = await WarpAuth.signUp(email, password);
  }

  $('auth-submit-btn').disabled = false;
  switchTab(authMode); // reset button text

  if (result.success) {
    if (result.needsConfirmation) {
      msgEl.textContent = '✓ Check your email to confirm your account.';
      msgEl.className = 'auth-msg success';
    } else {
      await initUserState(result.user);
      msgEl.textContent = '';
    }
  } else {
    msgEl.textContent = result.error || 'Authentication failed.';
    msgEl.className = 'auth-msg error';
  }
}

async function doSignOut() {
  await WarpAuth.signOut();
  currentUser = null;
  currentPlan = 'free';
  updateAccountUI(null, 'free');
  authFormWrap.style.display = 'block';
  signedInWrap.style.display = 'none';
  sparkWrap.style.display = 'none';
}

function updateAccountUI(user, plan) {
  if (user) {
    const initial = (user.email || 'U')[0].toUpperCase();
    avatarEl.textContent = initial;
    avatarEl.classList.remove('anon');
    planBadge.textContent = plan === 'pro' ? 'PRO' : 'FREE';
    planBadge.classList.toggle('pro', plan === 'pro');
    $('user-email-display').textContent = user.email || '';
    authFormWrap.style.display = 'none';
    signedInWrap.style.display = 'block';
  } else {
    avatarEl.textContent = '?';
    avatarEl.classList.add('anon');
    planBadge.textContent = 'FREE';
    planBadge.classList.remove('pro');
    authFormWrap.style.display = 'block';
    signedInWrap.style.display = 'none';
  }
}

async function initUserState(user) {
  currentUser = user;
  currentPlan = 'free';
  try {
    currentPlan = await WarpAuth.getUserPlan(user.id);
  } catch (e) { /* offline */ }
  updateAccountUI(user, currentPlan);
  loadSparkline();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Don't intercept when typing in auth fields
  if (e.target.tagName === 'INPUT') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      jump(e.shiftKey ? -50 : -10);
      break;
    case 'ArrowRight':
      e.preventDefault();
      jump(e.shiftKey ? 50 : 10);
      break;
    case 'ArrowUp':
      e.preventDefault();
      setWPM(Math.min(1500, wpm + 25));
      wpmSlider.value = wpm;
      break;
    case 'ArrowDown':
      e.preventDefault();
      setWPM(Math.max(100, wpm - 25));
      wpmSlider.value = wpm;
      break;
  }
});

// ── Event bindings ────────────────────────────────────────────────────────────
$('account-btn').addEventListener('click', toggleAuthPanel);
$('btn-extract').addEventListener('click', extractPage);
$('btn-selection').addEventListener('click', useSelection);
$('btn-fullreader').addEventListener('click', openFullReader);
$('btn-open-app').addEventListener('click', openInApp);
$('btn-back50').addEventListener('click', () => jump(-50));
$('btn-back10').addEventListener('click', () => jump(-10));
$('play-btn').addEventListener('click', togglePlay);
$('btn-fwd10').addEventListener('click', () => jump(10));
$('btn-fwd50').addEventListener('click', () => jump(50));
wpmSlider.addEventListener('input', (e) => setWPM(+e.target.value));

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Load saved WPM
  chrome.storage.sync.get(['defaultWPM'], (r) => {
    if (r.defaultWPM) {
      wpm = r.defaultWPM;
      wpmSlider.value = wpm;
      wpmVal.textContent = wpm;
    }
  });

  // Check for pending text (from context menu)
  chrome.storage.local.get(['pendingText'], (r) => {
    if (r.pendingText) {
      loadText(r.pendingText);
      chrome.storage.local.remove('pendingText');
    }
  });

  // Restore auth session
  try {
    const user = await WarpAuth.getUser();
    if (user) {
      await initUserState(user);
    }
  } catch (e) { /* offline — stay signed out UI */ }

  // Show usage status for free users
  const usage = await WarpAuth.getTodayUsage();
  if (currentPlan !== 'pro' && usage >= 3) {
    limitBanner.classList.add('show');
  }
}

init();
