// Warpreader Extension — Full-Tab Reader

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
// Restore preferred WPM
chrome.storage.sync.get(['defaultWPM'], (r) => {
  if (r.defaultWPM) { wpm = r.defaultWPM; setWPM(r.defaultWPM); }
});

// ── DOM ───────────────────────────────────────────────────────────────────────
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
const wpmDisplay  = $('wpm-display');

// ── RSVP ──────────────────────────────────────────────────────────────────────
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
  } else {
    playing = true;
    if (idx >= words.length) idx = 0;
    playBtn.textContent = '⏸';
    tick();
  }
}

function tick() {
  if (!playing || idx >= words.length) {
    playing = false;
    playBtn.textContent = '▶ Play';
    if (idx >= words.length) idx = 0;
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
  wpmDisplay.textContent = v + ' WPM';
  chrome.storage.sync.set({ defaultWPM: v });
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
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
$('btn-back50').addEventListener('click', () => jump(-50));
$('btn-back10').addEventListener('click', () => jump(-10));
$('play-btn').addEventListener('click', togglePlay);
$('btn-fwd10').addEventListener('click', () => jump(10));
$('btn-fwd50').addEventListener('click', () => jump(50));
wpmSlider.addEventListener('input', (e) => setWPM(+e.target.value));

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  chrome.storage.sync.get(['defaultWPM'], (r) => {
    if (r.defaultWPM) {
      wpm = r.defaultWPM;
      wpmSlider.value = wpm;
      setWPM(wpm);
    }
  });

  chrome.storage.local.get(['readerWords', 'readerIdx', 'readerWPM'], (r) => {
    if (r.readerWPM) {
      wpm = r.readerWPM;
      wpmSlider.value = wpm;
      setWPM(wpm);
    }

    if (r.readerWords) {
      words = r.readerWords.split(/\s+/).filter(w => w.length > 0);
      idx = r.readerIdx || 0;
      if (idx >= words.length) idx = 0;
      if (words.length) {
        showWord(words[idx]);
        updateProgress();
      } else {
        idleText.textContent = 'No text loaded. Open the popup and extract a page first.';
        idleText.style.display = 'block';
      }
    } else {
      idleText.textContent = 'No text loaded. Open the popup and extract a page first.';
      idleText.style.display = 'block';
    }
  });
}

init();
