import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
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

test('Real-Time WebSocket Flow: Multi-user instant delivery & read receipts', async () => {
  const app = await buildApp({ disableRateLimit: true });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;

  const user1 = await registerTestUser(app, '9999900011', '749281');
  const user2 = await registerTestUser(app, '9999900012', '850392');

  const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${user1.sessionToken}`);
  const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${user2.sessionToken}`);

  await Promise.all([
    new Promise(res => ws1.on('open', res)),
    new Promise(res => ws2.on('open', res))
  ]);

  const user2Received = [];
  ws2.on('message', (data) => {
    user2Received.push(JSON.parse(data.toString()));
  });

  const user1StatusUpdates = [];
  ws1.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    if (parsed.type === 'message_status_updated') {
      user1StatusUpdates.push(parsed);
    }
  });

  ws1.send(JSON.stringify({
    action: 'send_message',
    recipientId: user2.user.id,
    content: 'Real-time multi-user test message',
    clientMessageId: 'ws-msg-1'
  }));

  await new Promise(r => setTimeout(r, 200));

  const newMsgEvent = user2Received.find(e => e.type === 'new_message');
  assert.ok(newMsgEvent);
  assert.equal(newMsgEvent.message.content, 'Real-time multi-user test message');

  const deliveredUpdate = user1StatusUpdates.find(u => u.status === 'delivered');
  assert.ok(deliveredUpdate);

  ws2.send(JSON.stringify({
    action: 'mark_read',
    messageId: newMsgEvent.message.id
  }));

  await new Promise(r => setTimeout(r, 200));

  const readUpdate = user1StatusUpdates.find(u => u.status === 'read');
  assert.ok(readUpdate);

  ws1.close();
  ws2.close();
  await app.close();
});
