/**
 * Generate a small, synthetic, labelled evaluation set for the image tagger.
 *
 * Each image is a plain coloured panel with its intended labels drawn on it, so a
 * vision model has clear signal and the expected tags are known. No real photos,
 * no people, no private data. Writes PNGs plus labels.json under eval/dataset/.
 *
 *   npx tsx src/eval/generate.ts            # from apps/backend
 */
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

const repoRoot = path.resolve(__dirname, '../../../..');
const OUT_DIR = process.argv[2] ?? path.join(repoRoot, 'eval', 'dataset');

interface Spec {
  scene: string;
  room_type: string[];
  style: string[];
  materials: string[];
  colors: string[];
  bg: string;
}

// 24 specs across the tagger's known vocabulary.
const SPECS: Spec[] = [
  { scene: 'interior', room_type: ['kitchen'], style: ['modern'], materials: ['wood', 'stone'], colors: ['white', 'woodtone'], bg: '#d8cdbb' },
  { scene: 'interior', room_type: ['bathroom'], style: ['minimal'], materials: ['tile', 'glass'], colors: ['white', 'grey'], bg: '#e6e6e6' },
  { scene: 'interior', room_type: ['living'], style: ['scandinavian'], materials: ['wood'], colors: ['beige', 'woodtone'], bg: '#e8dcc8' },
  { scene: 'interior', room_type: ['bedroom'], style: ['japandi'], materials: ['wood', 'plaster'], colors: ['beige'], bg: '#ded3c0' },
  { scene: 'interior', room_type: ['office'], style: ['industrial'], materials: ['metal', 'concrete'], colors: ['grey', 'anthracite'], bg: '#8f8f8f' },
  { scene: 'interior', room_type: ['staircase'], style: ['modern'], materials: ['concrete', 'metal'], colors: ['grey'], bg: '#9a9a9a' },
  { scene: 'exterior', room_type: ['facade'], style: ['modern'], materials: ['concrete', 'glass'], colors: ['anthracite', 'white'], bg: '#5a5a5a' },
  { scene: 'exterior', room_type: ['garden'], style: ['rustic'], materials: ['stone'], colors: ['green'], bg: '#5e7d4f' },
  { scene: 'exterior', room_type: ['roof'], style: ['modern'], materials: ['metal'], colors: ['anthracite'], bg: '#3f3f3f' },
  { scene: 'detail', room_type: ['window'], style: ['minimal'], materials: ['glass', 'metal'], colors: ['black'], bg: '#2a2a2a' },
  { scene: 'detail', room_type: ['door'], style: ['classic'], materials: ['wood'], colors: ['woodtone'], bg: '#7a5a37' },
  { scene: 'detail', room_type: ['flooring'], style: ['scandinavian'], materials: ['wood'], colors: ['woodtone'], bg: '#b48a5f' },
  { scene: 'interior', room_type: ['kitchen'], style: ['classic'], materials: ['stone', 'wood'], colors: ['beige'], bg: '#d7c7a8' },
  { scene: 'interior', room_type: ['living'], style: ['industrial'], materials: ['brick', 'metal'], colors: ['anthracite'], bg: '#6b4a3a' },
  { scene: 'interior', room_type: ['bathroom'], style: ['modern'], materials: ['stone', 'tile'], colors: ['grey', 'white'], bg: '#cfcfcf' },
  { scene: 'exterior', room_type: ['facade'], style: ['rustic'], materials: ['stone', 'wood'], colors: ['woodtone'], bg: '#8a6b4a' },
  { scene: 'detail', room_type: ['lighting'], style: ['minimal'], materials: ['metal'], colors: ['black'], bg: '#1f1f1f' },
  { scene: 'render', room_type: ['living'], style: ['modern'], materials: ['glass', 'concrete'], colors: ['white', 'grey'], bg: '#dadada' },
  { scene: 'interior', room_type: ['office'], style: ['scandinavian'], materials: ['wood'], colors: ['beige', 'white'], bg: '#e4d8c4' },
  { scene: 'interior', room_type: ['bedroom'], style: ['minimal'], materials: ['plaster'], colors: ['white'], bg: '#f0f0f0' },
  { scene: 'exterior', room_type: ['garden'], style: ['modern'], materials: ['concrete', 'stone'], colors: ['green', 'grey'], bg: '#6f8a5a' },
  { scene: 'detail', room_type: ['window'], style: ['classic'], materials: ['wood', 'glass'], colors: ['woodtone'], bg: '#9a7b55' },
  { scene: 'interior', room_type: ['staircase'], style: ['industrial'], materials: ['metal', 'wood'], colors: ['anthracite', 'woodtone'], bg: '#4a4a4a' },
  { scene: 'interior', room_type: ['kitchen'], style: ['japandi'], materials: ['wood', 'stone'], colors: ['beige', 'woodtone'], bg: '#ccbfa6' },
];

function svgFor(spec: Spec, w = 1024, h = 768): string {
  const lines = [
    `scene: ${spec.scene}`,
    `room: ${spec.room_type.join(', ')}`,
    `style: ${spec.style.join(', ')}`,
    `materials: ${spec.materials.join(', ')}`,
    `colors: ${spec.colors.join(', ')}`,
  ];
  const dark = ['#2a2a2a', '#1f1f1f', '#3f3f3f', '#4a4a4a', '#5a5a5a', '#6b4a3a'].includes(spec.bg);
  const fg = dark ? '#f5f5f5' : '#1c1c1c';
  const text = lines
    .map((l, i) => `<text x="48" y="${120 + i * 72}" font-family="sans-serif" font-size="48" fill="${fg}">${l}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${spec.bg}"/>${text}</svg>`;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const labels: Record<string, Omit<Spec, 'bg'>> = {};
  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    const name = `eval_${String(i + 1).padStart(2, '0')}.png`;
    await sharp(Buffer.from(svgFor(spec))).png().toFile(path.join(OUT_DIR, name));
    const { bg: _bg, ...rest } = spec;
    void _bg;
    labels[name] = rest;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'labels.json'), JSON.stringify(labels, null, 2));
  console.log(`Wrote ${SPECS.length} labelled images and labels.json to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
