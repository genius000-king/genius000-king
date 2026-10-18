/** Connect two terminals by name. */
import {Link2, X} from 'lucide-react';
import {terminals, ref} from '../../../engines/catalog/types.js';
import {IconButton} from '../../common/IconButton.jsx';
import {useWorkbench} from '../context.js';

export default function ConnectModal() {
  const {connectNodes, editingWire, pair, project, setConnect, setPair} = useWorkbench();
  return (
    <div className="modal-backdrop" onPointerDown={() => setConnect(false)}>
      <div className="modal connect-modal glass" onPointerDown={e => e.stopPropagation()}>
        <div className="modal-heading">
          <span className="modal-icon">
            <Link2 size={22} />
          </span>
          <IconButton icon={X} label="Close connection dialog" onClick={() => setConnect(false)} />
        </div>
        <h2>{editingWire ? 'Reconnect this wire.' : 'Make a connection.'}</h2>
        <p>Choose two physical terminals. Their electrical nets will be joined.</p>
        {['From terminal', 'To terminal'].map((label, i) => (
          <label className="connect-field" key={label}>
            {label}
            <select
              aria-label={label}
              value={pair[i]}
              onChange={e => setPair(pair.map((v, j) => (j === i ? e.target.value : v)))}
            >
              <option value="">Choose a terminal…</option>
              {project.components.map(c => (
                <optgroup key={c.id} label={c.name + ' · ' + c.id.slice(0, 6)}>
                  {terminals(c).map(t => (
                    <option key={t.id} value={ref(c, t.id)}>
                      {t.id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
        <button className="primary-button" onClick={() => connectNodes(...pair)}>
          <Link2 size={15} />
          Connect terminals
        </button>
      </div>
    </div>
  );
}
