# Warpreader — Product Hunt Launch

## Tagline (60 chars max)
Read 3× faster with AI comprehension. Free.

## Description (260 chars)
RSVP speed reading that actually works. Upload PDFs, paste text, or read any URL at 300-1,500 WPM. AI asks comprehension questions after each session so you retain what you read. Web-based, no download, works everywhere.

## First Comment (by maker — crucial for traction)

Hey Product Hunt! 👋

I'm Beau, and I built Warpreader because every speed reading app I tried was either:
- iOS-only (Outread)
- Dated UI from 2018 (Spreeder)
- $30/month to listen to robots read for you (Speechify)

So I built a modern, web-first RSVP reader with one twist: **AI comprehension questions after every session**.

Turns out going faster doesn't help if you're not retaining anything. The comprehension quiz + tracking shows you exactly where your speed/understanding tradeoff is.

**What's free:**
- 3 docs/day, 2,000 words/session
- Basic WPM tracking
- Full RSVP reader

**What's in Pro ($4.99/mo):**
- Unlimited everything
- AI comprehension coach
- Cloud sync + reading history
- Reading streak + analytics

Would love feedback — especially from heavy readers. What would make this your go-to reading tool?

## Gallery Screenshots Needed
1. Landing page hero + WPM test
2. RSVP reader in action (word flashing, progress bar)
3. Comprehension quiz results screen
4. Reading history / progress chart
5. Chrome extension popup

## Categories
Primary: Productivity
Secondary: Education, Developer Tools

## Topics
speed reading, productivity, learning, reading, RSVP

---

# Reddit Launch Posts

## r/productivity (soft launch)

**Title:** I built a free RSVP speed reader with AI comprehension questions — here's what I learned

I've been building side projects for a while, and this one came from a personal frustration: I needed to read faster for work but existing apps were either Apple-only, ugly, or cost $30/mo.

So I built Warpreader — web-based RSVP reader, free tier, AI comprehension questions.

The AI part was the interesting discovery: **going faster doesn't help if you're not actually absorbing anything**. The comprehension questions show you exactly where your speed/retention tradeoff breaks down.

Free to try at warpreader.com — no signup required for the WPM test.

What's your current reading speed? I was at 210 WPM when I started, now around 420.

---

## r/learnprogramming

**Title:** Built a speed reading web app — sharing what I learned about RSVP + AI integration

Just shipped Warpreader (warpreader.com) — an RSVP speed reading app with AI comprehension questions.

**Tech stack:**
- Vanilla JS frontend (no frameworks — keeping it fast)
- Supabase for auth + DB
- Stripe for payments
- GPT-4o-mini for comprehension questions (shockingly cheap — ~$0.001/session)
- Cloudflare Pages for hosting

**Interesting technical challenges:**
- PDF text extraction in the browser (pdf.js) — tricky edge cases with tables/columns
- RSVP timing — needs to account for punctuation pauses, longer words, chunk breaks
- Comprehension questions — prompting GPT to ask conceptual questions vs. trivia was harder than expected

Happy to answer questions about any of the implementation details.

---

## r/speedreading

**Title:** New app: RSVP + AI comprehension — feedback wanted

Built a new speed reading app and would love feedback from people who actually use RSVP regularly.

Main difference from Spreeder/Outread: after each session, AI generates 3 comprehension questions to test retention. Tracks your comprehension score vs. WPM over time so you can find your optimal speed.

Free tier: 3 docs/day. Pro: $4.99/mo unlimited + AI.

warpreader.com — what would make this your main reading tool?

---

## Email Onboarding Sequence

### Email 1 — Welcome (immediate)
Subject: You're in. Here's how to hit 400 WPM.

Welcome to Warpreader.

Your first goal: 400 WPM with 80%+ comprehension. Most people can get there in 2-3 weeks.

Here's the fastest path:
1. Start at your natural pace — take the WPM test if you haven't
2. Add 50 WPM per session (if comprehension stays above 70%)
3. Read something you actually care about (you'll go faster)

Your first session is waiting → [Open Warpreader]

— Beau

---

### Email 2 — Day 3 (if no session after signup)
Subject: Did you forget about your reading speed?

Quick check-in.

You tested your reading speed but haven't done a full session yet.

Most people read around 238 WPM. Where do you want to be?
- 400 WPM = finish a 300-page book in 4 hours
- 600 WPM = finish it in 2.5 hours
- 800 WPM = professional speed reader territory

Takes 10 minutes/day to build the habit.

→ [Start your first session]

---

### Email 3 — Day 7 (active users)
Subject: Your week 1 reading report

You've been using Warpreader for a week. Here's where you stand:

[Dynamic: insert WPM, sessions, words read]

The research says the biggest gains come in weeks 2-4 as your brain adapts to the pace. Keep going.

Pro tip: The comprehension score matters more than WPM. Don't push speed if your comprehension drops below 70%.

→ [Continue reading]

---

### Email 4 — Day 14 (free users, upgrade push)
Subject: You're reading faster. Here's what Pro unlocks.

Your reading speed has improved [X]% since you started.

Free tier has served you well. But if you want to go further:

Pro ($4.99/mo) adds:
✓ Unlimited documents (no 3/day cap)
✓ AI comprehension coach
✓ Cloud sync — pick up where you left off on any device
✓ Full reading history + analytics

Cancel anytime. Most people pay for 1 month and stay for years.

→ [Upgrade to Pro — $4.99/mo]
