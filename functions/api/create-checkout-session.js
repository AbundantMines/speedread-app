// Warpreader — Stripe Checkout Session Creator
// Cloudflare Pages Function: POST /api/create-checkout-session
// Requires env var: STRIPE_SK (set in Cloudflare Pages → Settings → Environment Variables)

export async function onRequestPost(context) {
  const { request, env } = context;
  const STRIPE_SK = env.STRIPE_SK;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { priceId, plan, userId, email, successUrl, cancelUrl } = await request.json();

    if (!STRIPE_SK) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Missing priceId' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Build Stripe Checkout session via form-encoded API
    const isSubscription = plan !== 'lifetime';

    const params = new URLSearchParams({
      mode: isSubscription ? 'subscription' : 'payment',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: (successUrl || 'https://warpreader.com/app.html') + '?upgraded=true&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  cancelUrl  || 'https://warpreader.com/app.html',
      'allow_promotion_codes': 'true',
    });

    // 7-day free trial for subscriptions (reduces cold-audience friction dramatically)
    if (isSubscription) {
      params.set('subscription_data[trial_period_days]', '7');
      params.set('payment_method_collection', 'always'); // require card even for trial
    }

    // Pre-fill email if provided (from pre-checkout capture)
    if (email) params.set('customer_email', email);

    if (userId) params.set('client_reference_id', userId);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SK}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ id: session.id, url: session.url }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
