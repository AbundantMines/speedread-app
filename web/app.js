// ═══════════════════════════════════════════════════════════════
// SpeedRead — Main Reader Logic (app.js)
// ═══════════════════════════════════════════════════════════════

// ── STATE ──
let state = 'idle'; // idle | loading | ready | playing | paused

// Rolling buffer: [{word, timestamp}]
let wordBuffer = [];
const BUFFER_MAX_SECONDS = 120;

function addToBuffer(word) {
  const now = Date.now();
  wordBuffer.push({ word, timestamp: now });
  const cutoff = now - BUFFER_MAX_SECONDS * 1000;
  wordBuffer = wordBuffer.filter(e => e.timestamp >= cutoff);
}
let words = [];
let currentIdx = 0;
let wpm = 300;
let contextVisible = false;
let timerId = null;
let pageBoundaries = [];
let currentFile = { name: '', size: 0 };
let autoSaveTimer = null;
let sessionStartTime = null;
let rsvpFontSize = 72;

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
  addToBuffer(word);
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
    saveProgress();
    const duration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    showCompletionModal(currentFile.name.replace(/\.[^.]+$/, ''), words.length, wpm, duration);
    saveSessionData();
    stopAutoSave();
    return;
  }
  if (chunkSize > 1) {
    const chunk = getChunk(currentIdx);
    displayWord(chunk);
    updateProgress();
    if (contextVisible) updateContext();
    const delay = getChunkDelay(chunk, wpm, chunkSize);
    timerId = setTimeout(() => { currentIdx += chunkSize; scheduleNext(); }, delay);
  } else {
    const word = words[currentIdx];
    displayWord(word);
    updateProgress();
    if (contextVisible) updateContext();
    timerId = setTimeout(() => { currentIdx++; scheduleNext(); }, getWordDelay(word, wpm));
  }
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
const FONT_SIZES = { S: 48, M: 72, L: 96 };
function applyFontSize(px) {
  rsvpFontSize = px;
  const el = document.getElementById('word-row');
  if (el) el.style.fontSize = px + 'px';
  localStorage.setItem('speedread_fontsize', px);
}
function setFontSize(key) {
  applyFontSize(FONT_SIZES[key]);
  document.querySelectorAll('.size-btn').forEach(function(b) { b.classList.remove('active'); });
  const btn = document.getElementById('size-btn-' + key);
  if (btn) btn.classList.add('active');
}
function changeFontSize(delta) {
  applyFontSize(Math.max(32, Math.min(112, rsvpFontSize + delta)));
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
    } else if (file.name.toLowerCase().endsWith('.epub')) {
      setStatus('visible', 'Extracting ePub…');
      const { text, title } = await extractEpubText(file);
      if (title) document.getElementById('book-title-text').textContent = title;
      processText(text);
      showToast('📚 ePub loaded: ' + (title || file.name));
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
  const input = document.getElementById('url-input');
  const url = input.value.trim();
  if (!url || !url.startsWith('http')) { showToast('Please enter a valid URL'); return; }
  closeURLModal();
  showStatus('Fetching article…');
  showReaderZone();
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl);
    const html = await resp.text();
    const text = extractReadableText(html);
    if (text.split(' ').length < 50) {
      showToast('Could not extract readable text from this URL');
      return;
    }
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;
    currentFile = { name: title, size: text.length };
    document.getElementById('book-title-text').textContent = title;
    processText(text);
  } catch(e) {
    showToast('Could not fetch URL. Try pasting the text instead.', 4000);
    hideStatus();
  }
}

function extractReadableText(html) {
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  html = html.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  html = html.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  const text = html.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/\s{3,}/g, '\n\n').trim();
  return text;
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
  const modals = ['paste-modal','url-modal','help-modal','auth-modal','upgrade-modal','catchup-modal','completion-modal'];
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
['paste-modal','url-modal','help-modal','auth-modal','upgrade-modal','catchup-modal','completion-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });
});

// ── UTILS ──
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

