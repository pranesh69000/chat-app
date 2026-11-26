import Fastify from 'fastify';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { authRoutes } from './modules/auth/auth.routes.js';
import { contactRoutes } from './modules/contacts/contact.routes.js';
import { messagingRoutes } from './modules/messaging/messaging.routes.js';
import { websocketGateway } from './modules/messaging/websocket.gateway.js';
import { mediaRoutes } from './modules/media/media.routes.js';
import { notificationService } from './modules/notifications/notification.service.js';
import { authService } from './modules/auth/auth.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp(options = {}) {
  const app = Fastify({
    logger: false
  });

  await app.register(helmet, {
    contentSecurityPolicy: false
  });

  await app.register(cors, {
    origin: true
  });

  if (!options.disableRateLimit) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute'
    });
  }

  await app.register(websocket);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024
    }
  });

  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/'
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.post('/notifications/preferences', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const token = authHeader.replace('Bearer ', '');
    const user = await authService.getSessionUser(token);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const { enabled, wording } = request.body || {};
    const updated = notificationService.setPreferences(user.id, { enabled, wording });
    return reply.send({ success: true, preferences: updated });
  });

  // Modules
  await app.register(authRoutes);
  await app.register(contactRoutes);
  await app.register(messagingRoutes);
  await app.register(websocketGateway);
  await app.register(mediaRoutes);

  return app;
}
