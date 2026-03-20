# WarpRead App — Full Build, Go-to-Market & Financial Plan
**Prepared:** March 16, 2026 | **Goal:** $50K MRR in 18 months

---

## Product Vision

**Positioning:** The anti-Speechify. For people who want to actually *read* faster — not listen.  
**Tagline:** "Read everything. Miss nothing."  
**Core loop:** Speed read → comprehension check → track improvement → share streak

Not just an RSVP reader. A reading productivity platform:
1. Speed reading (RSVP) — the hook
2. AI comprehension coach — the retention mechanism
3. Reading analytics — the engagement loop
4. Browser extension — the viral distribution
5. Education/corporate — the revenue engine

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Vanilla JS / HTML (existing) → React for accounts/dashboard | Keep it fast, no framework overhead on reader |
| Backend | Supabase (Postgres + Auth + Realtime) | Free tier generous, auth built-in, open source |
| Payments | Stripe | Industry standard, best DX |
| AI | OpenAI GPT-4o-mini | Comprehension questions — cheap at $0.00015/1K tokens |
| Hosting | Vercel | Free tier, edge network, auto-deploy from GitHub |
| Email | Resend | 3K free/mo, simple API |
| Extension | Chrome Extension Manifest V3 | Vanilla JS, no bundler needed |
| Mobile | PWA (existing) → React Native later | PWA covers 80% of mobile use cases |
| Analytics | PostHog (self-hosted or cloud free tier) | Full funnel visibility |
| Domain | warpreader.com OR warpreader.com | Short, memorable |

---

## Build Phases

### Phase 1 — MVP Commercial (Weeks 1-3)
**Goal:** First paying user

#### 1A — User Accounts + Auth (Week 1)
- Supabase project setup
- Email + Google OAuth login
- User profile (WPM goal, reading stats, plan tier)
- Session persistence across devices

#### 1B — Freemium Gating (Week 1)
- Free tier: 3 documents/day, 2,000 words max per session
- Track usage in Supabase
- Soft gate → upgrade modal when limit hit

#### 1C — Stripe Payments (Week 1-2)
- Plans:
  - **Free** — 3 docs/day, 2K words/session
  - **Pro** — $4.99/mo or $39.99/yr — unlimited, AI comprehension, cloud sync
  - **Lifetime** — $99.99 one-time
- Stripe Checkout (hosted, no PCI headache)
- Webhook → update user plan in Supabase
- Billing portal for cancellation/upgrade

#### 1D — Cloud Sync (Week 2)
- Save reading progress per document
- Reading history (last 30 docs)
- WPM history over time (for progress chart)
- Bookmarks / resume reading

#### 1E — Landing Page (Week 2-3)
- Hero: "Read 3x faster. Understand more."
- Free WPM speed test (60-second test, shows result vs. average)
- Feature highlights
- Pricing table
- Social proof (reviews, user count)
- CTA: "Start free — no credit card"

---

### Phase 2 — Chrome Extension (Weeks 3-5)
**Goal:** Viral distribution mechanism

#### Extension Features
- **Context menu:** Right-click any selected text → "Speed Read This"
- **Page action:** Toolbar button → extract full article text → open RSVP reader in popup
- **Side panel:** Persistent reader panel (Chrome Side Panel API)
- **Auto-detect:** Identify article content on page (like Readability.js)
- **Sync:** Links to user account for Pro features

#### Extension Distribution
- Chrome Web Store submission (7-14 day review)
- Firefox Add-ons (same codebase, minor tweaks)
- Edge Add-ons (auto from Chrome)
- "Speed Read" badge shown to users → organic discovery

---

### Phase 3 — AI Comprehension Coach (Weeks 5-7)
**Goal:** Retention + differentiation

#### Features
- After completing a reading session → 3 comprehension questions (multiple choice)
- Show score + correct answers
- Optional: one-paragraph AI summary of what was read
- Track comprehension score vs. WPM over time
- Insight: "You score 87% comprehension at 400 WPM — try pushing to 450"
- Built on: GPT-4o-mini (cheap, fast enough)

