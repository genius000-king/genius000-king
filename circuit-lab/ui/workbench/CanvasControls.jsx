/** Connection prompt, transform tools and camera buttons over the 3D view. */
import {
  ArrowRight,
  X,
  RotateCcw,
  RotateCw,
  ArrowUpRight,
  ArrowDownToLine,
  ZoomIn,
  ZoomOut,
  Focus,
  Layers,
  Plus,
  Camera,
  MousePointer2,
  Move3D,
  Link2,
  PlusCircle,
} from 'lucide-react';
import {IconButton} from '../common/IconButton.jsx';
import {useWorkbench} from './context.js';

export default function CanvasControls() {
  const {
    cameraTools,
    choose,
    library,
    mode,
    pending,
    scene,
    selected,
    setCameraTools,
    setConnect,
    setEditingWire,
    setLibrary,
    setMode,
    setPair,
    setPending,
  } = useWorkbench();
  return (
    <div className="workspace-bottom">
      {pending && (
        <div className="connection-prompt glass">
          <span />
          {pending.split(':')[1]}
          <ArrowRight size={12} />
          Select a terminal
          <IconButton icon={X} label="Cancel connection" onClick={() => setPending(null)} />
        </div>
      )}
      {cameraTools && (
        <div className="camera-popover glass">
          <div>
            <IconButton
              icon={RotateCcw}
              label="Orbit camera left"
              onClick={() => scene.current?.nudgeCamera(-0.2, 0)}
            />
            <IconButton
              icon={RotateCw}
              label="Orbit camera right"
              onClick={() => scene.current?.nudgeCamera(0.2, 0)}
            />
            <IconButton
              icon={ArrowUpRight}
              label="Orbit camera up"
              onClick={() => scene.current?.nudgeCamera(0, -0.15)}
            />
            <IconButton
              icon={ArrowDownToLine}
              label="Orbit camera down"
              onClick={() => scene.current?.nudgeCamera(0, 0.15)}
            />
          </div>
          <div>
            <IconButton icon={ZoomIn} label="Zoom in" onClick={() => scene.current?.zoom(0.85)} />
            <IconButton icon={ZoomOut} label="Zoom out" onClick={() => scene.current?.zoom(1.15)} />
            <IconButton icon={Focus} label="Focus circuit" onClick={() => scene.current?.focus()} />
            <IconButton icon={Layers} label="Top camera view" onClick={() => scene.current?.view('top')} />
          </div>
        </div>
      )}
      <div className="toolstrip glass">
        <IconButton
          icon={Plus}
          label="Components"
          active={library}
          onClick={() => {
            setLibrary(!library);
            choose([]);
          }}
        />
        <IconButton
          icon={Camera}
          label="Camera controls"
          active={cameraTools}
          onClick={() => setCameraTools(!cameraTools)}
        />
        <span className="tool-divider" />
        <IconButton
          icon={MousePointer2}
          label="Select · V"
          active={mode === 'select'}
          onClick={() => {
            setMode('select');
            setPending(null);
          }}
        />
        {selected.length > 0 && (
          <>
            <IconButton
              icon={Move3D}
              label="Move on all three axes"
              active={mode === 'translate'}
              onClick={() => setMode('translate')}
            />
            <IconButton
              icon={RotateCw}
              label="Rotate object · R"
              active={mode === 'rotate'}
              onClick={() => setMode('rotate')}
            />
          </>
        )}
        <button
          className={`wire-tool ${mode === 'wire' ? 'active' : ''}`}
          aria-label="Wire tool"
          title="Wire tool · W"
          onClick={() => {
            setMode(mode === 'wire' ? 'select' : 'wire');
            setPending(null);
          }}
        >
          <Link2 size={18} />
        </button>
        {mode === 'wire' && (
          <IconButton
            icon={PlusCircle}
            label="Connect terminals by name"
            onClick={() => {
              setPair(['', '']);
              setEditingWire(null);
              setConnect(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
