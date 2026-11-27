import 'dotenv/config';
import { Fast2SmsService } from '../src/infrastructure/sms/fast2SmsService.js';

const apiKey = process.env.FAST2SMS_API_KEY;
const testNumber = process.argv[2];

if (!apiKey) {
  console.error('❌ Error: FAST2SMS_API_KEY is missing in your .env file!');
  process.exit(1);
}

if (!testNumber) {
  console.log('Usage: node scripts/check-sms.js <10-digit-mobile-number>');
  console.log('Example: node scripts/check-sms.js 9876543210');
  process.exit(1);
}

const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

console.log('--- TESTING FAST2SMS SERVICE ---');
console.log(`Sending test OTP [${testOtp}] to ${testNumber}...`);

const service = new Fast2SmsService(apiKey);

try {
  const result = await service.sendOtp(testNumber, testOtp);
  console.log('✓ SUCCESS:', result.message);
  console.log('Check your physical phone now for the SMS!');
} catch (err) {
  console.error('❌ FAILED to send SMS:', err.message);
}
