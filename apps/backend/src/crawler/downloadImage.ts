import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { request } from 'undici';
import sharp from 'sharp';
import { config } from '../config.js';
import { logger } from '../logger.js';

const DOWNLOAD_TIMEOUT_MS = 15000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const IMAGE_SIGNATURES: { sig: Buffer; ext: string }[] = [
  { sig: Buffer.from([0xff, 0xd8, 0xff]), ext: 'jpg' },
  { sig: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ext: 'png' },
  { sig: Buffer.from([0x47, 0x49, 0x46, 0x38]), ext: 'gif' },
  { sig: Buffer.from([0x52, 0x49, 0x46, 0x46]), ext: 'webp' }, // RIFF
  { sig: Buffer.from([0x3c, 0x3f, 0x78, 0x6d, 0x6c]), ext: 'svg' }, // <?xml - SVG often
];

function getExtFromContentType(ct: string): string {
  const m = ct.match(/image\/(\w+)/);
  if (m) {
    const t = m[1].toLowerCase();
    if (t === 'jpeg') return 'jpg';
    if (t === 'svg+xml') return 'svg';
    return t;
  }
  return 'jpg';
}

function getExtFromBuffer(buf: Buffer): string {
  for (const { sig, ext } of IMAGE_SIGNATURES) {
    if (buf.length >= sig.length && buf.subarray(0, sig.length).equals(sig)) return ext;
  }
  return 'jpg';
}

export interface DownloadResult {
  success: true;
  buffer: Buffer;
  contentType: string;
  ext: string;
  width: number;
  height: number;
  filesize: number;
  sha256: string;
}

export interface DownloadError {
  success: false;
  error: string;
}

export async function downloadImage(
  imageUrl: string,
  minSize: number
): Promise<DownloadResult | DownloadError> {
  let buffer: Buffer;
  let contentType = '';

  try {
    const res = await request(imageUrl, {
      method: 'GET',
      headersTimeout: 8000,
      bodyTimeout: DOWNLOAD_TIMEOUT_MS,
      maxRedirections: 3,
      headers: {
        'User-Agent': 'Pixfolio-Crawler/1.0 (Reference Image Library)',
        Accept: 'image/*',
      },
    });

    if (res.statusCode !== 200) {
      return { success: false, error: `HTTP ${res.statusCode}` };
    }

    const ct = res.headers['content-type'];
    if (ct && typeof ct === 'string') contentType = ct;

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of res.body) {
      total += chunk.length;
      if (total > MAX_FILE_SIZE) {
        return { success: false, error: 'File too large' };
      }
      chunks.push(Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }

  if (!contentType.startsWith('image/') && buffer.length < 32) {
    return { success: false, error: 'Not an image' };
  }

  let width: number;
  let height: number;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    return { success: false, error: 'Unsupported image format' };
  }

  const minSide = Math.min(width, height);
  if (minSide < minSize) {
    return { success: false, error: `Too small: ${width}x${height} (min ${minSize})` };
  }

  const ext = contentType.startsWith('image/')
    ? getExtFromContentType(contentType)
    : getExtFromBuffer(buffer);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    success: true,
    buffer,
    contentType,
    ext: ext === 'svg' ? 'png' : ext,
    width,
    height,
    filesize: buffer.length,
    sha256,
  };
}

/** Returns path relative to data dir, e.g. originals/abc123.jpg */
export function saveOriginal(sha256: string, ext: string, buffer: Buffer): string {
  const dir = config.paths.originals;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${sha256}.${ext}`);
  fs.writeFileSync(filePath, buffer);
  return `originals/${sha256}.${ext}`;
}

/** Returns path relative to data dir, e.g. thumbs/abc123.webp */
export async function saveThumbnail(sha256: string, ext: string, buffer: Buffer): Promise<string> {
  const dir = config.paths.thumbs;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${sha256}.webp`);
  await sharp(buffer)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outPath);
  return `thumbs/${sha256}.webp`;
}
