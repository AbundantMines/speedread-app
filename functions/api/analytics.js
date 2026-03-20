// Warpreader — Analytics Read Endpoint
// Cloudflare Pages Function: GET /api/analytics
// Returns funnel stats for the KPI dashboard (internal use)

export async function onRequestGet(context) {
  const { request, env } = context;

  // Simple auth check via secret header
  const authHeader = request.headers.get('X-Analytics-Key') || '';
  const validKey = env.ANALYTICS_KEY || 'warpreader-analytics-2026';
  if (authHeader !== validKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'DB not bound' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const now = new Date();
  const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
  const weekAgo   = new Date(now - 7*86400000).toISOString().split('T')[0];
  const monthAgo  = new Date(now - 30*86400000).toISOString().split('T')[0];

  async function count(event, since) {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM analytics_events WHERE event=? AND created_at >= ?`
    ).bind(event, since + 'T00:00:00').first();
    return r?.n || 0;
  }

  const [
    pv_24h, pv_7d, pv_30d,
    rsvp_24h, wpm_start_24h, wpm_done_24h,
    cta_24h, doc_24h, session_24h,
    upgrade_24h, checkout_24h,
  ] = await Promise.all([
    count('page_view', yesterday), count('page_view', weekAgo), count('page_view', monthAgo),
    count('rsvp_demo_start', yesterday), count('wpm_test_start', yesterday), count('wpm_test_complete', yesterday),
    count('cta_click', yesterday), count('doc_loaded', yesterday), count('session_complete', yesterday),
    count('upgrade_modal_shown', yesterday), count('checkout_start', yesterday),
  ]);

  // UTM breakdown (7d)
  const utmRows = await env.DB.prepare(`
    SELECT utm_source, utm_campaign, COUNT(*) as visits
    FROM analytics_events
    WHERE event='page_view' AND utm_source != '' AND created_at >= ?
    GROUP BY utm_source, utm_campaign ORDER BY visits DESC LIMIT 20
  `).bind(weekAgo + 'T00:00:00').all();

  // Top events (24h)
  const topEvents = await env.DB.prepare(`
    SELECT event, COUNT(*) as n FROM analytics_events
    WHERE created_at >= ? GROUP BY event ORDER BY n DESC LIMIT 20
  `).bind(yesterday + 'T00:00:00').all();

  const stats = {
    generated_at: now.toISOString(),
    funnel_24h: {
      page_views: pv_24h,
      rsvp_demo_started: rsvp_24h,
      wpm_test_started: wpm_start_24h,
      wpm_test_completed: wpm_done_24h,
      cta_clicks: cta_24h,
      docs_loaded: doc_24h,
      sessions_completed: session_24h,
      upgrade_modal_shown: upgrade_24h,
      checkout_started: checkout_24h,
    },
    funnel_7d:  { page_views: pv_7d },
    funnel_30d: { page_views: pv_30d },
    conversions_24h: {
      visitor_to_cta:   pv_24h   ? (cta_24h / pv_24h * 100).toFixed(1) + '%' : '—',
      cta_to_doc:       cta_24h  ? (doc_24h / cta_24h * 100).toFixed(1) + '%' : '—',
      upgrade_to_checkout: upgrade_24h ? (checkout_24h / upgrade_24h * 100).toFixed(1) + '%' : '—',
    },
    traffic_sources_7d: utmRows.results || [],
    top_events_24h: topEvents.results || [],
  };

  return new Response(JSON.stringify(stats, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
