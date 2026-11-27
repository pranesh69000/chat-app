import { config } from '../../config/env.js';
import { DevSmsService } from './devSmsService.js';
import { Fast2SmsService } from './fast2SmsService.js';

let serviceInstance;

if (config.FAST2SMS_API_KEY && config.USE_REAL_SMS) {
  serviceInstance = new Fast2SmsService(config.FAST2SMS_API_KEY);
  console.log('✓ SMS Service: Using Fast2SMS for cellular SMS delivery');
} else {
  serviceInstance = new DevSmsService();
  if (config.NODE_ENV !== 'test') {
    console.log('ℹ SMS Service: Using DevSmsService (OTPs logged to server console)');
  }
}

export const smsService = serviceInstance;
