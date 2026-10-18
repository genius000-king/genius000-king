/** Simulation time, board, nets and save state. */
import {Terminal, AlertTriangle, Activity} from 'lucide-react';
import {useWorkbench} from './context.js';

export default function StatusBar() {
  const {backend, diagnostics, drawer, project, saveState, setDrawer, sim} = useWorkbench();
  return (
    <footer className="statusbar">
      <div
        title={`${project.components.length} components · ${project.wires.length} wires · ${backend} · ${saveState}`}
      >
        <span className={sim.running ? 'pulse-dot' : 'status-dot'} />
        <b>{sim.running ? 'Running' : sim.boot === 'idle' ? 'Ready' : sim.boot}</b>
      </div>
      <div className="status-center">
        <button
          aria-label="Serial monitor"
          title="Serial monitor"
          className={drawer === 'serial' ? 'active' : ''}
          onClick={() => setDrawer(drawer === 'serial' ? null : 'serial')}
        >
          <Terminal size={14} />
        </button>
        <button
          aria-label="Circuit checks"
          title="Circuit checks"
          className={drawer === 'diagnostics' ? 'active' : ''}
          onClick={() => setDrawer(drawer === 'diagnostics' ? null : 'diagnostics')}
        >
          {diagnostics.length ? <AlertTriangle size={14} /> : <Activity size={14} />}{' '}
          {diagnostics.length > 0 && <span>{diagnostics.length}</span>}
        </button>
      </div>
    </footer>
  );
}
