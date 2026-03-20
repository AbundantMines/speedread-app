// ═══════════════════════════════════════════════════════════════
// Warpreader — Analytics SDK
// Tracks the full awareness → impression → click → conversion funnel
// Events fire to: GA4 (gtag), Microsoft Clarity (auto), /api/track (server)
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── UTM CAPTURE ──
  // Read UTM params from URL, persist across pages in sessionStorage
  function captureUTM() {
    const params = new URLSearchParams(window.location.search);
    const utm = {
      source:   params.get('utm_source')   || sessionStorage.getItem('utm_source')   || '',
      medium:   params.get('utm_medium')   || sessionStorage.getItem('utm_medium')   || '',
      campaign: params.get('utm_campaign') || sessionStorage.getItem('utm_campaign') || '',
      content:  params.get('utm_content')  || sessionStorage.getItem('utm_content')  || '',
      term:     params.get('utm_term')     || sessionStorage.getItem('utm_term')     || '',
    };
    // Only update sessionStorage if params were freshly in URL
    if (params.get('utm_source')) {
      Object.entries(utm).forEach(([k,v]) => { if(v) sessionStorage.setItem('utm_'+k, v); });
    }
    return utm;
  }

  // ── SESSION ID ──
  function getSessionId() {
    let sid = sessionStorage.getItem('wr_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('wr_sid', sid);
    }
    return sid;
  }

  // ── SERVER-SIDE EVENT INGESTION ──
  // POSTs to our Cloudflare Pages Function → persists regardless of ad blockers
  function trackServer(event, properties) {
    const utm = captureUTM();
    const payload = {
      event,
      page: window.location.pathname,
      utm_source:   utm.source,
      utm_medium:   utm.medium,
      utm_campaign: utm.campaign,
      referrer:     document.referrer || '',
      session_id:   getSessionId(),
      properties: Object.assign({}, properties, {
        utm_content: utm.content,
        utm_term:    utm.term,
        title:       document.title,
        screen:      window.innerWidth + 'x' + window.innerHeight,
      })
    };
    // Fire-and-forget, non-blocking
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function(){});
  }

  // ── GA4 EVENT WRAPPER ──
  function trackGA4(event, params) {
    if (typeof gtag === 'function') {
      gtag('event', event, params || {});
    }
  }

  // ── MAIN TRACK FUNCTION (exported as window.wrTrack) ──
  window.wrTrack = function(event, properties) {
    trackServer(event, properties || {});
    trackGA4(event, properties || {});
  };

  // ══════════════════════════════════════════════════
  // AUTO-TRACKED EVENTS
  // ══════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function() {
    var utm = captureUTM();

    // 1. PAGE VIEW
    window.wrTrack('page_view', {
      utm_source:   utm.source,
      utm_medium:   utm.medium,
      utm_campaign: utm.campaign,
    });

    // 2. CTA CLICKS — track all buttons/links that go to /app.html or /billing
    document.querySelectorAll('a[href*="app.html"], a[href*="/app"], .btn-gold').forEach(function(el) {
      el.addEventListener('click', function() {
        window.wrTrack('cta_click', {
          label: el.textContent.trim().slice(0, 80),
          href:  el.getAttribute('href') || '',
          page:  window.location.pathname,
        });
      });
    });

    // 3. PRICING SECTION VIEW (intersection observer)
    var pricingEl = document.getElementById('pricing');
    if (pricingEl && 'IntersectionObserver' in window) {
      var priceObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            window.wrTrack('pricing_viewed', {});
            priceObserver.disconnect();
          }
        });
      }, { threshold: 0.3 });
      priceObserver.observe(pricingEl);
    }

    // 4. SCROLL DEPTH (25 / 50 / 75 / 100%)
    var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
    window.addEventListener('scroll', function() {
      var scrolled = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
      [25, 50, 75, 100].forEach(function(pct) {
        if (!scrollMilestones[pct] && scrolled >= pct) {
          scrollMilestones[pct] = true;
          window.wrTrack('scroll_depth', { percent: pct });
        }
      });
    }, { passive: true });

    // 5. OUTBOUND LINK CLICKS
    document.querySelectorAll('a[href^="http"]').forEach(function(el) {
      el.addEventListener('click', function() {
        var href = el.getAttribute('href') || '';
        if (!href.includes('warpreader.com') && !href.includes('localhost')) {
          window.wrTrack('outbound_click', { url: href.slice(0, 200) });
        }
      });
    });

    // 6. FORM SUBMISSIONS
    document.querySelectorAll('form').forEach(function(form) {
      form.addEventListener('submit', function() {
        window.wrTrack('form_submit', {
          form_id: form.id || form.className.split(' ')[0] || 'unknown'
        });
      });
    });
  });

  // ══════════════════════════════════════════════════
  // APP-SPECIFIC EVENTS (called from app.js / billing.js)
  // ══════════════════════════════════════════════════

  // Call these from app.js at the right moments:
  // wrTrack('rsvp_demo_start', { source: 'hero' })
  // wrTrack('wpm_test_start', {})
  // wrTrack('wpm_test_complete', { wpm: 287 })
  // wrTrack('doc_loaded', { type: 'pdf', word_count: 12400 })
  // wrTrack('session_complete', { words_read: 4200, wpm: 320, duration_sec: 787 })
  // wrTrack('upgrade_modal_shown', { reason: 'word_cutoff' })
  // wrTrack('checkout_start', { plan: 'pro_monthly', price: 4.99 })
  // wrTrack('checkout_complete', { plan: 'pro_monthly', price: 4.99 })
  // wrTrack('trial_activated', { email: '...' })

})();
