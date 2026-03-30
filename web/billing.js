// ═══════════════════════════════════════════════════════════════
// Warpreader — Billing (Stripe)
// ═══════════════════════════════════════════════════════════════

// ── Replace with your Stripe publishable key ──
const STRIPE_PUBLISHABLE_KEY = 'pk_live_Pnwv4b9mbVYsh02hYPCga4I5';

// ── Stripe Price IDs ──
const PRICE_IDS = {
  pro_monthly: 'price_1TCnO8FfldkL2s76NGle1oX3',  // $4.99/mo
  pro_annual:  'price_1TCnO9FfldkL2s760PCk7Xvj',   // $39.99/yr
  lifetime:    'price_1TCnOAFfldkL2s76iItda4tX',   // $99 one-time
};

let stripeInstance = null;

function initBilling() {
  if (STRIPE_PUBLISHABLE_KEY === 'pk_live_YOUR_KEY') {
    console.warn('[Warpreader Billing] Stripe not configured — checkout disabled');
    return;
  }
  if (typeof Stripe === 'undefined') {
    console.warn('[Warpreader Billing] Stripe JS not loaded');
    return;
  }
  stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
}

/**
 * Open Stripe Checkout for a given plan.
 * If user email not known, capture it first then proceed.
 * @param {'pro_monthly'|'pro_annual'|'lifetime'} plan
 * @param {string} [knownEmail] - pre-fill email (skips capture modal)
 */
async function openCheckout(plan, knownEmail) {
  const planPrices = { pro_monthly: 4.99, pro_annual: 39.99, lifetime: 99 };
  if (typeof wrTrack === 'function') wrTrack('checkout_start', { plan, price: planPrices[plan] || 0 });

  if (!stripeInstance) { showUpgradeModal(); return; }

  const priceId = PRICE_IDS[plan];
  if (!priceId || priceId.startsWith('price_YOUR_')) {
    alert('Stripe price IDs not configured yet. See billing.js');
    return;
  }

  // ── Pre-checkout email capture (if we don't have it) ──
  const existingEmail = knownEmail
    || (typeof currentUser !== 'undefined' && currentUser?.email)
    || localStorage.getItem('wr_lead_email');

  if (!existingEmail) {
    _pendingCheckoutPlan = plan;
    _showPreCheckoutModal();
    return; // modal will call openCheckout(plan, email) on submit
  }

  // ── Persist email for abandon recovery ──
  localStorage.setItem('wr_lead_email', existingEmail);
  if (typeof wrTrack === 'function') wrTrack('checkout_email_captured', { plan });

  // ── Server-side lead save (fire-and-forget, never blocks checkout) ──
  const wpmResult = (() => { try { return JSON.parse(localStorage.getItem('speedread_wpm_test') || '{}').wpm; } catch(_) { return null; } })();
  fetch('/api/save-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: existingEmail, plan, source: document.referrer || 'direct', wpm: wpmResult })
  }).catch(() => {});

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        plan,
        email: existingEmail,
        userId: (typeof currentUser !== 'undefined' && currentUser?.id) || null,
        // Do NOT append ?upgraded=true here — server appends ?upgraded=true&session_id={CHECKOUT_SESSION_ID}
        successUrl: window.location.origin + '/app.html',
        cancelUrl: window.location.origin + '/app.html',
      })
    });
    const session = await response.json();
    if (session.error) throw new Error(session.error);
    if (!session.url) throw new Error('No checkout URL returned');
    // Use session.url (modern redirect) — more reliable than redirectToCheckout
    window.location.href = session.url;
  } catch (e) {
    console.error('[Warpreader Billing] Checkout error:', e);
    // Log checkout error to D1 analytics
    _logCheckoutError(plan, e.message);
    // Show visible error to user
    _showCheckoutError(e.message);
  }
}

// ── Pre-checkout email modal ──
let _pendingCheckoutPlan = null;

