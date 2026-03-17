// ═══════════════════════════════════════════════════════════════
// SpeedRead — Main Reader Logic (app.js)
// ═══════════════════════════════════════════════════════════════

// ── STATE ──
let state = 'idle'; // idle | loading | ready | playing | paused
let words = [];
let currentIdx = 0;
let wpm = 300;
let contextVisible = false;
let timerId = null;
let pageBoundaries = [];
let currentFile = { name: '', size: 0 };
let autoSaveTimer = null;
let sessionStartTime = null;
let rsvpFontSize = 52;

// ── ORP (Optimal Recognition Point) ──
const ORP_TABLE = [0,0,0,0,1,1,1,2,2,2,3,3,3,4,4,4];
function getORP(word) {
  const len = word.replace(/[^a-zA-Z0-9]/g, '').length;
  return ORP_TABLE[Math.min(len, ORP_TABLE.length - 1)];
}

// ── TIMING ──
function getWordDelay(word, wpmVal) {
  const base = 60000 / wpmVal;
  let mult = 1.0;
  if (/[.!?](\s|$)/.test(word) || /[.!?]$/.test(word)) mult = 2.8;
  else if (/[,;:]/.test(word)) mult = 1.6;
  else if (word.length > 10) mult = 1.3;
  else if (word.length <= 2) mult = 0.7;
  return Math.max(base * mult, 50);
}

// ── DISPLAY ──
function displayWord(word) {
  if (!word) return;
  const orp = getORP(word);
  document.getElementById('word-before').textContent = word.slice(0, orp);
  document.getElementById('word-orp').textContent = word.charAt(orp) || '';
  document.getElementById('word-after').textContent = word.slice(orp + 1);
  document.getElementById('word-row').style.display = 'flex';
  document.getElementById('rsvp-idle').style.display = 'none';
}

function showIdleDisplay(msg) {
  document.getElementById('word-row').style.display = 'none';
  const idle = document.getElementById('rsvp-idle');
  idle.style.display = '';
  idle.textContent = msg || 'Ready to read';
}

// ── PLAY / PAUSE ──
function togglePlay() {
  if (state === 'playing') pause();
  else if (state === 'paused' || state === 'ready') play();
}

function play() {
  if (!words.length) return;
  if (currentIdx >= words.length) currentIdx = 0;
  if (!sessionStartTime) sessionStartTime = Date.now();
  state = 'playing';
  updatePlayBtn();
  scheduleNext();
  startAutoSave();
}

function pause() {
  state = 'paused';
  updatePlayBtn();
  if (timerId) { clearTimeout(timerId); timerId = null; }
  saveProgress();
  stopAutoSave();
}

function scheduleNext() {
  if (state !== 'playing') return;
  if (currentIdx >= words.length) {
    state = 'paused';
    updatePlayBtn();
    showToast('🎉 Finished!');
    saveProgress();
    saveSessionData();
    stopAutoSave();
    return;
  }
  const word = words[currentIdx];
  displayWord(word);
  updateProgress();
  if (contextVisible) updateContext();
  timerId = setTimeout(() => { currentIdx++; scheduleNext(); }, getWordDelay(word, wpm));
}

function updatePlayBtn() {
  const btn = document.getElementById('play-btn');
  btn.textContent = state === 'playing' ? '⏸ Pause' : '▶ Play';
}

// ── JUMP / SEEK ──
function jumpWords(delta) {
  const wasPlaying = state === 'playing';
  if (wasPlaying && timerId) { clearTimeout(timerId); timerId = null; }
  currentIdx = Math.max(0, Math.min(words.length - 1, currentIdx + delta));
  displayWord(words[currentIdx]);
  updateProgress();
  if (contextVisible) updateContext();
  if (wasPlaying) { state = 'playing'; scheduleNext(); }
}

function seekTo(idx) {
  const wasPlaying = state === 'playing';
  if (wasPlaying && timerId) { clearTimeout(timerId); timerId = null; }
  currentIdx = Math.max(0, Math.min(words.length - 1, idx));
  displayWord(words[currentIdx]);
  updateProgress();
  if (contextVisible) updateContext();
  if (wasPlaying) { state = 'playing'; scheduleNext(); }
}

