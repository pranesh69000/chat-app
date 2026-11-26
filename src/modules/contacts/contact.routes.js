import { contactService } from './contact.service.js';
import { authService } from '../auth/auth.service.js';

export async function contactRoutes(fastify) {
  const authenticate = async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized: Missing session token' });
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await authService.getSessionUser(token);
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized: Invalid session' });
      return null;
    }

    return user;
  };

  // Sync contacts from address book
  fastify.post('/contacts/sync', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    const { phoneNumbers } = request.body || {};
    try {
      const result = await contactService.syncContacts(user.id, phoneNumbers || []);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // Get all registered contacts available to chat
  fastify.get('/contacts/registered', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    try {
      const registered = await contactService.getRegisteredUsers(user.id);
      return reply.send({ registered });
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}
