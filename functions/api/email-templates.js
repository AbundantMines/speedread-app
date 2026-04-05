// Warpreader — Email Templates
// Value-forward marketing: give before you ask. Every email delivers real value,
// not just a CTA. Brand colors: dark bg #0a0a0a, sky blue #38bdf8, warm text #e8e0d0

const BRAND = {
  bg: '#0a0a0a',
  card: '#0f172a',
  accent: '#38bdf8',
  accentDark: '#0284c7',
  text: '#e8e0d0',
  muted: '#8a9cae',
  border: '#1e293b',
};

const FOOTER = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:20px">
  <tr>
    <td style="text-align:center;font-size:12px;color:${BRAND.muted};font-family:system-ui,-apple-system,sans-serif">
      <a href="https://warpreader.com" style="color:${BRAND.accent};text-decoration:none;font-weight:600">⚡ Warpreader</a> — Read 3× faster. Miss nothing.<br><br>
      <a href="https://warpreader.com/app.html" style="color:${BRAND.muted};text-decoration:underline;margin:0 8px">Open app</a>
      <a href="https://warpreader.com/test" style="color:${BRAND.muted};text-decoration:underline;margin:0 8px">Speed test</a>
      <a href="{{unsubscribe}}" style="color:${BRAND.muted};text-decoration:underline;margin:0 8px">Unsubscribe</a>
    </td>
  </tr>
</table>`;

function wrap(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Warpreader</title>
</head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:${BRAND.text};line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden;color:transparent">${preheader}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;padding:20px 0">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${BRAND.bg};border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:32px 32px 0 32px">
            <a href="https://warpreader.com" style="text-decoration:none">
              <span style="font-size:22px;font-weight:800;color:${BRAND.accent}">⚡ Warpreader</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px">
            ${content}
            ${FOOTER}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
// LEAD NURTURE SEQUENCE — fires when someone gives email but doesn't convert
// Goal: Deliver VALUE first, sell second.
// ═══════════════════════════════════════════════════════════════

// Day 0 (immediate, after email capture): Welcome + the research-backed "why"
export function welcomeEmail(email, wpm = null) {
  const wpmLine = wpm
    ? `<p style="font-size:18px;color:${BRAND.accent};font-weight:600">Your baseline: <strong>${wpm} WPM</strong>. The average adult reads 238.</p>`
    : '';
  const content = `
<h1 style="color:${BRAND.text};font-size:28px;margin:0 0 16px 0;line-height:1.2">The most important skill nobody taught you 📖</h1>
${wpmLine}
<p style="font-size:16px;color:${BRAND.text}">You will spend <strong style="color:${BRAND.accent}">2.5 years of your life</strong> reading at current speeds. That's not a typo.</p>
<p style="font-size:16px;color:${BRAND.text}">Here's what most people don't know: your brain can process language <strong>3-5× faster</strong> than you're reading right now. The bottleneck isn't comprehension — it's <em>subvocalization</em> (that inner voice reading every word aloud).</p>
<p style="font-size:16px;color:${BRAND.text}">RSVP (Rapid Serial Visual Presentation) removes the eye movement and tricks your brain out of subvocalizing. It's how people go from 250 WPM to 500-800 WPM in a few weeks.</p>
<div style="background:${BRAND.card};border-left:3px solid ${BRAND.accent};padding:16px 20px;border-radius:6px;margin:24px 0">
  <p style="margin:0;color:${BRAND.text};font-size:15px"><strong style="color:${BRAND.accent}">Your 5-minute experiment:</strong><br>
  Paste any article into Warpreader. Start at 300 WPM. Push to 500 after 2 minutes. Notice what happens — you'll still understand it.</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=welcome" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Try it now →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted}">Tomorrow I'll send you the 3 biggest mistakes people make when starting speed reading. (Most of them aren't obvious.)</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau<br><span style="color:${BRAND.muted};font-size:13px">Founder, Warpreader</span></p>`;
  return {
    subject: wpm ? `Your ${wpm} WPM baseline — and why you can double it` : 'The most important skill nobody taught you',
    preheader: 'You\'ll spend 2.5 years of your life reading. Here\'s how to read 3× faster.',
    html: wrap(content, 'You\'ll spend 2.5 years of your life reading. Here\'s how to read 3× faster.'),
  };
}

