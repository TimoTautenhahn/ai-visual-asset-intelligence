import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { prisma } from '../db.js';
import { getNextJob, completeJob, failJob } from '../queue.js';
import { tagImageBase64 } from '../ai/tagging.js';

function getImagePath(asset: { original_path: string; thumb_path: string }): string {
  const dataDir = config.paths.dataDir;
  const thumbPath = path.join(dataDir, asset.thumb_path);
  const origPath = path.join(dataDir, asset.original_path);
  if (fs.existsSync(thumbPath)) return thumbPath;
  return origPath;
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
    const tags = await tagImageBase64(openai, base64, mime);
    if (!tags) {
      await failJob(jobId, 'Empty or invalid AI response');
      await prisma.assetAI.upsert({
        where: { asset_id: asset.id },
        create: { asset_id: asset.id, error: 'Empty or invalid AI response' },
        update: { error: 'Empty or invalid AI response' },
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
