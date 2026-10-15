const API = '/api';

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
  ai?: {
    description: string | null;
    tags_json: Record<string, unknown> | null;
    keywords: string[];
    described_at: string | null;
    error: string | null;
  } | null;
  occurrences?: { page_url: string }[];
}

export interface AssetsResponse {
  items: Asset[];
  total: number;
  page: number;
  limit: number;
}

export interface FacetsResponse {
  scene: { value: string; count: number }[];
  room_type: { value: string; count: number }[];
  style: { value: string; count: number }[];
  materials: { value: string; count: number }[];
  colors: { value: string; count: number }[];
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  item_count: number;
}

export interface CollectionItemWithAsset {
  id: string;
  asset_id: string;
  position: number;
  asset: Asset;
}

export interface CollectionDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  items: CollectionItemWithAsset[];
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

export interface ConfigResponse {
  aiEnabled: boolean;
}

export async function getConfig(): Promise<ConfigResponse> {
  const r = await fetch(`${API}/config`);
  if (!r.ok) throw new Error('Config failed');
  return r.json();
}

export async function getAssets(params: {
  query?: string;
  scene?: string;
  room_type?: string;
  style?: string;
  materials?: string;
  colors?: string;
  page?: number;
  limit?: number;
}): Promise<AssetsResponse> {
  const sp = new URLSearchParams();
  if (params.query) sp.set('query', params.query);
  if (params.scene) sp.set('scene', params.scene);
  if (params.room_type) sp.set('room_type', params.room_type);
  if (params.style) sp.set('style', params.style);
  if (params.materials) sp.set('materials', params.materials);
  if (params.colors) sp.set('colors', params.colors);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const r = await fetch(`${API}/assets?${sp}`);
  if (!r.ok) throw new Error('Assets failed');
  return r.json();
}

export async function getAsset(id: string): Promise<Asset> {
  const r = await fetch(`${API}/assets/${id}`);
  if (!r.ok) throw new Error('Asset failed');
  return r.json();
}

export async function getFacets(): Promise<FacetsResponse> {
  const r = await fetch(`${API}/facets`);
  if (!r.ok) throw new Error('Facets failed');
  return r.json();
}

export interface SimilarAsset {
  id: string;
  thumb_path: string;
  width: number;
  height: number;
  score?: number;
}

export async function getSimilar(id: string, limit?: number): Promise<{ items: SimilarAsset[] }> {
  const sp = limit ? `?limit=${limit}` : '';
  const r = await fetch(`${API}/assets/${id}/similar${sp}`);
  if (!r.ok) throw new Error('Similar failed');
  return r.json();
}

export async function retryAssetAi(id: string): Promise<void> {
  const r = await fetch(`${API}/assets/${id}/retry-ai`, { method: 'POST' });
  if (!r.ok) throw new Error('Retry failed');
}

export async function startImport(body: {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  minSize?: number;
}): Promise<{ id: string }> {
  const r = await fetch(`${API}/imports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('Import failed');
  return r.json();
}

export async function getImport(id: string): Promise<ImportJob> {
  const r = await fetch(`${API}/imports/${id}`);
  if (!r.ok) throw new Error('Import failed');
  return r.json();
}

export async function getCollections(): Promise<CollectionSummary[]> {
  const r = await fetch(`${API}/collections`);
  if (!r.ok) throw new Error('Collections failed');
  return r.json();
}

export async function getCollection(id: string): Promise<CollectionDetail> {
  const r = await fetch(`${API}/collections/${id}`);
  if (!r.ok) throw new Error('Collection failed');
  return r.json();
}

export async function createCollection(data: { name: string; description?: string }): Promise<{ id: string; name: string; description: string | null; created_at: string }> {
  const r = await fetch(`${API}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('Create collection failed');
  return r.json();
}

export async function addToCollection(collectionId: string, assetId: string, position?: number): Promise<void> {
  const r = await fetch(`${API}/collections/${collectionId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId, position }),
  });
  if (!r.ok) throw new Error('Add to collection failed');
}

export async function removeFromCollection(collectionId: string, assetId: string): Promise<void> {
  const r = await fetch(`${API}/collections/${collectionId}/items?asset_id=${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error('Remove failed');
}

export async function getJobs(): Promise<{
  queue: { id: string; type: string; status: string; error: string | null }[];
  imports: ImportJob[];
  ai_errors: { asset_id: string; error: string | null }[];
}> {
  const r = await fetch(`${API}/jobs`);
  if (!r.ok) throw new Error('Jobs failed');
  return r.json();
}

export function dataUrl(path: string): string {
  return `/data/${path}`;
}
