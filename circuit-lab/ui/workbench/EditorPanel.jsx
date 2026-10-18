/** Firmware files, the code editor and its diagnostics. */
import {
  Code2,
  PanelLeft,
  Maximize2,
  PanelRight,
  Minus,
  X,
  CircuitBoard,
  FileCode2,
  Plus,
  Info,
  Check,
  Upload,
  Square,
  RotateCcw,
  SkipForward,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Terminal,
} from 'lucide-react';
import {profileOf, isBoard} from '../../engines/catalog/boards.js';
import {sourceForBoard} from '../../engines/workspace/project.js';
import {IconButton} from '../common/IconButton.jsx';
import {Editor} from './lazy.jsx';
import {useWorkbench} from './context.js';

export default function EditorPanel() {
  const {
    change,
    compiled,
    dock,
    drawer,
    editorPanel,
    error,
    glass,
    minimized,
    panel,
    project,
    runSource,
    selectBoard,
    send,
    setCompiled,
    setDock,
    setDocs,
    setDrawer,
    setGlass,
    setLayout,
    setMinimized,
    setNewFile,
    source,
    startPanelDrag,
  } = useWorkbench();
  return (
    <section
      ref={editorPanel}
      className={`editor-panel glass ${minimized ? 'minimized' : ''}`}
      style={
        project.layout === 'float'
          ? {transform: `translate(${panel.x}px, ${panel.y}px)`, '--glass-alpha': glass}
          : {'--glass-alpha': glass}
      }
    >
      <div className="editor-titlebar" onPointerDown={startPanelDrag}>
        <span className="editor-title">
          <Code2 size={16} />
          Firmware{' '}
          <span className="language-badge">
            {profileOf(
              project.components.find(
                c => c.id === (project.activeBoard ?? project.components.find(isBoard)?.id)
              )
            )?.short ?? 'NO BOARD'}{' '}
            · ARDUINO
          </span>
        </span>
        <div>
          <IconButton
            icon={project.layout === 'float' ? PanelLeft : Maximize2}
            label={project.layout === 'float' ? 'Dock editor left' : 'Float editor'}
            onClick={() => {
              setDock('left');
              setLayout(project.layout === 'float' ? 'split' : 'float');
            }}
          />
          {project.layout === 'split' && (
            <IconButton
              icon={PanelRight}
              label="Switch dock side"
              onClick={() => setDock(dock === 'left' ? 'right' : 'left')}
            />
          )}
          <IconButton
            icon={minimized ? Maximize2 : Minus}
            label={minimized ? 'Expand editor' : 'Minimize editor'}
            onClick={() => setMinimized(!minimized)}
          />
          <IconButton icon={X} label="Close editor" onClick={() => setLayout('3d')} />
        </div>
      </div>
      {!minimized && (
        <>
          {project.components.filter(c => isBoard(c)).length > 1 && (
            <label className="firmware-target">
              <CircuitBoard size={13} />
              <select
                aria-label="Firmware target board"
                value={project.activeBoard ?? project.components.find(c => isBoard(c))?.id}
                onChange={e => selectBoard(e.target.value)}
              >
                {project.components
                  .filter(c => isBoard(c))
                  .map((c, i) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {profileOf(c).short}
                    </option>
                  ))}
              </select>
              <span>Independent firmware</span>
            </label>
          )}
          <div className="editor-tabs">
            {Object.keys(project.files).map(file => (
              <button
                className={project.activeFile === file ? 'active' : ''}
                key={file}
                onClick={() => change(p => ({...p, activeFile: file}), false)}
              >
                <FileCode2 size={13} />
                {file}
                <span className="file-dot" />
              </button>
            ))}
            <IconButton icon={Plus} label="Add source file" onClick={() => setNewFile(true)} />
          </div>
          <div className="editor-support">
            <span className="tiny-square" />
            Lab VM <span>·</span> Arduino-style source{' '}
            <button onClick={() => setDocs(true)} title="Supported APIs">
              <Info size={12} />
            </button>
          </div>
          <Editor
            file={project.activeFile}
            value={project.files[project.activeFile]}
            error={error?.file === project.activeFile ? error : null}
            onChange={value => {
              setCompiled(false);
              change(p => {
                p.files[p.activeFile] = value;
                return p;
              }, false);
            }}
          />
          <div className="editor-actions">
            <button className="compile-button" onClick={() => send('compile', {source})}>
              <Check size={15} />
              {compiled ? 'Compiled' : 'Compile'}
            </button>
            <button
              className="upload-button"
              onClick={() => {
                runSource.current = JSON.stringify(
                  project.components.filter(c => isBoard(c)).map(c => [c.id, sourceForBoard(project, c.id)])
                );
                send('run', {source});
              }}
            >
              <Upload size={14} />
              Upload & run
            </button>
            <IconButton icon={Square} label="Stop firmware" onClick={() => send('stop')} />
            <IconButton icon={RotateCcw} label="Reset firmware" onClick={() => send('reset')} />
            <IconButton
              icon={SkipForward}
              label="Step simulation 1 ms"
              disabled={!compiled}
              onClick={() => send('step', {ms: 1})}
            />
          </div>
          <div className="editor-status">
            <span>
              {error ? (
                <>
                  <AlertTriangle size={12} />
                  Compilation error
                </>
              ) : compiled ? (
                <>
                  <CheckCircle2 size={12} />
                  Build ready
                </>
              ) : (
                <>C++ subset · UTF-8</>
              )}
            </span>
            <label title="Glass opacity">
              <Sun size={12} />
              <input
                aria-label="Editor opacity"
                type="range"
                min=".45"
                max="1"
                step=".01"
                value={glass}
                onChange={e => setGlass(Number(e.target.value))}
              />
            </label>
            <button onClick={() => setDrawer(drawer === 'serial' ? null : 'serial')}>
              <Terminal size={12} />
              Serial
            </button>
          </div>
        </>
      )}
    </section>
  );
}
