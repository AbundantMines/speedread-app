// WarpReader — Stripe Webhook Handler
// Cloudflare Pages Function: POST /api/stripe-webhook
// Handles: checkout.session.completed, customer.subscription.*, trial_will_end
// Env vars required: STRIPE_SK, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY

export async function onRequestPost(context) {
  const { request, env } = context;

  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  // Verify Stripe webhook signature
  let event;
  try {
    event = await verifyStripeWebhook(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Trial + Checkout completed → create/upgrade account ──
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_email || session.customer_details?.email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const plan = session.metadata?.plan || 'pro_monthly';
        const isLifetime = plan === 'lifetime';

        if (email) {
          // Mark checkout_intent as converted in D1
          if (env.DB) {
            await env.DB.prepare(
              'UPDATE checkout_intents SET converted=1 WHERE email=?'
            ).bind(email).run();
          }

          // Upsert Supabase profile with pro status
          await upsertSupabaseProfile(env, email, {
            plan: isLifetime ? 'lifetime' : 'pro',
            stripe_customer_id: customerId,
            subscription_id: subscriptionId,
            plan_started_at: new Date().toISOString(),
          });

          // Send trial welcome email (Day 1 activation)
          if (env.RESEND_API_KEY) {
            try {
              const { TEMPLATES } = await import('./email-templates.js');
              const { subject, html } = TEMPLATES.trial_welcome(email);
              await sendEmail(env.RESEND_API_KEY, { to: email, subject, html });
            } catch (e) { console.error('[trial-welcome]', e); }
          }

          // Schedule Day 3 + Day 7 trial sequence (store in D1)
          if (env.DB) {
            const now = new Date();
            const day3 = new Date(now.getTime() + 3 * 86400000);
            const day7 = new Date(now.getTime() + 7 * 86400000);
            day3.setUTCHours(15, 0, 0, 0);
            day7.setUTCHours(15, 0, 0, 0);
            await env.DB.prepare(
              `INSERT OR IGNORE INTO email_queue (email, template, send_at, sent) VALUES (?, 'trial_day3', ?, 0), (?, 'trial_day7', ?, 0)`
            ).bind(email, day3.toISOString(), email, day7.toISOString()).run();
            // Stop the lead nurture sequence — they converted
            await env.DB.prepare(
              `DELETE FROM email_queue WHERE email=? AND template IN ('mistakes','science','drill','social_proof','abandon_1','abandon_2')`
            ).bind(email).run();
          }
        }
        break;
      }

      // ── Trial ending in 3 days → final retention email ──
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const customer = await fetchStripeCustomer(env.STRIPE_SK, sub.customer);
        const email = customer?.email;
        if (email && env.RESEND_API_KEY) {
          await sendEmail(env.RESEND_API_KEY, {
            to: email,
            subject: 'Your WarpReader trial ends in 3 days',
            html: getTrialEndingEmail(email),
          });
        }
        break;
      }

      // ── Subscription cancelled → downgrade to free ──
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = await fetchStripeCustomer(env.STRIPE_SK, sub.customer);
        const email = customer?.email;
        if (email) {
          await upsertSupabaseProfile(env, email, { plan: 'free', subscription_id: null });
        }
        break;
      }

      // ── Payment failed ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const email = invoice.customer_email;
        if (email && env.RESEND_API_KEY) {
          await sendEmail(env.RESEND_API_KEY, {
            to: email,
            subject: 'Action needed — WarpReader payment failed',
            html: getPaymentFailedEmail(email),
          });
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[WarpReader Webhook] Error:', e);
    return new Response(JSON.stringify({ error: 'Handler failed' }), { status: 500 });
  }
}

// ── Stripe signature verification (HMAC-SHA256) ──
async function verifyStripeWebhook(payload, sigHeader, secret) {
  if (!secret) return JSON.parse(payload); // dev mode — skip verification

  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signatures = sigHeader.split(',')
    .filter(p => p.startsWith('v1='))
    .map(p => p.slice(3));

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (!signatures.includes(sigHex)) throw new Error('Signature mismatch');
  return JSON.parse(payload);
}

