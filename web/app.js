// ═══════════════════════════════════════════════════════════════
// Warpreader — Main Reader Logic (app.js)
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
let wpm = parseInt(localStorage.getItem('speedread_preferred_wpm'), 10) || 300;
let contextVisible = false;
let timerId = null;
let pageBoundaries = [];
let sessionWordsRead = 0; // words read in current play session

// ── PAGE BOUNDARY HELPERS ──
// Returns the PDF page number for a given word index (binary search)
function getPageFromWordIdx(idx) {
  if (!pageBoundaries.length) return null;
  let lo = 0, hi = pageBoundaries.length - 1, result = pageBoundaries[0].page;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pageBoundaries[mid].startIdx <= idx) { result = pageBoundaries[mid].page; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}

// Returns the word index for the start of a given PDF page number
function getWordIdxFromPage(pageNum) {
  if (!pageBoundaries.length) return null;
  const entry = pageBoundaries.find(b => b.page === pageNum);
  return entry != null ? entry.startIdx : null;
}

// Total pages: from pageBoundaries if PDF, else estimate from wpp
function getTotalPages(wpp) {
  if (pageBoundaries.length) return pageBoundaries[pageBoundaries.length - 1].page;
  return Math.ceil(words.length / (wpp || 250));
}
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
  // Phase 1 hooks
  savePositionToLibrary();
  const sw = typeof sessionWordsRead !== 'undefined' ? sessionWordsRead : 0;
  if (sw > 200) {
    logReadingActivity(sw);
    const newStreak = updateStreakFull();
    updateXP(sw);
    const xpGained = Math.floor(sw / 100);
    showToast(`⏸ Paused · +${xpGained} XP · 🔥 ${newStreak.current} day streak`, 3000);
    sessionWordsRead = 0;
  }
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
    // Phase 1: book finished hooks
    logReadingActivity(sessionWordsRead || 0);
    updateStreakFull();
    updateXP(sessionWordsRead || 0);
    savePositionToLibrary();
    sessionWordsRead = 0;
    // Offer share card
    setTimeout(() => {
      if (confirm('🎉 Book finished! Generate your reading stats card?')) generateShareCard();
    }, 3500);
    return;
  }
  if (chunkSize > 1) {
    const chunk = getChunk(currentIdx);
    displayWord(chunk);
    updateProgress();
    if (contextVisible) updateContext();
    sessionWordsRead += chunkSize;
    const delay = getChunkDelay(chunk, wpm, chunkSize);
    timerId = setTimeout(() => { currentIdx += chunkSize; scheduleNext(); }, delay);
  } else {
    const word = words[currentIdx];
    displayWord(word);
    updateProgress();
    if (contextVisible) updateContext();
    sessionWordsRead += 1;
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
    if (pageInput) {
      const currentPage = pageBoundaries.length
        ? getPageFromWordIdx(currentIdx)
        : Math.floor(currentIdx / wpp) + 1;
      pageInput.value = currentPage;
    }
  }
  // Update word-count / page hint
  if (words.length) {
    const totPages = getTotalPages(wpp);
    const isPdfPages = pageBoundaries.length > 0;
    const hint = document.getElementById('jump-word-hint');
    if (hint) hint.textContent = `Word 1 – ${words.length.toLocaleString()} · Page 1 – ${totPages.toLocaleString()}${isPdfPages ? ' (PDF pages)' : ' (estimated)'}`;

    // Show/hide the wpp control — only useful for plain-text estimation
    const wppRow = document.getElementById('jump-wpp-row');
    if (wppRow) wppRow.style.display = isPdfPages ? 'none' : '';
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
  if (isNaN(page) || page < 1) { showToast('Enter a valid page number.'); return; }

  let wordIdx;
  if (pageBoundaries.length) {
    // PDF: use exact page boundaries
    const idx = getWordIdxFromPage(page);
    if (idx === null) {
      const maxPage = pageBoundaries[pageBoundaries.length - 1].page;
      showToast(`Page must be between 1 and ${maxPage}.`);
      return;
    }
    wordIdx = idx;
  } else {
    // Plain text: estimate from words-per-page
    const wpp = parseInt(document.getElementById('jump-wpp').value) || 250;
    wordIdx = Math.min((page - 1) * wpp, words.length - 1);
  }

  seekTo(wordIdx);
  hideJumpModal();
  showToast(`Jumped to page ${page} (word ${(wordIdx+1).toLocaleString()})`);
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
  const curPage  = pageBoundaries.length ? getPageFromWordIdx(currentIdx) : Math.floor(currentIdx / wpp) + 1;
  const totPages = getTotalPages(wpp);
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
  // Persist as user's preferred speed — restored on next session/document
  try { localStorage.setItem('speedread_preferred_wpm', wpm); } catch(_) {}
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

  // Save WPM to server (fire-and-forget)
  if (wpm >= 50 && duration >= 30) {
    const userId = (typeof currentUser !== 'undefined' && currentUser?.id) || null;
    const anonId = localStorage.getItem('wr_anon_id') || (() => {
      const id = 'anon_' + Math.random().toString(36).slice(2);
      try { localStorage.setItem('wr_anon_id', id); } catch (_) {}
      return id;
    })();
    fetch('/api/wpm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, anonId, wpm, percentile: null, source: 'session' }),
    }).catch(() => {});
  }

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
    if (err.message === 'DRM_PROTECTED') {
      document.getElementById('drm-modal').classList.remove('hidden');
    } else {
      showToast('⚠️ Error loading file. Try pasting the text instead.', 5000);
    }
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
  // Apply academic citation stripping if mode is on
  if (typeof text === 'string' && isAcademicMode()) {
    text = stripAcademicCitations(text);
  }
  words = (typeof text === 'string') ? text.split(/\s+/).filter(w => w.length > 0) : text;
  if (!pageBoundaries.length) pageBoundaries = [{ page: 1, startIdx: 0 }];
  if (typeof wrTrack === 'function') wrTrack('doc_loaded', { word_count: words.length, wpm_current: wpm });

  // Check daily doc limit (word cutoff is handled during playback, not at load)
  const check = checkFreeTierLimits(words.length);
  if (!check.allowed && check.reason === 'daily_docs') {
    showUpgradeModal(check.message);
    return;
  }

  incrementDailyUsage(words.length);
  currentIdx = 0;
  sessionWordsRead = 0;
  state = 'ready';
  setStatus('hidden');
  showIdleDisplay('Ready to read');
  updateProgress();

  // Soft email capture — show 3s after file load, only once per session
  if (!isPro() && !hasSubmittedLead() && !sessionStorage.getItem('lead_prompt_shown')) {
    sessionStorage.setItem('lead_prompt_shown', '1');
    setTimeout(() => {
      if (!hasSubmittedLead()) showSoftLeadPrompt();
    }, 3000);
  }

  const saved = loadProgress();
  if (saved && saved.wordIdx > 0) {
    offerResume(saved);
  } else {
    showToast(`📄 Loaded — ${words.length.toLocaleString()} words`);
  }
  // Offer save to library for logged-in users (not for course content)
  if (isLoggedIn && typeof isLoggedIn === 'function' && isLoggedIn() && currentFile.name && !currentFile._courseContent) {
    const lib = getLocalLibrary();
    const alreadySaved = lib.some(b => b.title === currentFile.name);
    if (!alreadySaved) {
      setTimeout(() => {
        showToast(`Save "${currentFile.name.slice(0,30)}" to My Books?`, 8000, [
          { label: 'Save →', primary: true, onClick: () => {
            const rawText = words.join(' ');
            saveBookToLibrary(currentFile.name, currentFile.name, rawText, words.length).then(id => {
              if (id) { currentFile.libraryId = id; showToast('📚 Saved to My Books!'); }
            });
          }},
          { label: 'Skip', onClick: () => {} }
        ]);
      }, 1500);
    } else {
      // Already saved — set libraryId
      const existing = lib.find(b => b.title === currentFile.name);
      if (existing) currentFile.libraryId = existing.id;
    }
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
// ── SOFT LEAD PROMPT (fires 3s after first file upload) ──
function showSoftLeadPrompt() {
  // Show as a toast-style banner, not a blocking modal
  const existing = document.getElementById('soft-lead-prompt');
  if (existing) return;
  const div = document.createElement('div');
  div.id = 'soft-lead-prompt';
  div.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:16px 20px;box-shadow:0 4px 24px rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;gap:14px;max-width:460px;width:calc(100% - 40px);animation:slideUp .4s ease';
  div.innerHTML = `
    <div style="flex:1">
      <div style="font-weight:700;font-size:.95rem;margin-bottom:3px">💾 Save your reading progress</div>
      <div style="font-size:.82rem;color:var(--text-muted)">Enter email to sync your position across devices</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="email" id="soft-lead-email" placeholder="your@email.com" autocomplete="email"
          style="flex:1;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:.85rem">
        <button onclick="submitSoftLead()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:.85rem">Save</button>
      </div>
    </div>
    <button onclick="document.getElementById('soft-lead-prompt').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px;flex-shrink:0" title="Dismiss">✕</button>
  `;
  document.body.appendChild(div);
  if (typeof wrTrack === 'function') wrTrack('soft_lead_shown', {});
}

function submitSoftLead() {
  const email = document.getElementById('soft-lead-email')?.value?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('soft-lead-email')?.focus();
    return;
  }
  activateEmailTrial('Reader', email);
  document.getElementById('soft-lead-prompt')?.remove();
  updateTrialBanner();
  showToast(`✅ Saved! Your progress will sync across devices.`, 4000);
  if (typeof wrTrack === 'function') wrTrack('soft_lead_submitted', { source: 'post_upload' });
}

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