// ── PROGRESS ──
function updateProgress() {
  if (!words.length) return;
  const pct = (currentIdx / words.length) * 100;
  document.getElementById('progress-fill').style.width = pct.toFixed(1) + '%';
  document.getElementById('progress-pct').textContent = pct.toFixed(1) + '%';
  document.getElementById('progress-pos').textContent = `Word ${(currentIdx+1).toLocaleString()} / ${words.length.toLocaleString()}`;
  const minsLeft = (words.length - currentIdx) / wpm;
  let timeStr;
  if (minsLeft < 1) timeStr = `~${Math.round(minsLeft*60)}s left`;
  else if (minsLeft < 60) timeStr = `~${Math.round(minsLeft)}min left`;
  else { const h = Math.floor(minsLeft/60); timeStr = `~${h}h ${Math.round(minsLeft%60)}m left`; }
  document.getElementById('progress-time').textContent = timeStr;
}

// ── CONTEXT ──
function updateContext() {
  const el = document.getElementById('context-strip');
  if (!contextVisible || !words.length) return;
  const start = Math.max(0, currentIdx - 15);
  const end = Math.min(words.length, currentIdx + 10);
  const before = words.slice(start, currentIdx).join(' ');
  const current = words[currentIdx] || '';
  const after = words.slice(currentIdx+1, end).join(' ');
  el.innerHTML = esc(before) + (before ? ' ' : '') + '<mark>' + esc(current) + '</mark>' + (after ? ' ' + esc(after) : '');
}

function toggleContext() {
  contextVisible = !contextVisible;
  const el = document.getElementById('context-strip');
  const btn = document.getElementById('context-btn');
  el.classList.toggle('visible', contextVisible);
  btn.textContent = `Context: ${contextVisible ? 'ON' : 'OFF'}`;
  if (contextVisible) updateContext();
}

// ── WPM ──
function setWPM(val) {
  wpm = Math.max(100, Math.min(1500, val));
  document.getElementById('wpm-display').textContent = wpm;
  document.getElementById('wpm-slider').value = wpm;
}
function onSlider(val) { setWPM(parseInt(val, 10)); }

// ── FONT SIZE ──
function changeFontSize(delta) {
  rsvpFontSize = Math.max(24, Math.min(80, rsvpFontSize + delta));
  document.getElementById('word-row').style.fontSize = rsvpFontSize + 'px';
}

// ── THEME ──
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
  document.getElementById('theme-btn').textContent = isLight ? '🌙' : '☀️';
  localStorage.setItem('speedread_theme', isLight ? 'dark' : 'light');
}

// ── COMPREHENSION (Pro placeholder) ──
function toggleComprehension() {
  if (!isPro()) { showUpgradeModal(); return; }
  showToast('🧠 Comprehension mode coming soon! Questions will appear after each session.');
}

