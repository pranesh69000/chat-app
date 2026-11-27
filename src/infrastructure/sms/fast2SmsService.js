/**
 * Fast2SMS provider for sending actual cellular SMS in India (+91 numbers).
 * Uses Fast2SMS OTP / Quick SMS API.
 */
export class Fast2SmsService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async sendOtp(phoneNumber, otp) {
    if (!this.apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured.');
    }

    // Fast2SMS expects 10-digit Indian phone number without +91
    const cleanNumber = phoneNumber.replace(/^\+91/, '').replace(/\D/g, '');

    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          variables_values: otp,
          route: 'otp',
          numbers: cleanNumber
        })
      });

      const data = await response.json();

      if (data && data.return === true) {
        return { success: true, message: 'SMS dispatched via Fast2SMS' };
      } else {
        console.error('[Fast2SMS Error Response]:', data);
        throw new Error(data.message?.[0] || data.message || 'Failed to dispatch SMS via Fast2SMS');
      }
    } catch (err) {
      console.error('[Fast2SMS Exception]:', err.message);
      throw err;
    }
  }
}
