// ═══════════════════════════════════════════════════════════════
// Warpreader — Sync (Reading History & Progress)
// ═══════════════════════════════════════════════════════════════

const SYNC_STORAGE_KEY = 'speedread_sessions';
const MAX_SESSIONS = 50;

// ── Save a reading session ──
async function saveSession(sessionData) {
  // sessionData: { doc_title, word_count, wpm, duration, date, comprehension_score }
  const session = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    doc_title: sessionData.doc_title || 'Untitled',
    word_count: sessionData.word_count || 0,
    wpm: sessionData.wpm || 250,
    duration: sessionData.duration || 0, // seconds
    date: sessionData.date || new Date().toISOString(),
    comprehension_score: sessionData.comprehension_score || null,
  };

  // Save to localStorage
  const sessions = getLocalSessions();
  sessions.unshift(session);
  if (sessions.length > MAX_SESSIONS) sessions.length = MAX_SESSIONS;
  localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(sessions));

  // Sync to Supabase if logged in
  if (isLoggedIn() && supabaseClient) {
    try {
      await supabaseClient.from('reading_sessions').insert({
        user_id: currentUser.id,
        ...session,
      });
    } catch (e) {
      console.warn('[Sync] Cloud save failed, local backup exists:', e);
    }
  }

  return session;
}

// ── Get sessions from localStorage ──
function getLocalSessions() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || '[]');
  } catch { return []; }
}

// ── Load last N sessions (prefer cloud if logged in) ──
async function loadRecentSessions(limit = 10) {
  if (isLoggedIn() && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('reading_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: false })
        .limit(limit);
      if (!error && data?.length) return data;
    } catch (e) {
      console.warn('[Sync] Cloud load failed, using local:', e);
    }
  }
  return getLocalSessions().slice(0, limit);
}

