// WarpReader — Email Queue Processor
// Cloudflare Pages Function: POST /api/send-email-queue
// Called by a cron or manual trigger to drain the email queue
// Also handles abandon recovery for checkout_intents

export async function onRequestPost(context) {
  const { env, request } = context;

  // Auth check — only internal calls
  const authHeader = request.headers.get('x-internal-key');
  if (authHeader !== env.INTERNAL_API_KEY && env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!env.RESEND_API_KEY || !env.DB) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY or DB binding' }), { status: 500 });
  }

  const results = { sent: 0, failed: 0, abandon_recovery: 0 };

  // ── 1. Drain email_queue (Day 3 + Day 7 sequences) ──
  const queued = await env.DB.prepare(
    `SELECT id, email, template FROM email_queue WHERE sent=0 AND send_at <= datetime('now') LIMIT 20`
  ).all();

  for (const row of queued.results || []) {
    try {
      const html = row.template === 'day3' ? getDay3Email(row.email) : getDay7Email(row.email);
      const subject = row.template === 'day3'
        ? 'Day 3 check-in — how\'s your reading speed?'
        : 'Day 7: Your trial ends tomorrow. Here\'s your progress.';

      const res = await sendEmail(env.RESEND_API_KEY, { to: row.email, subject, html });
      if (res.ok) {
        await env.DB.prepare('UPDATE email_queue SET sent=1 WHERE id=?').bind(row.id).run();
        results.sent++;
      } else {
        results.failed++;
      }
    } catch (e) {
      results.failed++;
    }
  }

  // ── 2. Abandon recovery: emails captured but never converted ──
  const abandoned = await env.DB.prepare(
    `SELECT email, plan, created_at FROM checkout_intents
     WHERE converted=0
     AND abandoned_email_sent IS NULL
     AND created_at <= datetime('now', '-2 hours')
     LIMIT 20`
  ).all();

  for (const row of abandoned.results || []) {
    try {
      const hoursAgo = Math.round((Date.now() - new Date(row.created_at).getTime()) / 3600000);
      const subject = hoursAgo < 48
        ? 'You left your WarpReader trial unfinished'
        : 'Last chance: your $1 WarpReader trial';

      const res = await sendEmail(env.RESEND_API_KEY, {
        to: row.email,
        subject,
        html: getAbandonEmail(row.email, hoursAgo),
      });

      if (res.ok) {
        await env.DB.prepare(
          `UPDATE checkout_intents SET abandoned_email_sent=datetime('now') WHERE email=?`
        ).bind(row.email).run();
        results.abandon_recovery++;
      }
    } catch (e) {
      results.failed++;
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

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

function getAbandonEmail(email, hoursAgo) {
  const checkoutUrl = 'https://warpreader.com/app.html';
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0">
<h1 style="color:#c9a84c">You left your trial unfinished</h1>
<p>You entered your email for a WarpReader trial ${hoursAgo < 48 ? 'a few hours' : 'yesterday'} ago — then something stopped you.</p>
<p>The $1 trial link is still here:</p>
<a href="${checkoutUrl}" style="display:inline-block;background:#c9a84c;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0">Start 7-day trial for $1 →</a>
<p style="color:#888">$1 today. Then $39.99/yr ($3.33/mo). Cancel before day 7 and you're charged nothing more.</p>
<p>If something got in the way, reply and let me know — I read everything.</p>
<p>— Beau<br><small style="color:#666">Founder, WarpReader</small></p>
</body></html>`;
}

function getDay3Email(email) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0">
<h1 style="color:#c9a84c">Day 3 check-in ⚡</h1>
<p>Three days in. This is usually when readers start to feel the shift — words come faster, comprehension stays high.</p>
<h2 style="color:#c9a84c">Day 3 Challenge: Push 50 WPM Faster</h2>
<ol>
  <li>Open WarpReader and set your speed 50 WPM above your Day 1 baseline</li>
  <li>Read for 20 minutes at the higher speed — it should feel slightly uncomfortable</li>
  <li>That discomfort is your brain rewiring. Stay with it.</li>
</ol>
<p>Take the <a href="https://warpreader.com/test" style="color:#c9a84c">speed test</a> after. Log your new score — you'll want this data.</p>
<p>4 days left in your trial. Most readers who make it to Day 7 never go back to slow reading.</p>
<p>— Beau</p>
</body></html>`;
}

function getDay7Email(email) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e0e0e0">
<h1 style="color:#c9a84c">Day 7: Tomorrow you get charged. Here's what you've gained.</h1>
<p>Your trial ends tomorrow. Before you decide, ask yourself one question:</p>
<blockquote style="border-left:3px solid #c9a84c;padding-left:16px;color:#aaa;font-style:italic">How many pages did I read this week that I wouldn't have read without WarpReader?</blockquote>
<p>If that number is greater than zero — you already got your money's worth. At $3.33/mo, that's one cup of coffee for a year of reading faster.</p>
<p>If you want to cancel: Account → Manage Subscription. No questions asked.</p>
<p>If you want to keep going: <a href="https://warpreader.com/app.html" style="color:#c9a84c">open the app and read something today</a>.</p>
<p>— Beau</p>
</body></html>`;
}
