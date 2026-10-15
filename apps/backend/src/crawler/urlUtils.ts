import { URL } from 'url';

export function normalizeUrl(href: string, base: string): string {
  try {
    const u = new URL(href, base);
    u.hash = '';
    u.search = u.search; // keep query for images
    return u.href;
  } catch {
    return '';
  }
}

export function getHostname(urlStr: string): string | null {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null;
  }
}

export function isSameDomain(urlStr: string, baseHost: string): boolean {
  const host = getHostname(urlStr);
  if (!host) return false;
  return host === baseHost;
}

export function resolveAbsoluteImageUrl(src: string, pageUrl: string): string {
  return normalizeUrl(src, pageUrl);
}