// Day 2: The 3 mistakes (pure value, no sell)
export function mistakesEmail(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">3 mistakes that kill your reading speed</h1>
<p style="font-size:16px;color:${BRAND.text}">I've watched thousands of people try speed reading. Almost everyone makes at least one of these three mistakes. Here they are, ranked by how badly they hurt:</p>
<h2 style="color:${BRAND.accent};font-size:20px;margin:32px 0 8px 0">1. Trying to read everything at max speed</h2>
<p style="font-size:16px;color:${BRAND.text}">Speed reading is a <em>tool</em>, not a replacement for slow reading. Use it for articles, reports, and emails. Keep slow reading for poetry, contracts, and books you want to savor.</p>
<p style="font-size:16px;color:${BRAND.muted};font-style:italic">The pros switch speeds constantly — 600 WPM for context, 300 WPM for key passages.</p>
<h2 style="color:${BRAND.accent};font-size:20px;margin:32px 0 8px 0">2. Not pushing past uncomfortable</h2>
<p style="font-size:16px;color:${BRAND.text}">Here's the paradox: you have to read at a speed that feels "too fast" to get better. If you're comfortable, you're not improving.</p>
<p style="font-size:16px;color:${BRAND.text}">Set your speed 50 WPM above your comfort level. Read for 10 minutes. Drop back down if you need to. Repeat daily. Your brain adapts in 3-5 days.</p>
<h2 style="color:${BRAND.accent};font-size:20px;margin:32px 0 8px 0">3. Skipping the cooldown</h2>
<p style="font-size:16px;color:${BRAND.text}">After a fast session (500+ WPM), read one page at normal speed. This "cool down" locks in the gains. Without it, your speed regresses within 24 hours.</p>
<div style="background:${BRAND.card};border-left:3px solid ${BRAND.accent};padding:16px 20px;border-radius:6px;margin:32px 0">
  <p style="margin:0;color:${BRAND.text};font-size:15px"><strong style="color:${BRAND.accent}">Today's action:</strong> Open Warpreader. Set your speed 50 WPM above your baseline. Read for 10 minutes. Feel the discomfort. That's your brain rewiring.</p>
</div>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=mistakes" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Open Warpreader →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted}">Next email: the science behind why your inner voice is slowing you down (and how RSVP gets around it).</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: '3 mistakes that kill your reading speed',
    preheader: 'The #1 mistake: trying to speed read EVERYTHING. Here\'s when to slow down.',
    html: wrap(content, 'The #1 mistake: trying to speed read EVERYTHING. Here\'s when to slow down.'),
  };
}

// Day 4: The science (deep value — builds authority)
export function scienceEmail(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">Why your inner voice is slowing you down 🧠</h1>
<p style="font-size:16px;color:${BRAND.text}">Right now, as you read this, there's a voice in your head saying each word. That's <strong style="color:${BRAND.accent}">subvocalization</strong>, and it's the single biggest limit on your reading speed.</p>
<p style="font-size:16px;color:${BRAND.text}">Here's the weird part: your visual cortex can process text at <strong>1,000+ WPM</strong>. But subvocalization forces you to "hear" every word, and human speech tops out around 250-300 WPM. That's why most people plateau there.</p>
<div style="background:${BRAND.card};padding:20px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border}">
  <p style="margin:0 0 8px 0;color:${BRAND.accent};font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">The RSVP trick</p>
  <p style="margin:0;color:${BRAND.text};font-size:16px">When words flash at you one at a time, two things happen:</p>
  <ol style="color:${BRAND.text};font-size:15px;margin:12px 0">
    <li style="margin:8px 0">Your eyes don't move (no saccades = 30% speed boost alone)</li>
    <li style="margin:8px 0">The rhythm is faster than you can subvocalize, forcing your brain to process visually</li>
  </ol>
  <p style="margin:12px 0 0 0;color:${BRAND.muted};font-size:14px">Studies from UMass and NYU show RSVP readers retain the same comprehension as traditional readers at 2× the speed.</p>
</div>
<p style="font-size:16px;color:${BRAND.text}">The catch: your brain fights this at first. You'll feel like you're "not really reading." That feeling goes away in 3-5 sessions as your visual cortex takes over from your auditory loop.</p>
<h2 style="color:${BRAND.accent};font-size:20px;margin:32px 0 8px 0">The ORP advantage</h2>
<p style="font-size:16px;color:${BRAND.text}">Warpreader highlights one letter in each word — the <strong>Optimal Recognition Point</strong>. It's not the first letter. It's about 1/3 into the word. Your brain has a "fovea point" that locks onto this spot and recognizes words faster than scanning left-to-right.</p>
<p style="font-size:16px;color:${BRAND.text}">This is why reading on Warpreader feels different from a speed reading app that just flashes words. The ORP is doing real work.</p>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=science" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Experience it →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted}">Next email: a 5-minute drill that adds 50-100 WPM in a single session.</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: 'The voice in your head is capping your reading speed',
    preheader: 'Your visual cortex can read at 1,000 WPM. Your inner voice caps you at 250. Here\'s the fix.',
    html: wrap(content, 'Your visual cortex can read at 1,000 WPM. Your inner voice caps you at 250. Here\'s the fix.'),
  };
}

