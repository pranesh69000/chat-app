/**
 * Input sanitization to prevent SQL Injection and XSS attacks.
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  let clean = input
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|UNION)\b)/gi, '')
    .replace(/(--|#|\/\*|\*\/)/g, '')
    .replace(/['";\\]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return clean.trim();
}

/**
 * Validates numeric-only passcode strength and prevents guessable patterns.
 * Constraints:
 * 1. Must be numeric only.
 * 2. Length must be between 4 and 8 digits (recommended 6).
 * 3. Rejects identical repeated digits (e.g., 0000, 111111, 9999).
 * 4. Rejects consecutive ascending sequences (e.g., 1234, 123456).
 * 5. Rejects consecutive descending sequences (e.g., 4321, 654321).
 * 6. Rejects common predictable PINs (e.g., 2580, 0852).
 */
export function validatePasscodeStrength(passcode) {
  if (!passcode || typeof passcode !== 'string') {
    throw new Error('Passcode is required and must contain only numbers.');
  }

  const trimmed = passcode.trim();

  // 1. Numeric only
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Passcode must contain only numeric digits (0-9).');
  }

  // 2. Length between 4 and 8 digits
  if (trimmed.length < 4 || trimmed.length > 8) {
    throw new Error('Passcode must be between 4 and 8 digits long.');
  }

  // 3. Repeated digits (e.g. 0000, 1111, 777777)
  const isAllSame = trimmed.split('').every(char => char === trimmed[0]);
  if (isAllSame) {
    throw new Error('Weak passcode: All digits cannot be identical (e.g. 1111, 0000).');
  }

  // 4. Consecutive ascending sequences (e.g. 1234, 2345, 123456)
  const digits = trimmed.split('').map(Number);
  let isAscending = true;
  let isDescending = true;

  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) isAscending = false;
    if (digits[i] !== digits[i - 1] - 1) isDescending = false;
  }

  if (isAscending) {
    throw new Error('Weak passcode: Sequential ascending digits (e.g. 1234, 123456) are easily guessable.');
  }

  if (isDescending) {
    throw new Error('Weak passcode: Sequential descending digits (e.g. 4321, 654321) are easily guessable.');
  }

  // 5. Common keypad sequences
  const commonPins = new Set(['2580', '0852', '1212', '1313', '1004', '2000', '2020', '2024', '2025', '2026']);
  if (commonPins.has(trimmed)) {
    throw new Error('Weak passcode: Common pattern detected. Please choose a less guessable passcode.');
  }

  return true;
}
