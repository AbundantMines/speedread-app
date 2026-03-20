// WarpRead Extension — Popup Reader

let words = [], idx = 0, wpm = 300, playing = false, timer = null;
const ORP = [0,0,0,0,1,1,1,2,2,2,3,3,3,4,4,4];

function getORP(w) { return ORP[Math.min(w.replace(/[^a-zA-Z0-9]/g,'').length, ORP.length-1)]; }
function delay(w) {
  const b = 60000/wpm; let m = 1;
  if (/[.!?]$/.test(w)) m = 2.8; else if (/[,;:]/.test(w)) m = 1.6; else if (w.length > 10) m = 1.3; else if (w.length <= 2) m = 0.7;
  return Math.max(b*m, 50);
}

function show(w) {
  if (!w) return;
  const o = getORP(w);
  document.getElementById('word-before').textContent = w.slice(0,o);
  document.getElementById('word-orp').textContent = w[o] || '';
  document.getElementById('word-after').textContent = w.slice(o+1);
  document.getElementById('word-row').style.display = 'flex';
  document.getElementById('idle-text').style.display = 'none';
}

function update() {
  if (!words.length) return;
  const pct = (idx/words.length*100).toFixed(1);
  document.getElementById('progress-fill').style.width = pct+'%';
  document.getElementById('progress-pct').textContent = pct+'%';
  document.getElementById('progress-pos').textContent = `Word ${idx+1} / ${words.length}`;
}

function togglePlay() {
  if (!words.length) return;
  if (playing) { playing = false; clearTimeout(timer); document.getElementById('play-btn').textContent = '▶ Play'; }
  else { playing = true; if (idx >= words.length) idx = 0; document.getElementById('play-btn').textContent = '⏸'; tick(); }
}

function tick() {
  if (!playing || idx >= words.length) { playing = false; document.getElementById('play-btn').textContent = '▶ Play'; return; }
  show(words[idx]); update();
  timer = setTimeout(() => { idx++; tick(); }, delay(words[idx]));
}

function jump(d) {
  const was = playing;
  if (was) { playing = false; clearTimeout(timer); }
  idx = Math.max(0, Math.min(words.length-1, idx+d));
  show(words[idx]); update();
  if (was) { playing = true; tick(); }
}

function setWPM(v) { wpm = v; document.getElementById('wpm-val').textContent = v; }

function loadText(text) {
  words = text.split(/\s+/).filter(w => w.length > 0);
  idx = 0; playing = false;
  clearTimeout(timer);
  if (words.length) { show(words[0]); update(); }
}

async function extractPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' }, (resp) => {
    if (resp?.text) loadText(resp.text);
    else document.getElementById('idle-text').textContent = 'Could not extract text';
  });
}

function useSelection() {
  chrome.storage.local.get(['pendingText'], (r) => {
    if (r.pendingText) { loadText(r.pendingText); chrome.storage.local.remove('pendingText'); }
    else document.getElementById('idle-text').textContent = 'No selected text found';
  });
}

// Load saved WPM preference
chrome.storage.sync.get(['defaultWPM'], (r) => {
  if (r.defaultWPM) { wpm = r.defaultWPM; document.getElementById('wpm-slider').value = wpm; document.getElementById('wpm-val').textContent = wpm; }
});

// Check for pending text from context menu
chrome.storage.local.get(['pendingText'], (r) => {
  if (r.pendingText) { loadText(r.pendingText); chrome.storage.local.remove('pendingText'); }
});