// Day 7: The drill (value + soft ask)
export function drillEmail(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">The 5-minute drill that adds 100 WPM ⚡</h1>
<p style="font-size:16px;color:${BRAND.text}">This is the training drill I wish someone had given me when I started. Most people skip warming up. That's a mistake.</p>
<div style="background:${BRAND.card};padding:24px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border}">
  <p style="margin:0 0 16px 0;color:${BRAND.accent};font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:0.5px">The 5-Minute Drill</p>
  <ol style="color:${BRAND.text};font-size:16px;margin:0;line-height:1.8">
    <li><strong>Minute 1:</strong> Read at your comfortable speed. This calibrates your brain.</li>
    <li><strong>Minute 2:</strong> Bump to +100 WPM. You'll feel rushed. That's the point.</li>
    <li><strong>Minute 3:</strong> Push to +200 WPM. You'll lose comprehension briefly. Don't panic.</li>
    <li><strong>Minute 4:</strong> Drop to +50 WPM. Your "new normal" will suddenly feel easy.</li>
    <li><strong>Minute 5:</strong> Read any article at this new speed. Lock in the gain.</li>
  </ol>
</div>
<p style="font-size:16px;color:${BRAND.text}">The trick is minute 3. When you push past your limit, your brain recalibrates what "fast" means. When you drop back down, a speed that felt impossible 3 minutes ago feels comfortable.</p>
<p style="font-size:16px;color:${BRAND.text}">Do this drill once a day for 7 days. You'll gain 50-100 WPM without "trying harder."</p>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=drill" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Run the drill →</a>
</div>
<hr style="border:none;border-top:1px solid ${BRAND.border};margin:32px 0">
<p style="font-size:16px;color:${BRAND.text}"><strong style="color:${BRAND.accent}">Quick note:</strong> You've been on the free tier for about a week. If you've found this stuff valuable, Warpreader Pro unlocks unlimited reading, cloud sync across devices, and the 28-day speed training course.</p>
<p style="font-size:16px;color:${BRAND.text}">It's $1 for 7 days to try it. Then $3.33/mo if you keep going. Less than a coffee, and you'll spend less time reading the same stuff.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://warpreader.com/app.html?plan=pro_annual&utm_source=email&utm_campaign=drill" style="background:transparent;color:${BRAND.accent};padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;border:1px solid ${BRAND.accent}">Try Pro for $1 →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted}">No pressure — the free tier is still fully usable.</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: 'The 5-minute drill that adds 100 WPM',
    preheader: 'Do this once a day for a week. Gain 100 WPM without trying harder.',
    html: wrap(content, 'Do this once a day for a week. Gain 100 WPM without trying harder.'),
  };
}

