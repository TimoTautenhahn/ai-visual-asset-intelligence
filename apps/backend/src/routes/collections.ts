import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';

const createBody = z.object({ name: z.string().min(1), description: z.string().optional() });
const updateBody = z.object({ name: z.string().min(1).optional(), description: z.string().optional() });
const addAssetBody = z.object({ asset_id: z.string().min(1), position: z.number().int().optional() });

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

export default async function collectionsRoutes(app: FastifyInstance) {
  app.get('/api/collections', async (_req, reply) => {
    const list = await prisma.collection.findMany({
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return reply.send(
      list.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        created_at: c.created_at.toISOString(),
        item_count: c._count.items,
      }))
    );
  });

  app.post('/api/collections', async (req, reply) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const col = await prisma.collection.create({
      data: { name: parsed.data.name, description: parsed.data.description ?? null },
    });
    return reply.send({
      id: col.id,
      name: col.name,
      description: col.description,
      created_at: col.created_at.toISOString(),
    });
  });

  app.get<{ Params: { id: string } }>('/api/collections/:id', async (req, reply) => {
    const col = await prisma.collection.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            asset: {
              include: { ai: true },
            },
          },
        },
      },
    });
    if (!col) return reply.status(404).send({ error: 'Collection not found' });
    return reply.send({
      id: col.id,
      name: col.name,
      description: col.description,
      created_at: col.created_at.toISOString(),
      items: col.items.map((i) => ({
        id: i.id,
        collection_id: i.collection_id,
        asset_id: i.asset_id,
        position: i.position,
        asset: {
          id: i.asset.id,
          original_path: i.asset.original_path,
          thumb_path: i.asset.thumb_path,
          width: i.asset.width,
          height: i.asset.height,
          status: i.asset.status,
          ai: i.asset.ai
            ? {
                description: i.asset.ai.description,
                tags_json: parseTagsJson(i.asset.ai.tags_json),
                keywords: parseKeywords(i.asset.ai.keywords),
              }
            : null,
        },
      })),
    });
  });

  app.patch<{ Params: { id: string } }>('/api/collections/:id', async (req, reply) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const col = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      },
    });
    return reply.send({
      id: col.id,
      name: col.name,
      description: col.description,
      created_at: col.created_at.toISOString(),
    });
  });

  app.delete<{ Params: { id: string } }>('/api/collections/:id', async (req, reply) => {
    await prisma.collection.delete({ where: { id: req.params.id } }).catch(() => null);
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/collections/:id/items', async (req, reply) => {
    const parsed = addAssetBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(parsed.error.flatten());
    const { asset_id, position } = parsed.data;
    const maxPos = await prisma.collectionItem
      .aggregate({ where: { collection_id: req.params.id }, _max: { position: true } })
      .then((r) => r._max.position ?? -1);
    const pos = position ?? maxPos + 1;
    const item = await prisma.collectionItem.upsert({
      where: {
        collection_id_asset_id: { collection_id: req.params.id, asset_id },
      },
      create: { collection_id: req.params.id, asset_id, position: pos },
      update: { position: pos },
    });
    return reply.send({
      id: item.id,
      collection_id: item.collection_id,
      asset_id: item.asset_id,
      position: item.position,
    });
  });

  app.delete<{ Params: { id: string }; Querystring: { asset_id: string } }>(
    '/api/collections/:id/items',
    async (req, reply) => {
      const asset_id = req.query.asset_id;
      if (!asset_id) return reply.status(400).send({ error: 'asset_id required' });
      await prisma.collectionItem.deleteMany({
        where: { collection_id: req.params.id, asset_id },
      });
      return reply.send({ ok: true });
    }
  );

  app.put<{ Params: { id: string }; Body: { item_ids: string[] } }>(
    '/api/collections/:id/order',
    async (req, reply) => {
      const item_ids = req.body?.item_ids;
      if (!Array.isArray(item_ids) || item_ids.length === 0)
        return reply.status(400).send({ error: 'item_ids array required' });
      await prisma.$transaction(
        item_ids.map((assetId, index) =>
          prisma.collectionItem.updateMany({
            where: { collection_id: req.params.id, asset_id: assetId },
            data: { position: index },
          })
        )
      );
      return reply.send({ ok: true });
    }
  );
}
