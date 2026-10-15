import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { startImport } from '../workers/importWorker.js';

const bodySchema = z.object({
  startUrl: z.string().url(),
  maxPages: z.number().int().min(1).max(2000).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  minSize: z.number().int().min(1).max(4000).optional(),
});

export default async function importsRoutes(app: FastifyInstance) {
  app.post('/api/imports', async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(parsed.error.flatten());
    }
    const { startUrl, maxPages, maxDepth, minSize } = parsed.data;
    const config = await import('../config.js').then((m) => m.config);
    const job = await prisma.importJob.create({
      data: {
        start_url: startUrl,
        status: 'pending',
        max_pages: maxPages ?? config.crawlMaxPagesDefault,
        max_depth: maxDepth ?? config.crawlMaxDepthDefault,
        min_size: minSize ?? config.minImageSizeDefault,
      },
    });
    startImport(job.id).catch((err) => {
      req.log.error(err, 'Import worker error');
    });
    return reply.send({
      id: job.id,
      start_url: job.start_url,
      status: job.status,
      max_pages: job.max_pages,
      max_depth: job.max_depth,
      min_size: job.min_size,
    });
  });

  app.patch<{ Params: { id: string }; Body: { status?: string } }>('/api/imports/:id', async (req, reply) => {
    const job = await prisma.importJob.findUnique({ where: { id: req.params.id } });
    if (!job) return reply.status(404).send({ error: 'Import not found' });
    if (req.body?.status === 'cancelled') {
      await prisma.importJob.update({
        where: { id: req.params.id },
        data: { status: 'cancelled', updated_at: new Date() },
      });
    }
    const updated = await prisma.importJob.findUnique({ where: { id: req.params.id } });
    return reply.send(updated ? {
      id: updated.id,
      start_url: updated.start_url,
      status: updated.status,
      max_pages: updated.max_pages,
      max_depth: updated.max_depth,
      min_size: updated.min_size,
      pages_visited: updated.pages_visited,
      images_found: updated.images_found,
      images_downloaded: updated.images_downloaded,
      images_processed: updated.images_processed,
      ai_described: updated.ai_described,
      errors: updated.errors,
      error_message: updated.error_message,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    } : {});
  });

  app.get<{ Params: { id: string } }>('/api/imports/:id', async (req, reply) => {
    const job = await prisma.importJob.findUnique({
      where: { id: req.params.id },
    });
    if (!job) return reply.status(404).send({ error: 'Import not found' });
    return reply.send({
      id: job.id,
      start_url: job.start_url,
      status: job.status,
      max_pages: job.max_pages,
      max_depth: job.max_depth,
      min_size: job.min_size,
      pages_visited: job.pages_visited,
      images_found: job.images_found,
      images_downloaded: job.images_downloaded,
      images_processed: job.images_processed,
      ai_described: job.ai_described,
      errors: job.errors,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  });
}