// ── WPM trend data for chart — merges session history + speed test history ──
async function getWPMTrend(days = 30) {
  const cutoff = Date.now() - days * 86400000;

  // Local reading sessions
  const sessions = await loadRecentSessions(MAX_SESSIONS);
  const sessionPoints = sessions
    .filter(s => new Date(s.date).getTime() > cutoff)
    .reverse()
    .map(s => ({ date: s.date, wpm: s.wpm, source: 'session' }));

  // Server speed test history (logged-in users or anon by ID)
  let testPoints = [];
  try {
    const userId = (typeof currentUser !== 'undefined' && currentUser?.id) || null;
    const anonId = localStorage.getItem('wr_anon_id');
    const qs = userId ? `userId=${userId}` : (anonId ? `anonId=${anonId}` : null);
    if (qs) {
      const r = await fetch(`/api/wpm?${qs}`);
      if (r.ok) {
        const data = await r.json();
        testPoints = (data || []).map(t => ({ date: t.created_at, wpm: t.wpm, source: 'test' }));
      }
    }
  } catch (_) {}

  // Merge + sort
  const all = [...sessionPoints, ...testPoints]
    .filter(p => new Date(p.date).getTime() > cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Deduplicate: if session and test within 1 min, keep session
  const deduped = all.filter((p, i) => {
    if (i === 0) return true;
    const prev = all[i - 1];
    return Math.abs(new Date(p.date) - new Date(prev.date)) > 60000;
  });

  return deduped;
}

// ── Render SVG line chart ──
function renderWPMChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data.length) {
    if (container) container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">No reading data yet. Start reading to see your progress!</p>';
    return;
  }

  const w = 400, h = 160, pad = { top: 20, right: 20, bottom: 30, left: 45 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;

  const wpms = data.map(d => d.wpm);
  const minWPM = Math.min(...wpms) - 20;
  const maxWPM = Math.max(...wpms) + 20;
  const range = maxWPM - minWPM || 1;

  const points = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1 || 1)) * pw;
    const y = pad.top + ph - ((d.wpm - minWPM) / range) * ph;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');
  const ACCENT = '#c9a84c';
  const dots = data.map((d, i) => {
    const [x, y] = points[i].split(',');
    const isTest = d.source === 'test';
    return `<circle cx="${x}" cy="${y}" r="${isTest ? 4 : 3}" fill="${ACCENT}" opacity="${isTest ? 1 : 0.7}" title="${d.wpm} WPM"/>`;
  }).join('');

  // Y-axis labels
  const yLabels = [minWPM + 20, Math.round((minWPM + maxWPM) / 2), maxWPM - 20].map(val => {
    const y = pad.top + ph - ((val - minWPM) / range) * ph;
    return `<text x="${pad.left - 6}" y="${y + 4}" fill="#8a8070" font-size="10" text-anchor="end">${Math.round(val)}</text>`;
  }).join('');

  // Gradient fill under line
  const fillPoints = `${pad.left + (0 / (data.length - 1 || 1)) * pw},${pad.top + ph} ${polyline} ${pad.left + ((data.length - 1) / (data.length - 1 || 1)) * pw},${pad.top + ph}`;

  // Improvement delta
  const first = data[0]?.wpm, last = data[data.length - 1]?.wpm;
  const delta = first && last ? last - first : 0;
  const deltaLabel = delta > 0 ? `+${delta} WPM` : delta < 0 ? `${delta} WPM` : '';
  const deltaColor = delta > 0 ? ACCENT : delta < 0 ? '#ef4444' : '';

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px">
      <defs>
        <linearGradient id="wpmGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${pad.left}" y1="${pad.top + ph}" x2="${pad.left + pw}" y2="${pad.top + ph}" stroke="#2a2a2a" stroke-width="1"/>
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + ph}" stroke="#2a2a2a" stroke-width="1"/>
      ${yLabels}
      <polygon points="${fillPoints}" fill="url(#wpmGrad)"/>
      <polyline points="${polyline}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
      ${deltaLabel ? `<text x="${pad.left + pw}" y="${pad.top + 14}" fill="${deltaColor}" font-size="11" font-weight="700" text-anchor="end">${deltaLabel}</text>` : ''}
    </svg>
  `;
}

// ── Free tier tracking ──
const DAILY_USAGE_KEY = 'speedread_daily_usage';

function getDailyUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_USAGE_KEY) || '{}');
    const today = new Date().toISOString().slice(0, 10);
    if (raw.date !== today) return { date: today, docs: 0, words: 0 };
    return raw;
  } catch { return { date: new Date().toISOString().slice(0, 10), docs: 0, words: 0 }; }
}

function incrementDailyUsage(wordCount) {
  const usage = getDailyUsage();
  usage.docs += 1;
  usage.words += wordCount;
  localStorage.setItem(DAILY_USAGE_KEY, JSON.stringify(usage));
  return usage;
}

const FREE_TIER_WORD_CUTOFF = 10000;

function checkFreeTierLimits(wordCount) {
  if (isPro()) return { allowed: true };
  const usage = getDailyUsage();
  if (usage.docs >= 5) return { allowed: false, reason: 'daily_docs', message: 'You\'ve reached your free limit of 5 documents per day.' };
  // No block at load time — free users read up to FREE_TIER_WORD_CUTOFF words
  // before being prompted, handled during playback in scheduleNext()
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
// EMAIL TRIAL SYSTEM
// Set LEAD_ENDPOINT to send leads to a backend when ready:
//   Formspree:    'https://formspree.io/f/YOUR_FORM_ID'
//   Apps Script:  'https://script.google.com/macros/s/.../exec'
//   Supabase fn:  '/functions/v1/capture-lead'
// ═══════════════════════════════════════════════════════════════
const TRIAL_KEY = 'speedread_trial';
const LEAD_KEY  = 'speedread_lead';
const LEAD_ENDPOINT = null; // → wire up when Supabase/Resend is live

function activateEmailTrial(name, email) {
  const lead = {
    name:   name.trim(),
    email:  email.trim().toLowerCase(),
    source: 'speedread_trial',
    ts:     new Date().toISOString()
  };
  const trial = { name: lead.name, email: lead.email, started_at: Date.now() };
  localStorage.setItem(LEAD_KEY,  JSON.stringify(lead));
  localStorage.setItem(TRIAL_KEY, JSON.stringify(trial));
  if (LEAD_ENDPOINT) {
    fetch(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    }).catch(() => {});
  }
  return trial;
}

function getEmailTrial() {
  try { return JSON.parse(localStorage.getItem(TRIAL_KEY)); } catch { return null; }
}

function isEmailTrialActive() {
  const t = getEmailTrial();
  if (!t) return false;
  return (Date.now() - t.started_at) < 24 * 60 * 60 * 1000;
}

function getTrialHoursRemaining() {
  const t = getEmailTrial();
  if (!t) return 0;
  const ms = 24 * 60 * 60 * 1000 - (Date.now() - t.started_at);
  return Math.max(0, Math.ceil(ms / (60 * 60 * 1000)));
}

function hasSubmittedLead() {
  return !!localStorage.getItem(LEAD_KEY);
}

function getStoredLead() {
  try { return JSON.parse(localStorage.getItem(LEAD_KEY)); } catch { return null; }
}
