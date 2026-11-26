import { messagingService } from './messaging.service.js';
import { authService } from '../auth/auth.service.js';
import { sanitizeInput } from '../../core/security.js';

export async function messagingRoutes(fastify) {
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

  // 1. Send Message (SQL Injection & XSS Sanitized)
  fastify.post('/messages/send', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    let { recipientId, content, type, mediaUrl, clientMessageId } = request.body || {};
    
    // Sanitize message content to prevent SQL injection & XSS
    if (content) {
      content = sanitizeInput(content);
    }
    if (clientMessageId) {
      clientMessageId = sanitizeInput(clientMessageId);
    }

    try {
      const result = await messagingService.sendMessage({
        senderId: user.id,
        recipientId,
        content,
        type,
        mediaUrl,
        clientMessageId
      });
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 2. Get Message History
  fastify.get('/messages/:recipientId', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    const { recipientId } = request.params;
    const { limit, before } = request.query || {};

    try {
      const result = await messagingService.getConversationHistory(user.id, recipientId, {
        limit: limit ? parseInt(limit, 10) : 50,
        before
      });
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 3. Get Conversations
  fastify.get('/conversations', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    try {
      const threads = await messagingService.getUserConversations(user.id);
      return reply.send({ conversations: threads });
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 4. Update Status
  fastify.patch('/messages/:id/status', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    const { id } = request.params;
    const { status } = request.body || {};

    try {
      const result = await messagingService.updateStatus(user.id, id, status);
      return reply.send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}
