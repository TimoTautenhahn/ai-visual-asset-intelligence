// Asset & AI tags schema – shared between backend and frontend
export type Scene = 'interior' | 'exterior' | 'detail' | 'plan' | 'render' | 'unknown';
export type RoomType = 'kitchen' | 'bathroom' | 'living' | 'bedroom' | 'office' | 'staircase' | 'facade' | 'garden' | 'roof' | 'window' | 'door' | 'lighting' | 'flooring' | 'unknown';
export type Style = 'modern' | 'minimal' | 'scandinavian' | 'industrial' | 'japandi' | 'classic' | 'rustic' | 'unknown';
export type Material = 'wood' | 'concrete' | 'stone' | 'metal' | 'glass' | 'plaster' | 'brick' | 'tile' | 'unknown';
export type Color = 'beige' | 'white' | 'black' | 'anthracite' | 'grey' | 'woodtone' | 'green' | 'blue' | 'unknown';

export interface AssetAITags {
  scene: Scene;
  room_type: RoomType[];
  style: Style[];
  materials: Material[];
  colors: Color[];
  elements: string[];
  quality_flags: string[];
  description: string;
  keywords: string[];
}

export const SCENE_OPTIONS: Scene[] = ['interior', 'exterior', 'detail', 'plan', 'render', 'unknown'];
export const ROOM_TYPE_OPTIONS: RoomType[] = ['kitchen', 'bathroom', 'living', 'bedroom', 'office', 'staircase', 'facade', 'garden', 'roof', 'window', 'door', 'lighting', 'flooring', 'unknown'];
export const STYLE_OPTIONS: Style[] = ['modern', 'minimal', 'scandinavian', 'industrial', 'japandi', 'classic', 'rustic', 'unknown'];
export const MATERIAL_OPTIONS: Material[] = ['wood', 'concrete', 'stone', 'metal', 'glass', 'plaster', 'brick', 'tile', 'unknown'];
export const COLOR_OPTIONS: Color[] = ['beige', 'white', 'black', 'anthracite', 'grey', 'woodtone', 'green', 'blue', 'unknown'];

export interface Asset {
  id: string;
  source_type: string;
  source_url: string | null;
  page_url: string | null;
  original_path: string;
  thumb_path: string;
  width: number;
  height: number;
  filesize: number;
  sha256: string;
  created_at: string;
  status: string;
  ai?: AssetAI | null;
  occurrences?: { page_url: string }[];
}

export interface AssetAI {
  asset_id: string;
  description: string | null;
  tags_json: AssetAITags | null;
  keywords: string[];
  described_at: string | null;
  error: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  items: CollectionItem[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  asset_id: string;
  position: number;
  asset?: Asset;
}

export interface ImportJob {
  id: string;
  start_url: string;
  status: string;
  max_pages: number;
  max_depth: number;
  min_size: number;
  pages_visited: number;
  images_found: number;
  images_downloaded: number;
  images_processed: number;
  ai_described: number;
  errors: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
