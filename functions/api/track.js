// Warpreader — Analytics Ingestion Endpoint
// Cloudflare Pages Function: POST /api/track
// Writes funnel events to D1 (warpreader-analytics)

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();

    if (!body.event || typeof body.event !== 'string') {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const props = typeof body.properties === 'object'
      ? JSON.stringify(body.properties)
      : '{}';

    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO analytics_events
          (event, page, utm_source, utm_medium, utm_campaign, referrer, session_id, properties)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        body.event.slice(0, 100),
        (body.page || '').slice(0, 255),
        (body.utm_source || '').slice(0, 100),
        (body.utm_medium || '').slice(0, 100),
        (body.utm_campaign || '').slice(0, 100),
        (body.referrer || '').slice(0, 500),
        (body.session_id || '').slice(0, 64),
        props.slice(0, 2000)
      ).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    // Never break UX — always 200
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