// ── PERSISTENCE ──
function getStorageKey() { return `speedread_progress_${currentFile.name}_${currentFile.size}`; }
function saveProgress() {
  if (!currentFile.name) return;
  try { localStorage.setItem(getStorageKey(), JSON.stringify({ wordIdx: currentIdx, wpm, contextOn: contextVisible, timestamp: Date.now() })); } catch(e) {}
}
function loadProgress() {
  if (!currentFile.name) return null;
  try { const r = localStorage.getItem(getStorageKey()); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function startAutoSave() { stopAutoSave(); autoSaveTimer = setInterval(() => { if (state === 'playing') saveProgress(); }, 30000); }
function stopAutoSave() { if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; } }

// ── SESSION DATA ──
function saveSessionData() {
  if (!currentFile.name || !sessionStartTime) return;
  const duration = Math.round((Date.now() - sessionStartTime) / 1000);
  saveSession({
    doc_title: currentFile.name.replace(/\.[^.]+$/, ''),
    word_count: words.length,
    wpm: wpm,
    duration: duration,
    date: new Date().toISOString(),
    comprehension_score: null,
  });
  sessionStartTime = null;
  refreshHistory();
}

// ── FILE LOADING ──
async function handleFile(file) {
  if (!file) return;

  // Free tier check
  const check = checkFreeTierLimits(0);
  if (!check.allowed && check.reason === 'daily_docs') {
    showUpgradeModal(check.message);
    return;
  }

  currentFile = { name: file.name, size: file.size };
  setStatus('visible', 'Loading ' + file.name + '…');
  showReader();
  document.getElementById('book-title-text').textContent = file.name.replace(/\.[^.]+$/, '');
  state = 'loading';
  words = [];
  pageBoundaries = [];
  currentIdx = 0;
  sessionStartTime = null;

  try {
    if (file.name.toLowerCase().endsWith('.pdf')) {
      await loadPDF(file);
    } else {
      const text = await file.text();
      processText(text);
    }
  } catch(err) {
    setStatus('hidden');
    showToast('⚠️ Error loading file. Try pasting the text instead.', 5000);
    console.error(err);
  }
}

async function loadPDF(file) {
  if (typeof pdfjsLib === 'undefined') {
    setStatus('hidden');
    showToast('⚠️ PDF.js not loaded.', 5000);
    return;
  }
  const ab = await file.arrayBuffer();
  let pdf;
  try { pdf = await pdfjsLib.getDocument({ data: ab }).promise; } catch(e) {
    setStatus('hidden');
    showToast('⚠️ Could not parse PDF.', 5000);
    return;
  }
  const allWords = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    setStatus('visible', `Extracting page ${p} of ${pdf.numPages}…`);
    try {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map(i => i.str).join(' ');
      const pw = text.split(/\s+/).filter(w => w.length > 0);
      pageBoundaries.push({ page: p, startIdx: allWords.length });
      allWords.push(...pw);
    } catch(e) { pageBoundaries.push({ page: p, startIdx: allWords.length }); }
  }
  setStatus('hidden');
  processText(allWords.join(' '));
}

function processText(text) {
  words = (typeof text === 'string') ? text.split(/\s+/).filter(w => w.length > 0) : text;
  if (!pageBoundaries.length) pageBoundaries = [{ page: 1, startIdx: 0 }];

  // Free tier word limit
  const check = checkFreeTierLimits(words.length);
  if (!check.allowed && check.reason === 'word_limit') {
    showUpgradeModal(check.message);
    // Truncate to 2000 for free users
    words = words.slice(0, 2000);
  }

  incrementDailyUsage(words.length);
  currentIdx = 0;
  state = 'ready';
  setStatus('hidden');
  showIdleDisplay('Ready to read');
  updateProgress();

  const saved = loadProgress();
  if (saved && saved.wordIdx > 0) {
    offerResume(saved);
  } else {
    showToast(`📄 Loaded — ${words.length.toLocaleString()} words`);
  }
}

// ── UI ──
function showReader() {
  document.getElementById('upload-zone').style.display = 'none';
  document.getElementById('reader-zone').classList.add('active');
}

function closeBook() {
  if (state === 'playing') pause();
  if (sessionStartTime) saveSessionData();
  stopAutoSave();
  words = [];
  pageBoundaries = [];
  currentIdx = 0;
  state = 'idle';
  currentFile = { name: '', size: 0 };
  sessionStartTime = null;
  document.getElementById('upload-zone').style.display = '';
  document.getElementById('reader-zone').classList.remove('active');
  document.getElementById('book-title-text').textContent = 'Ready to read';
  setStatus('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-pct').textContent = '0%';
  document.getElementById('progress-pos').textContent = 'Word 0 / 0';
  document.getElementById('progress-time').textContent = '—';
  document.getElementById('file-input').value = '';
}

function setStatus(vis, msg) {
  const bar = document.getElementById('status-bar');
  const txt = document.getElementById('status-text');
  if (vis === 'visible') { bar.classList.add('visible'); if (msg) txt.textContent = msg; }
  else bar.classList.remove('visible');
}

