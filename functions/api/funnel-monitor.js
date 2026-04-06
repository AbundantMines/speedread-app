// Cloudflare Pages Function: GET /api/funnel-monitor
// Queries D1 analytics_events table and returns funnel analysis with anomaly flags

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const now = Math.floor(Date.now() / 1000);
    const h24 = now - 86400;
    const h48 = now - 172800;

    const steps = [
      "page_view",
      "pricing_viewed",
      "checkout_start",
      "doc_loaded",
      "soft_lead_shown",
      "soft_lead_submitted",
      "auth_signed_in",
    ];

    // Build step count queries for last 24h and previous 24h
    const stepCountsLast24 = {};
    const stepCountsPrev24 = {};

    for (const step of steps) {
      const resLast = await db
        .prepare(
          `SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type = ? AND timestamp >= ?`
        )
        .bind(step, h24)
        .first();
      stepCountsLast24[step] = resLast ? resLast.cnt : 0;

      const resPrev = await db
        .prepare(
          `SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type = ? AND timestamp >= ? AND timestamp < ?`
        )
        .bind(step, h48, h24)
        .first();
      stepCountsPrev24[step] = resPrev ? resPrev.cnt : 0;
    }

    // All-time step counts
    const stepCountsAll = {};
    for (const step of steps) {
      const res = await db
        .prepare(`SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type = ?`)
        .bind(step)
        .first();
      stepCountsAll[step] = res ? res.cnt : 0;
    }

    // Conversion rates between steps (all-time)
    const conversionRates = {};
    for (let i = 0; i < steps.length - 1; i++) {
      const from = steps[i];
      const to = steps[i + 1];
      const fromCount = stepCountsAll[from];
      conversionRates[`${from}_to_${to}`] =
        fromCount > 0 ? ((stepCountsAll[to] / fromCount) * 100).toFixed(2) + "%" : "N/A";
    }

    // Last 24h conversion rates
    const conversionRatesLast24 = {};
    for (let i = 0; i < steps.length - 1; i++) {
      const from = steps[i];
      const to = steps[i + 1];
      const fromCount = stepCountsLast24[from];
      conversionRatesLast24[`${from}_to_${to}`] =
        fromCount > 0 ? ((stepCountsLast24[to] / fromCount) * 100).toFixed(2) + "%" : "N/A";
    }

    // Anomaly detection
    const anomalies = [];

    // "checkout_start > 0 but 0 conversions in 24h"
    if (stepCountsLast24["checkout_start"] > 0 && stepCountsLast24["auth_signed_in"] === 0) {
      anomalies.push({
        flag: "checkout_start > 0 but 0 conversions in 24h",
        detail: `${stepCountsLast24["checkout_start"]} checkout_start events, 0 auth_signed_in`,
        severity: "high",
      });
    }

    // "views up but docs_loaded flat"
    const viewsChange = stepCountsLast24["page_view"] - stepCountsPrev24["page_view"];
    const docsChange = stepCountsLast24["doc_loaded"] - stepCountsPrev24["doc_loaded"];
    if (viewsChange > 10 && docsChange <= 0) {
      anomalies.push({
        flag: "views up but docs_loaded flat",
        detail: `page_view +${viewsChange} vs prev 24h, doc_loaded change: ${docsChange}`,
        severity: "medium",
      });
    }

    // Pricing drop-off
    if (
      stepCountsLast24["pricing_viewed"] > 5 &&
      stepCountsLast24["checkout_start"] === 0
    ) {
      anomalies.push({
        flag: "pricing_viewed with 0 checkout_start in 24h",
        detail: `${stepCountsLast24["pricing_viewed"]} pricing views, 0 checkout starts`,
        severity: "medium",
      });
    }

    // Soft lead shown but 0 submitted
    if (
      stepCountsLast24["soft_lead_shown"] > 5 &&
      stepCountsLast24["soft_lead_submitted"] === 0
    ) {
      anomalies.push({
        flag: "soft_lead_shown with 0 submissions in 24h",
        detail: `${stepCountsLast24["soft_lead_shown"]} shown, 0 submitted`,
        severity: "low",
      });
    }

    const result = {
      generated_at: new Date().toISOString(),
      funnel: {
        all_time: stepCountsAll,
        last_24h: stepCountsLast24,
        previous_24h: stepCountsPrev24,
      },
      conversion_rates: {
        all_time: conversionRates,
        last_24h: conversionRatesLast24,
      },
      anomalies,
      anomaly_count: anomalies.length,
    };

    return new Response(JSON.stringify(result, null, 2), { headers, status: 200 });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { headers, status: 500 }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