#### Cost: ~$0.001-0.005 per session. At 100K sessions/mo = $100-500/mo.

---

### Phase 4 — Mobile PWA Polish + App Store (Weeks 7-10)
**Goal:** Mobile-first experience, App Store presence

#### PWA Improvements
- Offline reading mode (service worker cache)
- Home screen install prompt (iOS + Android)
- Haptic feedback on iOS for word advance
- Landscape mode support

#### React Native App (Month 3-4)
- iOS + Android native apps
- Share target integration ("Share to WarpRead" from any app)
- Notifications for daily reading streaks
- ePub reader integration (epub.js)

---

### Phase 5 — Gamification + Virality (Weeks 8-10)
**Goal:** Retention + word of mouth

#### Features
- Daily reading streak (like Duolingo)
- WPM milestones (badges: 300 WPM, 500 WPM, 1000 WPM)
- "My reading speed" shareable card (generate PNG, share to Twitter/IG)
- Weekly reading report email ("You read 47,000 words this week — faster than 89% of users")
- Referral program: Give 1 month Pro, get 1 month Pro

---

### Phase 6 — B2B / Education (Month 4-6)
**Goal:** Higher ARPU, longer contracts

#### Features
- Team workspace (admin dashboard, seat management)
- Bulk CSV user import
- Reading assignment system (assign documents to team members)
- Progress reporting (admin sees team WPM improvement over time)
- LMS integrations: Google Classroom, Canvas (OAuth SSO)
- White-label option for universities

#### Pricing
- Teams: $8/seat/mo (min 10 seats)
- Education: $5/seat/mo (min 50 seats, annual contract)
- Enterprise: Custom

---

## SEO & Content Strategy

### Free Tools (Acquisition)

| Tool | Keyword Target | Est. Monthly Searches |
|------|---------------|----------------------|
| WPM Speed Test | "reading speed test" | 12K-20K |
| Words Per Minute Calculator | "words per minute test" | 8K-15K |
| Speed Reading Test | "speed reading test" | 10K-18K |

Each tool: free, no signup required, shows result vs. average, soft CTA to "improve your speed."

### SEO Content Calendar (First 6 Months)

**Month 1 — Foundation**
1. "What Is Speed Reading? The Complete Guide (2026)" — cornerstone
2. "Average Reading Speed by Age: How Do You Compare?"
3. "RSVP Reading: Does It Actually Work? What Science Says"

**Month 2 — Competition**
4. "Spreeder vs WarpRead: Honest Comparison"
5. "Best Speed Reading Apps in 2026 (Tested & Ranked)"
6. "Outread App Review: Is It Worth It?"

**Month 3 — How-To**
7. "How to Read 3x Faster Without Losing Comprehension"
8. "Speed Reading for Students: Study Smarter, Not Harder"
9. "Speed Reading for ADHD: Does It Actually Help?"

**Month 4 — Audience Segments**
10. "Speed Reading for Lawyers: Get Through Case Files Faster"
11. "Speed Reading for Medical Students: Survive the Reading Load"
12. "How I Read 52 Books in a Year (With This App)"

**Month 5-6 — Long-tail + Viral**
13. "I Read Every Bestseller This Year at 800 WPM — Here's What Happened"
14. "Speed Reading Exercises: 10 Techniques That Actually Work"
15. "How Fast Can Humans Read? The Surprising Science"

**Ongoing:** 2 posts/month minimum.

### TikTok / Reels Strategy

Content buckets:
1. **"POV: reading 800 WPM"** — screen record of RSVP at high speed. Satisfying to watch. Low effort.
2. **"I read [X] books this week"** — before/after reading speed test
3. **"This app changed how I study"** — authentic testimonials
4. **"Speed reading sounds like..."** — comedic audio hook
5. **BookTok crossover** — "I speed read [popular book] in 2 hours"

