/**
 * Measure tag precision and coverage of the image tagger on the synthetic
 * labelled eval set. Precision = correct predicted tags / predicted tags.
 * Coverage (recall) = expected tags found / expected tags. Averaged per image
 * over the room_type, style, materials and colors categories.
 *
 * Needs an API key: set OPENAI_API_KEY (the tagger calls a vision model). Without
 * a key it prints a message and exits without error. No score is committed to the
 * README; run it yourself and decide what, if anything, to report.
 *
 *   OPENAI_API_KEY=... npx tsx src/eval/run.ts     # from apps/backend
 */
import path from 'node:path';
import fs from 'node:fs';
import OpenAI from 'openai';
import { tagImageBase64 } from '../ai/tagging.js';
import type { AssetAITags } from '@pixfolio/shared';

const repoRoot = path.resolve(__dirname, '../../../..');
const DATA_DIR = process.argv[2] ?? path.join(repoRoot, 'eval', 'dataset');

type Labels = Record<string, { scene: string; room_type: string[]; style: string[]; materials: string[]; colors: string[] }>;
const CATEGORIES = ['room_type', 'style', 'materials', 'colors'] as const;

function expectedSet(label: Labels[string]): Set<string> {
  return new Set(CATEGORIES.flatMap((c) => label[c]));
}

function predictedSet(tags: AssetAITags): Set<string> {
  const vals: string[] = [];
  for (const c of CATEGORIES) {
    const v = (tags as unknown as Record<string, unknown>)[c];
    if (Array.isArray(v)) vals.push(...v.map(String));
  }
  return new Set(vals.filter((v) => v && v !== 'unknown'));
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('No OPENAI_API_KEY set. The eval needs a vision model; set the key and rerun.');
    return;
  }
  const labelsPath = path.join(DATA_DIR, 'labels.json');
  if (!fs.existsSync(labelsPath)) {
    console.log(`No eval set at ${DATA_DIR}. Run: npx tsx src/eval/generate.ts`);
    return;
  }
  const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf8')) as Labels;
  const openai = new OpenAI({ apiKey });

  let sumPrecision = 0;
  let sumCoverage = 0;
  let scored = 0;

  for (const [name, label] of Object.entries(labels)) {
    const file = path.join(DATA_DIR, name);
    if (!fs.existsSync(file)) continue;
    const base64 = fs.readFileSync(file).toString('base64');
    const tags = await tagImageBase64(openai, base64, 'image/png');
    if (!tags) {
      console.log(`${name}: no tags returned`);
      continue;
    }
    const expected = expectedSet(label);
    const predicted = predictedSet(tags);
    const hits = [...predicted].filter((t) => expected.has(t)).length;
    const precision = predicted.size ? hits / predicted.size : 0;
    const coverage = expected.size ? hits / expected.size : 0;
    sumPrecision += precision;
    sumCoverage += coverage;
    scored += 1;
    console.log(`${name}: precision ${(precision * 100).toFixed(0)}%  coverage ${(coverage * 100).toFixed(0)}%`);
  }

  if (scored === 0) {
    console.log('No images scored.');
    return;
  }
  console.log('----');
  console.log(`Images: ${scored}`);
  console.log(`Mean tag precision: ${((sumPrecision / scored) * 100).toFixed(1)}%`);
  console.log(`Mean tag coverage:  ${((sumCoverage / scored) * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
