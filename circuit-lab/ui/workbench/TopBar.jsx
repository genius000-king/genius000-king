/** Brand, project menu button, run/pause, layout switch and the main actions. */
import {
  CircuitBoard,
  ChevronDown,
  FolderOpen,
  Code2,
  Pause,
  Play,
  Minimize,
  Maximize,
  MoreHorizontal,
} from 'lucide-react';
import {IconButton} from '../common/IconButton.jsx';
import {useWorkbench} from './context.js';

export default function TopBar() {
  const {
    full,
    menu,
    more,
    project,
    run,
    saveState,
    setGallery,
    setLayout,
    setMenu,
    setMore,
    sim,
    toggleFull,
  } = useWorkbench();
  return (
    <header className="topbar">
      <a className="brand" href="#" onClick={e => e.preventDefault()}>
        <span className="brand-icon">
          <CircuitBoard size={22} />
        </span>
        <span>
          Circuit Lab<span className="brand-period">.</span>
        </span>
      </a>
      <div className="top-separator" />
      <div className="project-heading">
        <button className="project-button" onClick={() => setMenu(!menu)}>
          {project.name}
          <ChevronDown size={13} />
        </button>
        <span className="save-indicator">
          <span />
          {saveState}
        </span>
      </div>
      <div className="top-actions">
        <button
          className="code-toggle"
          onClick={() => setGallery(true)}
          title="Projects"
          aria-label="Projects"
        >
          <FolderOpen size={18} />
        </button>
        <button
          className={`code-toggle ${project.layout !== '3d' ? 'active' : ''}`}
          onClick={() => setLayout(project.layout === '3d' ? 'float' : '3d')}
          title="Code editor"
          aria-label="Code"
        >
          <Code2 size={18} />
        </button>
        <button
          className={`run-button ${sim.running ? 'running' : ''}`}
          onClick={run}
          title="Run / pause · Space"
          aria-label={sim.running ? 'Pause' : 'Run circuit'}
        >
          {sim.running ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          <span>{sim.running ? 'Pause' : 'Run'}</span>
        </button>
        <IconButton
          icon={full ? Minimize : Maximize}
          label={full ? 'Exit full screen' : 'Full screen'}
          active={full}
          onClick={toggleFull}
        />
        <IconButton
          icon={MoreHorizontal}
          label="Workspace options"
          active={more}
          onClick={() => setMore(!more)}
        />
      </div>
    </header>
  );
}
