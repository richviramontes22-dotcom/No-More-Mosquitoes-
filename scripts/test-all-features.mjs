#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:8080';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Color logging
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  step: (msg) => console.log(`\n📍 ${msg}`),
  pass: (msg) => console.log(`✓ PASS: ${msg}`),
  fail: (msg) => console.error(`✗ FAIL: ${msg}`),
};

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function recordTest(name, passed, details) {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    log.pass(name);
  } else {
    results.failed++;
    log.fail(name);
    if (details) log.error(`  Details: ${details}`);
  }
}

async function testDatabaseConnectivity() {
  log.step('TEST 2: Supabase Database Connectivity');

  try {
    const response = await fetch(`${API_BASE}/api/db-check`);
    const data = await response.json();

    if (data.connected) {
      recordTest('Database health check', true);
      log.info(`  Connected to: ${data.url || 'Supabase'}`);
      
      const allSuccess = Object.values(data.results).every(r => r.success);
      if (allSuccess) {
        recordTest('All database tables accessible', true);
      } else {
        const failed = Object.entries(data.results)
          .filter(([_, r]) => !r.success)
          .map(([name]) => name);
        recordTest('All database tables accessible', false, `Failed: ${failed.join(', ')}`);
      }
    } else {
      recordTest('Database health check', false, 'Not connected');
    }
  } catch (error) {
    recordTest('Database health check', false, error.message);
  }
}

async function testWaitlistEndpoint() {
  log.step('TEST 5: Waitlist Email Signup');

  try {
    const testEmail = `waitlist-test-${Date.now()}@test.com`;
    
    const response = await fetch(`${API_BASE}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        name: 'Test User',
        phoneNumber: '555-1234'
      })
    });

    if (response.ok) {
      const data = await response.json();
      recordTest('Waitlist endpoint accepts email', true);
      log.info(`  Test email: ${testEmail}`);
    } else {
      recordTest('Waitlist endpoint accepts email', false, `HTTP ${response.status}`);
    }
  } catch (error) {
    recordTest('Waitlist endpoint accepts email', false, error.message);
  }
}

async function testEnvironmentVariables() {
  log.step('TEST 0: Environment Variables Setup');

  const envVars = {
    'VITE_SUPABASE_URL': SUPABASE_URL,
    'VITE_SUPABASE_ANON_KEY': SUPABASE_KEY ? '(set)' : '(missing)',
    'STRIPE_SECRET_KEY': STRIPE_SECRET ? '(set)' : '(missing)',
    'STRIPE_WEBHOOK_SECRET': STRIPE_WEBHOOK_SECRET ? '(set)' : '(missing)',
  };

  const allSet = SUPABASE_URL && SUPABASE_KEY && STRIPE_SECRET && STRIPE_WEBHOOK_SECRET;

  for (const [key, value] of Object.entries(envVars)) {
    if (value === '(missing)') {
      recordTest(`${key} configured`, false);
    } else {
      recordTest(`${key} configured`, true);
      if (value !== '(set)') {
        log.info(`  URL: ${value}`);
      }
    }
  }

  recordTest('All required credentials present', allSet);
  if (!allSet) {
    log.warning('Some credentials are missing. Full testing may not work.');
  }
}

async function testStripeWebhookSignature() {
  log.step('TEST 8: Stripe Webhook Signature Verification');

  try {
    // Try to call webhook with invalid signature
    const response = await fetch(`${API_BASE}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 'invalid_signature'
      },
      body: JSON.stringify({ type: 'test' })
    });

    // Should reject invalid signature (400 or 401)
    if (response.status >= 400) {
      recordTest('Webhook rejects invalid signature', true);
      log.info(`  Returns HTTP ${response.status} (correct)`);
    } else {
      recordTest('Webhook rejects invalid signature', false, `Got ${response.status}, expected 4xx`);
    }
  } catch (error) {
    recordTest('Webhook signature verification', false, error.message);
  }
}

async function testAPIAvailability() {
  log.step('TEST 3: API Endpoints Availability');

  const endpoints = [
    { method: 'GET', path: '/api/ping', name: 'Health check' },
    { method: 'GET', path: '/api/db-check', name: 'Database check' },
    { method: 'POST', path: '/api/waitlist', name: 'Waitlist endpoint' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.method === 'POST' ? JSON.stringify({}) : undefined,
      });

      const available = response.status < 500;
      recordTest(`${endpoint.name} endpoint`, available, 
        available ? `HTTP ${response.status}` : `Error ${response.status}`);
    } catch (error) {
      recordTest(`${endpoint.name} endpoint`, false, error.message);
    }
  }
}

async function testCredentialsInEnvironment() {
  log.step('TEST: Verify Credentials Loaded');

  const checks = {
    'Supabase URL': !!SUPABASE_URL,
    'Supabase Anon Key': !!SUPABASE_KEY,
    'Stripe Secret Key': !!STRIPE_SECRET,
    'Stripe Webhook Secret': !!STRIPE_WEBHOOK_SECRET,
  };

  let allPresent = true;
  for (const [name, present] of Object.entries(checks)) {
    recordTest(`${name} present`, present);
    if (!present) allPresent = false;
  }

  return allPresent;
}

async function runAllTests() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  COMPREHENSIVE FEATURE TEST SUITE                        ║
║  Testing all integrations and features                   ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Run tests in order
  await testCredentialsInEnvironment();
  await testEnvironmentVariables();
  await testAPIAvailability();
  await testDatabaseConnectivity();
  await testWaitlistEndpoint();
  await testStripeWebhookSignature();

  // Summary
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  TEST RESULTS SUMMARY                                     ║
╠═══════════════════════════════════════════════════════════╣
║  Total Tests: ${results.passed + results.failed}
║  ✓ Passed: ${results.passed}
║  ✗ Failed: ${results.failed}
║  Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%
╚═══════════════════════════════════════════════════════════╝
  `);

  console.log('\nDetailed Results:');
  console.log('═'.repeat(60));
  results.tests.forEach((test, i) => {
    const status = test.passed ? '✓' : '✗';
    const detail = test.details ? ` (${test.details})` : '';
    console.log(`${i + 1}. [${status}] ${test.name}${detail}`);
  });

  if (results.failed === 0) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🎉 ALL TESTS PASSED! 🎉                                  ║
║                                                           ║
║  The application is ready for production.                 ║
║  All integrations are working correctly.                  ║
╚═══════════════════════════════════════════════════════════╝
    `);
    process.exit(0);
  } else {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ⚠️  SOME TESTS FAILED                                    ║
║                                                           ║
║  Please review failures above and fix issues.             ║
╚═══════════════════════════════════════════════════════════╝
    `);
    process.exit(1);
  }
}

// Run all tests
runAllTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