// ── FEEDBACK ──
const FEEDBACK_ENDPOINT = null; // set to your endpoint when ready (same as LEAD_ENDPOINT)
let _feedbackCat    = 'bug';
let _feedbackRating = 0;

function showFeedbackModal() {
  const modal = document.getElementById('feedback-modal');
  if (!modal) return;
  // Pre-fill email from stored lead if available
  const lead = getStoredLead?.();
  const emailEl = document.getElementById('feedback-email');
  if (emailEl && lead?.email && !emailEl.value) emailEl.value = lead.email;
  modal.classList.remove('hidden');
}

function closeFeedbackModal() {
  document.getElementById('feedback-modal')?.classList.add('hidden');
  // Reset for next open
  setTimeout(() => {
    document.getElementById('feedback-form-wrap').style.display = '';
    document.getElementById('feedback-success').style.display = 'none';
    document.getElementById('feedback-text').value = '';
    document.getElementById('feedback-err').textContent = '';
    _feedbackRating = 0;
    document.querySelectorAll('.fb-star').forEach(s => s.classList.remove('lit'));
    // Reset category to first
    _feedbackCat = 'bug';
    document.querySelectorAll('.fb-cat').forEach((c, i) => c.classList.toggle('active', i === 0));
  }, 300);
}

function setFeedbackCat(el, cat) {
  _feedbackCat = cat;
  document.querySelectorAll('.fb-cat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function setFeedbackRating(val) {
  _feedbackRating = val;
  document.querySelectorAll('.fb-star').forEach(s => {
    s.classList.toggle('lit', parseInt(s.dataset.v) <= val);
  });
}

function submitFeedback() {
  const text = document.getElementById('feedback-text').value.trim();
  const err  = document.getElementById('feedback-err');
  if (!text) { err.textContent = 'Please write something first.'; return; }
  err.textContent = '';

  const entry = {
    category: _feedbackCat,
    rating:   _feedbackRating || null,
    text,
    email:    document.getElementById('feedback-email').value.trim() || null,
    wpm:      wpm || null,
    doc:      document.getElementById('book-title-text')?.textContent || null,
    ts:       new Date().toISOString(),
    ua:       navigator.userAgent.slice(0, 120),
  };

  // Persist locally
  try {
    const all = JSON.parse(localStorage.getItem('speedread_feedback') || '[]');
    all.unshift(entry);
    localStorage.setItem('speedread_feedback', JSON.stringify(all.slice(0, 50)));
  } catch (_) {}

  // Fire to backend if configured
  if (FEEDBACK_ENDPOINT) {
    fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, source: 'speedread_feedback' })
    }).catch(() => {});
  }

  // Show success
  document.getElementById('feedback-form-wrap').style.display = 'none';
  document.getElementById('feedback-success').style.display = 'block';
  setTimeout(closeFeedbackModal, 2200);
}

