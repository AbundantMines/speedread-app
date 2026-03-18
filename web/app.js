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

  // Free tier: pause at 10,000 words — show lead capture first, upgrade second
  if (!isPro() && currentIdx >= FREE_TIER_WORD_CUTOFF) {
    pause();
    if (!hasSubmittedLead()) {
      showAppLeadModal();
    } else if (isEmailTrialActive()) {
      // Trial somehow expired mid-read but isPro() missed it — shouldn't happen, safety net
    } else {
      showUpgradeModal('Your free 24-hour trial has ended. Upgrade to Pro to keep reading without limits.');
    }
    return;
  }

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

// ── JUMP TO POSITION ──
function showJumpModal() {
  const modal = document.getElementById('jump-modal');
  if (!modal) return;
  const wpp = parseInt(document.getElementById('jump-wpp')?.value) || 250;
  // Pre-fill inputs with current position (only if not already set by user)
  if (words.length && currentIdx > 0) {
    const wordInput = document.getElementById('jump-word-input');
    const pageInput = document.getElementById('jump-page-input');
    if (wordInput) wordInput.value = currentIdx + 1;
    if (pageInput) pageInput.value = Math.floor(currentIdx / wpp) + 1;
  }
  // Update word-count hint
  if (words.length) {
    const totPages = Math.ceil(words.length / wpp);
    const hint = document.getElementById('jump-word-hint');
    if (hint) hint.textContent = `Word 1 – ${words.length.toLocaleString()} · Page 1 – ${totPages.toLocaleString()}`;
  }
  modal.classList.remove('hidden');
}

function hideJumpModal() {
  const modal = document.getElementById('jump-modal');
  if (modal) modal.classList.add('hidden');
  // Clear position inputs so they re-populate with current pos on next open
  const wi = document.getElementById('jump-word-input');
  if (wi) wi.value = '';
  const pi = document.getElementById('jump-page-input');
  if (pi) pi.value = '';
  // Reset photo tab
  const fi = document.getElementById('jump-photo-input');
  if (fi) fi.value = '';
  const preview = document.getElementById('jump-photo-preview');
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  const status = document.getElementById('jump-photo-status');
  if (status) status.textContent = '';
  const btn = document.getElementById('jump-photo-btn');
  if (btn) btn.style.display = 'none';
  const drop = document.getElementById('jump-photo-drop');
  if (drop) drop.querySelector('.jump-photo-icon').style.display = '';
}

function switchJumpTab(tab) {
  ['word','page','photo'].forEach(t => {
    document.getElementById('jtab-'+t).classList.toggle('active', t === tab);
    document.getElementById('jpanel-'+t).classList.toggle('active', t === tab);
  });
}

function jumpToWord() {
  if (!words.length) { showToast('Load a document first.'); return; }
  const v = parseInt(document.getElementById('jump-word-input').value);
  if (isNaN(v) || v < 1 || v > words.length) {
    showToast(`Enter a word between 1 and ${words.length.toLocaleString()}.`);
    return;
  }
  seekTo(v - 1);
  hideJumpModal();
  showToast(`Jumped to word ${v.toLocaleString()}`);
}

function jumpToPage() {
  if (!words.length) { showToast('Load a document first.'); return; }
  const page = parseInt(document.getElementById('jump-page-input').value);
  const wpp = parseInt(document.getElementById('jump-wpp').value) || 250;
  if (isNaN(page) || page < 1) { showToast('Enter a valid page number.'); return; }
  const wordIdx = Math.min((page - 1) * wpp, words.length - 1);
  seekTo(wordIdx);
  hideJumpModal();
  showToast(`Jumped to page ${page} (~word ${(wordIdx+1).toLocaleString()})`);
}

function onJumpPhotoSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('jump-photo-preview');
  const icon = document.getElementById('jump-photo-drop').querySelector('.jump-photo-icon');
  const btn = document.getElementById('jump-photo-btn');
  const status = document.getElementById('jump-photo-status');
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.style.display = 'block';
  icon.style.display = 'none';
  status.textContent = '';
  btn.style.display = 'block';
}

