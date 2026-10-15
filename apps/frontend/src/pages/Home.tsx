import { useState, useEffect, useCallback } from 'react';
import {
  getAssets,
  getFacets,
  getConfig,
  getSimilar,
  retryAssetAi,
  addToCollection,
  getCollections,
  startImport,
  getImport,
  dataUrl,
  type Asset,
  type FacetsResponse,
  type CollectionSummary,
} from '../api';
import AssetDetail from '../components/AssetDetail';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [scene, setScene] = useState('');
  const [roomType, setRoomType] = useState('');
  const [style, setStyle] = useState('');
  const [materials, setMaterials] = useState('');
  const [colors, setColors] = useState('');
  const [facets, setFacets] = useState<FacetsResponse | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);

  const limit = 24;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await getAssets({
        query: query || undefined,
        scene: scene || undefined,
        room_type: roomType || undefined,
        style: style || undefined,
        materials: materials || undefined,
        colors: colors || undefined,
        page: p,
        limit,
      });
      setAssets(res.items);
      setTotal(res.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [query, scene, roomType, style, materials, colors]);

  useEffect(() => {
    getConfig().then((c) => setAiEnabled(c.aiEnabled));
    getFacets().then(setFacets);
    getCollections().then(setCollections);
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const loadMore = () => load(page + 1);

  return (
    <main className="main">
      <h1>Referenz-Bildbibliothek</h1>
      {!aiEnabled && (
        <p className="badge" style={{ marginBottom: '1rem' }}>AI deaktiviert (OPENAI_API_KEY nicht gesetzt)</p>
      )}

      <ImportForm onStarted={() => load(1)} />

      <div className="filters">
        <label>
          Suche
          <input
            type="search"
            placeholder="Beschreibung, Keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
          />
        </label>
        {facets && (
          <>
            <label>
              Szene
              <select value={scene} onChange={(e) => setScene(e.target.value)}>
                <option value="">Alle</option>
                {facets.scene.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </label>
            <label>
              Raum
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="">Alle</option>
                {facets.room_type.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </label>
            <label>
              Stil
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">Alle</option>
                {facets.style.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </label>
            <label>
              Material
              <select value={materials} onChange={(e) => setMaterials(e.target.value)}>
                <option value="">Alle</option>
                {facets.materials.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </label>
            <label>
              Farbe
              <select value={colors} onChange={(e) => setColors(e.target.value)}>
                <option value="">Alle</option>
                {facets.colors.map((f) => (
                  <option key={f.value} value={f.value}>{f.value} ({f.count})</option>
                ))}
              </select>
            </label>
          </>
        )}
        <button className="primary" onClick={() => load(1)}>Filtern</button>
      </div>

      <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>{total} Bilder</p>

      <div className="grid">
        {assets.map((a) => (
          <button
            key={a.id}
            type="button"
            className="grid-item"
            onClick={() => setSelectedId(a.id)}
          >
            <img src={dataUrl(a.thumb_path)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {loading && <p>Lade…</p>}
      {!loading && assets.length < total && (
        <button onClick={loadMore} style={{ marginTop: '1rem' }}>Mehr laden</button>
      )}

      {selectedId && (
        <AssetDetail
          assetId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelectAsset={setSelectedId}
          onAddToCollection={(cid) => addToCollection(cid, selectedId).then(() => setSelectedId(null))}
          collections={collections}
          onRetryAi={() => retryAssetAi(selectedId)}
          aiEnabled={aiEnabled}
        />
      )}
    </main>
  );
}

function ImportForm({ onStarted }: { onStarted: () => void }) {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(200);
  const [maxDepth, setMaxDepth] = useState(4);
  const [minSize, setMinSize] = useState(800);
  const [importId, setImportId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const start = async () => {
    setError('');
    try {
      const { id } = await startImport({
        startUrl: url,
        maxPages,
        maxDepth,
        minSize,
      });
      setImportId(id);
      poll(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import fehlgeschlagen');
    }
  };

  const poll = (id: string) => {
    const t = setInterval(async () => {
      try {
        const job = await getImport(id);
        setStatus({
          status: job.status,
          pages_visited: job.pages_visited,
          images_found: job.images_found,
          images_downloaded: job.images_downloaded,
          images_processed: job.images_processed,
          ai_described: job.ai_described,
          errors: job.errors,
        });
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(t);
          onStarted();
        }
      } catch {
        clearInterval(t);
      }
    }, 2000);
  };

  useEffect(() => {
    if (!importId) return;
    poll(importId);
  }, [importId]);

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3>Neue Quelle hinzufügen</h3>
      <div className="form-inline">
        <input
          type="url"
          placeholder="Start-URL (Homepage)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <label>
          Max Seiten
          <input
            type="number"
            min={1}
            max={2000}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
        <label>
          Max Tiefe
          <input
            type="number"
            min={1}
            max={10}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            style={{ width: 50 }}
          />
        </label>
        <label>
          Min Bildgröße (px)
          <input
            type="number"
            min={100}
            value={minSize}
            onChange={(e) => setMinSize(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
        <button className="primary" onClick={start} disabled={!url || !!importId}>
          Import starten
        </button>
      </div>
      {error && <p className="errors-list">{error}</p>}
      {status && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Status: {String(status.status)} · Seiten: {Number(status.pages_visited)} · 
          Gefunden: {Number(status.images_found)} · Geladen: {Number(status.images_downloaded)} ·
          Verarbeitet: {Number(status.images_processed)} · AI: {Number(status.ai_described)} ·
          Fehler: {Number(status.errors)}
        </p>
      )}
    </div>
  );
}

