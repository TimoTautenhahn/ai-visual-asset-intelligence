import { useState, useEffect } from 'react';
import { getJobs, retryAssetAi } from '../api';
import { Link } from 'react-router-dom';

export default function Jobs() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getJobs>> | null>(null);

  const load = () => {
    getJobs().then(setData);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <main className="main">Lade…</main>;

  return (
    <main className="main">
      <h1>Jobs & Fehler</h1>

      <div className="card">
        <h3>Laufende Imports</h3>
        {data.imports.filter((i) => i.status === 'running').length === 0 && <p>Keine laufenden Imports.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.imports.slice(0, 5).map((j) => (
            <li key={j.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{j.start_url}</strong> · {j.status} · Seiten: {j.pages_visited} · Bilder: {j.images_downloaded} · AI: {j.ai_described} · Fehler: {j.errors}
              {j.error_message && <span className="errors-list"> · {j.error_message}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>AI-Fehler (Retry möglich)</h3>
        {data.ai_errors.length === 0 && <p>Keine Fehler.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.ai_errors.map((e) => (
            <li key={e.asset_id} style={{ marginBottom: '0.5rem' }}>
              <Link to="/" onClick={() => retryAssetAi(e.asset_id)}>
                Asset {e.asset_id.slice(0, 8)}…
              </Link>
              <span className="errors-list"> {e.error}</span>
              <button type="button" onClick={() => retryAssetAi(e.asset_id)} style={{ marginLeft: '0.5rem' }}>
                Retry
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Queue (letzte Jobs)</h3>
        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.9rem' }}>
          {data.queue.map((j) => (
            <li key={j.id}>
              {j.type} · {j.status}
              {j.error && <span className="errors-list"> · {j.error}</span>}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
