import fs from 'fs';
import path from 'path';
import { config } from './config.js';

let fileStream: fs.WriteStream | null = null;

function ensureLogDir() {
  const dir = config.paths.logs;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getStream(): fs.WriteStream | null {
  if (fileStream) return fileStream;
  try {
    ensureLogDir();
    fileStream = fs.createWriteStream(config.paths.appLog, { flags: 'a' });
  } catch {
    return null;
  }
  return fileStream;
}

function format(level: string, msg: string, meta?: object): string {
  const ts = new Date().toISOString();
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `${ts} [${level}] ${msg}${metaStr}\n`;
}

export const logger = {
  info(msg: string, meta?: object) {
    const line = format('INFO', msg, meta);
    process.stdout.write(line);
    getStream()?.write(line);
  },
  warn(msg: string, meta?: object) {
    const line = format('WARN', msg, meta);
    process.stderr.write(line);
    getStream()?.write(line);
  },
  error(msg: string, meta?: object) {
    const line = format('ERROR', msg, meta);
    process.stderr.write(line);
    getStream()?.write(line);
  },
};
