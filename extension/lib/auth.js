// Warpreader Extension — Auth Module
// Handles Supabase auth, plan checking, WPM sync, and daily limits

const SUPABASE_URL = 'https://hmacjbgnvljhgvwdzkds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYWNqYmdudmxqaGd2d2R6a2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDcwODAsImV4cCI6MjA4OTM4MzA4MH0.crS-Y4zEnCmUPM7DBbJvb5nVufgtbEXyW6WpOSBTl2k';
const FREE_DAILY_LIMIT = 3;

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// Auth functions
async function signIn(email, password) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await persistSession(data.session);
    return { success: true, user: data.user };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function signUp(email, password) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) await persistSession(data.session);
    return { success: true, user: data.user, needsConfirmation: !data.session };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function signOut() {
  try {
    const sb = getSupabase();
    await sb.auth.signOut();
  } catch (e) { /* ignore */ }
  await chrome.storage.local.remove(['sb_session', 'sb_user', 'sb_plan']);
}

async function persistSession(session) {
  if (!session) return;
  await chrome.storage.local.set({
    sb_session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at
    }
  });
}

async function restoreSession() {
  try {
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    if (!sb_session) return null;
    const sb = getSupabase();
    const { data, error } = await sb.auth.setSession({
      access_token: sb_session.access_token,
      refresh_token: sb_session.refresh_token
    });
    if (error || !data.session) {
      await chrome.storage.local.remove(['sb_session', 'sb_user', 'sb_plan']);
      return null;
    }
    await persistSession(data.session);
    return data.user;
  } catch (e) {
    return null;
  }
}

async function getUser() {
  try {
    const user = await restoreSession();
    return user;
  } catch (e) {
    return null;
  }
}

async function getUserPlan(userId) {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    if (error || !data) return 'free';
    return data.plan || 'free';
  } catch (e) {
    return 'free';
  }
}

// Daily usage tracking
async function getTodayUsage() {
  const today = new Date().toISOString().split('T')[0];
  const { daily_usage } = await chrome.storage.local.get(['daily_usage']);
  if (!daily_usage || daily_usage.date !== today) return 0;
  return daily_usage.count || 0;
}

async function incrementUsage() {
  const today = new Date().toISOString().split('T')[0];
  const { daily_usage } = await chrome.storage.local.get(['daily_usage']);
  let count = 1;
  if (daily_usage && daily_usage.date === today) count = (daily_usage.count || 0) + 1;
  await chrome.storage.local.set({ daily_usage: { date: today, count } });
  return count;
}

async function canRead(plan) {
  if (plan === 'pro') return { allowed: true };
  const usage = await getTodayUsage();
  if (usage >= FREE_DAILY_LIMIT) return { allowed: false, usage, limit: FREE_DAILY_LIMIT };
  return { allowed: true, usage, limit: FREE_DAILY_LIMIT };
}

// WPM sync
async function saveWPMSession(userId, wpm) {
  if (!userId) return;
  try {
    await fetch('https://warpreader.com/api/wpm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, wpm, percentile: null, source: 'extension' })
    });
  } catch (e) { /* offline — silently fail */ }
}

async function fetchWPMHistory(userId) {
  if (!userId) return [];
  try {
    const r = await fetch(`https://warpreader.com/api/wpm?userId=${userId}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data.slice(-10) : [];
  } catch (e) {
    return [];
  }
}

// Expose globals
window.WarpAuth = {
  signIn, signUp, signOut, getUser, getUserPlan,
  getTodayUsage, incrementUsage, canRead,
  saveWPMSession, fetchWPMHistory
};
