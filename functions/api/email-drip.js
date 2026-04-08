// Warpreader — Email Drip Trigger Endpoint
// POST /api/email-drip
// Accepts { email, trigger } where trigger is one of:
//   signup | test_complete | checkout_abandon
// Stores the event in D1 email_events table and sends immediate email via Resend

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
    const { email, trigger, wpm, plan } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'invalid email' }, 400);
    }

    const validTriggers = ['signup', 'test_complete', 'checkout_abandon'];
    if (!trigger || !validTriggers.includes(trigger)) {
      return json({ ok: false, error: 'invalid trigger, expected: ' + validTriggers.join(', ') }, 400);
    }

    const db = env.DB;
    if (!db) {
      return json({ ok: false, error: 'D1 not bound' }, 500);
    }

    // Ensure email_events table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS email_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        wpm INTEGER,
        plan TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(email, trigger_type)
      )
    `).run();

    // Insert event (ignore duplicates)
    await db.prepare(`
      INSERT OR IGNORE INTO email_events (email, trigger_type, wpm, plan)
      VALUES (?, ?, ?, ?)
    `).bind(email, trigger, wpm || null, plan || null).run();

    // Send immediate email based on trigger
    let emailSent = false;
    if (env.RESEND_API_KEY) {
      try {
        let template = null;

        switch (trigger) {
          case 'signup':
            template = TEMPLATES.welcome(email, wpm);
            break;
          case 'test_complete':
            template = TEMPLATES.welcome(email, wpm);
            break;
          case 'checkout_abandon':
            template = TEMPLATES.abandon_1(email, plan || 'pro_annual');
            break;
        }

        if (template) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Warpreader <hello@warpreader.com>',
              reply_to: 'hello@warpreader.com',
              to: email,
              subject: template.subject,
              html: template.html,
            }),
          });
          emailSent = res.ok;
        }
      } catch (e) {
        console.error('[email-drip] send failed:', e);
      }
    }

    // Also ensure lead is saved (upsert into checkout_intents via save-lead logic)
    try {
      await db.prepare(`
        INSERT INTO checkout_intents (email, plan, source, wpm, created_at, converted)
        VALUES (?, ?, ?, ?, datetime('now'), 0)
        ON CONFLICT(email) DO UPDATE SET
          plan=COALESCE(excluded.plan, plan),
          wpm=COALESCE(excluded.wpm, wpm),
          updated_at=datetime('now')
      `).bind(email, plan || 'lead', 'drip_' + trigger, wpm || null).run();
    } catch (_) {}

    return json({ ok: true, email_sent: emailSent, trigger });

  } catch (e) {
    console.error('[email-drip]', e);
    return json({ ok: false, error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
