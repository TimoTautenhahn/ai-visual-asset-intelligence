/**
 * Extract image URLs from HTML string (no DOM). Used after we have page content.
 * Covers: img src, srcset (pick largest), picture/source srcset, meta og:image, twitter:image,
 * inline style background-image: url(...)
 */
import { resolveAbsoluteImageUrl } from './urlUtils.js';

export function extractImageUrls(html: string, pageUrl: string): string[] {
  const out = new Set<string>();

  // <img src="...">
  const imgSrcRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgSrcRe.exec(html)) !== null) {
    const url = resolveAbsoluteImageUrl(m[1].trim(), pageUrl);
    if (url) out.add(url);
  }

  // <img srcset="..."> — take largest candidate (last or with w descriptor)
  const srcsetRe = /<img[^>]+srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html)) !== null) {
    const candidates = m[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
    const withW = m[1].match(/\s+(\d+)w/g);
    let best = candidates[candidates.length - 1];
    if (withW && candidates.length) {
      let maxW = 0;
      candidates.forEach((c, i) => {
        const wMatch = m![1].split(',')[i]?.match(/(\d+)w/);
        const w = wMatch ? parseInt(wMatch[1], 10) : 0;
        if (w > maxW) {
          maxW = w;
          best = c;
        }
      });
    }
    const url = resolveAbsoluteImageUrl(best, pageUrl);
    if (url) out.add(url);
  }

  // <picture><source srcset="...">
  const pictureSrcsetRe = /<source[^>]+srcset=["']([^"']+)["']/gi;
  while ((m = pictureSrcsetRe.exec(html)) !== null) {
    const parts = m[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
    const url = resolveAbsoluteImageUrl(parts[parts.length - 1], pageUrl);
    if (url) out.add(url);
  }

  // meta og:image, twitter:image
  const metaRe = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  while ((m = metaRe.exec(html)) !== null) {
    const url = resolveAbsoluteImageUrl(m[1].trim(), pageUrl);
    if (url) out.add(url);
  }
  const metaRe2 = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi;
  while ((m = metaRe2.exec(html)) !== null) {
    const url = resolveAbsoluteImageUrl(m[1].trim(), pageUrl);
    if (url) out.add(url);
  }

  // inline style background-image: url(...)
  const bgRe = /background-image:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = bgRe.exec(html)) !== null) {
    const url = resolveAbsoluteImageUrl(m[1].trim(), pageUrl);
    if (url) out.add(url);
  }

  return [...out];
}

export function extractInternalLinks(html: string, pageUrl: string, baseHost: string): string[] {
  const out = new Set<string>();
  const linkRe = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const baseUrl = new URL(pageUrl);
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim();
    if (href.startsWith('#') || href.startsWith('javascript:')) continue;
    const resolved = new URL(href, pageUrl);
    resolved.hash = '';
    if (resolved.hostname === baseHost) {
      out.add(resolved.href);
    }
  }
  return [...out];
}