// ── Supabase profile upsert via Admin REST API ──
// Looks up user by email via admin API, then patches/creates profile by user UUID
async function upsertSupabaseProfile(env, email, updates) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  try {
    const adminHeaders = {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 1. Look up user by email via admin auth API
    const usersRes = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
      { headers: adminHeaders }
    );
    let userId = null;
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      userId = usersData?.users?.[0]?.id || null;
    }

    const profileData = { email, ...updates, updated_at: new Date().toISOString() };

    if (userId) {
      // User exists — upsert by id (primary key)
      await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(profileData),
      });
    }

    // Also upsert wpm_tests if relevant (nothing to do here on checkout — just profile)
    console.log(`[WarpReader Webhook] Profile updated: ${email} → plan=${updates.plan}`);
  } catch (e) {
    console.error('[WarpReader Webhook] Supabase upsert failed:', e);
  }
}

// ── Fetch Stripe customer by ID ──
async function fetchStripeCustomer(sk, customerId) {
  if (!sk || !customerId) return null;
  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: { 'Authorization': `Basic ${btoa(sk + ':')}` }
  });
  return res.ok ? res.json() : null;
}

// ── Send email via Resend ──
async function sendEmail(apiKey, { to, subject, html }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'WarpReader <hello@warpreader.com>',
      to,
      subject,
      html,
    }),
  });
}

// ── Email templates ──
function getWelcomeEmail(email, plan) {
  const isAnnual = plan === 'pro_annual';
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0">
<h1 style="color:#c9a84c">Your trial has started. Here's Day 1. ⚡</h1>
<p>You're officially a WarpReader. Your 7-day trial is live.</p>
<h2 style="color:#c9a84c">Day 1 Assignment: Establish Your Baseline</h2>
<ol>
  <li>Open <a href="https://warpreader.com/app.html" style="color:#c9a84c">WarpReader</a></li>
  <li>Set your speed to <strong>your current comfortable WPM</strong></li>
  <li>Read for 15 minutes — a book you've been meaning to finish</li>
  <li>Take the <a href="https://warpreader.com/test" style="color:#c9a84c">speed test</a> and save your score</li>
</ol>
<p>Most readers gain <strong>40-80 WPM in their first week</strong> just by using RSVP consistently. Your brain adapts fast.</p>
<p>Reply to this email any time if you have questions. I read everything.</p>
<p>— Hal<br><small style="color:#666">Warpreader AI</small></p>
<hr style="border-color:#333">
<small style="color:#555">You're getting this because you started a trial at warpreader.com. <a href="https://warpreader.com" style="color:#555">Manage subscription</a></small>
</body></html>`;
}

function getTrialEndingEmail(email) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0">
<h1 style="color:#c9a84c">Your trial ends in 3 days</h1>
<p>If you've been reading with WarpReader this week, you've already seen what it does. Most readers gain 40-100 WPM in their first 7 days.</p>
<p>Your subscription continues automatically at $3.33/mo (billed annually). If you want to cancel, do it now — no hard feelings and no charges.</p>
<a href="https://warpreader.com/app.html" style="display:inline-block;background:#c9a84c;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Keep reading →</a>
<p style="color:#888">To cancel: go to warpreader.com/app.html → Account → Manage Subscription.</p>
<p>— Hal<br><small style="color:#666">Warpreader AI</small></p>
</body></html>`;
}

function getPaymentFailedEmail(email) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0">
<h1 style="color:#c9a84c">Payment issue — action needed</h1>
<p>We couldn't process your WarpReader payment. Your account will stay active for a few more days while you update your payment method.</p>
<a href="https://warpreader.com/app.html" style="display:inline-block;background:#c9a84c;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Update payment method →</a>
<p>— Hal<br><small style="color:#666">Warpreader AI</small></p>
</body></html>`;
}
