import OpenAI from 'openai';
import type { AssetAITags } from '@pixfolio/shared';

// Shared tagging prompt and call, used by both the AI worker and the eval harness
// so they measure the same pipeline.
export const SYSTEM_PROMPT = `Du bist ein Experte für Architektur und Innenarchitektur. Analysiere das Bild und antworte NUR mit einem gültigen JSON-Objekt (kein anderer Text).
Schema:
{
  "scene": "interior|exterior|detail|plan|render|unknown",
  "room_type": ["kitchen","bathroom","living","bedroom","office","staircase","facade","garden","roof","window","door","lighting","flooring","unknown"],
  "style": ["modern","minimal","scandinavian","industrial","japandi","classic","rustic","unknown"],
  "materials": ["wood","concrete","stone","metal","glass","plaster","brick","tile","unknown"],
  "colors": ["beige","white","black","anthracite","grey","woodtone","green","blue","unknown"],
  "elements": ["floor-to-ceiling windows","flat roof", ...],
  "quality_flags": ["blurry","watermark","screenshot","collage","text_heavy","people_visible","license_risk"],
  "description": "1-2 Sätze auf Deutsch, präzise.",
  "keywords": ["max 12 freie Stichwörter"]
}
Nur die genannten Werte für scene, room_type, style, materials, colors verwenden. elements und keywords frei.`;

export function parseAiResponse(text: string): AssetAITags | null {
  const trimmed = text.replace(/^```json\s*|\s*```$/g, '').trim();
  try {
    const parsed = JSON.parse(trimmed) as AssetAITags;
    if (!parsed.description || !Array.isArray(parsed.keywords)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Send one image (base64) to the vision model and return parsed tags, or null
 * if the response was empty or not valid JSON. The schema is sent as a system
 * message so the model knows the exact vocabulary to use.
 */
export async function tagImageBase64(
  openai: OpenAI,
  base64: string,
  mime: string,
  model = 'gpt-4o-mini',
): Promise<AssetAITags | null> {
  const completion = await openai.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          { type: 'text', text: 'Analysiere dieses Bild und gib das JSON gemäß Schema zurück.' },
        ],
      },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) return null;
  return parseAiResponse(content);
}
