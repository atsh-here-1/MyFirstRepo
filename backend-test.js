// This script tests the basic functionality of the passkey backend.
// It can't complete the full registration/login flow because that requires a real browser,
// but it's perfect for checking if the initial server endpoints are working correctly.

// In your terminal, you might need to install node-fetch: npm install node-fetch
const fetch = require('node-fetch');

const BASE_URL = 'https://passkey-backend-6w35.onrender.com';
// Use a new, unique email for each test run to avoid "User already exists" errors.
const TEST_EMAIL = `testuser_${Date.now()}@example.com`;
// To test the login flow, replace this with an email you have successfully registered.
const EXISTING_EMAIL = 'test@example.com'; // <== IMPORTANT: CHANGE THIS

async function runBackendTests() {
  console.log('🚀 Starting backend tests...');
  
  await testRegisterStart();
  await testLoginStart();

  console.log('✅ All backend tests complete.');
}

async function testRegisterStart() {
  console.log(`\n--- [1] Testing: REGISTER /start with new email: ${TEST_EMAIL} ---`);
  try {
    const response = await fetch(`${BASE_URL}/register/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    });

    const data = await response.json();

    console.log('   Status Code:', response.status);
    console.log('   Response Body:', JSON.stringify(data, null, 2));

    if (response.ok && data.challenge && data.rp) {
      console.log('   [SUCCESS] /register/start responded with a valid challenge.');
    } else {
      console.error('   [FAIL] /register/start did not respond as expected.');
      console.error('   Error details:', data.error || 'No error message provided.');
    }
  } catch (error) {
    console.error('   [FAIL] An unexpected error occurred during the /register/start test.');
    console.error(error);
  }
}

async function testLoginStart() {
  console.log(`\n--- [2] Testing: LOGIN /start with existing email: ${EXISTING_EMAIL} ---`);
  try {
    const response = await fetch(`${BASE_URL}/login/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EXISTING_EMAIL }),
    });

    const data = await response.json();

    console.log('   Status Code:', response.status);
    console.log('   Response Body:', JSON.stringify(data, null, 2));

    if (response.ok && data.challenge && data.allowCredentials) {
      console.log('   [SUCCESS] /login/start responded with a valid challenge.');
      if (data.allowCredentials.length === 0) {
        console.warn('   [WARNING] The user exists, but has no passkeys registered. This is a likely source of errors.');
      }
    } else {
      console.error('   [FAIL] /login/start did not respond as expected.');
      console.error('   Error details:', data.error || 'No error message provided.');
    }
  } catch (error) {
    console.error('   [FAIL] An unexpected error occurred during the /login/start test.');
    console.error(error);
  }
}

runBackendTests();