// Day 10: Social proof + second soft ask
export function socialProofEmail(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">What 500 WPM gets you (math + stories)</h1>
<p style="font-size:16px;color:${BRAND.text}">Let me show you what the numbers actually look like.</p>
<div style="background:${BRAND.card};padding:24px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border}">
  <p style="margin:0 0 12px 0;color:${BRAND.accent};font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">Average reader (250 WPM)</p>
  <p style="margin:0 0 4px 0;color:${BRAND.text};font-size:16px">• 12 books per year (at 20 min/day)</p>
  <p style="margin:0 0 4px 0;color:${BRAND.text};font-size:16px">• Finishes a 300-page book in ~10 hours</p>
  <p style="margin:0;color:${BRAND.text};font-size:16px">• 2.5 years of life spent reading</p>
</div>
<div style="background:${BRAND.card};padding:24px;border-radius:8px;margin:24px 0;border:2px solid ${BRAND.accent}">
  <p style="margin:0 0 12px 0;color:${BRAND.accent};font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">Warpreader user (500 WPM)</p>
  <p style="margin:0 0 4px 0;color:${BRAND.text};font-size:16px">• <strong>24 books per year</strong> (same 20 min/day)</p>
  <p style="margin:0 0 4px 0;color:${BRAND.text};font-size:16px">• Finishes a 300-page book in ~5 hours</p>
  <p style="margin:0;color:${BRAND.text};font-size:16px">• <strong>Saves 1.25 years</strong> of your life</p>
</div>
<p style="font-size:16px;color:${BRAND.text}">At 500 WPM, you read double. At 800 WPM (achievable with a month of training), you read <strong>3×</strong> what an average person does in the same time.</p>
<p style="font-size:16px;color:${BRAND.text}">This isn't about speed-reading <em>more</em>. It's about reading the same amount in less time, or reading what you already wanted to read but never got to.</p>
<blockquote style="border-left:3px solid ${BRAND.accent};padding:16px 20px;color:${BRAND.muted};font-style:italic;margin:32px 0;background:${BRAND.card};border-radius:0 8px 8px 0">
"I went from 220 to 487 WPM in 30 days. I finished 5 books this month — more than I read all last year."<br>
<span style="color:${BRAND.accent};font-style:normal;font-weight:600;font-size:14px">— Warpreader user, March 2026</span>
</blockquote>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?plan=pro_annual&utm_source=email&utm_campaign=social_proof" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Start reading faster →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted};text-align:center">$1 for 7 days · cancel anytime · $3.33/mo after trial</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: 'What 500 WPM gets you (math + stories)',
    preheader: 'Average readers finish 12 books/year. Warpreader users finish 24. Same time investment.',
    html: wrap(content, 'Average readers finish 12 books/year. Warpreader users finish 24. Same time investment.'),
  };
}

// ═══════════════════════════════════════════════════════════════
// ABANDON CART RECOVERY
// ═══════════════════════════════════════════════════════════════

// 2 hours after checkout_intent created but no conversion
export function abandonCart1Email(email, plan = 'pro_annual') {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">You were this close 👋</h1>
<p style="font-size:16px;color:${BRAND.text}">You started checking out on Warpreader Pro earlier. Something pulled you away — I get it, happens to all of us.</p>
<p style="font-size:16px;color:${BRAND.text}">Here's what you were about to get for $1:</p>
<div style="background:${BRAND.card};padding:20px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border}">
  <ul style="color:${BRAND.text};font-size:16px;margin:0;padding-left:20px;line-height:1.8">
    <li>Unlimited reading (no 3-articles/day limit)</li>
    <li>Cloud sync — your progress follows you across devices</li>
    <li>28-day speed training course</li>
    <li>Book library with 60,000+ classics (Project Gutenberg)</li>
    <li>Dark/light themes, font control, comprehension mode</li>
  </ul>
</div>
<p style="font-size:16px;color:${BRAND.text}">Your checkout link is still valid. One click to pick up where you left off:</p>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?plan=${plan}&utm_source=email&utm_campaign=abandon_1" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Finish checkout →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted};text-align:center">$1 today · $3.33/mo after 7-day trial · cancel anytime</p>
<p style="font-size:14px;color:${BRAND.muted}">If something blocked you or you hit an issue, reply and let me know. I read every email.</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: 'You were this close — Warpreader Pro for $1',
    preheader: 'Your checkout link is still valid. Pick up where you left off.',
    html: wrap(content, 'Your checkout link is still valid. Pick up where you left off.'),
  };
}

