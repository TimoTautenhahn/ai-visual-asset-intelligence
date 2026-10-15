import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

// Phase 1: similarity by tag overlap (room_type, style, materials). No embeddings.
export default async function similarRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/assets/:id/similar',
    async (req, reply) => {
      const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10)));
      const asset = await prisma.asset.findUnique({
        where: { id: req.params.id },
        include: { ai: true },
      });
      if (!asset) return reply.status(404).send({ error: 'Asset not found' });
      if (!asset.ai?.tags_json) {
        return reply.send({ items: [] });
      }
      let tags: { room_type?: string[]; style?: string[]; materials?: string[] };
      try {
        tags = JSON.parse(asset.ai.tags_json) as { room_type?: string[]; style?: string[]; materials?: string[] };
      } catch {
        return reply.send({ items: [] });
      }
      const terms: string[] = [];
      if (Array.isArray(tags.room_type)) terms.push(...tags.room_type.map((t) => `"${t}"`));
      if (Array.isArray(tags.style)) terms.push(...tags.style.map((t) => `"${t}"`));
      if (Array.isArray(tags.materials)) terms.push(...tags.materials.map((t) => `"${t}"`));
      if (terms.length === 0) return reply.send({ items: [] });

      const candidates = await prisma.asset.findMany({
        where: {
          id: { not: asset.id },
          ai: { tags_json: { not: null } },
        },
        include: { ai: true },
        take: 200,
      });

      const scored = candidates
        .map((c) => {
          if (!c.ai?.tags_json) return { asset: c, score: 0 };
          let score = 0;
          for (const term of terms) {
            if (c.ai.tags_json.includes(term)) score += 1;
          }
          return { asset: c, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => ({
          id: x.asset.id,
          thumb_path: x.asset.thumb_path,
          width: x.asset.width,
          height: x.asset.height,
          score: x.score,
        }));

      return reply.send({ items: scored });
    }
  );
}
