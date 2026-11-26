import { connectionManager } from './connectionManager.js';
import { messagingService } from './messaging.service.js';
import { authService } from '../auth/auth.service.js';
import { sanitizeInput } from '../../core/security.js';

export async function websocketGateway(fastify) {
  fastify.get('/ws', { websocket: true }, async (socket, req) => {
    const token = req.query?.token;
    if (!token) {
      socket.send(JSON.stringify({ error: 'Unauthorized: Token required' }));
      socket.close(1008, 'Token required');
      return;
    }

    const user = await authService.getSessionUser(token);
    if (!user) {
      socket.send(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
      socket.close(1008, 'Invalid token');
      return;
    }

    connectionManager.addConnection(user.id, socket);

    socket.send(JSON.stringify({
      type: 'connected',
      userId: user.id,
      timestamp: Date.now()
    }));

    socket.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const { action } = payload;

        if (action === 'send_message') {
          // Sanitize message content to prevent SQL injection & XSS
          const cleanContent = payload.content ? sanitizeInput(payload.content) : '';

          const msg = await messagingService.sendMessage({
            senderId: user.id,
            recipientId: payload.recipientId,
            content: cleanContent,
            type: payload.type || 'text',
            mediaUrl: payload.mediaUrl,
            clientMessageId: payload.clientMessageId
          });

          socket.send(JSON.stringify({
            type: 'message_sent',
            message: msg
          }));

          const isDelivered = connectionManager.sendToUser(msg.recipientId, {
            type: 'new_message',
            message: msg
          });

          if (isDelivered) {
            const deliveredMsg = await messagingService.updateStatus(msg.recipientId, msg.id, 'delivered');
            socket.send(JSON.stringify({
              type: 'message_status_updated',
              messageId: msg.id,
              status: 'delivered',
              deliveredAt: deliveredMsg.deliveredAt
            }));
          }
        } else if (action === 'mark_read') {
          const { messageId } = payload;
          const readMsg = await messagingService.updateStatus(user.id, messageId, 'read');

          connectionManager.sendToUser(readMsg.senderId, {
            type: 'message_status_updated',
            messageId,
            status: 'read',
            readAt: readMsg.readAt
          });
        }
      } catch (err) {
        socket.send(JSON.stringify({
          type: 'error',
          error: err.message
        }));
      }
    });

    socket.on('close', () => {
      connectionManager.removeConnection(user.id, socket);
    });
  });
}
