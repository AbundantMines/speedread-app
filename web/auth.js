// ═══════════════════════════════════════════════════════════════
// Warpreader — Auth (Supabase)
// ═══════════════════════════════════════════════════════════════

// ── Replace these with your Supabase project credentials ──
const SUPABASE_URL = 'YOUR_SUPABASE_URL';           // e.g. https://xyzcompany.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // e.g. eyJhbGciOiJIUzI1NiIs...

let supabaseClient = null;
let currentUser = null;
let userProfile = null;

// ── Initialize ──
function initAuth() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('[Warpreader Auth] Supabase not configured — running in local-only mode');
    return;
  }
  if (typeof supabase === 'undefined') {
    console.warn('[Warpreader Auth] Supabase JS not loaded');
    return;
  }
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseClient.auth.onAuthStateChange(handleAuthChange);
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      currentUser = data.session.user;
      fetchUserProfile();
    }
  });
}

// ── Auth State Change Handler ──
function handleAuthChange(event, session) {
  if (event === 'SIGNED_IN' && session) {
    currentUser = session.user;
    fetchUserProfile();
    // Redirect to app if on landing page
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
      window.location.href = 'app.html';
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    userProfile = null;
    // Redirect to landing if on app page
    if (window.location.pathname.endsWith('app.html')) {
      window.location.href = 'index.html';
    }
  }
}

// ── Fetch User Profile (plan tier, usage) ──
async function fetchUserProfile() {
  if (!supabaseClient || !currentUser) return null;
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('display_name, plan, docs_today, words_today, created_at')
      .eq('id', currentUser.id)
      .single();
    if (!error && data) {
      userProfile = data;
      if (typeof onProfileLoaded === 'function') onProfileLoaded(userProfile);
    }
    return userProfile;
  } catch (e) {
    console.warn('[Warpreader Auth] Profile fetch failed:', e);
    return null;
  }
}

// ── Email/Password Sign Up ──
async function signUp(email, password, displayName) {
  if (!supabaseClient) return { error: { message: 'Auth not configured' } };
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split('@')[0] } }
  });
  return { data, error };
}

// ── Email/Password Sign In ──
async function signIn(email, password) {
  if (!supabaseClient) return { error: { message: 'Auth not configured' } };
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  return { data, error };
}

// ── Google OAuth ──
async function signInWithGoogle() {
  if (!supabaseClient) return { error: { message: 'Auth not configured' } };
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/app.html' }
  });
  return { data, error };
}

// ── Sign Out ──
async function signOut() {
  if (!supabaseClient) {
    currentUser = null;
    userProfile = null;
    window.location.href = 'index.html';
    return;
  }
  await supabaseClient.auth.signOut();
}

// ── Helpers ──
function isLoggedIn() { return !!currentUser; }
function isPro() {
  return userProfile?.plan === 'pro' || userProfile?.plan === 'lifetime' || isEmailTrialActive();
}
function getUserDisplayName() {
  return userProfile?.display_name || currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || 'Reader';
}
function getUserEmail() { return currentUser?.email || ''; }
function getUserPlan() { return userProfile?.plan || 'free'; }

// ── Initialize on load ──
document.addEventListener('DOMContentLoaded', initAuth);