// 24 hours after intent: Urgency + reminder
export function abandonCart2Email(email, plan = 'pro_annual') {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">Your $1 trial link — last ping</h1>
<p style="font-size:16px;color:${BRAND.text}">I promise this is the last email about your cart. I hate getting these myself.</p>
<p style="font-size:16px;color:${BRAND.text}">Here's the thing: the average person reads <strong>4 books a year</strong>. Warpreader users finish <strong>12+</strong>. That's not because they read more — it's because they read faster.</p>
<p style="font-size:16px;color:${BRAND.text}">If that sounds worth $3.33/mo to you, the link is below. If not, I'll stop bothering you.</p>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?plan=${plan}&utm_source=email&utm_campaign=abandon_2" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Start $1 trial →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted};text-align:center">7 days full access. Cancel anytime before day 8 and pay nothing more.</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau<br><span style="color:${BRAND.muted};font-size:13px">P.S. If you hit a technical issue, reply and I'll fix it personally.</span></p>`;
  return {
    subject: 'Your $1 trial link — last ping',
    preheader: 'Average reader: 4 books/year. Warpreader users: 12+. Same time investment.',
    html: wrap(content, 'Average reader: 4 books/year. Warpreader users: 12+. Same time investment.'),
  };
}

// ═══════════════════════════════════════════════════════════════
// TRIAL ACTIVATION SEQUENCE (for users who DID convert)
// ═══════════════════════════════════════════════════════════════

export function trialWelcomeEmail(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:28px;margin:0 0 16px 0;line-height:1.2">You're in. Let's make this count. ⚡</h1>
<p style="font-size:16px;color:${BRAND.text}">7 days to find out if reading 3× faster is for you. Here's how to get the most out of the trial:</p>
<div style="background:${BRAND.card};padding:24px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border}">
  <p style="margin:0 0 16px 0;color:${BRAND.accent};font-weight:700;font-size:16px">Day 1: Establish your baseline</p>
  <ol style="color:${BRAND.text};font-size:16px;margin:0;padding-left:20px;line-height:1.8">
    <li>Take the <a href="https://warpreader.com/test" style="color:${BRAND.accent}">speed test</a> — know your current WPM</li>
    <li>Upload any article or PDF you've been meaning to read</li>
    <li>Read for 15 minutes at your current comfort speed</li>
    <li>Notice how your eyes don't move — that's 30% speed gain right there</li>
  </ol>
</div>
<p style="font-size:16px;color:${BRAND.text}"><strong style="color:${BRAND.accent}">Most important thing:</strong> don't try to read faster yet. Just use Warpreader at your normal speed. Your brain needs to adjust to RSVP first.</p>
<p style="font-size:16px;color:${BRAND.text}">Tomorrow I'll show you how to safely push to +100 WPM without losing comprehension.</p>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=trial_day1" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Open Warpreader →</a>
</div>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau<br><span style="color:${BRAND.muted};font-size:13px">P.S. Reply to this email with questions. Seriously, I read everything.</span></p>`;
  return {
    subject: 'You\'re in. Let\'s make this count. ⚡',
    preheader: '7 days to find out if reading 3× faster is for you. Here\'s your Day 1 plan.',
    html: wrap(content, '7 days to find out if reading 3× faster is for you. Here\'s your Day 1 plan.'),
  };
}

export function trialDay3Email(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">Day 3: Time to push 🚀</h1>
<p style="font-size:16px;color:${BRAND.text}">By now your brain has adjusted to RSVP. You probably feel like you're reading at your normal speed — comfortable, easy.</p>
<p style="font-size:16px;color:${BRAND.text}">That comfort is the signal to push harder.</p>
<div style="background:${BRAND.card};padding:24px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border}">
  <p style="margin:0 0 12px 0;color:${BRAND.accent};font-weight:700;font-size:16px">Today's drill (10 minutes)</p>
  <ol style="color:${BRAND.text};font-size:16px;margin:0;padding-left:20px;line-height:1.8">
    <li><strong>3 min</strong> at your current comfort speed (warm up)</li>
    <li><strong>3 min</strong> +100 WPM (will feel fast)</li>
    <li><strong>2 min</strong> +200 WPM (will feel too fast — that's the point)</li>
    <li><strong>2 min</strong> back to +50 WPM (feel the new normal)</li>
  </ol>
</div>
<p style="font-size:16px;color:${BRAND.text}">That last step is the trick. When you drop from "too fast" to "+50 WPM," your old comfort speed suddenly feels like slow motion.</p>
<p style="font-size:16px;color:${BRAND.text}">Take the <a href="https://warpreader.com/test?utm_source=email&utm_campaign=trial_day3" style="color:${BRAND.accent}">speed test</a> after the drill. I bet you've gained 30-80 WPM already.</p>
<div style="text-align:center;margin:32px 0">
  <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=trial_day3" style="background:${BRAND.accent};color:#000;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Run the drill →</a>
</div>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: 'Day 3: Time to push',
    preheader: 'Your brain has adjusted. Time to run the speed-up drill.',
    html: wrap(content, 'Your brain has adjusted. Time to run the speed-up drill.'),
  };
}