// ── PASTE MODAL ──
function openPasteModal() { document.getElementById('paste-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('paste-textarea').focus(), 50); }
function closePasteModal() { document.getElementById('paste-modal').classList.add('hidden'); document.getElementById('paste-textarea').value = ''; }
function startFromPaste() {
  const text = document.getElementById('paste-textarea').value.trim();
  if (!text) { showToast('⚠️ Please paste some text first.'); return; }
  closePasteModal();
  currentFile = { name: 'pasted-text', size: text.length };
  showReader();
  document.getElementById('book-title-text').textContent = 'Pasted Text';
  processText(text);
}

// ── URL MODAL ──
function openURLModal() { document.getElementById('url-modal').classList.remove('hidden'); setTimeout(() => document.getElementById('url-input').focus(), 50); }
function closeURLModal() { document.getElementById('url-modal').classList.add('hidden'); document.getElementById('url-input').value = ''; }
async function importFromURL() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { showToast('⚠️ Please enter a URL.'); return; }
  closeURLModal();
  showReader();
  setStatus('visible', 'Fetching article…');
  document.getElementById('book-title-text').textContent = 'Loading…';

  try {
    // Use a CORS proxy or direct fetch. Direct fetch works for same-origin only.
    // In production, you'd use a serverless function to fetch and extract text.
    const resp = await fetch(url);
    const html = await resp.text();
    // Simple text extraction: strip HTML tags
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Remove scripts, styles, nav, footer
    doc.querySelectorAll('script,style,nav,footer,header,aside').forEach(el => el.remove());
    const text = (doc.querySelector('article') || doc.body).textContent.replace(/\s+/g, ' ').trim();
    const title = doc.querySelector('title')?.textContent || new URL(url).hostname;

    currentFile = { name: title, size: text.length };
    document.getElementById('book-title-text').textContent = title;
    processText(text);
  } catch(e) {
    setStatus('hidden');
    showToast('⚠️ Could not fetch URL. CORS may be blocking the request. Try pasting the text instead.', 5000);
    closeBook();
  }
}

// ── HELP ──
function openHelp() { document.getElementById('help-modal').classList.remove('hidden'); }
function closeHelp() { document.getElementById('help-modal').classList.add('hidden'); }

// ── AUTH MODAL ──
let authMode = 'login';
function handleAccountClick() {
  if (isLoggedIn()) { signOut(); }
  else { document.getElementById('auth-modal').classList.remove('hidden'); }
}
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }
function switchAuthTab(mode, btn) {
  authMode = mode;
  document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-name').style.display = mode === 'signup' ? '' : 'none';
  document.getElementById('auth-modal-title').textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
  document.querySelector('#auth-form .btn-primary').textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
}
async function handleAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showToast('⚠️ Please fill in all fields.'); return; }
  let result;
  if (authMode === 'signup') {
    const name = document.getElementById('auth-name').value.trim();
    result = await signUp(email, password, name);
  } else {
    result = await signIn(email, password);
  }
  if (result.error) { showToast('⚠️ ' + result.error.message, 4000); }
  else { closeAuthModal(); showToast('✅ Signed in!'); updateAccountUI(); }
}

// ── UPGRADE MODAL ──
function showUpgradeModal(msg) {
  if (msg) {
    document.querySelector('.upgrade-modal-content p').textContent = msg;
  }
  document.getElementById('upgrade-modal').classList.remove('hidden');
}
function closeUpgradeModal() { document.getElementById('upgrade-modal').classList.add('hidden'); }

// ── TOAST ──
function showToast(msg, duration, buttons) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const span = document.createElement('span');
  span.textContent = msg;
  toast.appendChild(span);
  if (buttons?.length) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;margin-left:auto;flex-shrink:0';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.className = b.primary ? 'btn btn-primary btn-sm' : 'btn btn-sm';
      btn.onclick = () => { removeToast(toast); b.onClick?.(); };
      wrap.appendChild(btn);
    });
    toast.appendChild(wrap);
  }
  container.appendChild(toast);
  const d = duration || (buttons ? 12000 : 3000);
  const timer = setTimeout(() => removeToast(toast), d);
  toast._timer = timer;
}
function removeToast(toast) {
  if (toast._timer) clearTimeout(toast._timer);
  toast.style.animation = 'fadeOut 0.2s ease forwards';
  setTimeout(() => toast.remove(), 220);
}

