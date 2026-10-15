import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export default async function facetsRoutes(app: FastifyInstance) {
  app.get('/api/facets', async (_req, reply) => {
    const ais = await prisma.assetAI.findMany({
      where: { tags_json: { not: null } },
      select: { tags_json: true },
    });

    const scene: Record<string, number> = {};
    const room_type: Record<string, number> = {};
    const style: Record<string, number> = {};
    const materials: Record<string, number> = {};
    const colors: Record<string, number> = {};

    for (const row of ais) {
      if (!row.tags_json) continue;
      try {
        const tags = JSON.parse(row.tags_json) as {
          scene?: string;
          room_type?: string[];
          style?: string[];
          materials?: string[];
          colors?: string[];
        };
        if (tags.scene) scene[tags.scene] = (scene[tags.scene] || 0) + 1;
        if (Array.isArray(tags.room_type))
          tags.room_type.forEach((r) => (room_type[r] = (room_type[r] || 0) + 1));
        if (Array.isArray(tags.style))
          tags.style.forEach((s) => (style[s] = (style[s] || 0) + 1));
        if (Array.isArray(tags.materials))
          tags.materials.forEach((m) => (materials[m] = (materials[m] || 0) + 1));
        if (Array.isArray(tags.colors))
          tags.colors.forEach((c) => (colors[c] = (colors[c] || 0) + 1));
      } catch {
        // skip invalid json
      }
    }

    return reply.send({
      scene: Object.entries(scene).map(([value, count]) => ({ value, count })),
      room_type: Object.entries(room_type).map(([value, count]) => ({ value, count })),
      style: Object.entries(style).map(([value, count]) => ({ value, count })),
      materials: Object.entries(materials).map(([value, count]) => ({ value, count })),
      colors: Object.entries(colors).map(([value, count]) => ({ value, count })),
    });
  });
}
