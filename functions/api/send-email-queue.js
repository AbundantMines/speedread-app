// Warpreader — Email Queue Processor
// POST /api/send-email-queue (internal key required)
// Drains scheduled email_queue and fires abandon cart recovery.
// Uses templates from ./email-templates.js

import { TEMPLATES } from './email-templates.js';

export async function onRequestPost(context) {
  const { env, request } = context;

  const authHeader = request.headers.get('x-internal-key');
  if (authHeader !== env.INTERNAL_API_KEY && env.INTERNAL_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!env.RESEND_API_KEY || !env.DB) {
    return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY or DB binding' }), { status: 500 });
  }

  const results = { sent: 0, failed: 0, abandon_1: 0, abandon_2: 0, queue_drained: 0 };

  // ── 1. Drain email_queue (scheduled sequences) ──
  const queued = await env.DB.prepare(
    `SELECT id, email, template FROM email_queue WHERE sent=0 AND send_at <= datetime('now') LIMIT 50`
  ).all();

  for (const row of queued.results || []) {
    try {
      const templateFn = TEMPLATES[row.template];
      if (!templateFn) {
        results.failed++;
        continue;
      }
      const { subject, html } = templateFn(row.email);
      const res = await sendEmail(env.RESEND_API_KEY, { to: row.email, subject, html });
      if (res.ok) {
        await env.DB.prepare('UPDATE email_queue SET sent=1, sent_at=datetime(\'now\') WHERE id=?').bind(row.id).run();
        results.sent++;
        results.queue_drained++;
      } else {
        results.failed++;
      }
    } catch (e) {
      console.error('[email-queue]', e);
      results.failed++;
    }
  }

  // ── 2. Abandon cart recovery — Stage 1 (2h after intent) ──
  const abandon1 = await env.DB.prepare(
    `SELECT email, plan, wpm, created_at FROM checkout_intents
     WHERE converted=0
     AND abandoned_email_sent IS NULL
     AND created_at <= datetime('now', '-2 hours')
     AND created_at > datetime('now', '-24 hours')
     LIMIT 20`
  ).all();

  for (const row of abandon1.results || []) {
    try {
      const { subject, html } = TEMPLATES.abandon_1(row.email, row.plan);
      const res = await sendEmail(env.RESEND_API_KEY, { to: row.email, subject, html });
      if (res.ok) {
        await env.DB.prepare(
          `UPDATE checkout_intents SET abandoned_email_sent=datetime('now') WHERE email=?`
        ).bind(row.email).run();
        results.abandon_1++;
      }
    } catch (e) { results.failed++; }
  }

  // ── 3. Abandon cart recovery — Stage 2 (24h after intent, still not converted) ──
  const abandon2 = await env.DB.prepare(
    `SELECT email, plan, created_at FROM checkout_intents
     WHERE converted=0
     AND abandoned_email_sent IS NOT NULL
     AND abandoned_email_2_sent IS NULL
     AND created_at <= datetime('now', '-24 hours')
     AND created_at > datetime('now', '-72 hours')
     LIMIT 20`
  ).all();

  for (const row of abandon2.results || []) {
    try {
      const { subject, html } = TEMPLATES.abandon_2(row.email, row.plan);
      const res = await sendEmail(env.RESEND_API_KEY, { to: row.email, subject, html });
      if (res.ok) {
        await env.DB.prepare(
          `UPDATE checkout_intents SET abandoned_email_2_sent=datetime('now') WHERE email=?`
        ).bind(row.email).run();
        results.abandon_2++;
      }
    } catch (e) { results.failed++; }
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
      from: 'Warpreader <hello@warpreader.com>',
      reply_to: 'hello@warpreader.com',
      to,
      subject,
      html,
    }),
  });
}

// GET endpoint for cron triggers — same auth
export async function onRequestGet(context) {
  return onRequestPost(context);
}
