// Warpreader — Lead capture + sequence scheduler
// POST /api/save-lead
// Saves email to checkout_intents AND schedules the nurture sequence

import { TEMPLATES } from './email-templates.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { email, plan, source, wpm, skip_welcome } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid email' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ ok: false, error: 'no db' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

    // Check if email already exists — avoid duplicate sequences
    const existing = await db.prepare(
      'SELECT email, sequence_started FROM checkout_intents WHERE email=?'
    ).bind(email).first();

    // Upsert intent
    await db.prepare(`
      INSERT INTO checkout_intents (email, plan, source, wpm, created_at, converted)
      VALUES (?, ?, ?, ?, datetime('now'), 0)
      ON CONFLICT(email) DO UPDATE SET
        plan=excluded.plan,
        source=excluded.source,
        wpm=COALESCE(excluded.wpm, wpm),
        updated_at=datetime('now')
    `).bind(email, plan || 'lead', source || 'direct', wpm || null).run();

    // Only schedule sequence if this is a new lead (avoid spamming existing leads)
    if (!existing || !existing.sequence_started) {
      await scheduleNurtureSequence(db, email);
      await db.prepare('UPDATE checkout_intents SET sequence_started=datetime(\'now\') WHERE email=?').bind(email).run();

      // Send immediate welcome email
      if (env.RESEND_API_KEY && !skip_welcome) {
        try {
          const { subject, html } = TEMPLATES.welcome(email, wpm);
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Warpreader <hello@warpreader.com>',
              reply_to: 'hello@warpreader.com',
              to: email,
              subject,
              html,
            }),
          });
        } catch (e) {
          console.error('[welcome-email]', e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sequence_scheduled: !existing }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...cors }
    });
  } catch (e) {
    console.error('[save-lead]', e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors }
    });
  }
}

// Schedule the value-forward nurture sequence
async function scheduleNurtureSequence(db, email) {
  const now = new Date();
  const queue = [
    // Day 2: 3 mistakes (pure value)
    { template: 'mistakes', daysOffset: 2 },
    // Day 4: The science (builds authority)
    { template: 'science', daysOffset: 4 },
    // Day 7: The drill + first soft ask
    { template: 'drill', daysOffset: 7 },
    // Day 10: Social proof + second soft ask
    { template: 'social_proof', daysOffset: 10 },
  ];

  for (const item of queue) {
    const sendAt = new Date(now);
    sendAt.setDate(sendAt.getDate() + item.daysOffset);
    // Send at 9am local-ish (9am UTC is a reasonable default)
    sendAt.setUTCHours(15, 0, 0, 0); // 15:00 UTC = 8am PT = 11am ET
    try {
      await db.prepare(
        'INSERT OR IGNORE INTO email_queue (email, template, send_at, sent) VALUES (?, ?, ?, 0)'
      ).bind(email, item.template, sendAt.toISOString()).run();
    } catch (e) {
      console.error('[schedule]', item.template, e);
    }
  }
}
