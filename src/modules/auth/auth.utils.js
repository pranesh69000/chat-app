import crypto from 'node:crypto';

/**
 * Normalizes and validates Indian mobile phone numbers (+91 preset).
 * Accepts 10-digit number or +91 followed by 10 digits.
 * Indian mobile numbers start with 6, 7, 8, or 9.
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number must be a valid 10-digit Indian number');
  }

  // Remove spaces, dashes, brackets
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Check 10 digits starting with 6, 7, 8, or 9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(cleaned)) {
    throw new Error('Invalid Indian mobile number. Please enter a valid 10-digit number starting with 6, 7, 8, or 9.');
  }

  return `+91${cleaned}`;
}

export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

export function hashOtp(otp, salt = '') {
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
}