function showUpgradeModal(msg) {
  if (typeof wrTrack === 'function') wrTrack('upgrade_modal_shown', { reason: msg ? msg.slice(0, 80) : 'manual' });
  const pEl = document.getElementById('upgrade-modal-msg');
  const h2El = document.getElementById('upgrade-modal-title');
  if (msg) {
    if (pEl) pEl.textContent = msg;
    if (h2El) h2El.textContent = 'Keep reading — upgrade to Pro';
  } else {
    // Default: contextual copy based on reading progress
    const pagesRead = Math.ceil((currentIdx || 0) / 250);
    if (h2El && pagesRead > 2) {
      h2El.textContent = `You've read ${pagesRead} pages. Don't lose your place.`;
    }
    if (pEl) pEl.innerHTML = 'Upgrade to Pro to save every book, track your WPM, and read without limits.<br><small style="color:var(--accent)">📚 Unlimited library · 📈 WPM tracking · 🔁 Never lose your place</small>';
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
function onProfileLoaded(profile) {
  updateAccountUI();
  // Refresh chart — now has server data available
  refreshHistory();
}

// ── DRAG & DROP ──
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  // Skip if any modal is open
  const modals = ['paste-modal','url-modal','help-modal','auth-modal','upgrade-modal','catchup-modal','completion-modal','mybooks-modal','course-modal','quiz-modal','share-modal','drm-modal'];
  for (const id of modals) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      if (e.key === 'Escape') el.classList.add('hidden');
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
['paste-modal','url-modal','help-modal','auth-modal','upgrade-modal','catchup-modal','completion-modal','mybooks-modal','course-modal','quiz-modal','share-modal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });
});

// ── UTILS ──
function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

// ── CATCH ME UP ──
// ── TEXT CLEANING ──
// Strips PDF extraction artifacts before summarising:
//   • Standalone page numbers and chapter/section headers
//   • Broken hyphenation (e.g. "commer - cially" → "commercially")
//   • Consecutive duplicate words (e.g. "designs, designs" → "designs")
//   • Leading/trailing noise words and excessive whitespace
//   • Academic: footnotes, running headers, bibliography sections, ligature artifacts
function cleanExtractedText(raw) {
  let t = raw;

  // 0. Fix ligature artifacts from PDF extraction
  t = t.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
       .replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl');

  // 0b. Remove bibliography/references section (everything after a standalone header)
  t = t.replace(/(\n|^)(References|Bibliography|Works Cited|Notes)\s*(\n|$)[\s\S]*/i, '');

  // 0c. Remove full footnote blocks: lines starting with ¹²³ superscripts or [1] patterns
  t = t.replace(/^[\u00B9\u00B2\u00B3\u2070-\u2079\u00B9]+\s+.+$/gm, '');
  t = t.replace(/^\[\d+(?:,\s*\d+)*\]\s+.+$/gm, '');

  // 0d. Remove running headers/footers: repeated short lines (< 6 words) appearing 2+ times
  const lines = t.split('\n');
  const lineCount = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.split(/\s+/).length < 6) {
      lineCount[trimmed] = (lineCount[trimmed] || 0) + 1;
    }
  }
  const repeatedLines = new Set(Object.keys(lineCount).filter(l => lineCount[l] >= 2));
  t = lines.filter(line => !repeatedLines.has(line.trim())).join('\n');

  // 0e. Remove standalone page numbers: bare numbers, "— 248 —", "p. 248", "pp. 45–67"
  t = t.replace(/^[\s\u2014\-]*\d{1,4}[\s\u2014\-]*$/gm, '');          // bare / em-dash wrapped
  t = t.replace(/\bpp?\.\s*\d+(?:[–\-]\d+)?/g, '');                     // p. 248 / pp. 45–67
  t = t.replace(/\u2014\s*\d{1,4}\s*\u2014/g, '');                      // — 248 —

  // 0f. Remove inline footnote reference markers mid-sentence
  //     Superscript unicode: ¹²³⁴⁵⁶⁷⁸⁹⁰, bracketed numbers [1], [2,3], symbols *, †, ‡
  t = t.replace(/[\u00B9\u00B2\u00B3\u2074-\u2079\u2070]+/g, '');       // superscript digits
  t = t.replace(/\[(\d+(?:[,\s]\d+)*)\]/g, '');                         // [1], [2,3]
  t = t.replace(/(?<=\S)[*†‡]/g, '');                                    // mid-sentence symbols

  // 1. Fix soft-hyphen line breaks: "word -\s*word2" → "wordword2"
  //    Handles both "commer - cially" and "some-\nthing"
  t = t.replace(/(\w+)\s*-\s+([a-z])/g, '$1$2');

  // 2. Remove page-number artifacts:
  //    Patterns like "248 Chapter 5", "Page 12", bare numbers on their own
  t = t.replace(/\b(Page|Chapter|Section|Part|Figure|Table|Appendix)\s+\d+[\w.]*/gi, '');
  t = t.replace(/\b\d{1,4}\s+(Chapter|Section|Part)\b/gi, '');
  // Standalone integers that aren't part of a sentence (preceded/followed by spaces or punctuation)
  t = t.replace(/(^|\s)\d{1,4}(\s|$)/g, ' ');

  // 3. Remove consecutive duplicate words/phrases (handles "designs, designs")
  t = t.replace(/\b(\w[\w']*)(,?\s+\1)+\b/gi, '$1');

  // 4. Collapse multiple spaces, strip leading/trailing whitespace
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/\s{2,}/g, ' ').trim();

  return t;
}

// ── ACADEMIC MODE ──
// Strips citation noise for academic readers.
// Toggle persisted in localStorage key "academicMode".

function isAcademicMode() {
  return localStorage.getItem('academicMode') === 'true';
}

function toggleAcademicMode() {
  const next = !isAcademicMode();
  localStorage.setItem('academicMode', next ? 'true' : 'false');
  updateAcademicBtn();
}

function updateAcademicBtn() {
  const btn = document.getElementById('academic-mode-btn');
  if (!btn) return;
  if (isAcademicMode()) {
    btn.style.background = '#f97316';
    btn.style.color = '#fff';
    btn.style.borderColor = '#f97316';
    btn.title = 'Academic Mode: ON — citations stripped';
  } else {
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.title = 'Academic Mode: OFF — click to strip citations';
  }
}

function stripAcademicCitations(text) {
  let t = text;

  // Parenthetical citations with author name(s) + year
  // (Smith, 2019), (Jones et al., 2021), (Smith & Jones, 2019, pp. 45-67)
  t = t.replace(/\((?:see\s+|cf\.\s+)?[A-Z][a-záéíóú\-]+(?:\s+(?:&|and|et)\s+(?:al\.|[A-Z][a-z]+))*(?:,?\s*et al\.)?(?:,\s*\d{4}(?:[,\s]+pp?\.\s*\d+(?:[–\-]\d+)?)?)?\)/g, '');

  // (ibid.), (op. cit.), (loc. cit.)
  t = t.replace(/\((?:ibid|op\. cit|loc\. cit)\.?\)/gi, '');

  // Numbered references: [1], [2], [1, 2, 3], [1-4]
  t = t.replace(/\[\d+(?:[,\-]\s*\d+)*\]/g, '');

  // "et al." standalone
  t = t.replace(/\bet al\.\s*/g, '');

  // DOI references: doi:10.xxxx/xxxxx
  t = t.replace(/\bdoi:\S+/gi, '');

  // Collapse extra whitespace left by removals
  t = t.replace(/\s{2,}/g, ' ').trim();

  return t;
}

// ── FALLBACK SUMMARY (no API key) ──
// Extracts the most coherent complete sentences from cleaned text.
// Prefers: first sentence + a middle sentence + last sentence.
function buildFallbackSummary(cleanText, seconds) {
  const sentences = cleanText.match(/[A-Z][^.!?]{15,}[.!?]/g) || [];
  if (sentences.length === 0) {
    // Last resort: first 60 words
    return cleanText.split(' ').slice(0, 60).join(' ') + '…';
  }
  if (sentences.length <= 3) return sentences.join(' ');
  // Pick beginning, middle, end for good coverage
  const picks = [
    sentences[0],
    sentences[Math.floor(sentences.length / 2)],
    sentences[sentences.length - 1]
  ];
  return picks.join(' ');
}

async function catchMeUp(seconds = 30) {
  if (state === 'playing') pause();
  const cutoff = Date.now() - seconds * 1000;
  const rawWords = wordBuffer
    .filter(e => e.timestamp >= cutoff)
    .map(e => e.word)
    .join(' ');
  if (rawWords.split(' ').length < 10) {
    showToast('Not enough text to summarize yet');
    return;
  }
  const cleanText = cleanExtractedText(rawWords);
  showCatchUpModal('loading', seconds);
  try {
    const summary = await getSummary(cleanText, seconds);
    showCatchUpModal('result', seconds, summary);
  } catch (e) {
    showCatchUpModal('result', seconds, buildFallbackSummary(cleanText, seconds));
  }
}

async function getSummary(cleanText, seconds) {
  const maxTokens = seconds >= 60 ? 200 : 130;
  if (window.OPENAI_API_KEY) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a reading assistant helping a speed reader recall what they just read. Write a concise, clear recap — not a summary of the whole book, just the specific ideas in this passage. Use plain language. 2-3 sentences maximum. Ignore any stray numbers, page references, or formatting artifacts in the source text.'
          },
          {
            role: 'user',
            content: `The reader just covered this passage at speed. Write a recap that captures the key ideas clearly:\n\n${cleanText}`
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.25
      })
    });
    const data = await resp.json();
    if (data.choices && data.choices[0]) return data.choices[0].message.content.trim();
    throw new Error('bad response');
  }
  return buildFallbackSummary(cleanText, seconds);
}

