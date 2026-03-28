// WarpReader — Feedback API
// POST /api/feedback — saves feedback to D1
// GET  /api/feedback — returns recent feedback (admin)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-internal-key',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { category, rating, text, email, user_id, wpm, doc, ua } = body;

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Text required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO feedback (category, rating, text, email, user_id, wpm, doc_title, user_agent) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(
        category || 'general',
        rating || null,
        text.trim().slice(0, 2000),
        email || null,
        user_id || null,
        wpm || null,
        doc || null,
        (ua || '').slice(0, 200)
      ).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Save failed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // Admin-only: check internal key
  const authKey = request.headers.get('x-internal-key');
  if (authKey !== env.INTERNAL_API_KEY && env.INTERNAL_API_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    if (!env.DB) {
      return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    const results = await env.DB.prepare(
      'SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?'
    ).bind(Math.min(limit, 200)).all();

    return new Response(JSON.stringify(results.results || []), {
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