async function findPageByPhoto() {
  if (!words.length) { showToast('Load a document first.'); return; }
  const fileInput = document.getElementById('jump-photo-input');
  const file = fileInput.files[0];
  if (!file) { showToast('Select a photo first.'); return; }

  const status = document.getElementById('jump-photo-status');
  const btn = document.getElementById('jump-photo-btn');
  btn.disabled = true;
  status.textContent = '⏳ Reading image…';

  try {
    // Convert to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const apiKey = window.OPENAI_API_KEY;
    if (!apiKey) {
      status.textContent = '⚠️ AI feature requires an OpenAI API key (coming soon for Pro users).';
      btn.disabled = false;
      return;
    }

    status.textContent = '🔍 Analyzing page text…';
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}`, detail: 'high' } },
            { type: 'text', text: 'Transcribe the first 60 words of body text visible on this page. Return ONLY those words exactly as written, preserving word order. Ignore headers, page numbers, captions, footnotes. Output only the transcribed words, nothing else.' }
          ]
        }]
      })
    });

    const data = await resp.json();
    const extracted = data.choices?.[0]?.message?.content?.trim();
    if (!extracted || extracted.length < 10) {
      status.textContent = '❌ Could not read text from this image. Try a clearer photo.';
      btn.disabled = false;
      return;
    }

    status.textContent = '📖 Searching document…';
    const matchIdx = fuzzyFindInDocument(extracted);

    if (matchIdx < 0) {
      status.textContent = '❌ Page not found in loaded document. Make sure the same book is loaded.';
      btn.disabled = false;
      return;
    }

    status.textContent = `✓ Found at word ${(matchIdx + 1).toLocaleString()} — jumping there…`;
    setTimeout(() => {
      seekTo(matchIdx);
      hideJumpModal();
      showToast(`📷 Found your page! Jumped to word ${(matchIdx + 1).toLocaleString()}`);
    }, 900);

  } catch (e) {
    status.textContent = '❌ Error: ' + (e.message || 'Unknown error');
    btn.disabled = false;
  }
}

function fuzzyFindInDocument(extractedText) {
  // Normalize: lowercase, strip punctuation, keep words >2 chars
  const normalize = s => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const needle = normalize(extractedText);
  if (needle.length < 5) return -1;

  const windowSize = Math.min(needle.length, 40);
  const needleSet = new Set(needle);
  const THRESHOLD = 0.40; // 40% word overlap minimum

  let bestScore = 0;
  let bestIdx = -1;

  // Slide through document in steps of 8 for performance
  for (let i = 0; i <= words.length - windowSize; i += 8) {
    const hay = normalize(words.slice(i, i + windowSize + 15).join(' '));
    let overlap = 0;
    for (const w of hay) { if (needleSet.has(w)) overlap++; }
    const score = overlap / needleSet.size;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }

  // Refine: scan ±20 words around best guess at step 1
  if (bestIdx >= 0) {
    const start = Math.max(0, bestIdx - 20);
    const end = Math.min(words.length - windowSize, bestIdx + 20);
    for (let i = start; i <= end; i++) {
      const hay = normalize(words.slice(i, i + windowSize + 5).join(' '));
      let overlap = 0;
      for (const w of hay) { if (needleSet.has(w)) overlap++; }
      const score = overlap / needleSet.size;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
  }

  return bestScore >= THRESHOLD ? bestIdx : -1;
}

function seekByProgressClick(e) {
  if (!words.length) return;
  const bar = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const idx = Math.floor(pct * words.length);
  seekTo(idx);
}

// ── PROGRESS ──
function updateProgress() {
  if (!words.length) return;
  const pct = (currentIdx / words.length) * 100;
  document.getElementById('progress-fill').style.width = pct.toFixed(1) + '%';
  document.getElementById('progress-pct').textContent = pct.toFixed(1) + '%';
  const wpp = parseInt(document.getElementById('jump-wpp')?.value) || 250;
  const curPage = Math.floor(currentIdx / wpp) + 1;
  const totPages = Math.ceil(words.length / wpp);
  document.getElementById('progress-pos').textContent = `Word ${(currentIdx+1).toLocaleString()} / ${words.length.toLocaleString()} · Pg ${curPage.toLocaleString()} / ${totPages.toLocaleString()}`;
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

  // Check daily doc limit (word cutoff is handled during playback, not at load)
  const check = checkFreeTierLimits(words.length);
  if (!check.allowed && check.reason === 'daily_docs') {
    showUpgradeModal(check.message);
    return;
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
  document.getElementById('progress-pos').textContent = 'Word 0 / 0 · Pg — / —';
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
// ── LEAD CAPTURE (app) ──
function showAppLeadModal() {
  document.getElementById('app-lead-modal')?.classList.remove('hidden');
}
function closeAppLeadModal() {
  document.getElementById('app-lead-modal')?.classList.add('hidden');
}

function submitAppLead(e) {
  e.preventDefault();
  const name  = document.getElementById('app-lead-name')?.value?.trim();
  const email = document.getElementById('app-lead-email')?.value?.trim();
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('app-lead-err').textContent = 'Please enter a valid name and email.';
    return;
  }
  document.getElementById('app-lead-err').textContent = '';
  activateEmailTrial(name, email);
  // Show success state
  document.getElementById('app-lead-form-wrap').style.display = 'none';
  document.getElementById('app-lead-success').style.display = 'block';
  updateTrialBanner();
  setTimeout(() => {
    closeAppLeadModal();
    document.getElementById('app-lead-form-wrap').style.display = '';
    document.getElementById('app-lead-success').style.display = 'none';
    document.getElementById('app-lead-name').value  = '';
    document.getElementById('app-lead-email').value = '';
    showToast(`🎉 24h Pro access unlocked, ${name.split(' ')[0]}! Read without limits.`, 5000);
  }, 1800);
}

function updateTrialBanner() {
  const banner = document.getElementById('trial-banner');
  if (!banner) return;
  if (isPro() && isEmailTrialActive()) {
    const h = getTrialHoursRemaining();
    banner.style.display = 'block';
    banner.innerHTML = `🎉 <strong>Pro Trial</strong> · ${h}h remaining`;
  } else if (isEmailTrialActive()) {
    // Same as above — isPro() should be true but just in case
    banner.style.display = 'block';
    banner.innerHTML = `🎉 <strong>Pro Trial</strong> · ${getTrialHoursRemaining()}h remaining`;
  } else {
    banner.style.display = 'none';
  }
}

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
// ── CURATED LIBRARY — ICP-optimised (public domain, Gutenberg verified) ──
const FEATURED_BOOKS = [
  // ── PHILOSOPHY ──
  {
    id: 2680, title: 'Meditations', author: 'Marcus Aurelius',
    genre: 'philosophy',
    desc: 'The private journal of a Roman emperor. Read daily by executives and generals for 2,000 years. Probably the highest signal-per-page ratio of anything ever written.'
  },
  {
    id: 10661, title: 'Discourses of Epictetus', author: 'Epictetus',
    genre: 'philosophy',
    desc: 'Stoic operating manual for what you control vs. what you don\'t. The slave-turned-philosopher whose students ran empires.'
  },
  {
    id: 150, title: 'The Republic', author: 'Plato',
    genre: 'philosophy',
    desc: 'The original framework for justice, governance, and what makes a society function. Still the foundation of every serious political conversation.'
  },
  {
    id: 5116, title: 'Pragmatism', author: 'William James',
    genre: 'philosophy',
    desc: 'Truth is what works. James built the philosophy that made America: results over doctrine, action over theory. Essential for operators.'
  },
  {
    id: 4363, title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche',
    genre: 'philosophy',
    desc: 'The most challenging critique of conventional morality ever written. Forces you to interrogate every assumption you didn\'t know you had.'
  },

  // ── ECONOMICS ──
  {
    id: 3300, title: 'The Wealth of Nations', author: 'Adam Smith',
    genre: 'economics',
    desc: 'The source code of modern capitalism. Written in 1776, still explains more of the world than most economists want to admit.'
  },
  {
    id: 67363, title: 'The Theory of Moral Sentiments', author: 'Adam Smith',
    genre: 'economics',
    desc: 'Smith\'s real masterwork — on empathy, markets, and why rational self-interest alone doesn\'t explain human cooperation. The book he was proudest of.'
  },
  {
    id: 833, title: 'The Theory of the Leisure Class', author: 'Thorstein Veblen',
    genre: 'economics',
    desc: 'Where status signaling, conspicuous consumption, and social capital were first mapped. Every luxury brand, every prestige purchase — predicted here in 1899.'
  },
  {
    id: 59844, title: 'The Science of Getting Rich', author: 'Wallace D. Wattles',
    genre: 'economics',
    desc: 'The 1910 original behind most modern wealth philosophy. Sharper and less padded than its descendants. 100 pages. No filler.'
  },
  {
    id: 8581, title: 'The Art of Money Getting', author: 'P.T. Barnum',
    genre: 'economics',
    desc: '1880 business principles from the man who invented the modern entertainment industry. Turns out Barnum had more to teach than just the circus.'
  },

  // ── STRATEGY ──
  {
    id: 132, title: 'The Art of War', author: 'Sun Tzu',
    genre: 'strategy',
    desc: '500 BC. Still the operating system behind every serious competitive framework in business, politics, and investing. 13 chapters. No waste.'
  },
  {
    id: 1232, title: 'The Prince', author: 'Niccolò Machiavelli',
    genre: 'strategy',
    desc: 'The unfiltered manual on power, leadership, and political reality. Written in 1513 for a Medici prince. Still taught at West Point and Harvard.'
  },
  {
    id: 14033, title: 'Plutarch\'s Lives, Vol. 1', author: 'Plutarch',
    genre: 'strategy',
    desc: 'Parallel biographies of the greatest Greeks and Romans — how they rose, led, and fell. The book that shaped Washington, Napoleon, and Jefferson.'
  },

  // ── BIOGRAPHIES ──
  {
    id: 20203, title: 'Autobiography of Benjamin Franklin', author: 'Benjamin Franklin',
    genre: 'biographies',
    desc: 'Scientist, inventor, diplomat, founder, printer, entrepreneur. Franklin wrote his own manual on becoming exceptional. One of the most practical memoirs ever written.'
  },
  {
    id: 17976, title: 'Autobiography of Andrew Carnegie', author: 'Andrew Carnegie',
    genre: 'biographies',
    desc: 'Immigrant arrives penniless. Builds the largest steel empire in history. Gives it all away. First-person account of what compounding ambition actually looks like.'
  },
  {
    id: 14033, title: 'Lives of the Noble Romans', author: 'Plutarch',
    genre: 'biographies',
    desc: 'Caesar, Cicero, Brutus, Pompey — their decisions under pressure, in their own moment. The biography format that invented the genre.'
  },

  // ── PSYCHOLOGY ──
  {
    id: 66048, title: 'The Interpretation of Dreams', author: 'Sigmund Freud',
    genre: 'psychology',
    desc: 'The book that created modern psychology. Whether or not you buy the theory, the framework for understanding unconscious motivation is irreplaceable.'
  },
  {
    id: 621, title: 'The Varieties of Religious Experience', author: 'William James',
    genre: 'psychology',
    desc: 'The most rigorous empirical study of belief, consciousness, and transformation ever attempted. Why high-performers often report the same internal experiences.'
  },
];

let _activeLibraryGenre = 'all';

function renderBookList(books) {
  const list = document.getElementById('library-list');
  if (!list) return;
  if (!books.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:10px 0">No books in this category yet.</div>';
    return;
  }
  list.innerHTML = books.map(b => {
    const safeTitle = b.title.replace(/'/g, "\\'");
    const safeAuthor = b.author.replace(/'/g, "\\'");
    const genreLabels = { philosophy:'🧠 Philosophy', economics:'📈 Economics', strategy:'⚔️ Strategy', biographies:'🏆 Biographies', psychology:'🧬 Psychology' };
    const tag = b.genre && _activeLibraryGenre === 'all' ? `<div class="library-genre-tag">${genreLabels[b.genre] || b.genre}</div>` : '';
    const desc = b.desc ? `<div class="library-desc">${b.desc}</div>` : '';
    return `<div class="library-item" onclick="openLibraryBook(${b.id}, '${safeTitle}', '${safeAuthor}')">
      ${tag}
      <div class="library-title">${b.title}</div>
      <div class="library-author">${b.author}</div>
      ${desc}
    </div>`;
  }).join('');
}

function loadLibrary() {
  _activeLibraryGenre = 'all';
  const books = FEATURED_BOOKS.filter((b, i, arr) =>
    arr.findIndex(x => x.id === b.id) === i  // dedupe by ID
  );
  renderBookList(books);
}

function filterLibrary(genre, chipEl) {
  _activeLibraryGenre = genre;
  // Update chip active state
  document.querySelectorAll('.lib-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  // Clear search
  const searchEl = document.getElementById('library-search');
  if (searchEl) searchEl.value = '';
  // Filter and render
  const books = genre === 'all'
    ? FEATURED_BOOKS.filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i)
    : FEATURED_BOOKS.filter(b => b.genre === genre);
  renderBookList(books);
}

async function searchLibrary(query) {
  if (query.length < 2) { loadLibrary(); return; }
  // Clear active chip on search
  document.querySelectorAll('.lib-chip').forEach(c => c.classList.remove('active'));
  const list = document.getElementById('library-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">Searching…</div>';
  try {
    const resp = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}&languages=en&mime_type=text%2Fplain`);
    const data = await resp.json();
    const books = data.results.slice(0, 10);
    if (!books.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">No results — try a different title or author</div>';
      return;
    }
    list.innerHTML = books.map(b => {
      const author = b.authors[0]?.name?.split(',').reverse().join(' ').trim() || 'Unknown';
      const safeTitle = b.title.replace(/'/g, "\\'");
      const safeAuthor = author.replace(/'/g, "\\'");
      // Use our curated description if this book is in FEATURED_BOOKS
      const featured = FEATURED_BOOKS.find(f => f.id === b.id);
      const descHtml = featured?.desc ? `<div class="library-desc">${featured.desc}</div>` : '';
      return `<div class="library-item" onclick="openLibraryBook(${b.id}, '${safeTitle}', '${safeAuthor}')">
        <div class="library-title">${b.title}</div>
        <div class="library-author">${author}</div>
        ${descHtml}
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px">Search unavailable</div>';
  }
}

function showStatus(msg) { setStatus('visible', msg); }
function hideStatus() { setStatus('hidden'); }
function showReaderZone() { showReader(); }

// Fetch with timeout helper
async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

// Try multiple CORS proxies in order until one works
async function fetchTextViaProxy(textUrl) {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(textUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(textUrl)}`,
    `https://cors-anywhere.herokuapp.com/${textUrl}`,
  ];
  let lastErr;
  for (const proxyUrl of proxies) {
    try {
      const resp = await fetchWithTimeout(proxyUrl, 9000);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (text.length < 500) throw new Error('Response too short');
      return text;
    } catch(e) {
      lastErr = e;
      console.warn(`Proxy failed (${proxyUrl.slice(0, 40)}…):`, e.message);
    }
  }
  throw lastErr || new Error('All proxies failed');
}

async function openLibraryBook(gutenbergId, title, author) {
  showStatus(`Loading "${title}"…`);
  showReaderZone();
  try {
    // Fetch metadata with timeout
    const metaResp = await fetchWithTimeout(`https://gutendex.com/books/${gutenbergId}/`);
    if (!metaResp.ok) throw new Error(`Metadata fetch failed: ${metaResp.status}`);
    const meta = await metaResp.json();
    const formats = meta.formats || {};
    const textUrl = formats['text/plain; charset=utf-8'] ||
                    formats['text/plain; charset=us-ascii'] ||
                    formats['text/plain'];
    if (!textUrl) {
      showToast('⚠️ No plain text version available for this book.', 4000);
      hideStatus();
      return;
    }

    showStatus(`Fetching "${title}" text…`);
    const rawText = await fetchTextViaProxy(textUrl);
    const cleaned = stripGutenbergBoilerplate(rawText);

    currentFile = { name: `${title} — ${author}`, size: cleaned.length };
    document.getElementById('book-title-text').textContent = `${title} — ${author}`;
    processText(cleaned);
    showToast(`📚 Loaded: ${title}`);
  } catch(e) {
    console.error('openLibraryBook error:', e);
    if (e.name === 'AbortError') {
      showToast('⏱ Request timed out. Check your connection and try again.', 4000);
    } else {
      showToast('⚠️ Could not load book — try again or paste the text directly.', 4000);
    }
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
  updateTrialBanner();
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
