import type { FastifyInstance } from 'fastify';
import { getRecentJobs, retryJob } from '../queue.js';
import { prisma } from '../db.js';

export default async function jobsRoutes(app: FastifyInstance) {
  app.get('/api/jobs', async (_req, reply) => {
    const [queueJobs, importJobs] = await Promise.all([
      getRecentJobs(50),
      prisma.importJob.findMany({
        take: 20,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          start_url: true,
          status: true,
          pages_visited: true,
          images_found: true,
          images_downloaded: true,
          images_processed: true,
          ai_described: true,
          errors: true,
          error_message: true,
          created_at: true,
        },
      }),
    ]);
    const errors = await prisma.assetAI.findMany({
      where: { error: { not: null } },
      take: 20,
      orderBy: { described_at: 'desc' },
      select: { asset_id: true, error: true, described_at: true },
    });
    return reply.send({
      queue: queueJobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        error: j.error,
        created_at: j.created_at,
      })),
      imports: importJobs.map((j) => ({
        id: j.id,
        start_url: j.start_url,
        status: j.status,
        pages_visited: j.pages_visited,
        images_found: j.images_found,
        images_downloaded: j.images_downloaded,
        images_processed: j.images_processed,
        ai_described: j.ai_described,
        errors: j.errors,
        error_message: j.error_message,
        created_at: j.created_at,
      })),
      ai_errors: errors.map((e) => ({
        asset_id: e.asset_id,
        error: e.error,
        described_at: e.described_at,
      })),
    });
  });

  app.post<{ Params: { id: string } }>('/api/jobs/:id/retry', async (req, reply) => {
    await retryJob(req.params.id);
    return reply.send({ ok: true });
  });
}
