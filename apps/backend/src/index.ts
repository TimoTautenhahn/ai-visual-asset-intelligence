import fs from 'fs';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { logger } from './logger.js';
import { startAiWorkerLoop } from './workers/aiWorker.js';

import importsRoutes from './routes/imports.js';
import assetsRoutes from './routes/assets.js';
import facetsRoutes from './routes/facets.js';
import collectionsRoutes from './routes/collections.js';
import jobsRoutes from './routes/jobs.js';
import similarRoutes from './routes/similar.js';
import configRoutes from './routes/config.js';

async function main() {
  [config.paths.dataDir, config.paths.originals, config.paths.thumbs, config.paths.logs].forEach(
    (dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('Created directory', { dir });
      }
    }
  );

  const app = Fastify({ logger: false });

  app.addHook('onRequest', (req, _reply, done) => {
    logger.info(`${req.method} ${req.url}`);
    done();
  });

  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, {
    root: config.paths.dataDir,
    prefix: '/data/',
    decorateReply: true,
  });

  await app.register(importsRoutes);
  await app.register(assetsRoutes);
  await app.register(facetsRoutes);
  await app.register(collectionsRoutes);
  await app.register(jobsRoutes);
  await app.register(similarRoutes);
  await app.register(configRoutes);

  app.get('/api/health', async (_req, reply) => {
    return reply.send({ ok: true, ts: new Date().toISOString() });
  });

  const port = config.port;
  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`Backend listening on http://localhost:${port}`);

  if (config.openaiApiKey) {
    startAiWorkerLoop(2000);
    logger.info('AI worker loop started');
  } else {
    logger.info('OpenAI API key not set – AI disabled');
  }
}

main().catch((err) => {
  logger.error('Fatal', { err });
  process.exit(1);
});
