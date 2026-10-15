import path from 'path';
import { chromium } from 'playwright';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getHostname, normalizeUrl } from '../crawler/urlUtils.js';
import { extractImageUrls, extractInternalLinks } from '../crawler/imageExtractor.js';
import {
  downloadImage,
  saveOriginal,
  saveThumbnail,
} from '../crawler/downloadImage.js';
import { addJob } from '../queue.js';

const RATE_LIMIT_MS = 800;
const PAGE_TIMEOUT_MS = 20000;

export async function startImport(importId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: importId } });
  if (!job || job.status !== 'pending') return;

  await prisma.importJob.update({
    where: { id: importId },
    data: { status: 'running', updated_at: new Date() },
  });

  const baseHost = getHostname(job.start_url);
  if (!baseHost) {
    await failImport(importId, 'Invalid start URL');
    return;
  }

  const visited = new Set<string>();
  const seenImageUrls = new Set<string>();
  const queue: { url: string; depth: number }[] = [
    { url: normalizeUrl(job.start_url, job.start_url), depth: 0 },
  ];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    logger.error('Playwright launch failed', { err, importId });
    await failImport(importId, 'Browser launch failed');
    return;
  }

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Authoritative cancellation check against the database.
      const next = await prisma.importJob.findUnique({ where: { id: importId } });
      if (next?.status === 'cancelled') break;

      if (visited.has(current.url) || current.depth > job.max_depth) continue;
      if (visited.size >= job.max_pages) break;

      visited.add(current.url);
      await prisma.importJob.update({
        where: { id: importId },
        data: {
          pages_visited: visited.size,
          updated_at: new Date(),
        },
      });

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

      let html: string;
      try {
        const res = await page.goto(current.url, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT_MS,
        });
        if (!res || res.status() >= 400) {
          await incErrors(importId);
          continue;
        }
        html = await page.content();
      } catch (err) {
        logger.warn('Page load failed', { url: current.url, err });
        await incErrors(importId);
        continue;
      }

      const links = extractInternalLinks(html, current.url, baseHost);
      for (const link of links) {
        if (!visited.has(link) && current.depth + 1 <= job.max_depth) {
          queue.push({ url: link, depth: current.depth + 1 });
        }
      }

      const imageUrls = extractImageUrls(html, current.url);
      for (const imgUrl of imageUrls) {
        if (seenImageUrls.has(imgUrl)) continue;
        seenImageUrls.add(imgUrl);
        await prisma.importJob.update({
          where: { id: importId },
          data: { images_found: { increment: 1 }, updated_at: new Date() },
        });

        const result = await downloadImage(imgUrl, job.min_size);
        if (!result.success) {
          await incErrors(importId);
          continue;
        }

        const existing = await prisma.asset.findUnique({
          where: { sha256: result.sha256 },
        });
        if (existing) {
          await prisma.assetOccurrence.upsert({
            where: {
              asset_id_page_url: { asset_id: existing.id, page_url: current.url },
            },
            create: { asset_id: existing.id, page_url: current.url },
            update: {},
          });
          await prisma.importJob.update({
            where: { id: importId },
            data: {
              images_downloaded: { increment: 1 },
              images_processed: { increment: 1 },
              updated_at: new Date(),
            },
          });
          if (config.openaiApiKey) {
            await addJob('ai_describe', { assetId: existing.id });
          }
          continue;
        }

        const originalPath = saveOriginal(result.sha256, result.ext, result.buffer);
        const thumbPath = await saveThumbnail(result.sha256, result.ext, result.buffer);

        const asset = await prisma.asset.create({
          data: {
            source_type: 'web',
            source_url: imgUrl,
            page_url: current.url,
            original_path: originalPath,
            thumb_path: thumbPath,
            width: result.width,
            height: result.height,
            filesize: result.filesize,
            sha256: result.sha256,
            status: config.openaiApiKey ? 'ai_pending' : 'imported',
          },
        });
        await prisma.assetOccurrence.create({
          data: { asset_id: asset.id, page_url: current.url },
        });
        await prisma.importJob.update({
          where: { id: importId },
          data: {
            images_downloaded: { increment: 1 },
            images_processed: { increment: 1 },
            updated_at: new Date(),
          },
        });
        if (config.openaiApiKey) {
          await addJob('ai_describe', { assetId: asset.id });
        }
      }
    }

    const final = await prisma.importJob.findUnique({ where: { id: importId } });
    if (final?.status === 'running') {
      await prisma.importJob.update({
        where: { id: importId },
        data: { status: 'completed', updated_at: new Date() },
      });
    }
  } catch (err) {
    logger.error('Import worker error', { importId, err });
    await failImport(importId, err instanceof Error ? err.message : String(err));
  } finally {
    await browser?.close();
  }
}

async function failImport(importId: string, message: string): Promise<void> {
  await prisma.importJob.update({
    where: { id: importId },
    data: { status: 'failed', error_message: message, updated_at: new Date() },
  });
}

async function incErrors(importId: string): Promise<void> {
  await prisma.importJob.update({
    where: { id: importId },
    data: { errors: { increment: 1 }, updated_at: new Date() },
  });
}
