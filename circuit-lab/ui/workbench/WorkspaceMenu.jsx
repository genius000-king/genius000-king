/** The "more" menu: view, appearance, export and workspace settings. */
import {
  Undo2,
  Redo2,
  Grid2X2,
  Focus,
  Sun,
  Moon,
  Box,
  PanelLeft,
  Code2,
  Layers,
  Orbit,
  Terminal,
  Waves,
  Gauge,
  Wifi,
  Activity,
  Link2,
  AlertTriangle,
  Calculator,
  BookOpen,
  Bug,
} from 'lucide-react';
import {MODES, PROFILES} from '../../engines/performance/index.js';
import {IconButton} from '../common/IconButton.jsx';
import {useWorkbench} from './context.js';

export default function WorkspaceMenu() {
  const {
    choosePerformance,
    device,
    performanceMode,
    profile,
    change,
    grid,
    history,
    project,
    redo,
    scene,
    setDocs,
    setDrawer,
    setGrid,
    setLayout,
    setMore,
    setTools,
    undo,
  } = useWorkbench();
  return (
    <>
      <div className="menu-backdrop" onClick={() => setMore(false)} />
      <div className="workspace-menu glass">
        <div className="menu-row">
          <IconButton icon={Undo2} label="Undo · ⌘Z" onClick={undo} disabled={!history.current.undo.length} />
          <IconButton
            icon={Redo2}
            label="Redo · ⇧⌘Z"
            onClick={redo}
            disabled={!history.current.redo.length}
          />
          <span />
          <IconButton
            icon={Grid2X2}
            label="Toggle grid"
            active={grid}
            onClick={() => {
              setGrid(!grid);
              scene.current.grid.visible = !grid;
              scene.current.dirty = true;
            }}
          />
          <IconButton
            icon={Focus}
            label="Fit circuit"
            onClick={() => {
              scene.current?.focus();
              setMore(false);
            }}
          />
        </div>
        <details>
          <summary>Appearance</summary>
          <button
            onClick={() =>
              change(
                p => ({
                  ...p,
                  appearance: {
                    ...p.appearance,
                    theme: (p.appearance?.theme ?? 'dark') === 'dark' ? 'light' : 'dark',
                  },
                }),
                false
              )
            }
          >
            {(project.appearance?.theme ?? 'dark') === 'dark' ? <Sun size={15} /> : <Moon size={15} />}{' '}
            {(project.appearance?.theme ?? 'dark') === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <label className="glass-control">
            Panel opacity <b>{Math.round((project.appearance?.opacity ?? 0.36) * 100)}%</b>
            <input
              aria-label="Workspace panel opacity"
              type="range"
              min=".12"
              max=".85"
              step=".01"
              value={project.appearance?.opacity ?? 0.36}
              onChange={e =>
                change(p => ({...p, appearance: {...p.appearance, opacity: Number(e.target.value)}}), false)
              }
            />
          </label>
        </details>
        <details open>
          <summary>View</summary>
          <button onClick={() => setLayout('3d')}>
            <Box size={15} />
            3D workspace
          </button>
          <button onClick={() => setLayout('split')}>
            <PanelLeft size={15} />
            Split view
          </button>
          <button onClick={() => setLayout('float')}>
            <Code2 size={15} />
            Floating editor
          </button>
          <button
            onClick={() => {
              scene.current?.view('top');
              setMore(false);
            }}
          >
            <Layers size={15} />
            Top view
          </button>
          <button
            onClick={() => {
              scene.current?.view('perspective');
              setMore(false);
            }}
          >
            <Orbit size={15} />
            Perspective
          </button>
        </details>
        <details>
          <summary>Instruments</summary>
          {[
            ['serial', 'Serial monitor', Terminal],
            ['scope', 'Oscilloscope', Waves],
            ['logic', 'Logic analyzer', Gauge],
            ['gpio', 'GPIO', Grid2X2],
            ['network', 'Wi-Fi / UDP', Wifi],
            ['signals', 'Signals', Activity],
            ['i2c', 'I²C bus', Link2],
            ['debug', 'Firmware debugger', Bug],
            ['diagnostics', 'Circuit diagnostics', AlertTriangle],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setDrawer(key);
                setMore(false);
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </details>
        <details>
          <summary>Simulation</summary>
          <label className="glass-control">
            Time resolution
            <b>
              {
                {1: 'Fast · 1 ms', 5: 'Balanced · 0.2 ms', 20: 'Precise · 50 µs'}[
                  project.config?.precision ?? 5
                ]
              }
            </b>
            <select
              aria-label="Simulation time resolution"
              value={project.config?.precision ?? 5}
              onChange={e =>
                change(p => ({...p, config: {...p.config, precision: Number(e.target.value)}}), false)
              }
            >
              <option value="1">Fast · 1 ms steps</option>
              <option value="5">Balanced · 0.2 ms sub-steps</option>
              <option value="20">Precise · 50 µs sub-steps</option>
            </select>
          </label>
        </details>
        <details>
          <summary>Performance</summary>
          <label className="glass-control">
            Graphics
            <b>{profile.label}</b>
            <select
              aria-label="Graphics performance"
              value={performanceMode}
              onChange={e => choosePerformance(e.target.value)}
            >
              {Object.entries(MODES).map(([mode, label]) => (
                <option key={mode} value={mode}>
                  {mode === 'auto' ? `${label} · ${PROFILES[device.tier].label} for this device` : label}
                </option>
              ))}
            </select>
          </label>
          <p className="inline-note">
            Battery saver turns off shadows, antialiasing and panel blur and caps the frame rate. Quality uses
            WebGPU where the browser has it.
          </p>
        </details>
        <button
          className="reference-button"
          onClick={() => {
            setTools(true);
            setMore(false);
          }}
        >
          <Calculator size={14} />
          Engineering calculators
        </button>
        <button
          className="reference-button"
          onClick={() => {
            setDocs(true);
            setMore(false);
          }}
        >
          <BookOpen size={14} />
          Reference & shortcuts
        </button>
      </div>
    </>
  );
}