// ── CATCH ME UP ──
async function catchMeUp(seconds = 30) {
  if (state === 'playing') pause();
  const cutoff = Date.now() - seconds * 1000;
  const recentWords = wordBuffer
    .filter(e => e.timestamp >= cutoff)
    .map(e => e.word)
    .join(' ');
  if (recentWords.split(' ').length < 10) {
    showToast('Not enough text to summarize yet');
    return;
  }
  showCatchUpModal('loading', seconds);
  try {
    const summary = await getSummary(recentWords, seconds);
    showCatchUpModal('result', seconds, summary);
  } catch (e) {
    showCatchUpModal('fallback', seconds, recentWords.split(' ').slice(-40).join(' ') + '...');
  }
}

async function getSummary(text, seconds) {
  const wordCount = text.split(' ').length;
  if (window.OPENAI_API_KEY) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Summarize this passage in 2-3 clear sentences. Be direct and capture the key points:\n\n${text}`
        }],
        max_tokens: 150,
        temperature: 0.3
      })
    });
    const data = await resp.json();
    return data.choices[0].message.content;
  }
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length <= 3) return text;
  return [sentences[0], sentences[Math.floor(sentences.length/2)], sentences[sentences.length-1]].join(' ');
}

function showCatchUpModal(modalState, seconds, content = '') {
  const modal = document.getElementById('catchup-modal');
  const loading = document.getElementById('catchup-loading');
  const result = document.getElementById('catchup-result');
  const title = document.getElementById('catchup-title');
  title.textContent = `Last ${seconds} seconds`;
  modal.classList.remove('hidden');
  if (modalState === 'loading') {
    loading.style.display = 'flex';
    result.style.display = 'none';
  } else {
    loading.style.display = 'none';
    result.style.display = 'block';
    result.textContent = content;
  }
}

function closeCatchUpModal(resume = false) {
  document.getElementById('catchup-modal').classList.add('hidden');
  if (resume && words.length > 0) play();
}

// ── PAUSE ON TAB SWITCH ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') {
    pause();
    showToast('⏸ Paused — tab switched');
  }
});

// ── PUBLIC DOMAIN LIBRARY (Gutendex) ──
const FEATURED_BOOKS = [
  { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' },
  { id: 11, title: 'Alice in Wonderland', author: 'Lewis Carroll' },
  { id: 2701, title: 'Moby Dick', author: 'Herman Melville' },
  { id: 1661, title: 'Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' },
  { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift' },
  { id: 76, title: 'The Adventures of Tom Sawyer', author: 'Mark Twain' },
];

async function loadLibrary() {
  const list = document.getElementById('library-list');
  if (!list) return;
  list.innerHTML = FEATURED_BOOKS.map(b => `
    <div class="library-item" onclick="openLibraryBook(${b.id}, '${b.title.replace(/'/g, "\\'")}', '${b.author.replace(/'/g, "\\'")}')">
      <div class="library-title">${b.title}</div>
      <div class="library-author">${b.author}</div>
    </div>
  `).join('');
}

async function searchLibrary(query) {
  if (query.length < 2) { loadLibrary(); return; }
  const list = document.getElementById('library-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">Searching…</div>';
  try {
    const resp = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en&mime_type=text%2Fplain`);
    const data = await resp.json();
    const books = data.results.slice(0, 8);
    if (!books.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">No results</div>';
      return;
    }
    list.innerHTML = books.map(b => {
      const author = b.authors[0]?.name?.split(',').reverse().join(' ').trim() || 'Unknown';
      return `<div class="library-item" onclick="openLibraryBook(${b.id}, '${b.title.replace(/'/g, "\\'")}', '${author.replace(/'/g, "\\'")}')">
        <div class="library-title">${b.title}</div>
        <div class="library-author">${author}</div>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">Search unavailable</div>';
  }
}

function showStatus(msg) { setStatus('visible', msg); }
function hideStatus() { setStatus('hidden'); }
function showReaderZone() { showReader(); }

async function openLibraryBook(gutenbergId, title, author) {
  showStatus(`Loading "${title}"…`);
  showReaderZone();
  try {
    const metaResp = await fetch(`https://gutendex.com/books/${gutenbergId}/`);
    const meta = await metaResp.json();
    const formats = meta.formats || {};
    const textUrl = formats['text/plain; charset=utf-8'] ||
                    formats['text/plain; charset=us-ascii'] ||
                    formats['text/plain'];
    if (!textUrl) { showToast('No text version available'); return; }
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(textUrl)}`;
    const textResp = await fetch(proxyUrl);
    const rawText = await textResp.text();
    const cleaned = stripGutenbergBoilerplate(rawText);
    currentFile = { name: `${title} — ${author}`, size: cleaned.length };
    document.getElementById('book-title-text').textContent = `${title} — ${author}`;
    processText(cleaned);
    showToast(`📚 Loaded: ${title}`);
  } catch(e) {
    console.error(e);
    showToast('Could not load book. Try another.', 3000);
    hideStatus();
  }
}

function stripGutenbergBoilerplate(text) {
  const startMatch = text.match(/\*{3}\s*START OF (THIS|THE) PROJECT GUTENBERG[^\n]*\n/i);
  if (startMatch) {
    text = text.slice(text.indexOf(startMatch[0]) + startMatch[0].length);
  }
  const endMatch = text.match(/\*{3}\s*END OF (THIS|THE) PROJECT GUTENBERG/i);
  if (endMatch) {
    text = text.slice(0, text.indexOf(endMatch[0]));
  }
  return text.trim();
}

function loadLibraryPage() {
  window.open('https://gutendex.com/books/?languages=en&mime_type=text%2Fplain', '_blank');
}

// ── CHUNK MODE ──
let chunkSize = 1;

function getChunk(startIdx) {
  return words.slice(startIdx, startIdx + chunkSize).join(' ');
}

function getChunkDelay(chunk, wpmVal, size) {
  const base = 60000 / wpmVal;
  const chunkMultiplier = size === 2 ? 1.6 : size === 3 ? 2.1 : 1.0;
  const lastWord = chunk.split(' ').pop();
  let punct = 1.0;
  if (/[.!?]/.test(lastWord)) punct = 2.5;
  else if (/[,;:]/.test(lastWord)) punct = 1.4;
  return Math.max(base * chunkMultiplier * punct, 80);
}

function setChunkSize(n) {
  chunkSize = n;
  [1,2,3].forEach(i => {
    const btn = document.getElementById('chunk' + i + '-btn');
    if (i === n) { btn.style.background = 'var(--accent)'; btn.style.color = '#000'; }
    else { btn.style.background = ''; btn.style.color = ''; }
  });
}

// ── STREAKS ──
function updateStreak() {
  const data = JSON.parse(localStorage.getItem('speedread_streak') || '{"streak":0,"lastDate":null}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === today) {
    return data.streak;
  } else if (data.lastDate === yesterday) {
    data.streak += 1;
  } else {
    data.streak = 1;
  }
  data.lastDate = today;
  localStorage.setItem('speedread_streak', JSON.stringify(data));
  return data.streak;
}

function getStreak() {
  const data = JSON.parse(localStorage.getItem('speedread_streak') || '{"streak":0,"lastDate":null}');
  return data.streak;
}

// ── COMPLETION MODAL ──
function showCompletionModal(docTitle, wordsRead, wpmAchieved, durationSeconds) {
  document.getElementById('completion-title').textContent = docTitle || 'Reading session complete';
  document.getElementById('comp-wpm').textContent = wpmAchieved;
  document.getElementById('comp-words').textContent = wordsRead.toLocaleString();
  document.getElementById('comp-time').textContent = Math.round(durationSeconds / 60);
  const streak = updateStreak();
  document.getElementById('comp-streak').textContent = streak;
  document.getElementById('streak-display').textContent = streak > 0 ? '🔥 ' + streak + ' day streak' : '';
  document.getElementById('completion-modal').classList.remove('hidden');
}

function closeCompletionModal() {
  document.getElementById('completion-modal').classList.add('hidden');
}

function shareSession() {
  const wpm = document.getElementById('comp-wpm').textContent;
  const words = document.getElementById('comp-words').textContent;
  const streak = document.getElementById('comp-streak').textContent;
  const text = `I just read ${words} words at ${wpm} WPM with SpeedRead! 🔥 ${streak} day streak. speedread.app`;
  if (navigator.share) {
    navigator.share({ text });
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
  }
}

// ── FONT SELECTION ──
function setFont(fontFamily) {
  document.getElementById('word-row').style.fontFamily = fontFamily;
  localStorage.setItem('speedread_font', fontFamily);
}

// ── SAMPLE ARTICLE ──
function loadSampleArticle() {
  const SAMPLE = `The Science of Reading Fast

Speed reading is not a myth. Research from the University of Massachusetts found that the average adult reads at 238 words per minute — about the same speed they could read at age 18. Yet humans process speech at 400 words per minute and can comprehend auditory information at 600 words per minute or faster. The gap between how fast we read and how fast we can understand is enormous.

The primary bottleneck is not comprehension speed — it's habits. Specifically, three habits slow almost every reader down: subvocalization (internally "saying" each word), regression (re-reading words already seen), and narrow visual span (fixating on one word at a time instead of processing groups).

RSVP — Rapid Serial Visual Presentation — addresses all three simultaneously. By presenting words sequentially at a controlled rate, RSVP eliminates eye movement entirely. Your eyes stay fixed in one place. Words come to you. The result: reading speed increases dramatically with no loss of comprehension, and often improved comprehension because attention is forced to stay focused rather than drift.

Studies by Rayner et al. (2016) showed that skilled readers make only 3-4 fixations per line of text, while novice readers make 7-8. Each fixation costs roughly 200-250 milliseconds. Eliminating fixations through RSVP can theoretically allow reading at 600-900 WPM while maintaining comprehension.

The key is progressive training. Trying to read at 900 WPM immediately is like trying to run a marathon without training — you'll fail and conclude it's impossible. But building speed gradually, allowing comprehension to adapt, produces lasting results. Most people double their reading speed within three weeks of consistent practice.

The practical application is significant. The average knowledge worker reads 4-5 hours per day. At 238 WPM, a 300-page book takes roughly 10 hours. At 500 WPM, that same book takes under 5 hours. At 700 WPM, under 3.5 hours. Over a year of daily reading, the compounding effect of faster reading is hundreds of hours saved — time that can be reinvested in reading more, understanding more, and knowing more.`;

  loadText(SAMPLE, 'The Science of Reading Fast');
  showToast('📰 Sample article loaded');
}

function loadText(text, title) {
  currentFile = { name: title || 'Untitled', size: text.length };
  showReader();
  document.getElementById('book-title-text').textContent = title || 'Untitled';
  processText(text);
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const theme = localStorage.getItem('speedread_theme');
  if (theme === 'light') { document.documentElement.setAttribute('data-theme', 'light'); document.getElementById('theme-btn').textContent = '☀️'; }

  updateAccountUI();
  refreshHistory();
  loadLibrary();

  // Restore font
  const savedFont = localStorage.getItem('speedread_font');
  if (savedFont) { document.getElementById('font-select').value = savedFont; setFont(savedFont); }

  // Restore & apply font size (always apply on load so it's never stuck at browser default)
  const savedSize = parseInt(localStorage.getItem('speedread_fontsize'), 10);
  if (savedSize && savedSize >= 32) {
    applyFontSize(savedSize);
    // Highlight the matching size button if it matches a preset
    const matchKey = Object.keys(FONT_SIZES).find(k => FONT_SIZES[k] === savedSize);
    if (matchKey) { document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active')); const btn = document.getElementById('size-btn-' + matchKey); if (btn) btn.classList.add('active'); }
  } else {
    applyFontSize(72);
    const btn = document.getElementById('size-btn-M');
    if (btn) btn.classList.add('active');
  }

  // Show streak
  const streakEl = document.getElementById('streak-display');
  if (streakEl) streakEl.textContent = getStreak() > 0 ? '🔥 ' + getStreak() + ' day streak' : '';

  // Check for plan redirect from landing page
  const params = new URLSearchParams(window.location.search);
  const plan = params.get('plan');
  if (plan) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => openCheckout(plan), 500);
  }
});
