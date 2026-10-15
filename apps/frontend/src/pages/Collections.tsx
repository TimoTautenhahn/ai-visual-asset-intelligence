import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCollections, createCollection, type CollectionSummary } from '../api';

export default function Collections() {
  const [list, setList] = useState<CollectionSummary[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getCollections().then(setList);
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createCollection({ name: name.trim() });
      setName('');
      const next = await getCollections();
      setList(next);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="main">
      <h1>Sammlungen</h1>
      <div className="card">
        <h3>Neue Sammlung</h3>
        <div className="form-inline">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button className="primary" onClick={create} disabled={creating || !name.trim()}>
            Erstellen
          </button>
        </div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {list.map((c) => (
          <li key={c.id} style={{ marginBottom: '0.5rem' }}>
            <Link to={`/collections/${c.id}`}>
              {c.name}
            </Link>
            <span className="badge" style={{ marginLeft: '0.5rem' }}>{c.item_count} Bilder</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