function showCatchUpModal(modalState, seconds, content = '') {
  const modal = document.getElementById('catchup-modal');
  const loading = document.getElementById('catchup-loading');
  const result = document.getElementById('catchup-result');
  const title = document.getElementById('catchup-title');
  title.textContent = `What you just read${seconds === 30 ? ' (30s)' : ' (60s)'}`;
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
  if (typeof wrTrack === 'function') wrTrack('session_complete', {
    words_read: wordsRead, wpm: wpmAchieved, duration_sec: Math.round(durationSeconds)
  });
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
  const text = `I just read ${words} words at ${wpm} WPM with Warpreader! 🔥 ${streak} day streak. warpreader.com`;
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

function loadText(text, title, opts) {
  currentFile = { name: title || 'Untitled', size: text.length, _courseContent: !!(opts && opts.isCourse) };
  showReader();
  document.getElementById('book-title-text').textContent = title || 'Untitled';
  processText(text);
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 FEATURES: Library · Streak/Levels · Course · Comprehension · Share
// ══════════════════════════════════════════════════════════════════════════════

// ── FEATURE 1: MY BOOKS LIBRARY (IndexedDB + Supabase) ──

const IDB_NAME = 'warpreader', IDB_STORE = 'documents';
let _idb = null;

function openIDB() {
  return new Promise((res, rej) => {
    if (_idb) return res(_idb);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror = () => rej(req.error);
  });
}

async function saveDocToIDB(id, text) {
  const db = await openIDB();
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ id, text });
    tx.oncomplete = () => res();
  });
}

async function getDocFromIDB(id) {
  const db = await openIDB();
  return new Promise((res) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(id);
    req.onsuccess = () => res(req.result ? req.result.text : null);
  });
}

function getLocalLibrary() {
  try { return JSON.parse(localStorage.getItem('wr_library') || '[]'); } catch { return []; }
}

async function getLibraryCount() {
  return getLocalLibrary().length;
}

async function saveBookToLibrary(title, fileName, text, wordCount) {
  if (!isPro()) {
    const count = await getLibraryCount();
    if (count >= 3) {
      showToast('Free plan: 3 books max. Upgrade to Pro for unlimited.', 4000);
      showUpgradeModal();
      return null;
    }
  }
  const id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  await saveDocToIDB(id, text);
  if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
    try {
      await supabaseClient.from('documents').insert({
        user_id: currentUser.id,
        title,
        file_name: fileName,
        word_count: wordCount,
        last_position: 0
      });
    } catch(e) { console.warn('Library sync error:', e); }
  }
  const lib = getLocalLibrary();
  lib.push({ id, title, fileName, wordCount, lastPosition: 0, lastReadAt: null, createdAt: Date.now() });
  localStorage.setItem('wr_library', JSON.stringify(lib));
  updateLevelBadge();
  return id;
}

async function loadBookFromLibrary(id) {
  const text = await getDocFromIDB(id);
  if (!text) {
    showToast('Book not found in local storage — please re-upload', 3000);
    return;
  }
  const lib = getLocalLibrary();
  const book = lib.find(b => b.id === id);
  if (!book) return;
  const title = book.title;
  document.getElementById('mybooks-modal').classList.add('hidden');
  loadText(text, title);
  currentFile.libraryId = id;
  if (book.lastPosition > 0) {
    setTimeout(() => {
      showToast(`Resume "${title.slice(0,25)}" from ${Math.round(book.lastPosition/book.wordCount*100)}%?`, 10000, [
        { label: 'Resume', primary: true, onClick: () => { currentIdx = book.lastPosition; displayWord(words[currentIdx]); updateProgress(); }},
        { label: 'Start Over', onClick: () => {} }
      ]);
    }, 800);
  }
}

async function deleteBook(id) {
  if (!confirm('Remove this book from your library?')) return;
  const db = await openIDB();
  const tx = db.transaction(IDB_STORE, 'readwrite');
  tx.objectStore(IDB_STORE).delete(id);
  const lib = getLocalLibrary().filter(b => b.id !== id);
  localStorage.setItem('wr_library', JSON.stringify(lib));
  if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
    await supabaseClient.from('documents').delete().eq('user_id', currentUser.id).eq('title', id);
  }
  renderMyBooks();
  showToast('Book removed');
}

