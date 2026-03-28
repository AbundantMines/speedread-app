// WarpReader — WPM Progress Tracking
// GET  /api/wpm?userId=xxx  → returns history array
// POST /api/wpm             → saves a new test result
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, DB (D1 fallback)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const anonId = url.searchParams.get('anonId'); // fallback for logged-out users

  try {
    let results = [];

    // Try Supabase first (logged-in users)
    if (userId && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/wpm_tests?user_id=eq.${userId}&order=created_at.asc&limit=30`,
        { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
      );
      if (res.ok) results = await res.json();
    }

    // D1 fallback (anon users or backup)
    if (!results.length && anonId && env.DB) {
      const r = await env.DB.prepare(
        'SELECT wpm, percentile, created_at FROM wpm_results WHERE anon_id=? ORDER BY created_at ASC LIMIT 30'
      ).bind(anonId).all();
      results = r.results || [];
    }

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', ...cors } });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { userId, anonId, wpm, percentile, source } = await request.json();

    if (!wpm || wpm < 50 || wpm > 2000) {
      return new Response(JSON.stringify({ error: 'Invalid WPM' }), { status: 400, headers: cors });
    }

    const entry = {
      wpm: Math.round(wpm),
      percentile: Math.round(percentile || 0),
      source: source || 'test',
      created_at: new Date().toISOString(),
    };

    // Save to Supabase (logged-in users)
    if (userId && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/wpm_tests`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ user_id: userId, ...entry }),
      });
    }

    // Always save to D1 (anon + logged-in both get stored for stats)
    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO wpm_results (user_id, anon_id, wpm, percentile, source, created_at) VALUES (?,?,?,?,?,?)'
      ).bind(userId || null, anonId || null, entry.wpm, entry.percentile, entry.source, entry.created_at).run();
    }

    return new Response(JSON.stringify({ ok: true, entry }), {
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Save failed' }), { status: 500, headers: cors });
  }
}
