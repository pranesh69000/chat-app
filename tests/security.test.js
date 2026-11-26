import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { userRepository } from '../src/modules/auth/auth.repository.js';
import { messageRepository } from '../src/modules/messaging/messaging.repository.js';
import { notificationService } from '../src/modules/notifications/notification.service.js';
import { smsService } from '../src/infrastructure/sms/devSmsService.js';
import { sanitizeInput } from '../src/core/security.js';

beforeEach(async () => {
  await userRepository.clear();
  await messageRepository.clear();
  notificationService.clear();
  smsService.clear();
});

test('Security Tests: 4-attempt password lockout for 10 minutes & SQL injection prevention', async () => {
  const app = await buildApp({ disableRateLimit: true });
  const testPhone = '+919999900030';

  // 1. Register a valid user
  await app.inject({ method: 'POST', url: '/auth/request-otp', payload: { phoneNumber: testPhone } });
  const otp = smsService.getLastSentOtp(testPhone);
  const v = await app.inject({ method: 'POST', url: '/auth/verify-otp', payload: { phoneNumber: testPhone, otp } });
  const { verificationToken } = JSON.parse(v.payload);
  await app.inject({ method: 'POST', url: '/auth/set-password', payload: { verificationToken, password: 'RealPassword@123' } });

  // 2. Brute Force Protection: 4 wrong password attempts must lock out for 10 minutes (429)
  for (let i = 0; i < 3; i++) {
    const wrongRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { phoneNumber: testPhone, password: 'WrongPassword' }
    });
    assert.equal(wrongRes.statusCode, 401);
  }

  // 4th wrong attempt -> Triggers 10-minute lockout (429)
  const fourthWrongRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { phoneNumber: testPhone, password: 'WrongPassword' }
  });
  assert.equal(fourthWrongRes.statusCode, 429);
  const fourthBody = JSON.parse(fourthWrongRes.payload);
  assert.ok(fourthBody.error.includes('Too many failed attempts') || fourthBody.error.includes('locked'));

  // 3. SQL Injection Prevention: verify malicious query strings are neutralized
  const maliciousQuery = "SELECT * FROM users WHERE '1'='1' --; DROP TABLE messages;";
  const sanitized = sanitizeInput(maliciousQuery);
  assert.ok(!sanitized.includes('SELECT'));
  assert.ok(!sanitized.includes('DROP'));
  assert.ok(!sanitized.includes('--'));
  assert.ok(!sanitized.includes("'"));
  assert.ok(!sanitized.includes(';'));
});
