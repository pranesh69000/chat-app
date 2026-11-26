import { config } from '../src/config/env.js';
import { r2StorageService } from '../src/infrastructure/storage/cloudflareR2Service.js';
import { HeadBucketCommand } from '@aws-sdk/client-s3';

console.log('--- TESTING CLOUDFLARE R2 CONFIGURATION ---');
console.log('USE_R2:', config.USE_R2);
console.log('R2_BUCKET_NAME:', config.R2_BUCKET_NAME);
console.log('R2_ACCOUNT_ID present:', Boolean(config.R2_ACCOUNT_ID));
console.log('R2_ACCESS_KEY_ID present:', Boolean(config.R2_ACCESS_KEY_ID));
console.log('R2_SECRET_ACCESS_KEY present:', Boolean(config.R2_SECRET_ACCESS_KEY));

if (!config.USE_R2) {
  console.log('\nNotice: USE_R2 is set to false in .env! Set USE_R2=true to enable R2 cloud storage.');
  process.exit(0);
}

if (!r2StorageService.client) {
  console.error('\n❌ ERROR: Cloudflare R2 client could not be initialized. Check that R2_ACCOUNT_ID is in .env.');
  process.exit(1);
}

try {
  console.log('\n1. Checking connection to bucket:', config.R2_BUCKET_NAME);
  await r2StorageService.client.send(new HeadBucketCommand({ Bucket: config.R2_BUCKET_NAME }));
  console.log('   ✓ SUCCESS: Connected to Cloudflare R2 Bucket!');

  console.log('\n2. Testing file upload (voice/media test)...');
  const testBuffer = Buffer.from('TEST_VOICE_NOTE_AUDIO_CONTENT_CLOUDFLARE_R2');
  const uploadResult = await r2StorageService.saveFile({
    fileId: 'test-r2-diag-' + Date.now(),
    filename: 'test-audio.webm',
    buffer: testBuffer,
    mimeType: 'audio/webm',
    ownerId: 'user-diag-1',
    recipientId: 'user-diag-2'
  });
  console.log('   ✓ SUCCESS: File uploaded to R2 at:', uploadResult.r2Key);

  console.log('\n3. Testing file retrieval from R2...');
  const downloaded = await r2StorageService.getFileBuffer(uploadResult.fileId);
  console.log('   ✓ SUCCESS: File downloaded back from R2! Size:', downloaded.length, 'bytes');

  console.log('\n======================================================');
  console.log('ALL CLOUDFLARE R2 STORAGE CHECKS PASSED SUCCESSFULLY!');
  console.log('======================================================');
} catch (err) {
  console.error('\n❌ ERROR CONNECTING TO CLOUDFLARE R2:');
  console.error('Error Code:', err.code || err.name);
  console.error('Error Message:', err.message);
  console.log('\nTroubleshooting tips:');
  console.log('1. Verify your R2_ACCOUNT_ID (from your Cloudflare R2 Overview page).');
  console.log('2. Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env.');
  console.log('3. Ensure the bucket name in .env matches the bucket you created (private-chat-media).');
}