Target: 3 videos/week. Outsource editing after initial template set.

### Influencer Pipeline

| Creator Type | Target Names | Ask | Budget |
|-------------|-------------|-----|--------|
| Productivity YouTube | Ali Abdaal, Thomas Frank, Mike & Matty | Sponsored review | $500-2K |
| Study TikTok | Various 100K-1M studygramers | Send free Pro account, ask for authentic review | $0-200 |
| ADHD creators | How to ADHD, Hayley Honeyman | Accessibility angle | $200-500 |
| Newsletter writers | Productivity newsletters (5-50K subs) | Affiliate deal (20% rev share) | $0 + rev share |

---

## Marketing Channels & Budget

### Month 1-3 (Pre-Revenue — Lean)

| Channel | Monthly Budget | Goal |
|---------|---------------|------|
| Content/SEO | $0 (time only) | Foundation articles live |
| Product Hunt launch | $0 | 500+ upvotes, 2K signups |
| Reddit soft launches | $0 | 500 organic signups |
| Chrome Web Store listing | $5 one-time dev fee | 500 installs |
| Creator outreach (free accounts) | $0 | 3-5 authentic reviews |
| **Total** | **~$5/mo** | **5K users** |

### Month 4-8 (Early Revenue — Invest in Growth)

| Channel | Monthly Budget | Expected Return |
|---------|---------------|----------------|
| YouTube sponsorships (2/mo) | $1,500 | 2K-5K signups/placement |
| TikTok content creation | $300 (editing) | Organic reach |
| Google Ads (brand + "speed reading app") | $300 | 200-400 trial signups |
| Affiliate program (20% rev share) | Variable | Scalable |
| **Total** | **~$2,100/mo** | **+2K users/mo** |

### Month 9-18 (Scale)

| Channel | Monthly Budget | Expected Return |
|---------|---------------|----------------|
| YouTube sponsorships (4/mo) | $4,000 | 8-15K signups/mo |
| Paid social (Meta retargeting) | $500 | 300-500 conversions |
| B2B outbound (1 SDR part-time) | $2,000 | 5-10 deals/mo |
| SEO content production | $500 (freelance) | Long-term organic |
| Affiliate payouts | ~10% of affiliate MRR | Self-funding |
| **Total** | **~$7,000/mo** | **Target $50K MRR** |

---

## Financial Model

### Infrastructure Costs (Monthly)

| Service | Free Tier | Pro Tier | At Scale ($50K MRR) |
|---------|-----------|----------|---------------------|
| Supabase | $0 (500MB, 50K MAU) | $25/mo (8GB, unlimited) | $25-200/mo |
| Vercel | $0 (hobby) | $20/mo (pro) | $20/mo |
| OpenAI API (comprehension) | N/A | ~$50/mo at 10K sessions | $200-500/mo |
| Stripe fees | 2.9% + $0.30/txn | Same | ~$1,500/mo at $50K MRR |
| Resend (email) | $0 (3K/mo) | $20/mo | $20-50/mo |
| PostHog (analytics) | $0 (1M events) | $0-450/mo | $50/mo |
| Domain + SSL | $12/yr | — | $12/yr |
| Apple Dev ($99/yr) | N/A | $99/yr | $99/yr |
| Google Play ($25 one-time) | N/A | $25 once | — |
| **Total Infra** | **~$0** | **~$120/mo** | **~$2,000-2,800/mo** |

### Revenue Model

| Tier | Price | Est. % of Paying Users |
|------|-------|------------------------|
| Pro Monthly | $4.99/mo | 40% |
| Pro Annual | $39.99/yr ($3.33/mo) | 35% |
| Lifetime | $99.99 (one-time) | 10% |
| Team (avg 15 seats @ $8) | $120/mo/team | 15% (by revenue) |

**Blended ARPU (paying users):** ~$5.50/mo

### MRR Projections

