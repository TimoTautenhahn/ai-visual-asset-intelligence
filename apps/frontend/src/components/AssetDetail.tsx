import { useState, useEffect } from 'react';
import { getAsset, getSimilar, dataUrl, type Asset, type CollectionSummary, type SimilarAsset } from '../api';

interface AssetDetailProps {
  assetId: string;
  onClose: () => void;
  onSelectAsset?: (id: string) => void;
  onAddToCollection: (collectionId: string) => void;
  collections: CollectionSummary[];
  onRetryAi: () => void;
  aiEnabled: boolean;
}

export default function AssetDetail({ assetId, onClose, onSelectAsset, onAddToCollection, onRetryAi, aiEnabled, collections }: AssetDetailProps) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [similar, setSimilar] = useState<SimilarAsset[]>([]);
  const [addToCol, setAddToCol] = useState('');

  useEffect(() => {
    getAsset(assetId).then(setAsset);
    getSimilar(assetId, 12).then((r) => setSimilar(r.items));
  }, [assetId]);

  if (!asset) return <div className="drawer">Lade…</div>;

  const tags = asset.ai?.tags_json as Record<string, unknown> | null;
  const keywords = asset.ai?.keywords ?? [];

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div className="drawer">
        <div className="close">
          <button type="button" onClick={onClose}>Schließen</button>
        </div>
        <div className="content">
          <img
            className="full"
            src={dataUrl(asset.original_path)}
            alt={asset.ai?.description ?? ''}
          />
          <p><strong>Quelle:</strong> {asset.page_url || asset.source_url || '–'}</p>
          <p><strong>Größe:</strong> {asset.width}×{asset.height} · {Math.round(asset.filesize / 1024)} KB</p>
          <p><strong>Status:</strong> {asset.status}</p>
          {asset.ai?.description && <p>{asset.ai.description}</p>}
          {asset.ai?.error && (
            <p className="errors-list">
              AI-Fehler: {asset.ai.error}
              {aiEnabled && <button type="button" onClick={onRetryAi} style={{ marginLeft: '0.5rem' }}>Erneut versuchen</button>}
            </p>
          )}
          {tags && (
            <div style={{ marginTop: '0.5rem' }}>
              {tags.scene && <span className="chip">Szene: {String(tags.scene)}</span>}
              {Array.isArray(tags.room_type) && tags.room_type.map((r: string) => <span key={r} className="chip">{r}</span>)}
              {Array.isArray(tags.style) && tags.style.map((s: string) => <span key={s} className="chip">{s}</span>)}
              {Array.isArray(tags.materials) && tags.materials.map((m: string) => <span key={m} className="chip">{m}</span>)}
              {keywords.map((k) => <span key={k} className="chip">{k}</span>)}
            </div>
          )}
          <div style={{ marginTop: '1rem' }}>
            <label>Zur Sammlung hinzufügen</label>
            <div className="form-inline">
              <select value={addToCol} onChange={(e) => setAddToCol(e.target.value)}>
                <option value="">– wählen –</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="primary"
                disabled={!addToCol}
                onClick={() => addToCol && onAddToCollection(addToCol)}
              >
                Hinzufügen
              </button>
            </div>
          </div>
          {similar.length > 0 && (
            <>
              <h4 style={{ marginTop: '1.5rem' }}>Ähnliche Bilder</h4>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {similar.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="grid-item"
                    onClick={() => onSelectAsset?.(s.id)}
                  >
                    <img src={dataUrl(s.thumb_path)} alt="" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
