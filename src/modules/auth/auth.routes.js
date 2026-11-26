import { authService } from './auth.service.js';
import { sanitizeInput } from '../../core/security.js';

export async function authRoutes(fastify) {
  // 1. Request OTP
  fastify.post('/auth/request-otp', async (request, reply) => {
    let { phoneNumber } = request.body || {};
    phoneNumber = sanitizeInput(phoneNumber);
    if (!phoneNumber) {
      return reply.code(400).send({ error: 'Phone number is required' });
    }

    try {
      const result = await authService.requestOtp(phoneNumber);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 2. Verify OTP
  fastify.post('/auth/verify-otp', async (request, reply) => {
    let { phoneNumber, otp } = request.body || {};
    phoneNumber = sanitizeInput(phoneNumber);
    otp = sanitizeInput(otp);

    if (!phoneNumber || !otp) {
      return reply.code(400).send({ error: 'Phone number and OTP are required' });
    }

    try {
      const result = await authService.verifyOtp(phoneNumber, otp);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 3. Set Account Password
  fastify.post('/auth/set-password', async (request, reply) => {
    let { verificationToken, password } = request.body || {};
    verificationToken = sanitizeInput(verificationToken);

    if (!verificationToken || !password) {
      return reply.code(400).send({ error: 'Verification token and password are required' });
    }

    try {
      const result = await authService.setPassword(verificationToken, password);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 4. Unlock directly with Passcode (enforces 4-attempt lockout)
  fastify.post('/auth/unlock', async (request, reply) => {
    const { passcode } = request.body || {};
    const clientIp = request.ip || 'client-ip';

    if (!passcode) {
      return reply.code(400).send({ error: 'Passcode is required' });
    }

    try {
      const result = await authService.unlockWithPasscode(passcode, clientIp);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 5. Login with Phone + Password
  fastify.post('/auth/login', async (request, reply) => {
    let { phoneNumber, password } = request.body || {};
    phoneNumber = sanitizeInput(phoneNumber);

    if (!phoneNumber || !password) {
      return reply.code(400).send({ error: 'Phone number and password are required' });
    }

    try {
      const result = await authService.loginWithPassword(phoneNumber, password);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 6. Get current profile
  fastify.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized: Missing session token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await authService.getSessionUser(token);

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized: Invalid or expired session' });
    }

    return reply.send({ user });
  });
}