function offerResume(saved) {
  showToast(`Resume from word ${(saved.wordIdx+1).toLocaleString()}?`, 12000, [
    { label: 'Resume', primary: true, onClick: () => {
      currentIdx = saved.wordIdx;
      if (saved.wpm) setWPM(saved.wpm);
      displayWord(words[currentIdx]);
      updateProgress();
    }},
    { label: 'Start Over', onClick: () => { currentIdx = 0; displayWord(words[0]); updateProgress(); }}
  ]);
}

// ── HISTORY ──
async function refreshHistory() {
  const sessions = await loadRecentSessions(10);
  const list = document.getElementById('history-list');
  if (!sessions.length) { list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">No sessions yet</div>'; return; }
  list.innerHTML = sessions.map(s => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<div class="history-item">
      <div class="history-title">${esc(s.doc_title)}</div>
      <div class="history-meta">${s.wpm} WPM • ${s.word_count?.toLocaleString() || '?'} words • ${dateStr}</div>
    </div>`;
  }).join('');

  // Chart
  const trend = await getWPMTrend(30);
  renderWPMChart('wpm-chart', trend);
}

// ── ACCOUNT UI ──
function updateAccountUI() {
  const avatar = document.getElementById('account-avatar');
  const name = document.getElementById('account-name');
  const plan = document.getElementById('account-plan');
  const logout = document.getElementById('account-logout');

  if (isLoggedIn()) {
    const dn = getUserDisplayName();
    avatar.textContent = dn.charAt(0).toUpperCase();
    name.textContent = dn;
    const p = getUserPlan();
    plan.textContent = p.toUpperCase();
    plan.className = 'account-plan ' + (p === 'free' ? 'plan-free' : 'plan-pro');
    logout.textContent = '↪';
    logout.title = 'Sign out';
  } else {
    avatar.textContent = '?';
    name.textContent = 'Not signed in';
    plan.textContent = 'FREE';
    plan.className = 'account-plan plan-free';
    logout.textContent = '⚙';
    logout.title = 'Sign in';
  }
}

// Called by auth.js when profile loads
function onProfileLoaded(profile) { updateAccountUI(); }

// ── DRAG & DROP ──
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  // Skip if any modal is open
  const modals = ['paste-modal','url-modal','help-modal','auth-modal','upgrade-modal'];
  for (const id of modals) {
    if (!document.getElementById(id).classList.contains('hidden')) {
      if (e.key === 'Escape') document.getElementById(id).classList.add('hidden');
      return;
    }
  }
  const ctrl = e.ctrlKey || e.metaKey;
  switch(e.key) {
    case ' ': e.preventDefault(); if (state === 'ready' || state === 'paused' || state === 'playing') togglePlay(); break;
    case 'ArrowLeft': e.preventDefault(); jumpWords(ctrl ? -1000 : e.shiftKey ? -100 : -10); break;
    case 'ArrowRight': e.preventDefault(); jumpWords(ctrl ? 1000 : e.shiftKey ? 100 : 10); break;
    case 'c': case 'C': if (state !== 'idle') toggleContext(); break;
    case ',': setWPM(wpm - 25); break;
    case '.': setWPM(wpm + 25); break;
  }
});

// ── TOUCH ──
let touchStartX = 0, touchStartY = 0;
document.getElementById('rsvp-window').addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: true });
document.getElementById('rsvp-window').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { if (state === 'ready' || state === 'paused' || state === 'playing') togglePlay(); }
  else if (Math.abs(dx) > 40 && Math.abs(dy) < 60) jumpWords(dx < 0 ? 50 : -50);
}, { passive: true });

// Click outside modals
['paste-modal','url-modal','help-modal','auth-modal','upgrade-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });
});

// ── UTILS ──
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const theme = localStorage.getItem('speedread_theme');
  if (theme === 'light') { document.documentElement.setAttribute('data-theme', 'light'); document.getElementById('theme-btn').textContent = '☀️'; }

  updateAccountUI();
  refreshHistory();

  // Check for plan redirect from landing page
  const params = new URLSearchParams(window.location.search);
  const plan = params.get('plan');
  if (plan) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => openCheckout(plan), 500);
  }
});
