// Warpreader — Pre-checkout Lead Save
// Cloudflare Pages Function: POST /api/save-lead
// Saves email + intent before user is redirected to Stripe
// Requires D1 binding: DB (warpreader-analytics)

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { email, plan, source, wpm } = await request.json();
    if (!email) return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const db = env.DB;
    if (db) {
      // Upsert checkout intent — update if email already exists (they may be retrying)
      await db.prepare(`
        INSERT INTO checkout_intents (email, plan, source, wpm, created_at, converted)
        VALUES (?, ?, ?, ?, datetime('now'), 0)
        ON CONFLICT(email) DO UPDATE SET plan=excluded.plan, source=excluded.source, updated_at=datetime('now')
      `).bind(email, plan || 'unknown', source || 'direct', wpm || null).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    // Non-blocking — never fail checkout because of lead save
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }});
}
