import {FolderOpen, X, Search, ArrowRight} from 'lucide-react';
import {useState} from 'react';

export function ProjectGallery({projects, onLoad, onClose}) {
  const [board, setBoard] = useState('All'),
    [q, setQ] = useState('');
  const boards = ['All', ...new Set(projects.map(p => p.board.split(' + ')[0].replace(/ × 2$/, '')))];
  const list = projects.filter(
    p =>
      (board === 'All' || p.board.startsWith(board)) &&
      (p.name + ' ' + p.summary + ' ' + p.tags.join(' ')).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal gallery-modal glass" onPointerDown={e => e.stopPropagation()}>
        <div className="modal-heading">
          <span className="modal-icon">
            <FolderOpen size={22} />
          </span>
          <button className="icon-button" onClick={onClose} aria-label="Close projects">
            <X size={17} />
          </button>
        </div>
        <div className="eyebrow">{projects.length} RUNNABLE PROJECTS · EVERY ONE IS TESTED</div>
        <h2>Projects</h2>
        <div className="gallery-filters">
          <label className="library-search">
            <Search size={14} />
            <input
              aria-label="Search projects"
              placeholder="Search projects, parts, concepts…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </label>
          <div className="category-tabs scroll-chips">
            {boards.map(b => (
              <button key={b} className={board === b ? 'selected' : ''} onClick={() => setBoard(b)}>
                {b}
              </button>
            ))}
          </div>
        </div>
        <div className="gallery-grid">
          {list.map(p => (
            <button key={p.id} className="project-card" onClick={() => onLoad(p)}>
              <span className="project-board">{p.board}</span>
              <strong>{p.name}</strong>
              <p>{p.summary}</p>
              <span className="project-tags">
                {p.tags.map(t => (
                  <i key={t}>{t}</i>
                ))}
              </span>
              <span className="project-foot">
                <b>{p.level}</b>
                <span>
                  Open <ArrowRight size={12} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
