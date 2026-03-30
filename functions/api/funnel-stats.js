// Warpreader — Funnel Stats API
// Cloudflare Pages Function: GET /api/funnel-stats
// Returns conversion funnel metrics from D1 analytics_events
// Covers: page_view, pricing_view, checkout_start, checkout_error, upgrade_complete

export async function onRequestGet(context) {
  const { env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const h24  = 86400;
    const h48  = 172800;

    // ── Aggregate counts for last 24h and previous 24h ──
    // analytics_events table schema:
    //   id, event, page, utm_source, utm_medium, utm_campaign,
    //   referrer, session_id, properties, created_at (timestamp)

    // Funnel events we care about:
    // page_view          → any page load
    // pricing_view       → landing page pricing section visibility (event fired from JS)
    // checkout_start     → user clicked a checkout button
    // checkout_error     → checkout call failed
    // upgrade_complete   → stripe webhook confirmed payment

    const eventMap = {
      page_views:       'page_view',
      pricing_views:    'pricing_view',
      checkout_starts:  'checkout_start',
      checkout_errors:  'checkout_error',
      conversions:      'upgrade_complete',
    };

    // Batch query: get all relevant events in the last 48h in one query
    const rows = await env.DB.prepare(`
      SELECT event, COUNT(*) as count,
             SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as last_24h,
             SUM(CASE WHEN created_at < datetime('now', '-1 day') AND created_at >= datetime('now', '-2 days') THEN 1 ELSE 0 END) as prev_24h
      FROM analytics_events
      WHERE event IN ('page_view', 'pricing_view', 'checkout_start', 'checkout_error', 'upgrade_complete')
        AND created_at >= datetime('now', '-2 days')
      GROUP BY event
    `).all();

    // Normalize into a lookup
    const data = {};
    for (const row of (rows.results || [])) {
      data[row.event] = {
        total: row.count || 0,
        last_24h: row.last_24h || 0,
        prev_24h: row.prev_24h || 0,
      };
    }

    const get = (event) => data[event] || { total: 0, last_24h: 0, prev_24h: 0 };

    const pv  = get('page_view');
    const prv = get('pricing_view');
    const cs  = get('checkout_start');
    const ce  = get('checkout_error');
    const cv  = get('upgrade_complete');

    // ── Conversion rates (current 24h) ──
    const safeRate = (num, den) => den > 0 ? Math.round((num / den) * 10000) / 100 : 0;

    const rates_24h = {
      visit_to_pricing:    safeRate(prv.last_24h, pv.last_24h),
      pricing_to_checkout: safeRate(cs.last_24h, prv.last_24h),
      checkout_to_convert: safeRate(cv.last_24h, cs.last_24h),
      visit_to_convert:    safeRate(cv.last_24h, pv.last_24h),
      checkout_error_rate: safeRate(ce.last_24h, cs.last_24h),
    };

    // Previous 24h rates for comparison
    const rates_prev = {
      visit_to_pricing:    safeRate(prv.prev_24h, pv.prev_24h),
      pricing_to_checkout: safeRate(cs.prev_24h, prv.prev_24h),
      checkout_to_convert: safeRate(cv.prev_24h, cs.prev_24h),
      visit_to_convert:    safeRate(cv.prev_24h, pv.prev_24h),
      checkout_error_rate: safeRate(ce.prev_24h, cs.prev_24h),
    };

    // ── Anomaly detection ──
    const anomalies = [];

    // Anomaly 1: Views up but checkouts down
    const pvChange  = pv.last_24h - pv.prev_24h;
    const csChange  = cs.last_24h - cs.prev_24h;
    if (pvChange > 20 && csChange < -2) {
      anomalies.push({
        type: 'views_up_checkouts_down',
        severity: 'warning',
        message: `Page views +${pvChange} vs yesterday, but checkout starts ${csChange}. Funnel drop at pricing step.`,
      });
    }

    // Anomaly 2: High checkout error rate
    if (rates_24h.checkout_error_rate > 10) {
      anomalies.push({
        type: 'high_checkout_errors',
        severity: 'critical',
        message: `Checkout error rate is ${rates_24h.checkout_error_rate}% in the last 24h. Investigate Stripe or API issues.`,
      });
    }

    // Anomaly 3: Zero conversions with meaningful traffic
    if (pv.last_24h > 50 && cv.last_24h === 0 && cs.last_24h > 0) {
      anomalies.push({
        type: 'zero_conversions',
        severity: 'warning',
        message: `${cs.last_24h} checkout starts but 0 conversions in last 24h. Possible Stripe webhook issue.`,
      });
    }

    // Anomaly 4: Conversion rate improved
    const cvImprovement = rates_24h.visit_to_convert - rates_prev.visit_to_convert;
    if (cvImprovement > 0.5 && cv.last_24h > 0) {
      anomalies.push({
        type: 'conversion_up',
        severity: 'info',
        message: `Overall conversion rate improved by ${cvImprovement.toFixed(2)}pp vs yesterday (${rates_prev.visit_to_convert}% → ${rates_24h.visit_to_convert}%).`,
      });
    }

    // ── Top plans converting (from properties JSON) ──
    let topPlans = [];
    try {
      const planRows = await env.DB.prepare(`
        SELECT json_extract(properties, '$.plan') as plan, COUNT(*) as count
        FROM analytics_events
        WHERE event = 'checkout_start'
          AND created_at >= datetime('now', '-7 days')
          AND json_extract(properties, '$.plan') IS NOT NULL
        GROUP BY plan
        ORDER BY count DESC
        LIMIT 5
      `).all();
      topPlans = planRows.results || [];
    } catch(_) {}

    // ── Build response ──
    const response = {
      generated_at: new Date().toISOString(),
      window: '24h vs previous 24h',
      funnel: {
        page_views:      { last_24h: pv.last_24h,  prev_24h: pv.prev_24h,  change: pv.last_24h  - pv.prev_24h  },
        pricing_views:   { last_24h: prv.last_24h, prev_24h: prv.prev_24h, change: prv.last_24h - prv.prev_24h },
        checkout_starts: { last_24h: cs.last_24h,  prev_24h: cs.prev_24h,  change: cs.last_24h  - cs.prev_24h  },
        checkout_errors: { last_24h: ce.last_24h,  prev_24h: ce.prev_24h,  change: ce.last_24h  - ce.prev_24h  },
        conversions:     { last_24h: cv.last_24h,  prev_24h: cv.prev_24h,  change: cv.last_24h  - cv.prev_24h  },
      },
      conversion_rates: {
        last_24h: rates_24h,
        prev_24h: rates_prev,
        delta: {
          visit_to_pricing:    rates_24h.visit_to_pricing    - rates_prev.visit_to_pricing,
          pricing_to_checkout: rates_24h.pricing_to_checkout - rates_prev.pricing_to_checkout,
          checkout_to_convert: rates_24h.checkout_to_convert - rates_prev.checkout_to_convert,
          visit_to_convert:    rates_24h.visit_to_convert    - rates_prev.visit_to_convert,
        },
      },
      top_plans_7d: topPlans,
      anomalies,
      summary: anomalies.filter(a => a.severity === 'critical').length > 0
        ? '🔴 CRITICAL: ' + anomalies.filter(a => a.severity === 'critical').map(a => a.message).join(' | ')
        : anomalies.filter(a => a.severity === 'warning').length > 0
          ? '⚠️ WARNING: ' + anomalies.filter(a => a.severity === 'warning').map(a => a.message).join(' | ')
          : '✅ Funnel healthy',
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Query failed', detail: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
