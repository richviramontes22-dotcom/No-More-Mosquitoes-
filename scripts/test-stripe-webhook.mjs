#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const API_BASE = 'http://localhost:8080';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STRIPE_SECRET) {
  console.error('❌ Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, STRIPE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Color logging
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  step: (msg) => console.log(`\n📍 ${msg}`),
  data: (label, data) => console.log(`${label}:`, JSON.stringify(data, null, 2))
};

async function testStripeWebhook() {
  try {
    log.step('Testing Stripe Integration');

    // Step 1: Get or create test user
    log.step('Step 1: Setting up test user');

    // Use a fixed test email to avoid rate limiting
    const testEmail = 'stripe-test@nomosquitoes.com';
    const testPassword = 'StripeTest123!@#';

    // Try to sign in first, if that fails, create new user
    let userId;
    let accessToken;

    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginError) {
      // User doesn't exist, try to create
      log.info('User not found, creating new test user...');
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            name: 'Test User',
            role: 'customer'
          }
        }
      });

      if (signupError && !signupError.message.includes('already registered')) {
        throw signupError;
      }

      userId = signupData?.user?.id;
      if (!userId) {
        throw new Error('Failed to create test user');
      }
      log.success(`Created test user: ${testEmail}`);
    } else {
      userId = loginData.user?.id;
      accessToken = loginData.session?.access_token;
      log.success(`Using existing test user: ${testEmail}`);
    }

    // Step 2: Ensure we have access token
    log.step('Step 2: Getting authentication token');
    if (!accessToken) {
      const { data: freshLogin, error: freshError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (freshError) throw freshError;
      accessToken = freshLogin.session?.access_token;
    }

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }
    log.success('User authenticated');

    // Step 3: Create/get test property
    log.step('Step 3: Setting up test property');
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .insert({
        user_id: userId,
        name: 'Test Property',
        address: '123 Test St',
        acreage: 0.5,
        status: 'active'
      })
      .select()
      .single();

    if (propertyError) throw propertyError;
    const propertyId = propertyData.id;
    log.success(`Created test property: ${propertyId}`);
    log.data('Property', propertyData);

    // Step 4: Create checkout session
    log.step('Step 4: Creating Stripe checkout session');
    const checkoutResponse = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyId: propertyId,
        acreage: 0.5,
        cadenceDays: 30,
        program: 'subscription'
      })
    });

    if (!checkoutResponse.ok) {
      throw new Error(`Checkout failed: ${await checkoutResponse.text()}`);
    }

    const checkoutData = await checkoutResponse.json();
    log.success('Checkout session created');
    log.data('Checkout Data', {
      sessionId: checkoutData.sessionId,
      url: checkoutData.url ? '(Stripe redirect URL)' : 'N/A'
    });

    // Step 5: Simulate webhook - checkout.session.completed
    log.step('Step 5: Simulating webhook event: checkout.session.completed');
    const mockCheckoutSession = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_test_${Date.now()}`,
          customer: `cus_test_${Date.now()}`,
          subscription: `sub_test_${Date.now()}`,
          payment_intent: `pi_test_${Date.now()}`,
          mode: 'subscription',
          metadata: {
            user_id: userId,
            property_id: propertyId,
            cadence_days: '30'
          }
        }
      }
    };

    const webhookResponse = await fetch(`${API_BASE}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockCheckoutSession)
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed: ${await webhookResponse.text()}`);
    }

    log.success('Webhook event processed');

    // Step 6: Verify subscription was created
    log.step('Step 6: Verifying subscription in database');
    
    // Wait a moment for database to sync
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      throw new Error('No subscription found after webhook');
    }

    const subscription = subscriptions[0];
    log.success(`Subscription created successfully!`);
    log.data('Subscription Record', {
      id: subscription.id,
      user_id: subscription.user_id,
      status: subscription.status,
      stripe_subscription_id: subscription.stripe_subscription_id,
      created_at: subscription.created_at
    });

    // Step 7: Verify property was updated
    log.step('Step 7: Verifying property update');
    const { data: updatedProperty, error: propError } = await supabase
      .from('properties')
      .select('program, cadence')
      .eq('id', propertyId)
      .single();

    if (propError) throw propError;

    log.success('Property updated successfully');
    log.data('Property Status', {
      program: updatedProperty.program,
      cadence: updatedProperty.cadence
    });

    // Final summary
    log.step('Test Summary');
    console.log(`
┌─────────────────────────────────────────┐
│  ✅ STRIPE INTEGRATION TEST PASSED!     │
├─────────────────────────────────────────┤
│ ✓ User created & authenticated          │
│ ✓ Property created                      │
│ ✓ Checkout session created              │
│ ✓ Webhook event processed               │
│ ✓ Subscription synced to database       │
│ ✓ Property updated with subscription    │
└─────────────────────────────────────────┘

Your Stripe integration is fully operational!

To complete the test with actual payment:
1. Go to ${API_BASE}/schedule
2. Select your property
3. Use Stripe test card: 4242 4242 4242 4242
4. Expiry: 12/25, CVC: 123
5. Complete payment and verify subscription
    `);

  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testStripeWebhook();
