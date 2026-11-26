import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { userRepository } from '../src/modules/auth/auth.repository.js';
import { messageRepository } from '../src/modules/messaging/messaging.repository.js';
import { storageService } from '../src/infrastructure/storage/localStorageService.js';
import { smsService } from '../src/infrastructure/sms/devSmsService.js';

beforeEach(async () => {
  await userRepository.clear();
  await messageRepository.clear();
  await storageService.clear();
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

test('Media Flow: Upload media -> Designated recipient retrieves media -> Unauthorized third-party blocked', async () => {
  const app = await buildApp({ disableRateLimit: true });
  const user1 = await registerTestUser(app, '9999900021', '749281');
  const user2 = await registerTestUser(app, '9999900022', '850392');
  const user3 = await registerTestUser(app, '9999900023', '961403');

  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);

  const { mediaService } = await import('../src/modules/media/media.service.js');
  const uploadResult = await mediaService.uploadMedia({
    userId: user1.user.id,
    recipientId: user2.user.id,
    filename: 'photo.png',
    buffer: validPngBuffer,
    mimeType: 'image/png'
  });

  assert.ok(uploadResult.fileId);
  assert.equal(uploadResult.mimeType, 'image/png');

  // Recipient accesses media
  const friendMedia = await mediaService.getMediaStream(user2.user.id, uploadResult.fileId);
  assert.equal(friendMedia.mimeType, 'image/png');
  assert.equal(friendMedia.buffer.length, validPngBuffer.length);

  // Unauthorized third party blocked
  await assert.rejects(
    async () => {
      await mediaService.getMediaStream(user3.user.id, uploadResult.fileId);
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});
