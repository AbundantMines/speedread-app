// ═══════════════════════════════════════════════════════════════
// SpeedRead — Billing (Stripe)
// ═══════════════════════════════════════════════════════════════

// ── Replace with your Stripe publishable key ──
const STRIPE_PUBLISHABLE_KEY = 'pk_live_YOUR_KEY'; // Replace with your Stripe publishable key

// ── Stripe Price IDs — set these after creating products in Stripe Dashboard ──
const PRICE_IDS = {
  pro_monthly: 'price_YOUR_MONTHLY_ID',   // $4.99/mo
  pro_annual:  'price_YOUR_ANNUAL_ID',     // $39.99/yr
  lifetime:    'price_YOUR_LIFETIME_ID',   // $99 one-time
};

let stripeInstance = null;

function initBilling() {
  if (STRIPE_PUBLISHABLE_KEY === 'pk_live_YOUR_KEY') {
    console.warn('[SpeedRead Billing] Stripe not configured — checkout disabled');
    return;
  }
  if (typeof Stripe === 'undefined') {
    console.warn('[SpeedRead Billing] Stripe JS not loaded');
    return;
  }
  stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
}

/**
 * Open Stripe Checkout for a given plan.
 * @param {'pro_monthly'|'pro_annual'|'lifetime'} plan
 */
async function openCheckout(plan) {
  if (!stripeInstance) {
    showUpgradeModal();
    return;
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId || priceId.startsWith('price_YOUR_')) {
    alert('Stripe price IDs not configured yet. See billing.js');
    return;
  }

  // In production, you'd call your server to create a Checkout Session.
  // For client-only demo, we redirect to Stripe Checkout via the API.
  // This requires a server endpoint. For now, show a placeholder.
  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        plan,
        userId: currentUser?.id,
        successUrl: window.location.origin + '/app.html?upgraded=true',
        cancelUrl: window.location.origin + '/app.html',
      })
    });
    const session = await response.json();
    await stripeInstance.redirectToCheckout({ sessionId: session.id });
  } catch (e) {
    console.error('[SpeedRead Billing] Checkout error:', e);
    alert('Checkout is not available yet. Server endpoint needed.');
  }
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
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:16px;background:linear-gradient(135deg,#c9a84c,#d4ad55);color:#000;text-align:center;font-weight:700;font-size:18px;z-index:3001;animation:slideDown 0.5s ease';
  banner.textContent = '🎉 You\'re now Pro! Unlimited speed reading unlocked.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);
}

function launchConfetti() {
  const colors = ['#c9a84c', '#22c55e', '#e63946', '#3b82f6', '#f59e0b', '#8b5cf6'];
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
