import { mediaService } from './media.service.js';
import { authService } from '../auth/auth.service.js';

export async function mediaRoutes(fastify) {
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

  // 1. Upload Media
  fastify.post('/media/upload', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    try {
      const result = await mediaService.uploadMedia({
        userId: user.id,
        filename: data.filename,
        buffer,
        mimeType: data.mimetype
      });
      return reply.code(201).send(result);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });

  // 2. Download / Stream Media (Protected: Only paired users can access)
  fastify.get('/media/:fileId', async (request, reply) => {
    const user = await authenticate(request, reply);
    if (!user) return;

    const { fileId } = request.params;

    try {
      const media = await mediaService.getMediaStream(user.id, fileId);
      reply.header('Content-Type', media.mimeType);
      return reply.send(media.buffer);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ error: err.message });
    }
  });
}
