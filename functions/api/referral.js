// Warpreader — Referral System API
// Cloudflare Pages Function: GET /api/referral, POST /api/referral
//
// D1 DB ID: 855d0ea9-f72a-44d6-aa5c-6159d1576062
// Account ID: c1420b02712836b1fe4735a6e08e9a14
//
// Table schema (run in D1 console):
//   CREATE TABLE IF NOT EXISTS referrals (
//     id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
//     referrer_email TEXT NOT NULL,
//     referred_email TEXT,
//     created_at TEXT DEFAULT (datetime('now')),
//     redeemed INTEGER DEFAULT 0,
//     redeemed_at TEXT
//   );

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── GET /api/referral?referrer_email=foo@bar.com
//    Returns referral stats for a given user
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const referrerEmail = url.searchParams.get('referrer_email');

  if (!referrerEmail) {
    return json({ ok: false, error: 'referrer_email required' }, 400);
  }

  if (!env.DB) {
    return json({ ok: false, error: 'DB not configured' }, 503);
  }

  try {
    // Count total referrals and redeemed referrals
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(redeemed) as redeemed
      FROM referrals
      WHERE referrer_email = ?
    `).bind(referrerEmail.toLowerCase()).first();

    // Get list of referred emails (anonymized — just show domains)
    const list = await env.DB.prepare(`
      SELECT referred_email, created_at, redeemed
      FROM referrals
      WHERE referrer_email = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(referrerEmail.toLowerCase()).all();

    return json({
      ok: true,
      referrer_email: referrerEmail,
      total_referrals: stats?.total || 0,
      redeemed_referrals: stats?.redeemed || 0,
      days_earned: (stats?.redeemed || 0) * 7,
      referrals: (list?.results || []).map(r => ({
        referred_email: r.referred_email
          ? r.referred_email.replace(/^(.).*@(.*)$/, '$1***@$2')
          : null,
        created_at: r.created_at,
        redeemed: !!r.redeemed,
      })),
    });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

// ── POST /api/referral
//    Body: { action: 'create' | 'redeem', referrer_email, referred_email, ref_code }
//
//    action=create: creates a referral record (called when referred user lands + signs up)
//    action=redeem: marks a referral redeemed (called after referred user activates trial)
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, error: 'DB not configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const { action, referrer_email, referred_email } = body;

  if (!action) return json({ ok: false, error: 'action required' }, 400);

  try {
    if (action === 'create') {
      // Validate
      if (!referrer_email) return json({ ok: false, error: 'referrer_email required' }, 400);

      const refEmail = referrer_email.toLowerCase().trim();
      const refrdEmail = referred_email ? referred_email.toLowerCase().trim() : null;

      // Don't allow self-referral
      if (refrdEmail && refrdEmail === refEmail) {
        return json({ ok: false, error: 'Cannot refer yourself' }, 400);
      }

      // Check if referred_email already referred (prevent duplicates if provided)
      if (refrdEmail) {
        const existing = await env.DB.prepare(`
          SELECT id FROM referrals WHERE referred_email = ?
        `).bind(refrdEmail).first();
        if (existing) {
          return json({ ok: true, already_exists: true });
        }
      }

      await env.DB.prepare(`
        INSERT INTO referrals (referrer_email, referred_email, created_at, redeemed)
        VALUES (?, ?, datetime('now'), 0)
      `).bind(refEmail, refrdEmail).run();

      return json({ ok: true, created: true });

    } else if (action === 'redeem') {
      // Mark a referral as redeemed when the referred user activates
      if (!referrer_email || !referred_email) {
        return json({ ok: false, error: 'referrer_email and referred_email required' }, 400);
      }

      const refEmail = referrer_email.toLowerCase().trim();
      const refrdEmail = referred_email.toLowerCase().trim();

      const result = await env.DB.prepare(`
        UPDATE referrals
        SET redeemed = 1, redeemed_at = datetime('now')
        WHERE referrer_email = ?
          AND referred_email = ?
          AND redeemed = 0
      `).bind(refEmail, refrdEmail).run();

      return json({
        ok: true,
        redeemed: result.meta?.changes > 0,
        referrer_bonus_days: 7,
        referred_bonus_days: 7,
      });

    } else {
      return json({ ok: false, error: 'Unknown action' }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS,
  });
}