function _showPreCheckoutModal() {
  const existing = document.getElementById('pre-checkout-modal');
  if (existing) { existing.remove(); }

  const isLifetime = _pendingCheckoutPlan === 'lifetime';
  const planLabels = { pro_monthly: '$1 today → $4.99/mo', pro_annual: '$1 today → $39.99/yr', lifetime: '$99 one-time' };
  const label = planLabels[_pendingCheckoutPlan] || 'Pro';

  const overlay = document.createElement('div');
  overlay.id = 'pre-checkout-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--bg-card,#1a1a2e);border:1px solid var(--border,#333);border-radius:18px;padding:32px 28px;max-width:400px;width:100%;text-align:center">
      <div style="font-size:2rem;margin-bottom:8px">${isLifetime ? '🔑' : '⚡'}</div>
      <h3 style="font-size:1.25rem;font-weight:800;margin-bottom:6px">${isLifetime ? 'Almost there' : 'Start your 7-day trial for $1'}</h3>
      <p style="color:var(--text-muted,#888);font-size:.9rem;margin-bottom:20px">${isLifetime ? 'Enter your email — we\'ll send your receipt.' : '$1 today. Then ${label.split('→')[1]?.trim() || label} after 7 days. Cancel anytime before day 7.'}</p>
      <input type="email" id="pre-checkout-email" placeholder="your@email.com" autocomplete="email"
        style="width:100%;box-sizing:border-box;background:var(--bg-elevated,#111);border:1px solid var(--border,#333);border-radius:10px;padding:12px 14px;color:var(--text,#fff);font-size:1rem;margin-bottom:12px">
      <button onclick="_submitPreCheckout()" style="width:100%;background:var(--accent,#c9a84c);color:#000;border:none;border-radius:10px;padding:13px;font-weight:800;font-size:1rem;cursor:pointer">
        ${isLifetime ? 'Continue →' : 'Start 7-Day Trial — $1 →'}
      </button>
      <div style="font-size:.75rem;color:var(--text-muted,#666);margin-top:8px">${isLifetime ? '' : '7-day trial · $1 today · cancel before day 7 to pay nothing more'}</div>
      <button onclick="document.getElementById('pre-checkout-modal').remove()" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:.85rem;margin-top:12px;display:block;width:100%">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('pre-checkout-email')?.focus(), 100);
}

function _submitPreCheckout() {
  const email = document.getElementById('pre-checkout-email')?.value?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('pre-checkout-email')?.focus();
    return;
  }
  document.getElementById('pre-checkout-modal')?.remove();
  openCheckout(_pendingCheckoutPlan, email);
}

// ── Checkout error logging + visible error UI ──
function _logCheckoutError(plan, errorMsg) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'checkout_error',
        page: window.location.pathname,
        session_id: (() => { let s = sessionStorage.getItem('wr_sid'); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem('wr_sid', s); } return s; })(),
        properties: { plan, error: errorMsg, ts: Date.now() }
      })
    }).catch(() => {});
  } catch(_) {}
}

function _showCheckoutError(errorMsg) {
  // Remove any existing error
  const prev = document.getElementById('wr-checkout-error-banner');
  if (prev) prev.remove();

  const banner = document.createElement('div');
  banner.id = 'wr-checkout-error-banner';
  banner.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1a1a2e', 'border:1.5px solid #ef4444', 'color:#fca5a5',
    'border-radius:12px', 'padding:14px 20px', 'z-index:9999',
    'font-size:.95rem', 'max-width:420px', 'width:calc(100% - 48px)',
    'display:flex', 'align-items:center', 'gap:12px', 'box-shadow:0 4px 24px rgba(0,0,0,.5)'
  ].join(';');
  banner.innerHTML = `
    <span style="font-size:1.3rem">⚠️</span>
    <span style="flex:1">Checkout failed: ${errorMsg || 'Something went wrong. Please try again.'}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:1.1rem;line-height:1;flex-shrink:0">✕</button>
  `;
  document.body.appendChild(banner);
  // Auto-dismiss after 8s
  setTimeout(() => { if (banner.parentElement) banner.remove(); }, 8000);
}

// ── Check for successful upgrade ──
function checkUpgradeSuccess() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('upgraded') === 'true') {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    showUpgradeSuccess();
  }
}

function showUpgradeSuccess() {
  // Confetti
  launchConfetti();
  // Banner
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:16px;background:linear-gradient(135deg,#38bdf8,#7dd3fc);color:#000;text-align:center;font-weight:700;font-size:18px;z-index:3001;animation:slideDown 0.5s ease';
  banner.textContent = '🎉 You\'re now Pro! Unlimited speed reading unlocked.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);
}

function launchConfetti() {
  const colors = ['#38bdf8', '#22c55e', '#e63946', '#3b82f6', '#f59e0b', '#8b5cf6'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (6 + Math.random() * 8) + 'px';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initBilling();
  checkUpgradeSuccess();
});
