#!/usr/bin/env node
// Warpreader — Create Stripe Products & Prices
// Run: STRIPE_SECRET_KEY=sk_live_xxx node scripts/create-stripe-products.js
// Or add to .env and run: node scripts/create-stripe-products.js

require('dotenv').config();
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY');

async function createProducts() {
  console.log('🔧 Creating Stripe products and prices...\n');

  // ─── 1. PRO SUBSCRIPTION ───────────────────────────────────
  const proProduct = await stripe.products.create({
    name: 'Warpreader Pro',
    description: 'Unlimited speed reading, AI comprehension coach, cloud sync',
    metadata: { plan: 'pro' },
  });

  const proMonthly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 499, // $4.99
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Pro Monthly',
    metadata: { plan: 'pro', interval: 'monthly' },
  });

  const proAnnual = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 3999, // $39.99
    currency: 'usd',
    recurring: { interval: 'year' },
    nickname: 'Pro Annual',
    metadata: { plan: 'pro', interval: 'annual' },
  });

  // ─── 2. LIFETIME ───────────────────────────────────────────
  const lifetimeProduct = await stripe.products.create({
    name: 'Warpreader Lifetime',
    description: 'One-time purchase — Pro features forever',
    metadata: { plan: 'lifetime' },
  });

  const lifetimePrice = await stripe.prices.create({
    product: lifetimeProduct.id,
    unit_amount: 9999, // $99.99
    currency: 'usd',
    nickname: 'Lifetime',
    metadata: { plan: 'lifetime' },
  });

  // ─── 3. OUTPUT PRICE IDs ───────────────────────────────────
  console.log('✅ Products created!\n');
  console.log('Copy these into web/config.js:\n');
  console.log(`STRIPE_PRICE_PRO_MONTHLY = "${proMonthly.id}"`);
  console.log(`STRIPE_PRICE_PRO_ANNUAL  = "${proAnnual.id}"`);
  console.log(`STRIPE_PRICE_LIFETIME    = "${lifetimePrice.id}"\n`);

  // ─── 4. CREATE CUSTOMER PORTAL CONFIG ──────────────────────
  const portalConfig = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Warpreader subscription',
    },
    features: {
      subscription_cancel: { enabled: true },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: [{ product: proProduct.id, prices: [proMonthly.id, proAnnual.id] }],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });

  console.log(`STRIPE_PORTAL_CONFIG = "${portalConfig.id}"`);
  console.log('\n✅ All done! Set up webhook at:');
  console.log('https://dashboard.stripe.com/webhooks');
  console.log('Endpoint URL: https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook');
  console.log('Events to send: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted');
}

createProducts().catch(console.error);