export function trialDay7Email(email) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">Day 7: Decision time</h1>
<p style="font-size:16px;color:${BRAND.text}">Your trial ends tomorrow. I want to make the decision easy.</p>
<p style="font-size:16px;color:${BRAND.text}">Ask yourself one question:</p>
<blockquote style="border-left:3px solid ${BRAND.accent};padding:16px 20px;color:${BRAND.text};font-style:italic;margin:24px 0;background:${BRAND.card};border-radius:0 8px 8px 0;font-size:18px">
How many pages did I read this week that I wouldn't have read without Warpreader?
</blockquote>
<p style="font-size:16px;color:${BRAND.text}">If the answer is greater than zero, you already got your money's worth. $3.33/mo is a cup of coffee — and you're getting back <strong>1+ hours per week</strong>.</p>
<p style="font-size:16px;color:${BRAND.text}">If the answer is zero, cancel. No hard feelings. Life's too short to pay for things you don't use.</p>
<div style="display:flex;gap:12px;margin:32px 0;flex-wrap:wrap">
  <div style="flex:1;min-width:200px;background:${BRAND.card};padding:20px;border-radius:8px;border:2px solid ${BRAND.accent};text-align:center">
    <p style="margin:0 0 8px 0;color:${BRAND.accent};font-weight:700;font-size:14px;text-transform:uppercase">Keep going</p>
    <p style="margin:0 0 12px 0;color:${BRAND.text};font-size:15px">$3.33/mo billed annually</p>
    <a href="https://warpreader.com/app.html?utm_source=email&utm_campaign=trial_day7" style="background:${BRAND.accent};color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Keep reading fast</a>
  </div>
  <div style="flex:1;min-width:200px;background:${BRAND.card};padding:20px;border-radius:8px;border:1px solid ${BRAND.border};text-align:center">
    <p style="margin:0 0 8px 0;color:${BRAND.muted};font-weight:700;font-size:14px;text-transform:uppercase">Not for me</p>
    <p style="margin:0 0 12px 0;color:${BRAND.muted};font-size:15px">One click, no questions</p>
    <a href="https://warpreader.com/app.html#manage" style="background:transparent;color:${BRAND.muted};padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;border:1px solid ${BRAND.muted}">Cancel</a>
  </div>
</div>
<p style="font-size:16px;color:${BRAND.text}">Either way — thanks for trying it. You're on a shortlist of people who actually care about reading more and faster. That's not common.</p>
<p style="font-size:16px;color:${BRAND.text};margin-top:24px">— Beau</p>`;
  return {
    subject: 'Your trial ends tomorrow — here\'s the honest question',
    preheader: 'One question to decide: how many pages did you read this week that you wouldn\'t have otherwise?',
    html: wrap(content, 'One question to decide: how many pages did you read this week that you wouldn\'t have otherwise?'),
  };
}

// ═══════════════════════════════════════════════════════════════
// MAGIC LINK (replaces Supabase default)
// ═══════════════════════════════════════════════════════════════

export function magicLinkEmail(email, link) {
  const content = `
<h1 style="color:${BRAND.text};font-size:26px;margin:0 0 16px 0;line-height:1.2">Your Warpreader sign-in link</h1>
<p style="font-size:16px;color:${BRAND.text}">Click the button below to sign in. No password needed.</p>
<div style="text-align:center;margin:32px 0">
  <a href="${link}" style="background:${BRAND.accent};color:#000;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Sign in to Warpreader →</a>
</div>
<p style="font-size:14px;color:${BRAND.muted}">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
<p style="font-size:14px;color:${BRAND.muted}">Trouble with the button? Copy and paste this URL into your browser:<br><span style="color:${BRAND.accent};word-break:break-all">${link}</span></p>`;
  return {
    subject: 'Sign in to Warpreader',
    preheader: 'Your sign-in link — no password needed.',
    html: wrap(content, 'Your sign-in link — no password needed.'),
  };
}

// Export all for use in send-email-queue.js
export const TEMPLATES = {
  welcome: welcomeEmail,
  mistakes: mistakesEmail,
  science: scienceEmail,
  drill: drillEmail,
  social_proof: socialProofEmail,
  abandon_1: abandonCart1Email,
  abandon_2: abandonCart2Email,
  trial_welcome: trialWelcomeEmail,
  trial_day3: trialDay3Email,
  trial_day7: trialDay7Email,
  magic_link: magicLinkEmail,
};