function renderMyBooks() {
  const lib = getLocalLibrary();
  const list = document.getElementById('mybooks-list');
  const empty = document.getElementById('mybooks-empty');
  const upgrade = document.getElementById('mybooks-upgrade');
  if (!list) return;
  if (lib.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
  } else {
    if (empty) empty.style.display = 'none';
    const colors = ['#c9a84c','#3b82f6','#22c55e','#a855f7','#ef4444','#f59e0b'];
    const emojis = ['📗','📘','📕','📙','📓','📔'];
    list.innerHTML = lib.map((book, i) => {
      const progress = book.wordCount > 0 ? Math.round((book.lastPosition / book.wordCount) * 100) : 0;
      const color = colors[i % colors.length];
      const emoji = emojis[i % emojis.length];
      const lastRead = book.lastReadAt ? new Date(book.lastReadAt).toLocaleDateString() : 'Never';
      const safeId = book.id.replace(/'/g, "\\'");
      return `<div onclick="loadBookFromLibrary('${safeId}')" style="display:flex;align-items:center;gap:14px;padding:14px;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
        <div style="width:44px;height:60px;border-radius:4px;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${book.title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin:3px 0">${(book.wordCount||0).toLocaleString()} words · Last read ${lastRead}</div>
          <div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px"><div style="height:100%;width:${progress}%;background:${color};border-radius:2px;transition:width 0.3s"></div></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${progress}% complete</div>
        </div>
        <button onclick="event.stopPropagation();deleteBook('${safeId}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:8px;opacity:0.5;font-size:16px" title="Remove">🗑</button>
      </div>`;
    }).join('');
  }
  if (upgrade) {
    if (!isPro() && lib.length >= 3) upgrade.classList.remove('hidden');
    else upgrade.classList.add('hidden');
  }
}

function openMyBooks() {
  renderMyBooks();
  document.getElementById('mybooks-modal').classList.remove('hidden');
}

function savePositionToLibrary() {
  if (!currentFile || !currentFile.libraryId) return;
  const lib = getLocalLibrary();
  const book = lib.find(b => b.id === currentFile.libraryId);
  if (book) {
    book.lastPosition = currentIdx;
    book.lastReadAt = Date.now();
    localStorage.setItem('wr_library', JSON.stringify(lib));
  }
}

// ── FEATURE 2: STREAK + PROGRESSION LEVELS ──

const LEVELS = [
  { level:1,  name:'Beginner',      minWpm:0,   maxWpm:199,  emoji:'📖', color:'#888' },
  { level:2,  name:'Casual Reader', minWpm:200, maxWpm:249,  emoji:'📚', color:'#6b7280' },
  { level:3,  name:'Reader',        minWpm:250, maxWpm:299,  emoji:'⚡', color:'#3b82f6' },
  { level:4,  name:'Fast Reader',   minWpm:300, maxWpm:349,  emoji:'🚀', color:'#22c55e' },
  { level:5,  name:'Speed Reader',  minWpm:350, maxWpm:399,  emoji:'🔥', color:'#f59e0b' },
  { level:6,  name:'Rapid Reader',  minWpm:400, maxWpm:449,  emoji:'⚡', color:'#f97316' },
  { level:7,  name:'Elite Reader',  minWpm:450, maxWpm:499,  emoji:'💎', color:'#a855f7' },
  { level:8,  name:'Master',        minWpm:500, maxWpm:549,  emoji:'🏆', color:'#ec4899' },
  { level:9,  name:'Expert',        minWpm:550, maxWpm:599,  emoji:'🌟', color:'#06b6d4' },
  { level:10, name:'Warp Speed',    minWpm:600, maxWpm:9999, emoji:'🛸', color:'#c9a84c' },
];

function getLevelForWpm(wpmVal) {
  return LEVELS.find(l => wpmVal >= l.minWpm && wpmVal <= l.maxWpm) || LEVELS[0];
}

function updateStreakFull() {
  const today = new Date().toISOString().split('T')[0];
  const streak = JSON.parse(localStorage.getItem('wr_streak') || '{"current":0,"best":0,"lastDate":""}');
  if (streak.lastDate === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (streak.lastDate === yesterday) {
    streak.current += 1;
  } else {
    streak.current = 1;
  }
  if (streak.current > streak.best) streak.best = streak.current;
  streak.lastDate = today;
  localStorage.setItem('wr_streak', JSON.stringify(streak));
  if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
    supabaseClient.from('profiles').update({
      streak_current: streak.current,
      streak_best: streak.best,
      last_session_date: today
    }).eq('id', currentUser.id).then(() => {});
  }
  return streak;
}

function getStreakDisplay() {
  return JSON.parse(localStorage.getItem('wr_streak') || '{"current":0,"best":0}');
}

function updateXP(wordsReadCount) {
  const xp = JSON.parse(localStorage.getItem('wr_xp') || '{"total":0}');
  const gained = Math.floor(wordsReadCount / 100);
  xp.total += gained;
  localStorage.setItem('wr_xp', JSON.stringify(xp));
  if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
    supabaseClient.from('profiles').update({ xp_total: xp.total }).eq('id', currentUser.id).then(() => {});
  }
  return gained;
}

function logReadingActivity(wordsReadCount) {
  if (!wordsReadCount) return;
  const today = new Date().toISOString().split('T')[0];
  const activity = JSON.parse(localStorage.getItem('wr_activity') || '{}');
  activity[today] = (activity[today] || 0) + wordsReadCount;
  const cutoff = new Date(Date.now() - 90*86400000).toISOString().split('T')[0];
  Object.keys(activity).forEach(d => { if (d < cutoff) delete activity[d]; });
  localStorage.setItem('wr_activity', JSON.stringify(activity));
  // Update total words
  const prev = parseInt(localStorage.getItem('wr_total_words') || '0');
  localStorage.setItem('wr_total_words', String(prev + wordsReadCount));
  renderHeatmap('heatmap-container');
}

function renderHeatmap(containerId) {
  const activity = JSON.parse(localStorage.getItem('wr_activity') || '{}');
  const container = document.getElementById(containerId);
  if (!container) return;
  const days = 84;
  const cells = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(Date.now() - i*86400000).toISOString().split('T')[0];
    const w = activity[d] || 0;
    const opacity = w === 0 ? 0.08 : Math.min(0.2 + (w/5000)*0.8, 1);
    cells.push(`<div title="${d}: ${w.toLocaleString()} words" style="width:10px;height:10px;border-radius:2px;background:rgba(201,168,76,${opacity});flex-shrink:0"></div>`);
  }
  container.innerHTML = `<div style="display:grid;grid-template-rows:repeat(7,10px);grid-auto-flow:column;gap:2px">${cells.join('')}</div>`;
}

function updateLevelBadge() {
  const badge = document.getElementById('level-badge');
  if (!badge) return;
  const level = getLevelForWpm(wpm);
  const streak = getStreakDisplay();
  badge.style.display = 'block';
  badge.textContent = `${level.emoji} Lv${level.level} ${level.name} · 🔥 ${streak.current}d`;
  badge.title = `${level.name} — ${wpm} WPM · ${streak.current} day streak (best: ${streak.best})`;
}

// ── FEATURE 3: 28-DAY TRAINING COURSE ──

