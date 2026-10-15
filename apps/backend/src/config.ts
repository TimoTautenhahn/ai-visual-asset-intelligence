import path from 'path';

function env(name: string, def: string): string {
  const v = process.env[name];
  return v !== undefined && v !== '' ? v : def;
}

function envInt(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

// When run via "npm run dev" from repo root, cwd is repo root
const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');

export const config = {
  port: envInt('PORT_BACKEND', 3000),
  databaseUrl: env('DATABASE_URL', 'file:./prisma/dev.sqlite'),
  openaiApiKey: env('OPENAI_API_KEY', ''),
  crawlMaxPagesDefault: envInt('CRAWL_MAX_PAGES_DEFAULT', 200),
  crawlMaxDepthDefault: envInt('CRAWL_MAX_DEPTH_DEFAULT', 4),
  minImageSizeDefault: envInt('MIN_IMAGE_SIZE_DEFAULT', 800),
  paths: {
    dataDir,
    originals: path.join(dataDir, 'originals'),
    thumbs: path.join(dataDir, 'thumbs'),
    logs: path.join(dataDir, 'logs'),
    appLog: path.join(dataDir, 'logs', 'app.log'),
  },
};

export function isAiEnabled(): boolean {
  return config.openaiApiKey.length > 0;
}
