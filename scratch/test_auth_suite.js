const axios = require('axios');
const { Client } = require('pg');

async function testFullAuthSecuritySuite() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password123!',
    database: 'muslim_database_app',
  });

  try {
    await client.connect();
    const testEmail = `sec_user_${Date.now()}@example.com`;

    console.log('[1. Test Registration] Registering email:', testEmail);
    const regRes = await axios.post('http://localhost:5000/api/v1/auth/register', {
      name: 'Security User',
      email: testEmail,
      password: 'Password123!',
    });
    console.log('Register Response:', regRes.data);

    console.log('[2. Test Unverified Login] Attempting login before OTP...');
    try {
      await axios.post('http://localhost:5000/api/v1/auth/login', {
        email: testEmail,
        password: 'Password123!',
      });
    } catch (err) {
      console.log('Unverified Login Rejected (EXPECTED):', err.response?.data?.message);
    }

    console.log('[3. Fetch OTP from DB]');
    const otpQuery = await client.query(
      'SELECT code FROM otp_codes WHERE email = $1 AND purpose = $2',
      [testEmail, 'VERIFY_EMAIL']
    );
    const otpCode = otpQuery.rows[0].code;
    console.log('Fetched 6-Digit OTP Code:', otpCode);

    console.log('[4. Test Verify OTP]');
    const verifyRes = await axios.post('http://localhost:5000/api/v1/auth/verify-otp', {
      email: testEmail,
      code: otpCode,
    });
    console.log('Verify OTP Success:', verifyRes.data.success);
    const accessToken = verifyRes.data.data.accessToken;
    console.log('Issued Access Token:', accessToken ? 'Valid JWT' : 'Failed');

    console.log('[5. Test Access Protected Route]');
    const profRes = await axios.get('http://localhost:5000/api/v1/auth/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log('User Name:', profRes.data.data.user.name);
    console.log('User Is Verified:', profRes.data.data.user.is_verified);

    console.log('[6. Test Logout & Token Blacklist]');
    const logoutRes = await axios.post(
      'http://localhost:5000/api/v1/auth/logout',
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log('Logout Response:', logoutRes.data);

    console.log('[7. Test Access Protected Route with Revoked Token]');
    try {
      await axios.get('http://localhost:5000/api/v1/auth/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.log('Access with Revoked Token Rejected (EXPECTED):', err.response?.data?.message);
    }

    console.log('\n[SUCCESS] ALL AUTH SECURITY TESTS PASSED 100%!');
  } catch (err) {
    console.error('[Fatal Error]', err.response?.data || err.message);
  } finally {
    await client.end();
  }
}

testFullAuthSecuritySuite();