const COURSE_DAYS = [
  { day:1,  week:1, title:'Find Your Baseline', wpmTarget:null, duration:10, content:'gutenberg_short', desc:'Read at your natural pace. No pressure — we\'re just establishing where you start.' },
  { day:2,  week:1, title:'The RSVP Advantage', wpmTarget:null, duration:10, content:'gutenberg_short', desc:'Today we explain why RSVP works. Then read the same passage 20 WPM faster.' },
  { day:3,  week:1, title:'First Speed Bump', wpmTarget:'base+20', duration:12, content:'philosophy', desc:'Read 20 WPM above your baseline. It\'ll feel fast. That\'s the point.' },
  { day:4,  week:1, title:'Hold the Pace', wpmTarget:'base+20', duration:12, content:'philosophy', desc:'Same target. Focus on not re-reading. The brain adapts to forward momentum.' },
  { day:5,  week:1, title:'Vocabulary Sprint', wpmTarget:'base+30', duration:15, content:'fiction', desc:'Fiction is easier — higher frequency words. Use it to push your pace.' },
  { day:6,  week:1, title:'Comprehension Check', wpmTarget:'base+25', duration:15, content:'philosophy', desc:'Push speed, then we\'ll test comprehension. Aim for 70%+ at your new pace.' },
  { day:7,  week:1, title:'Week 1 Review', wpmTarget:'base+30', duration:15, content:'mixed', desc:'Full session at your week-1 target. Track your improvement from Day 1.' },
  { day:8,  week:2, title:'Break the Ceiling', wpmTarget:'base+50', duration:15, content:'fiction', desc:'Week 2 starts here. 50 WPM above baseline. This is where real gains happen.' },
  { day:9,  week:2, title:'Long Form Stamina', wpmTarget:'base+50', duration:20, content:'philosophy', desc:'First 20-minute session. Stamina matters as much as speed.' },
  { day:10, week:2, title:'Speed Burst Training', wpmTarget:'base+80', duration:10, content:'fiction', desc:'10 minutes, 80 WPM above baseline. Sprint, not marathon.' },
  { day:11, week:2, title:'Recovery Pace', wpmTarget:'base+40', duration:20, content:'mixed', desc:'Drop to +40 for a longer session. Let the gains consolidate.' },
  { day:12, week:2, title:'The Discomfort Zone', wpmTarget:'base+100', duration:10, content:'fiction', desc:'We\'re going 100 WPM above baseline for 10 minutes. You\'ll miss some words. That\'s fine.' },
  { day:13, week:2, title:'Comprehension at Speed', wpmTarget:'base+60', duration:15, content:'philosophy', desc:'Speed check with comprehension quiz. See how much you retain at your new pace.' },
  { day:14, week:2, title:'Week 2 Milestone', wpmTarget:'base+70', duration:20, content:'mixed', desc:'Big session. 20 minutes at +70 WPM. This is your new comfortable pace.' },
  { day:15, week:3, title:'New Normal', wpmTarget:'base+70', duration:20, content:'philosophy', desc:'Last week\'s push speed is now your normal. Read at it comfortably.' },
  { day:16, week:3, title:'Technical Content', wpmTarget:'base+60', duration:20, content:'nonfiction', desc:'Non-fiction is harder. Same speed, denser content. This builds real comprehension.' },
  { day:17, week:3, title:'Speed Ladder', wpmTarget:'base+80', duration:15, content:'fiction', desc:'Up 10 WPM from last week. The ladder continues.' },
  { day:18, week:3, title:'30-Minute Challenge', wpmTarget:'base+60', duration:30, content:'mixed', desc:'First 30-minute session. This is the real endurance test.' },
  { day:19, week:3, title:'Focus Sprint', wpmTarget:'base+100', duration:10, content:'fiction', desc:'10-minute sprint at +100. Push the ceiling again.' },
  { day:20, week:3, title:'Comprehension Deep Dive', wpmTarget:'base+70', duration:20, content:'philosophy', desc:'Quiz after this session. Target: 80%+ comprehension at your speed.' },
  { day:21, week:3, title:'Week 3 Review', wpmTarget:'base+80', duration:25, content:'mixed', desc:'25 minutes, +80 WPM. This is where most people double their original pace.' },
  { day:22, week:4, title:'Peak Week Begins', wpmTarget:'base+100', duration:20, content:'philosophy', desc:'Week 4. This week we find your ceiling.' },
  { day:23, week:4, title:'Maximum Throughput', wpmTarget:'base+120', duration:15, content:'fiction', desc:'+120 WPM above baseline. Go as fast as you can while understanding 60%+.' },
  { day:24, week:4, title:'Endurance at Peak', wpmTarget:'base+100', duration:30, content:'mixed', desc:'30 minutes at your peak sustainable pace.' },
  { day:25, week:4, title:'Final Speed Test', wpmTarget:'base+130', duration:10, content:'fiction', desc:'Sprint. Your fastest session yet.' },
  { day:26, week:4, title:'Comprehension Final', wpmTarget:'base+100', duration:20, content:'philosophy', desc:'Final comprehension check. Prove you\'re actually reading, not just skimming.' },
  { day:27, week:4, title:'Victory Lap', wpmTarget:'base+100', duration:20, content:'mixed', desc:'Comfortable session at your new normal. You\'ve earned this.' },
  { day:28, week:4, title:'GRADUATION 🎓', wpmTarget:'base+100', duration:15, content:'philosophy', desc:'Day 28. Read the same passage from Day 1. See how far you\'ve come.' },
];

function getCourseState() {
  return JSON.parse(localStorage.getItem('wr_course') || '{"started":false,"dayCompleted":0,"baseWpm":0,"startDate":null}');
}

function saveCourseState(state) {
  localStorage.setItem('wr_course', JSON.stringify(state));
  if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
    supabaseClient.from('profiles').update({
      course_started_at: state.startDate,
      course_day_completed: state.dayCompleted
    }).eq('id', currentUser.id).then(() => {});
  }
}

function startCourse() {
  const baseWpmVal = wpm;
  saveCourseState({ started: true, dayCompleted: 0, baseWpm: baseWpmVal, startDate: new Date().toISOString() });
  renderCourse();
}

function completeCourseDay() {
  const cs = getCourseState();
  cs.dayCompleted = Math.max(cs.dayCompleted, getCurrentCourseDay());
  saveCourseState(cs);
  if (cs.dayCompleted >= 28) {
    showGraduationModal();
    if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
      supabaseClient.from('profiles').update({ course_completed_at: new Date().toISOString() }).eq('id', currentUser.id).then(() => {});
    }
  }
  showToast(`✅ Day ${cs.dayCompleted} complete! 🎉`);
}

function getCurrentCourseDay() {
  const cs = getCourseState();
  return Math.min(cs.dayCompleted + 1, 28);
}

function renderCourse() {
  const cs = getCourseState();
  const container = document.getElementById('course-content');
  if (!container) return;

  if (!cs.started) {
    container.innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:48px;margin-bottom:16px">🎯</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:8px">28 Days to 2× Faster Reading</div>
        <div style="color:var(--text-muted);font-size:14px;max-width:400px;margin:0 auto 24px;line-height:1.6">15–30 minutes a day. Structured progression. Comprehension checks. By Day 28 you'll read at 2–3× your current pace.</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Your current speed: <strong style="color:var(--accent)">${wpm} WPM</strong></div>
        <button onclick="startCourse()" style="background:var(--accent);color:#000;border:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;cursor:pointer">Start Day 1 →</button>
      </div>`;
    return;
  }

  const todayDay = getCurrentCourseDay();
  const todayLesson = COURSE_DAYS[todayDay - 1];
  const targetWpm = todayLesson.wpmTarget === null ? cs.baseWpm :
    parseInt(todayLesson.wpmTarget.replace('base+','')) + cs.baseWpm;

  const weekBars = [1,2,3,4].map(w => {
    const weekDays = COURSE_DAYS.filter(d => d.week === w);
    const done = weekDays.filter(d => d.day <= cs.dayCompleted).length;
    const pct = done / 7 * 100;
    const barColor = w === Math.ceil(todayDay/7) ? 'var(--accent)' : done === 7 ? '#22c55e' : '#333';
    return `<div style="flex:1"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Week ${w}</div><div style="height:6px;background:#222;border-radius:3px"><div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width 0.3s"></div></div></div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:20px">${weekBars}</div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px">Day ${todayDay} of 28 · ${Math.round(todayDay/28*100)}% complete</div>
    <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div>
          <div style="font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:1px">Day ${todayDay} · Week ${todayLesson.week}</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px">${todayLesson.title}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text-muted)">Target</div>
          <div style="font-size:20px;font-weight:700;color:var(--accent)">${targetWpm}<span style="font-size:12px;color:var(--text-muted)"> WPM</span></div>
        </div>
      </div>
      <div style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:16px">${todayLesson.desc}</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">⏱ ${todayLesson.duration} min session</div>
      <button onclick="startCourseDay(${todayDay},${targetWpm})" style="width:100%;background:var(--accent);color:#000;border:none;padding:12px;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer">Start Day ${todayDay} →</button>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:10px">Course Progress</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
      ${COURSE_DAYS.map(d => {
        const bg = d.day < todayDay ? '#22c55e22' : d.day === todayDay ? 'rgba(201,168,76,0.2)' : '#1a1a1a';
        const border = d.day < todayDay ? '#22c55e44' : d.day === todayDay ? 'rgba(201,168,76,0.5)' : '#222';
        const textColor = d.day < todayDay ? '#22c55e' : d.day === todayDay ? 'var(--accent)' : '#555';
        const icon = d.day < todayDay ? '✓' : d.day === todayDay ? '▶' : String(d.day);
        return `<div title="Day ${d.day}: ${d.title}" style="height:28px;border-radius:4px;background:${bg};border:1px solid ${border};display:flex;align-items:center;justify-content:center;font-size:10px;color:${textColor}">${icon}</div>`;
      }).join('')}
    </div>`;
}

async function startCourseDay(day, targetWpmVal) {
  setWPM(targetWpmVal);
  const lesson = COURSE_DAYS[day-1];
  document.getElementById('course-modal').classList.add('hidden');
  const bookId = lesson.content === 'philosophy' ? 2680 : 1342;
  showToast(`Loading Day ${day} content...`);
  try {
    const resp = await fetch(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`);
    const fullText = await resp.text();
    const ws = fullText.split(/\s+/).filter(w => w.length > 0);
    const start = (day - 1) * 500;
    const count = lesson.duration * targetWpmVal;
    const section = ws.slice(start, start + count).join(' ');
    loadText(section, `Day ${day}: ${lesson.title}`, { isCourse: true });
    showToast(`Day ${day} ready — ${targetWpmVal} WPM target 🎯`);
  } catch(e) {
    showToast('Could not load content — paste your own text to continue', 4000);
  }
}

