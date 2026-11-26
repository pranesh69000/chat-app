import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { userRepository } from '../src/modules/auth/auth.repository.js';
import { smsService } from '../src/infrastructure/sms/devSmsService.js';

beforeEach(async () => {
  await userRepository.clear();
  smsService.clear();
});

test('Full Authentication Flow: Indian Phone (+91 preset) -> OTP -> Numeric Passcode Strength -> Login', async () => {
  const app = await buildApp({ disableRateLimit: true });
  const testPhone = '9876543210'; // 10-digit Indian number

  // 1. Request OTP
  const reqOtpRes = await app.inject({
    method: 'POST',
    url: '/auth/request-otp',
    payload: { phoneNumber: testPhone }
  });
  assert.equal(reqOtpRes.statusCode, 200);
  const reqOtpBody = JSON.parse(reqOtpRes.payload);
  assert.equal(reqOtpBody.phoneNumber, '+919876543210');

  const generatedOtp = smsService.getLastSentOtp('+919876543210');
  assert.ok(generatedOtp);

  // 2. Verify OTP
  const verifyRes = await app.inject({
    method: 'POST',
    url: '/auth/verify-otp',
    payload: { phoneNumber: '+919876543210', otp: generatedOtp }
  });
  assert.equal(verifyRes.statusCode, 200);
  const verifyBody = JSON.parse(verifyRes.payload);

  // 3. Security Test: Reject weak guessable passcodes
  // A. Non-numeric
  const nonNumericRes = await app.inject({
    method: 'POST',
    url: '/auth/set-password',
    payload: { verificationToken: verifyBody.verificationToken, password: 'abcd' }
  });
  assert.equal(nonNumericRes.statusCode, 400);

  // B. Repeated digits (e.g. 1111)
  const repeatedRes = await app.inject({
    method: 'POST',
    url: '/auth/set-password',
    payload: { verificationToken: verifyBody.verificationToken, password: '1111' }
  });
  assert.equal(repeatedRes.statusCode, 400);

  // C. Ascending sequence (e.g. 1234)
  const sequentialRes = await app.inject({
    method: 'POST',
    url: '/auth/set-password',
    payload: { verificationToken: verifyBody.verificationToken, password: '1234' }
  });
  assert.equal(sequentialRes.statusCode, 400);

  // 4. Accept strong, non-guessable numeric passcode (e.g. 749281)
  const setPassRes = await app.inject({
    method: 'POST',
    url: '/auth/set-password',
    payload: { verificationToken: verifyBody.verificationToken, password: '749281' }
  });
  assert.equal(setPassRes.statusCode, 200);

  // 5. Unlock with numeric passcode
  const unlockRes = await app.inject({
    method: 'POST',
    url: '/auth/unlock',
    payload: { passcode: '749281' }
  });
  assert.equal(unlockRes.statusCode, 200);
  assert.ok(JSON.parse(unlockRes.payload).sessionToken);
});
