// ═══════════════════════════════════════════════════════════════
// Warpreader — Auth (Supabase)
// ═══════════════════════════════════════════════════════════════

// ── Replace these with your Supabase project credentials ──
const SUPABASE_URL = 'https://hmacjbgnvljhgvwdzkds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYWNqYmdudmxqaGd2d2R6a2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDcwODAsImV4cCI6MjA4OTM4MzA4MH0.crS-Y4zEnCmUPM7DBbJvb5nVufgtbEXyW6WpOSBTl2k';

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
    // Redirect to app only if on landing page after OAuth callback
    const isLanding = window.location.pathname === '/' ||
                      window.location.pathname.endsWith('index.html');
    if (isLanding) {
      window.location.href = 'app.html';
    } else {
      // Already on app — just update UI
      if (typeof updateAccountUI === 'function') updateAccountUI();
      if (typeof closeAuthModal === 'function') closeAuthModal();
      if (typeof showToast === 'function') showToast('✅ Signed in as ' + (session.user.email || 'user'));
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    userProfile = null;
    // Do NOT auto-redirect — let user stay on current page, just update UI
    if (typeof updateAccountUI === 'function') updateAccountUI();
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
  if (!supabaseClient) {
    if (typeof showToast === 'function') showToast('⚠️ Auth not configured — check Supabase setup', 4000);
    console.error('[Warpreader Auth] supabaseClient is null — Supabase JS may not have loaded');
    return { error: { message: 'Auth not configured' } };
  }
  try {
    // Show a loading state on the button
    const btn = document.querySelector('.btn-google');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.textContent = 'Connecting…'; }

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/app.html',
        queryParams: { access_type: 'offline', prompt: 'select_account' }
      }
    });

    if (error) {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Continue with Google'; }
      if (typeof showToast === 'function') showToast('⚠️ Google sign-in error: ' + error.message, 5000);
      return { error };
    }
    // If we get here with data.url, Supabase is redirecting — that's correct
    return { data };
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️ Google sign-in failed: ' + e.message, 5000);
    console.error('[Warpreader Auth] signInWithGoogle error:', e);
    return { error: e };
  }
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
