import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { prisma } from '../db.js';
import { getNextJob, completeJob, failJob } from '../queue.js';
import type { AssetAITags } from '@pixfolio/shared';

const SYSTEM_PROMPT = `Du bist ein Experte für Architektur und Innenarchitektur. Analysiere das Bild und antworte NUR mit einem gültigen JSON-Objekt (kein anderer Text).
Schema:
{
  "scene": "interior|exterior|detail|plan|render|unknown",
  "room_type": ["kitchen","bathroom","living","bedroom","office","staircase","facade","garden","roof","window","door","lighting","flooring","unknown"],
  "style": ["modern","minimal","scandinavian","industrial","japandi","classic","rustic","unknown"],
  "materials": ["wood","concrete","stone","metal","glass","plaster","brick","tile","unknown"],
  "colors": ["beige","white","black","anthracite","grey","woodtone","green","blue","unknown"],
  "elements": ["floor-to-ceiling windows","flat roof", ...],
  "quality_flags": ["blurry","watermark","screenshot","collage","text_heavy","people_visible","license_risk"],
  "description": "1–2 Sätze auf Deutsch, präzise.",
  "keywords": ["max 12 freie Stichwörter"]
}
Nur die genannten Werte für scene, room_type, style, materials, colors verwenden. elements und keywords frei.`;

function getImagePath(asset: { original_path: string; thumb_path: string }): string {
  const dataDir = config.paths.dataDir;
  const thumbPath = path.join(dataDir, asset.thumb_path);
  const origPath = path.join(dataDir, asset.original_path);
  if (fs.existsSync(thumbPath)) return thumbPath;
  return origPath;
}

function parseAiResponse(text: string): AssetAITags | null {
  const trimmed = text.replace(/^```json\s*|\s*```$/g, '').trim();
  try {
    const parsed = JSON.parse(trimmed) as AssetAITags;
    if (!parsed.description || !Array.isArray(parsed.keywords)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function runAiWorker(): Promise<void> {
  if (!config.openaiApiKey) return;
  const next = await getNextJob('ai_describe');
  if (!next) return;

  const { id: jobId, payload } = next;
  const asset = await prisma.asset.findUnique({
    where: { id: payload.assetId },
  });
  if (!asset) {
    await completeJob(jobId);
    return;
  }

  const imagePath = getImagePath(asset);
  if (!fs.existsSync(imagePath)) {
    await failJob(jobId, 'Image file not found');
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: 'ai_error' },
    });
    return;
  }

  const base64 = fs.readFileSync(imagePath).toString('base64');
  const ext = path.extname(imagePath).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
            {
              type: 'text',
              text: 'Analysiere dieses Bild und gib das JSON gemäß Schema zurück.',
            },
          ],
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      await failJob(jobId, 'Empty response');
      await prisma.assetAI.upsert({
        where: { asset_id: asset.id },
        create: { asset_id: asset.id, error: 'Empty response' },
        update: { error: 'Empty response' },
      });
      await prisma.asset.update({
        where: { id: asset.id },
        data: { status: 'ai_error' },
      });
      return;
    }

    const tags = parseAiResponse(content);
    if (!tags) {
      await failJob(jobId, 'Invalid JSON');
      await prisma.assetAI.upsert({
        where: { asset_id: asset.id },
        create: { asset_id: asset.id, error: 'Invalid JSON' },
        update: { error: 'Invalid JSON' },
      });
      await prisma.asset.update({
        where: { id: asset.id },
        data: { status: 'ai_error' },
      });
      return;
    }

    const keywordsStr = JSON.stringify(tags.keywords.slice(0, 12));
    const tagsStr = JSON.stringify(tags);

    await prisma.assetAI.upsert({
      where: { asset_id: asset.id },
      create: {
        asset_id: asset.id,
        description: tags.description,
        tags_json: tagsStr,
        keywords: keywordsStr,
        described_at: new Date(),
      },
      update: {
        description: tags.description,
        tags_json: tagsStr,
        keywords: keywordsStr,
        described_at: new Date(),
        error: null,
      },
    });
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: 'ai_done' },
    });

    const job = await prisma.importJob.findFirst({
      where: { status: 'running' },
      orderBy: { updated_at: 'desc' },
    });
    if (job) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: { ai_described: { increment: 1 }, updated_at: new Date() },
      });
    }

    await completeJob(jobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('AI describe failed', { assetId: asset.id, err });
    await failJob(jobId, msg);
    await prisma.assetAI.upsert({
      where: { asset_id: asset.id },
      create: { asset_id: asset.id, error: msg },
      update: { error: msg },
    });
    await prisma.asset.update({
      where: { id: asset.id },
      data: { status: 'ai_error' },
    });
  }
}

let aiWorkerInterval: ReturnType<typeof setInterval> | null = null;

export function startAiWorkerLoop(intervalMs: number = 2000): void {
  if (aiWorkerInterval) return;
  aiWorkerInterval = setInterval(() => {
    runAiWorker().catch((err) => logger.error('AI worker loop error', { err }));
  }, intervalMs);
}

export function stopAiWorkerLoop(): void {
  if (aiWorkerInterval) {
    clearInterval(aiWorkerInterval);
    aiWorkerInterval = null;
  }
}
