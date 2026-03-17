#!/bin/bash
# SpeedRead Backend Setup Script
# Run this ONCE after you've authenticated: supabase login
# Then: bash backend/setup.sh

set -e
echo "🚀 SpeedRead Backend Setup"
echo "=========================="

# ─── 1. SUPABASE PROJECT ─────────────────────────────────────
echo ""
echo "Step 1: Creating Supabase project..."
# Creates project in the nearest region
supabase projects create speedread-app --org-id YOUR_ORG_ID --region us-west-1 --db-password "$(openssl rand -base64 24)"
echo "✅ Supabase project created"

echo ""
echo "Step 2: Linking project..."
# Get project ref from dashboard and replace below
PROJECT_REF="YOUR_PROJECT_REF"
supabase link --project-ref $PROJECT_REF
echo "✅ Project linked"

echo ""
echo "Step 3: Running migrations..."
supabase db push
echo "✅ Schema applied"

echo ""
echo "Step 4: Deploying edge functions..."
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy comprehension
echo "✅ Edge functions deployed"

# ─── 2. GET CREDENTIALS ──────────────────────────────────────
echo ""
echo "Step 5: Fetching API keys..."
supabase status
echo ""
echo "⚠️  Copy the 'anon key' and 'service_role key' above"
echo "    Then add them to .env (see .env.example)"

echo ""
echo "=========================="
echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy API keys into web/config.js"
echo "2. Create Stripe products (run: node scripts/create-stripe-products.js)"
echo "3. Push code: git push origin main (auto-deploys to Cloudflare Pages)"
