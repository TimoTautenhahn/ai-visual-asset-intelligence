import type { FastifyInstance } from 'fastify';
import { isAiEnabled } from '../config.js';

export default async function configRoutes(app: FastifyInstance) {
  app.get('/api/config', async (_req, reply) => {
    return reply.send({
      aiEnabled: isAiEnabled(),
    });
  });
}
