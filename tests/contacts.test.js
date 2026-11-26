import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { userRepository } from '../src/modules/auth/auth.repository.js';
import { smsService } from '../src/infrastructure/sms/devSmsService.js';

beforeEach(async () => {
  await userRepository.clear();
  smsService.clear();
});

// Helper registers using valid 10-digit Indian number & strong numeric passcode
async function registerUser(app, phone, passcode = '749281') {
  await app.inject({ method: 'POST', url: '/auth/request-otp', payload: { phoneNumber: phone } });
  const otp = smsService.getLastSentOtp(phone.startsWith('+91') ? phone : `+91${phone}`);
  const v = await app.inject({ method: 'POST', url: '/auth/verify-otp', payload: { phoneNumber: phone.startsWith('+91') ? phone : `+91${phone}`, otp } });
  const { verificationToken } = JSON.parse(v.payload);
  const p = await app.inject({ method: 'POST', url: '/auth/set-password', payload: { verificationToken, password: passcode } });
  return JSON.parse(p.payload);
}

test('Contact Sync: Registered contacts appear for immediate chat, unregistered contacts receive SMS invite option', async () => {
  const app = await buildApp({ disableRateLimit: true });

  const userA = await registerUser(app, '9999911111', '749281');
  const userB = await registerUser(app, '9999922222', '850392');

  const syncRes = await app.inject({
    method: 'POST',
    url: '/contacts/sync',
    headers: { authorization: `Bearer ${userA.sessionToken}` },
    payload: {
      phoneNumbers: ['+919999922222', '+919999933333']
    }
  });

  assert.equal(syncRes.statusCode, 200);
  const body = JSON.parse(syncRes.payload);

  assert.equal(body.registered.length, 1);
  assert.equal(body.registered[0].phoneNumber, '+919999922222');
  assert.equal(body.registered[0].userId, userB.user.id);

  assert.equal(body.notRegistered.length, 1);
  assert.equal(body.notRegistered[0].phoneNumber, '+919999933333');
  assert.ok(body.notRegistered[0].inviteLink);
});
