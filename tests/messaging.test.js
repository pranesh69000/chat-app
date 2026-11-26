import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { userRepository } from '../src/modules/auth/auth.repository.js';
import { messageRepository } from '../src/modules/messaging/messaging.repository.js';
import { smsService } from '../src/infrastructure/sms/devSmsService.js';

beforeEach(async () => {
  await userRepository.clear();
  await messageRepository.clear();
  smsService.clear();
});

async function registerTestUser(app, phone, passcode = '749281') {
  await app.inject({ method: 'POST', url: '/auth/request-otp', payload: { phoneNumber: phone } });
  const otp = smsService.getLastSentOtp(phone.startsWith('+91') ? phone : `+91${phone}`);
  const v = await app.inject({ method: 'POST', url: '/auth/verify-otp', payload: { phoneNumber: phone.startsWith('+91') ? phone : `+91${phone}`, otp } });
  const { verificationToken } = JSON.parse(v.payload);
  const p = await app.inject({ method: 'POST', url: '/auth/set-password', payload: { verificationToken, password: passcode } });
  return JSON.parse(p.payload);
}

test('Multi-User Messaging Flow: Send message to any registered user -> Double tick -> Blue tick', async () => {
  const app = await buildApp({ disableRateLimit: true });
  const user1 = await registerTestUser(app, '9999900001', '749281');
  const user2 = await registerTestUser(app, '9999900002', '850392');

  const sendRes = await app.inject({
    method: 'POST',
    url: '/messages/send',
    headers: { authorization: `Bearer ${user1.sessionToken}` },
    payload: {
      recipientId: user2.user.id,
      content: 'Hello friend, how are you?',
      type: 'text',
      clientMessageId: 'client-msg-1'
    }
  });
  assert.equal(sendRes.statusCode, 201);
  const sentMsg = JSON.parse(sendRes.payload);
  assert.equal(sentMsg.status, 'sent');
  assert.equal(sentMsg.recipientId, user2.user.id);

  const deliverRes = await app.inject({
    method: 'PATCH',
    url: `/messages/${sentMsg.id}/status`,
    headers: { authorization: `Bearer ${user2.sessionToken}` },
    payload: { status: 'delivered' }
  });
  assert.equal(deliverRes.statusCode, 200);
  assert.equal(JSON.parse(deliverRes.payload).status, 'delivered');

  const readRes = await app.inject({
    method: 'PATCH',
    url: `/messages/${sentMsg.id}/status`,
    headers: { authorization: `Bearer ${user2.sessionToken}` },
    payload: { status: 'read' }
  });
  assert.equal(readRes.statusCode, 200);
  assert.equal(JSON.parse(readRes.payload).status, 'read');

  const historyRes = await app.inject({
    method: 'GET',
    url: `/messages/${user2.user.id}`,
    headers: { authorization: `Bearer ${user1.sessionToken}` }
  });
  assert.equal(historyRes.statusCode, 200);
  const history = JSON.parse(historyRes.payload);
  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0].status, 'read');
});