| Month | Registered | Paying (4%) | B2B Seats | MRR | Infra Cost | Marketing | Net |
|-------|-----------|------------|-----------|-----|-----------|-----------|-----|
| 3 | 5,000 | 100 | 0 | $550 | $50 | $5 | $495 |
| 6 | 20,000 | 500 | 50 | $3,350 | $120 | $1,000 | $2,230 |
| 9 | 50,000 | 1,500 | 200 | $9,850 | $300 | $2,100 | $7,450 |
| 12 | 100,000 | 3,000 | 500 | $20,500 | $600 | $4,000 | $15,900 |
| 15 | 130,000 | 4,500 | 800 | $32,250 | $1,200 | $6,000 | $25,050 |
| 18 | 160,000 | 6,000 | 1,200 | $52,200 | $2,000 | $7,000 | $43,200 |

**Break-even:** Month 5-6 (infra+marketing costs covered)  
**$50K MRR:** Month 17-18  
**Cumulative investment before profitability:** ~$10-15K (mostly marketing, infra is nearly free)

---

## Project Structure

```
speedread-app/
├── web/                    # Main web app (Vanilla JS → React)
│   ├── app/               # Authenticated app (reader, dashboard, settings)
│   ├── landing/           # Marketing site + WPM test
│   └── api/               # Serverless functions (Vercel)
├── extension/             # Chrome Extension
│   ├── manifest.json
│   ├── content.js         # Page text extraction
│   ├── popup.html         # RSVP reader popup
│   ├── background.js      # Service worker
│   └── options.html       # Settings
├── mobile/                # React Native (Phase 4)
├── backend/               # Supabase migrations + edge functions
│   ├── migrations/
│   └── functions/
├── content/               # SEO blog posts (Markdown → deployed)
└── docs/
    └── PLAN.md            # This file
```

---

## Execution Order (Next 30 Days)

### Week 1
- [ ] Set up Supabase project + schema
- [ ] Add auth to existing speedread.html (Supabase Auth JS)
- [ ] Freemium usage gating
- [ ] Stripe integration + webhook
- [ ] Deploy to Vercel with custom domain

### Week 2
- [ ] Cloud sync (reading history, WPM progress)
- [ ] Landing page with WPM speed test
- [ ] Pricing page
- [ ] Basic email onboarding (Resend)

### Week 3
- [ ] Chrome extension v1 (context menu + popup reader)
- [ ] Chrome Web Store submission
- [ ] Product Hunt listing draft

### Week 4
- [ ] AI comprehension coach (GPT-4o-mini)
- [ ] WPM progress chart
- [ ] Product Hunt launch
- [ ] 3 foundation SEO articles published

### Month 2
- [ ] ePub support
- [ ] Reading streaks + gamification
- [ ] Shareable WPM card
- [ ] 5 more SEO articles
- [ ] First creator outreach batch

### Month 3
- [ ] Team/B2B dashboard v1
- [ ] Referral program
- [ ] First YouTube sponsorship
- [ ] Mobile PWA polish
- [ ] App Store submission (React Native or PWA wrapper)

---

## Success Metrics (Dashboard)

| Metric | Week 4 | Month 3 | Month 6 | Month 12 |
|--------|--------|---------|---------|----------|
| Registered users | 500 | 5,000 | 20,000 | 100,000 |
| DAU/MAU | 20% | 25% | 30% | 35% |
| Paying users | 10 | 100 | 500 | 3,000 |
| MRR | $50 | $550 | $3,350 | $20,500 |
| Chrome installs | 200 | 2,000 | 8,000 | 30,000 |
| Organic sessions | 500 | 5,000 | 20,000 | 80,000 |
| WPM test completions | 100 | 2,000 | 10,000 | 50,000 |
| Avg session WPM | — | 380 | 420 | 460 |

---

*$50K MRR is achievable. It requires browser extension virality + B2B sales + consistent SEO. The competitive window is open. Build fast.*
