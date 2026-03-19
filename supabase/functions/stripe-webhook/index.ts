// Supabase Edge Function — Stripe Webhook Handler
// Deploy: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') as string

// Plan mapping from Stripe price IDs
const PRICE_TO_PLAN: Record<string, string> = {
  'price_pro_monthly': 'pro',
  'price_pro_annual': 'pro',
  'price_lifetime': 'lifetime',
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Unauthorized', { status: 401 })
  }

  console.log('Webhook event:', event.type)

  switch (event.type) {
    // ─── NEW SUBSCRIPTION / PAYMENT ───────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string
      const userId = session.metadata?.user_id
      const priceId = session.metadata?.price_id
      const mode = session.mode

      if (!userId) {
        console.error('No user_id in session metadata')
        break
      }

      if (mode === 'payment') {
        // One-time lifetime purchase
        await supabase.rpc('upgrade_user_plan', {
          p_user_id: userId,
          p_plan: 'lifetime',
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: null,
          p_subscription_status: 'lifetime',
          p_subscription_ends_at: null,
        })
      } else if (mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const activePriceId = subscription.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[activePriceId] || 'pro'

        await supabase.rpc('upgrade_user_plan', {
          p_user_id: userId,
          p_plan: plan,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: subscription.id,
          p_subscription_status: subscription.status,
          p_subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
        })
      }
      break
    }

    // ─── SUBSCRIPTION UPDATED ─────────────────────────────────
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      // Look up user by Stripe customer ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!profile) break

      const activePriceId = subscription.items.data[0]?.price.id
      const plan = subscription.status === 'active' ? (PRICE_TO_PLAN[activePriceId] || 'pro') : 'free'

      await supabase.rpc('upgrade_user_plan', {
        p_user_id: profile.id,
        p_plan: plan,
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: subscription.id,
        p_subscription_status: subscription.status,
        p_subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      break
    }

    // ─── SUBSCRIPTION CANCELED / EXPIRED ─────────────────────
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!profile) break

      await supabase.rpc('upgrade_user_plan', {
        p_user_id: profile.id,
        p_plan: 'free',
        p_stripe_customer_id: customerId,
        p_stripe_subscription_id: subscription.id,
        p_subscription_status: 'canceled',
        p_subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
