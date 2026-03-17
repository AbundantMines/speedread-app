// ═══════════════════════════════════════════════════════════════
// SpeedRead — Sync (Reading History & Progress)
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

// ── WPM trend data for chart ──
async function getWPMTrend(days = 30) {
  const sessions = await loadRecentSessions(MAX_SESSIONS);
  const cutoff = Date.now() - days * 86400000;
  return sessions
    .filter(s => new Date(s.date).getTime() > cutoff)
    .reverse()
    .map(s => ({ date: s.date, wpm: s.wpm, words: s.word_count }));
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
  const dots = data.map((d, i) => {
    const [x, y] = points[i].split(',');
    return `<circle cx="${x}" cy="${y}" r="3" fill="#38bdf8"/>`;
  }).join('');

  // Y-axis labels
  const yLabels = [minWPM, Math.round((minWPM + maxWPM) / 2), maxWPM].map(val => {
    const y = pad.top + ph - ((val - minWPM) / range) * ph;
    return `<text x="${pad.left - 8}" y="${y + 4}" fill="#8a8070" font-size="10" text-anchor="end">${Math.round(val)}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px">
      <line x1="${pad.left}" y1="${pad.top + ph}" x2="${pad.left + pw}" y2="${pad.top + ph}" stroke="#222" stroke-width="1"/>
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + ph}" stroke="#222" stroke-width="1"/>
      ${yLabels}
      <text x="${pad.left + pw/2}" y="${h - 4}" fill="#8a8070" font-size="10" text-anchor="middle">Sessions</text>
      <text x="12" y="${pad.top + ph/2}" fill="#8a8070" font-size="10" text-anchor="middle" transform="rotate(-90,12,${pad.top + ph/2})">WPM</text>
      <polyline points="${polyline}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
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

function checkFreeTierLimits(wordCount) {
  if (isPro()) return { allowed: true };
  const usage = getDailyUsage();
  if (usage.docs >= 3) return { allowed: false, reason: 'daily_docs', message: 'You\'ve reached your free limit of 3 documents per day.' };
  if (wordCount > 2000) return { allowed: false, reason: 'word_limit', message: 'Free tier is limited to 2,000 words per session. This document has ' + wordCount.toLocaleString() + ' words.' };
  return { allowed: true };
}
