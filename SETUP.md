# SpeedRead — Setup Guide
Everything Hal built unassisted. These are the 4 steps YOU need to do (~20 minutes total).

---

## ✅ Already Done (by Hal)
- Full web app: `/web/` (RSVP reader, auth shell, Stripe shell, cloud sync shell)
- Chrome extension: `/extension/` (packaged at `extension/speedread-extension.zip`)
- Landing page: deploying now
- Backend schema: `/backend/migrations/001_initial_schema.sql`
- Edge functions: Stripe webhook + AI comprehension
- SEO articles: 3 foundation articles in `/content/blog/`
- TikTok scripts: `/content/social/tiktok-scripts.md`
- GitHub repo: https://github.com/AbundantMines/speedread-app
- Cloudflare Pages: https://speedread-app.pages.dev (auto-deploys on git push)
- GitHub Actions: configured, secrets set

---

## Step 1 — Register Domain (~5 min)
Register `speedread.app` — available on Cloudflare at ~$14/yr.

1. Go to https://dash.cloudflare.com → Register Domains → Search "speedread.app"
2. Purchase (credit card on file)
3. Point DNS to Cloudflare Pages:
   - In Cloudflare Pages → speedread-app → Custom Domains → Add "speedread.app"
   - Cloudflare auto-configures DNS

---

## Step 2 — Create Supabase Project (~5 min)
1. Go to https://supabase.com → New project
   - Name: speedread-app
   - Password: (save securely)
   - Region: US West (closest to Oregon)
2. Go to SQL Editor → paste contents of `backend/migrations/001_initial_schema.sql` → Run
3. Go to Project Settings → API → copy:
   - `Project URL` → paste into `web/auth.js` where it says `YOUR_SUPABASE_URL`
   - `anon public key` → paste into `web/auth.js` where it says `YOUR_SUPABASE_ANON_KEY`
4. Go to Authentication → Providers → Enable Google OAuth:
   - Need Google Client ID + Secret from console.cloud.google.com
   - (Hal already has Google API access via halabundance@gmail.com)
5. Run Supabase CLI to deploy edge functions:
   ```bash
   cd /Users/beauturner/.openclaw/workspace/speedread-app
   supabase login  # opens browser
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy comprehension
   # Set secrets:
   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   supabase secrets set OPENAI_API_KEY=sk-xxx
   ```

---

## Step 3 — Create Stripe Products (~5 min)
1. Go to https://dashboard.stripe.com → Create account if needed
2. Install stripe npm: `npm install stripe dotenv` in speedread-app directory
3. Add your key to `.env`: `STRIPE_SECRET_KEY=sk_live_xxx`
4. Run: `node scripts/create-stripe-products.js`
5. Copy the 3 price IDs it outputs → paste into `web/billing.js` where marked
6. Add webhook in Stripe Dashboard:
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy webhook secret → add to Supabase secrets above

---

## Step 4 — Submit Chrome Extension (~10 min)
1. Go to https://chrome.google.com/webstore/devconsole
2. Pay $5 developer registration (one-time)
3. Upload `extension/speedread-extension.zip`
4. Fill in: description, screenshots, category (Productivity)
5. Submit for review (7-14 days)

Meanwhile the extension works in developer mode:
- Chrome → Extensions → Developer Mode ON → Load Unpacked → select `extension/` folder

---

## After All Steps
1. Update `web/auth.js` with Supabase credentials
2. Update `web/billing.js` with Stripe price IDs
3. `git add -A && git commit -m "Add live credentials" && git push origin main`
4. Site auto-deploys. You're live and taking money.

---

## Ongoing Operations (Hal handles automatically)
- Daily SEO article (1/day, picked based on keyword opportunity)
- TikTok content creation (scripts ready, needs filming)
- Rankings monitoring
- SEO content for speedread blog
- Chrome Web Store review responses
- Feature requests → new articles

---

## Cost Summary (Monthly at Scale)
| | Monthly |
|---|---|
| Cloudflare Pages + DNS | ~$5 |
| Supabase Pro (at scale) | $25 |
| OpenAI API (comprehension) | $50-500 |
| Stripe fees (at $50K MRR) | ~$1,500 |
| Marketing (YouTube, etc.) | $0-7,000 |
| **Total infra at $50K MRR** | **~$1,600-2,000** |
| **Net margin** | **~86%** |