function showGraduationModal() {
  const cs = getCourseState();
  showToast(`🎓 Course complete! You went from ${cs.baseWpm} WPM to ${wpm} WPM!`, 6000);
  setTimeout(() => generateShareCard(), 2000);
}

function openCourse() {
  renderCourse();
  document.getElementById('course-modal').classList.remove('hidden');
}

// ── FEATURE 4: COMPREHENSION CHECK ──

let quizQuestions = [];
let quizAnswers = {};

async function generateComprehensionCheck() {
  if (!words.length) { showToast('Load a document first', 3000); return; }
  const recentWords = wordBuffer.slice(-400).map(e => e.word).join(' ');
  const cleanPassage = cleanExtractedText(recentWords) || recentWords;

  const modal = document.getElementById('quiz-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('quiz-loading').style.display = 'block';
  document.getElementById('quiz-questions').style.display = 'none';
  document.getElementById('quiz-result').style.display = 'none';
  document.getElementById('quiz-submit-btn').style.display = 'none';
  document.getElementById('quiz-resume-btn').style.display = 'none';
  const badge = document.getElementById('quiz-score-badge');
  if (badge) badge.style.display = 'none';
  quizAnswers = {};

  if (!window.OPENAI_API_KEY) {
    document.getElementById('quiz-loading').innerHTML = '<div style="color:#f59e0b;padding:20px 0">AI comprehension requires an OpenAI API key.<br><span style="font-size:12px;color:var(--text-muted)">Coming soon for Pro users — questions will be generated automatically.</span></div>';
    document.getElementById('quiz-resume-btn').style.display = 'block';
    return;
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${window.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Generate exactly 3 multiple-choice comprehension questions about the passage. Return ONLY valid JSON array: [{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0}] where correct is 0-3 index.' },
          { role: 'user', content: `Passage:\n\n${cleanPassage}` }
        ],
        max_tokens: 600, temperature: 0.3
      })
    });
    const data = await resp.json();
    const content = data.choices[0].message.content.trim();
    quizQuestions = JSON.parse(content.replace(/```json|```/g,'').trim());
    renderQuiz();
  } catch(e) {
    document.getElementById('quiz-loading').innerHTML = '<div style="color:#ef4444">Could not generate questions — try again</div>';
    document.getElementById('quiz-resume-btn').style.display = 'block';
  }
}

function renderQuiz() {
  document.getElementById('quiz-loading').style.display = 'none';
  document.getElementById('quiz-submit-btn').style.display = 'block';
  const container = document.getElementById('quiz-questions');
  container.style.display = 'block';
  container.innerHTML = quizQuestions.map((q, qi) => `
    <div style="margin-bottom:20px">
      <div style="font-weight:600;font-size:14px;margin-bottom:10px">${qi+1}. ${q.question}</div>
      ${q.options.map((opt, oi) => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
          <input type="radio" name="q${qi}" value="${oi}" onchange="quizAnswers[${qi}]=${oi}" style="accent-color:var(--accent)">
          <span style="font-size:13px">${opt}</span>
        </label>
      `).join('')}
    </div>
  `).join('');
}

function submitQuiz() {
  const answered = Object.keys(quizAnswers).length;
  if (answered < quizQuestions.length) { showToast(`Answer all ${quizQuestions.length} questions first`); return; }
  let correct = 0;
  quizQuestions.forEach((q, i) => { if (parseInt(quizAnswers[i]) === q.correct) correct++; });
  const score = Math.round(correct / quizQuestions.length * 100);
  document.getElementById('quiz-submit-btn').style.display = 'none';
  document.getElementById('quiz-resume-btn').style.display = 'block';
  document.getElementById('quiz-questions').style.display = 'none';
  const badge = document.getElementById('quiz-score-badge');
  if (badge) {
    badge.style.display = 'block';
    badge.textContent = `${score}%`;
    badge.style.background = score >= 80 ? 'rgba(34,197,94,0.2)' : score >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)';
    badge.style.color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  }
  const advice = score >= 90 ? `🚀 Excellent! Try pushing to ${wpm + 25} WPM.` :
                 score >= 70 ? '✅ Good retention at this speed.' :
                 score >= 50 ? `⚡ Consider dropping to ${Math.max(wpm - 25, 100)} WPM for better retention.` :
                               `⚠️ Slow down — try ${Math.max(wpm - 50, 100)} WPM for better comprehension.`;
  const result = document.getElementById('quiz-result');
  result.style.display = 'block';
  result.innerHTML = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:48px;font-weight:800;color:${score >= 70 ? '#22c55e' : '#f59e0b'}">${score}%</div>
      <div style="font-size:16px;margin:8px 0">${correct} of ${quizQuestions.length} correct</div>
      <div style="font-size:14px;color:var(--text-muted);margin-top:12px;padding:12px;background:var(--bg-elevated);border-radius:8px">${advice}</div>
    </div>`;
  if (typeof isLoggedIn === 'function' && isLoggedIn() && supabaseClient) {
    supabaseClient.from('comprehension_results').insert({ user_id: currentUser.id, score, wpm_at_time: wpm }).then(() => {});
  }
  showToast(`Comprehension: ${score}% — ${correct}/${quizQuestions.length} correct`);
}

function closeQuiz(resume) {
  document.getElementById('quiz-modal').classList.add('hidden');
  if (resume && words.length > 0) play();
}

// ── FEATURE 5: SHAREABLE STATS CARD ──

