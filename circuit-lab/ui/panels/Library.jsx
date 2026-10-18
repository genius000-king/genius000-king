import {X, Search, Plus} from 'lucide-react';
import {useState, useMemo} from 'react';
import {TYPES, CATEGORIES} from '../../engines/catalog/types.js';
import {Thumb} from './Thumb.jsx';

export function Library({onAdd, onClose}) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('All');
  const counts = useMemo(
    () =>
      Object.values(TYPES).reduce((m, t) => {
        m[t.category] = (m[t.category] ?? 0) + 1;
        return m;
      }, {}),
    []
  );
  const list = Object.entries(TYPES).filter(
    ([key, t]) =>
      (category === 'All' || t.category === category) &&
      (t.name + ' ' + t.subtitle + ' ' + t.category + ' ' + (t.spec ?? '') + ' ' + key)
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  return (
    <aside className="library glass">
      <div className="panel-title">
        <span>
          Components <b>{Object.keys(TYPES).length}</b>
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          title="Collapse components"
          aria-label="Collapse components"
        >
          <X size={17} strokeWidth={1.65} />
        </button>
      </div>
      <label className="library-search">
        <Search size={14} />
        <input
          aria-label="Search components"
          placeholder={`Search ${Object.keys(TYPES).length} parts, boards, instruments…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
      </label>
      <div className="category-tabs scroll-chips">
        {CATEGORIES.map(c => (
          <button className={category === c ? 'selected' : ''} onClick={() => setCategory(c)} key={c}>
            {c}
            {c !== 'All' && <span>{counts[c] ?? 0}</span>}
          </button>
        ))}
      </div>
      <div className="component-grid">
        {list.map(([key, t]) => (
          <button
            className="component-card"
            title={`${t.name} · ${t.subtitle}\nClick to add, or drag into the workspace`}
            draggable
            onDragStart={e => e.dataTransfer.setData('component', key)}
            onClick={() => onAdd(key)}
            key={key}
          >
            <span className="add-component">
              <Plus size={11} />
            </span>
            <Thumb type={key} />
            <span>{t.name}</span>
            <small>{t.spec ?? t.category}</small>
          </button>
        ))}
        {!list.length && (
          <div className="empty-inline">
            <Search size={20} />
            <span>No part matches “{query}”.</span>
          </div>
        )}
      </div>
    </aside>
  );
}
