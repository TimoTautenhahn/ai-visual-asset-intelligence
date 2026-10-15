import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

function parseTagsJson(tagsJson: string | null): object | null {
  if (!tagsJson) return null;
  try {
    return JSON.parse(tagsJson) as object;
  } catch {
    return null;
  }
}

function parseKeywords(keywords: string): string[] {
  try {
    const arr = JSON.parse(keywords);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default async function assetsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      query?: string;
      scene?: string;
      room_type?: string;
      style?: string;
      materials?: string;
      colors?: string;
      page?: string;
      limit?: string;
    };
  }>('/api/assets', async (req, reply) => {
    const query = req.query.query?.trim() || '';
    const scene = req.query.scene;
    const room_type = req.query.room_type?.split(',').filter(Boolean) ?? [];
    const style = req.query.style?.split(',').filter(Boolean) ?? [];
    const materials = req.query.materials?.split(',').filter(Boolean) ?? [];
    const colors = req.query.colors?.split(',').filter(Boolean) ?? [];
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '24', 10)));
    const skip = (page - 1) * limit;

    type Where = Parameters<typeof prisma.asset.findMany>[0]['where'];
    const and: Where[] = [];

    if (query) {
      and.push({
        OR: [
          { ai: { description: { contains: query } } },
          { ai: { keywords: { contains: query } } },
        ],
      });
    }

    const tagParts: string[] = [];
    if (scene) tagParts.push(`"scene":"${scene}"`);
    room_type.forEach((r) => tagParts.push(`"${r}"`));
    style.forEach((s) => tagParts.push(`"${s}"`));
    materials.forEach((m) => tagParts.push(`"${m}"`));
    colors.forEach((c) => tagParts.push(`"${c}"`));
    for (const p of tagParts) {
      and.push({ ai: { tags_json: { contains: p } } });
    }

    const finalWhere: Where | undefined = and.length ? { AND: and } : undefined;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: finalWhere,
        include: {
          ai: true,
          occurrences: { select: { page_url: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.asset.count({
        where: finalWhere,
      }),
    ]);

    const items = assets.map((a) => ({
      id: a.id,
      source_type: a.source_type,
      source_url: a.source_url,
      page_url: a.page_url,
      original_path: a.original_path,
      thumb_path: a.thumb_path,
      width: a.width,
      height: a.height,
      filesize: a.filesize,
      sha256: a.sha256,
      created_at: a.created_at.toISOString(),
      status: a.status,
      ai: a.ai
        ? {
            asset_id: a.ai.asset_id,
            description: a.ai.description,
            tags_json: parseTagsJson(a.ai.tags_json),
            keywords: parseKeywords(a.ai.keywords),
            described_at: a.ai.described_at?.toISOString() ?? null,
            error: a.ai.error,
          }
        : null,
      occurrences: a.occurrences?.map((o) => ({ page_url: o.page_url })) ?? [],
    }));

    return reply.send({ items, total, page, limit });
  });

  app.get<{ Params: { id: string } }>('/api/assets/:id', async (req, reply) => {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: { ai: true, occurrences: { select: { page_url: true } } },
    });
    if (!asset) return reply.status(404).send({ error: 'Asset not found' });
    return reply.send({
      id: asset.id,
      source_type: asset.source_type,
      source_url: asset.source_url,
      page_url: asset.page_url,
      original_path: asset.original_path,
      thumb_path: asset.thumb_path,
      width: asset.width,
      height: asset.height,
      filesize: asset.filesize,
      sha256: asset.sha256,
      created_at: asset.created_at.toISOString(),
      status: asset.status,
      ai: asset.ai
        ? {
            asset_id: asset.ai.asset_id,
            description: asset.ai.description,
            tags_json: parseTagsJson(asset.ai.tags_json),
            keywords: parseKeywords(asset.ai.keywords),
            described_at: asset.ai.described_at?.toISOString() ?? null,
            error: asset.ai.error,
          }
        : null,
      occurrences: asset.occurrences?.map((o) => ({ page_url: o.page_url })) ?? [],
    });
  });

  app.post<{ Params: { id: string } }>('/api/assets/:id/retry-ai', async (req, reply) => {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) return reply.status(404).send({ error: 'Asset not found' });
    const { addJob } = await import('../queue.js');
    await addJob('ai_describe', { assetId: asset.id });
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: 'ai_pending' },
    });
    return reply.send({ ok: true });
  });
}
