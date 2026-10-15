import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getCollection, removeFromCollection, dataUrl, type CollectionDetail as ColDetail } from '../api';

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const present = searchParams.get('present') === '1';

  const [col, setCol] = useState<ColDetail | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    getCollection(id).then(setCol);
  }, [id]);

  if (!id || !col) return <main className="main">Lade…</main>;

  if (present && col.items.length > 0) {
    const current = col.items[slideIndex];
    const asset = current?.asset;
    return (
      <div className="present">
        <button type="button" className="close-btn" onClick={() => window.history.back()}>
          Schließen
        </button>
        {asset && (
          <img src={dataUrl(asset.original_path)} alt={asset.ai?.description ?? ''} />
        )}
        <button
          type="button"
          className="nav-btn prev"
          onClick={() => setSlideIndex((i) => (i <= 0 ? col.items.length - 1 : i - 1))}
        >
          ‹
        </button>
        <button
          type="button"
          className="nav-btn next"
          onClick={() => setSlideIndex((i) => (i >= col.items.length - 1 ? 0 : i + 1))}
        >
          ›
        </button>
        <span style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', color: '#fff' }}>
          {slideIndex + 1} / {col.items.length}
        </span>
      </div>
    );
  }

  const remove = async (assetId: string) => {
    await removeFromCollection(id, assetId);
    const next = await getCollection(id);
    setCol(next);
  };

  const presentUrl = `${window.location.origin}/collections/${id}?present=1`;

  return (
    <main className="main">
      <h1>{col.name}</h1>
      {col.description && <p style={{ color: 'var(--muted)' }}>{col.description}</p>}
      <p>
        <a href={presentUrl} target="_blank" rel="noopener noreferrer">
          Präsentationsmodus (Vollbild)
        </a>
        {' · '}
        <button
          type="button"
          onClick={() => {
            const html = exportCollectionHtml(col);
            const blob = new Blob([html], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `collection-${col.name.replace(/\s+/g, '-')}.html`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Als HTML exportieren
        </button>
      </p>
      <div className="grid">
        {col.items.map((item) => (
          <div key={item.id} className="grid-item" style={{ position: 'relative' }}>
            <img src={dataUrl(item.asset.thumb_path)} alt="" />
            <button
              type="button"
              onClick={() => remove(item.asset_id)}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                padding: '2px 6px',
                fontSize: '0.75rem',
              }}
              title="Aus Sammlung entfernen"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

function exportCollectionHtml(col: ColDetail): string {
  const items = col.items
    .map(
      (i) =>
        `<figure><img src="${dataUrl(i.asset.original_path)}" alt="${(i.asset.ai?.description ?? '').replace(/"/g, '&quot;')}" /><figcaption>${(i.asset.ai?.description ?? '').replace(/</g, '&lt;')}</figcaption></figure>`
    )
    .join('\n');
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>${col.name}</title>
  <style>
    body { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 1rem; }
    figure { margin: 2rem 0; }
    figure img { max-width: 100%; height: auto; }
    figcaption { color: #666; margin-top: 0.5rem; }
  </style>
</head>
<body>
  <h1>${col.name}</h1>
  ${col.description ? `<p>${col.description}</p>` : ''}
  ${items}
</body>
</html>`;
}
