# SpeedRead — Speed Reading App

Read 3x faster using RSVP (Rapid Serial Visual Presentation) technology.

## Project Structure

```
speedread-app/
├── web/                    # Web app
│   ├── index.html          # Landing page with WPM test
│   ├── app.html            # Main reader app
│   ├── styles.css          # Shared styles
│   ├── app.js              # RSVP reader logic
│   ├── auth.js             # Supabase auth
│   ├── billing.js          # Stripe billing
│   └── sync.js             # Reading history & sync
├── extension/              # Chrome extension
│   ├── manifest.json       # Manifest V3
│   ├── popup.html/js       # Mini RSVP reader popup
│   ├── content.js          # Page text extraction
│   ├── background.js       # Context menu & messaging
│   ├── options.html        # Settings page
│   └── icon*.png           # Extension icons
└── README.md
```

## Local Development

```bash
# Serve the web app locally
cd web
python3 -m http.server 8080
# Open http://localhost:8080
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Create these tables:

```sql
-- User profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  display_name TEXT,
  plan TEXT DEFAULT 'free',  -- 'free', 'pro', 'lifetime'
  docs_today INT DEFAULT 0,
  words_today INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reading sessions
CREATE TABLE reading_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  doc_title TEXT,
  word_count INT,
  wpm INT,
  duration INT,  -- seconds
  date TIMESTAMPTZ,
  comprehension_score REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users see own sessions" ON reading_sessions FOR ALL USING (auth.uid() = user_id);
```

3. Enable Google OAuth in Auth > Providers
4. Update `auth.js` with your project URL and anon key

## Stripe Setup

1. Create products in [Stripe Dashboard](https://dashboard.stripe.com):
   - **Pro Monthly**: $4.99/mo recurring
   - **Pro Annual**: $39.99/yr recurring
   - **Lifetime**: $99 one-time
2. Update `billing.js` with your publishable key and price IDs
3. Create a server endpoint at `/api/create-checkout-session` (use Vercel serverless function or similar)

### Stripe Webhook

Set up a webhook to update user plans in Supabase when checkout completes:
- Events: `checkout.session.completed`, `customer.subscription.deleted`
- Endpoint: `https://yourdomain.com/api/stripe-webhook`

## Deploy to Vercel

```bash
cd web
vercel --prod
```

Or connect the GitHub repo and auto-deploy from the `web/` directory.

### Environment Variables (Vercel)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # For server-side webhook
STRIPE_SECRET_KEY=sk_live_...               # For creating checkout sessions
STRIPE_WEBHOOK_SECRET=whsec_...             # For webhook verification
```

## Chrome Extension

### Load for Development

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` folder
4. **Important**: Open `generate-icons.html` in a browser to download proper PNG icons, then replace the placeholder PNGs

### Submit to Chrome Web Store

1. Replace placeholder PNG icons with proper ones (use `generate-icons.html`)
2. Take screenshots (1280x800)
3. Zip the `extension/` folder (exclude `generate-icons.html` and `.svg` files)
4. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
5. Pay one-time $5 developer fee
6. Upload zip, fill in listing details, submit for review

## Features

- **RSVP Reader**: Word-by-word display with Optimal Recognition Point
- **Smart Timing**: Punctuation-aware delays for natural reading flow
- **PDF Support**: Extract text from PDFs (via pdf.js)
- **URL Import**: Fetch and extract article text from URLs
- **Progress Tracking**: Reading history, WPM trends, session analytics
- **Free Tier**: 3 docs/day, 2K words/session
- **Pro Tier**: Unlimited + AI comprehension + cloud sync
- **Chrome Extension**: Speed read any webpage with right-click context menu
- **Dark/Light Theme**: Toggle between themes
- **Keyboard Shortcuts**: Full keyboard navigation
- **Mobile Responsive**: Works on iPhone and Android
- **Touch Gestures**: Tap to play/pause, swipe to skip

## Tech Stack

- Vanilla JS + HTML + CSS (no frameworks)
- PDF.js (CDN) for PDF parsing
- Supabase for auth + database
- Stripe for payments
- Chrome Extension Manifest V3