function generateShareCard() {
  const streak = getStreakDisplay();
  const totalWords = parseInt(localStorage.getItem('wr_total_words') || '0');
  const hoursSaved = totalWords > 0 ? Math.max(0, (totalWords/250 - totalWords/Math.max(wpm,1))/60).toFixed(1) : '0';
  const lib = getLocalLibrary();
  const booksFinished = lib.filter(b => b.wordCount > 0 && b.lastPosition >= (b.wordCount * 0.9)).length;

  const canvas = document.getElementById('share-canvas');
  if (!canvas) return;
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0,0,1080,1080);
  grad.addColorStop(0, '#0a0a0a');
  grad.addColorStop(1, '#111111');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,1080,1080);

  // Accent border
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 6;
  ctx.strokeRect(30,30,1020,1020);

  // Brand
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡ WarpReader', 540, 120);

  // Main WPM
  ctx.fillStyle = '#f0e8d8';
  ctx.font = 'bold 160px system-ui, -apple-system, sans-serif';
  ctx.fillText(String(wpm), 540, 380);
  ctx.fillStyle = '#888';
  ctx.font = '48px system-ui, -apple-system, sans-serif';
  ctx.fillText('words per minute', 540, 450);

  // Divider
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(120,500); ctx.lineTo(960,500); ctx.stroke();

  // Stats
  const stats = [
    { label: 'Hours Saved', value: hoursSaved + 'h' },
    { label: 'Day Streak', value: '🔥 ' + streak.current },
    { label: 'Books Read', value: String(booksFinished) },
  ];
  stats.forEach((s, i) => {
    const x = 200 + i * 340;
    ctx.fillStyle = '#c9a84c';
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.value, x, 620);
    ctx.fillStyle = '#666';
    ctx.font = '28px system-ui, -apple-system, sans-serif';
    ctx.fillText(s.label, x, 665);
  });

  // Level
  const lvl = getLevelForWpm(wpm);
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${lvl.emoji} Level ${lvl.level} — ${lvl.name}`, 540, 730);

  // Message
  ctx.fillStyle = '#f0e8d8';
  ctx.font = '30px system-ui, -apple-system, sans-serif';
  ctx.fillText('I read faster than 94% of people.', 540, 800);

  // URL
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText('warpreader.com', 540, 950);

  document.getElementById('share-modal').classList.remove('hidden');
  const nativeBtn = document.getElementById('native-share-btn');
  if (nativeBtn) nativeBtn.style.display = navigator.share ? 'block' : 'none';
}

function downloadShareCard() {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'my-warpreader-stats.png';
  a.click();
  showToast('Stats card downloaded! 📤');
}

async function nativeShare() {
  const canvas = document.getElementById('share-canvas');
  if (!canvas) return;
  canvas.toBlob(async blob => {
    try {
      await navigator.share({
        title: `I read at ${wpm} WPM with WarpReader`,
        text: `I read at ${wpm} WPM — that's faster than 94% of people. Try WarpReader free: warpreader.com`,
        files: [new File([blob], 'warpreader-stats.png', { type: 'image/png' })]
      });
    } catch(e) { downloadShareCard(); }
  });
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const theme = localStorage.getItem('speedread_theme');
  if (theme === 'light') { document.documentElement.setAttribute('data-theme', 'light'); document.getElementById('theme-btn').textContent = '☀️'; }

  // Restore preferred WPM from last session
  const savedWPM = parseInt(localStorage.getItem('speedread_preferred_wpm'), 10);
  if (savedWPM >= 100 && savedWPM <= 1500) setWPM(savedWPM);

  updateAccountUI();
  updateTrialBanner();
  refreshHistory();
  loadLibrary();
  updateAcademicBtn();

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

  // Phase 1: init heatmap, level badge
  renderHeatmap('heatmap-container');
  updateLevelBadge();

  // Check for plan redirect from landing page
  const params = new URLSearchParams(window.location.search);
  const plan = params.get('plan');
  if (plan) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => openCheckout(plan), 500);
  }

  // Auto-open auth modal if ?auth=login
  if (params.get('auth') === 'login') {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => {
      const modal = document.getElementById('auth-modal');
      if (modal) modal.classList.remove('hidden');
    }, 300);
  }

  // ── Post-checkout: link Stripe session to account ──
  if (params.get('upgraded') === 'true') {
    const sessionId = params.get('session_id') || '';
    window.history.replaceState({}, '', window.location.pathname); // clean URL
    localStorage.setItem('wr_stripe_session', sessionId);

    setTimeout(() => {
      if (currentUser) {
        // Already logged in — link the upgrade to their account
        _linkStripeToAccount(sessionId, currentUser.email);
        showToast('🎉 You\'re now Pro! Your account is activated.', 5000);
      } else {
        // Not logged in — show upgrade success modal with signup prompt
        _showUpgradeSuccessModal(sessionId);
      }
    }, 800);
  }
});

// ── Link Stripe session to Supabase account ──
async function _linkStripeToAccount(sessionId, email) {
  if (!email) return;
  try {
    // Update profile plan via webhook (idempotent — webhook does the heavy lifting)
    // Here we just ensure the profile exists with the right email
    if (supabaseClient && currentUser) {
      await supabaseClient.from('profiles').upsert({
        id: currentUser.id,
        email: currentUser.email,
        plan: 'pro',
        stripe_session_id: sessionId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      await fetchUserProfile();
      updateAccountUI();
    }
  } catch (e) {
    console.warn('[WarpReader] Account link failed:', e);
  }
}

// ── Upgrade success modal (prompts account creation for new buyers) ──
function _showUpgradeSuccessModal(sessionId) {
  const existing = document.getElementById('upgrade-success-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'upgrade-success-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:18px;padding:32px 28px;max-width:420px;width:100%;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:8px">🎉</div>
      <h2 style="font-size:1.4rem;font-weight:800;margin-bottom:8px">Payment confirmed!</h2>
      <p style="color:var(--text-muted);font-size:.95rem;margin-bottom:20px">
        Create a free account to save your progress, sync your library across devices, and track your WPM over time.
      </p>
      <input type="email" id="upgrade-email" placeholder="your@email.com" autocomplete="email"
        style="width:100%;box-sizing:border-box;background:var(--bg-elevated,#111);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-size:1rem;margin-bottom:8px">
      <input type="password" id="upgrade-password" placeholder="Create a password (8+ chars)"
        style="width:100%;box-sizing:border-box;background:var(--bg-elevated,#111);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-size:1rem;margin-bottom:12px">
      <button onclick="_submitUpgradeSignup('${sessionId}')" style="width:100%;background:var(--accent);color:#000;border:none;border-radius:10px;padding:13px;font-weight:800;font-size:1rem;cursor:pointer">
        Create Account & Activate Pro →
      </button>
      <button onclick="document.getElementById('upgrade-success-modal').remove()"
        style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.85rem;margin-top:12px;display:block;width:100%">
        Skip for now (you can create an account later)
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('upgrade-email')?.focus(), 100);
}

async function _submitUpgradeSignup(sessionId) {
  const email = document.getElementById('upgrade-email')?.value?.trim();
  const password = document.getElementById('upgrade-password')?.value;
  if (!email || !password || password.length < 8) {
    showToast('Please enter a valid email and password (8+ characters)');
    return;
  }
  try {
    const result = await signUp(email, password);
    if (result?.error) {
      // Maybe they already have an account — try login
      const loginResult = await signIn(email, password);
      if (loginResult?.error) {
        showToast('Could not create account: ' + (result.error.message || 'unknown error'));
        return;
      }
    }
    document.getElementById('upgrade-success-modal')?.remove();
    await _linkStripeToAccount(sessionId, email);
    showToast('✅ Account created and Pro activated! Welcome to WarpReader Pro.', 5000);
  } catch (e) {
    showToast('Signup failed — please try again');
  }
}
