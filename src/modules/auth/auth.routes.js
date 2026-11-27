import { authService } from './auth.service.js';
import { sanitizeInput } from '../../core/security.js';

export async function authRoutes(fastify) {
  // 1. Register: phone + passcode (no OTP)
  fastify.post('/auth/register', async (request, reply) => {
    let { phoneNumber, passcode } = request.body || {};
    phoneNumber = sanitizeInput(phoneNumber);

    if (!phoneNumber || !passcode) {
      return reply.code(400).send({ error: 'Phone number and passcode are required' });
    }

    try {
      const result = await authService.register(phoneNumber, passcode);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 2. Login: phone + passcode
  fastify.post('/auth/login', async (request, reply) => {
    let { phoneNumber, passcode } = request.body || {};
    phoneNumber = sanitizeInput(phoneNumber);

    if (!phoneNumber || !passcode) {
      return reply.code(400).send({ error: 'Phone number and passcode are required' });
    }

    try {
      const result = await authService.login(phoneNumber, passcode);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 3. Logout
  fastify.post('/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    await authService.logout(token);
    return reply.send({ success: true });
  });

  // 4. Get current profile
  fastify.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const token = authHeader.replace('Bearer ', '');
    const user = await authService.getSessionUser(token);
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized: Invalid or expired session' });
    }
    return reply.send({ user });
  });
}
