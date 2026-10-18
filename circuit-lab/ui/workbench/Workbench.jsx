import {CheckCircle2, GripVertical} from 'lucide-react';
import {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {isBoard} from '../../engines/catalog/boards.js';

import {makeComponent, TYPES} from '../../engines/catalog/types.js';

import {filesForBoard, sourceForBoard, validateProject} from '../../engines/workspace/project.js';
import {reseat} from '../../engines/workspace/snap.js';

import {load, blankState, loadIssue, KEY} from './storage.js';
import '../styles.css';
import {WorkbenchContext} from './context.js';
import {detectDevice, profileFor, readMode, writeMode} from '../../engines/performance/index.js';
import {preloadScene} from './scene-loader.js';
import {
  WorkspaceMenu,
  ProjectMenu,
  Inspector,
  DiagnosticsDrawer,
  ConnectModal,
  NewFileModal,
  DocsModal,
  Library,
  ToolsModal,
  ProjectGallery,
} from './lazy.jsx';
import TopBar from './TopBar.jsx';
import CanvasControls from './CanvasControls.jsx';
import EditorPanel from './EditorPanel.jsx';
import StatusBar from './StatusBar.jsx';
import PinTooltip from './PinTooltip.jsx';

const debugHook = (() => {
  try {
    return sessionStorage.getItem('circuit-lab-debug') === '1';
  } catch {
    return false;
  }
})();

export function App() {
  const [project, setProject] = useState(load),
    [selected, setSelected] = useState([]),
    [wireId, setWireId] = useState(null),
    [mode, setMode] = useState('select'),
    [library, setLibrary] = useState(false),
    [pinInfo, setPinInfo] = useState(null),
    [cameraTools, setCameraTools] = useState(false),
    [more, setMore] = useState(false),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All'),
    [sim, setSim] = useState(blankState),
    [backend, setBackend] = useState('Starting renderer'),
    [toast, setToast] = useState(''),
    [error, setError] = useState(null),
    [compiled, setCompiled] = useState(false),
    [hover, setHover] = useState(null),
    [pending, setPending] = useState(null),
    [drawer, setDrawer] = useState(null),
    [docs, setDocs] = useState(false),
    [menu, setMenu] = useState(false),
    [connect, setConnect] = useState(false),
    [editingWire, setEditingWire] = useState(null),
    [pair, setPair] = useState(['', '']),
    [inspectorTab, setInspectorTab] = useState('properties'),
    [split, setSplit] = useState(project.editor?.split ?? 43),
    [dock, setDock] = useState(project.editor?.dock ?? 'left'),
    [panel, setPanel] = useState(project.editor?.panel ?? {x: 0, y: 0}),
    [minimized, setMinimized] = useState(false),
    [glass, setGlass] = useState(project.editor?.glass ?? 0.66),
    [serialInput, setSerialInput] = useState(''),
    [audioEnabled, setAudioEnabled] = useState(false),
    [grid, setGrid] = useState(true),
    [saveState, setSaveState] = useState('Saved locally'),
    [historyVersion, setHistoryVersion] = useState(0),
    [graphicsGeneration, setGraphicsGeneration] = useState(0),
    [performanceMode, setPerformanceMode] = useState(readMode),
    [resolution, setResolution] = useState(null),
    [newFile, setNewFile] = useState(false),
    [fileName, setFileName] = useState('helpers.ino'),
    [gallery, setGallery] = useState(false),
    [tools, setTools] = useState(false),
    [full, setFull] = useState(false);
  /* Real fullscreen where the browser allows it; iPhone Safari only allows it for video, so there the button switches to an immersive layout instead */
  useEffect(() => {
    const sync = () => setFull(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);
  const toggleFull = () => {
    const el = document.documentElement,
      active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
      setFull(false);
      return;
    }
    if (full) {
      setFull(false);
      return;
    }
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    setFull(true);
    if (request) Promise.resolve(request.call(el, {navigationUI: 'hide'})).catch(() => {});
  };
  const sceneRoot = useRef(null),
    scene = useRef(null),
    worker = useRef(null),
    current = useRef(project),
    simRef = useRef(sim),
    history = useRef({undo: [], redo: []}),
    callbacks = useRef({}),
    handStart = useRef(null),
    initial = useRef(project),
    importRef = useRef(null),
    notifyTimer = useRef(),
    audio = useRef(null),
    editorPanel = useRef(null),
    didCamera = useRef(false),
    preserveBadSave = useRef(!!loadIssue.message),
    serialBottom = useRef(null),
    runSource = useRef(''),
    latest = useRef({});
  current.current = project;
  simRef.current = sim;
  latest.current = {selected, wireId, mode, pending};
  // test hook: always in development, and in a production build once a test sets the session flag
  if (process.env.NODE_ENV !== 'production' || debugHook)
    window.__circuitLab = {
      project: () => current.current,
      state: () => simRef.current,
      scene: () => scene.current,
    };
  // how much this device renders; changing the mode rebuilds the renderer (antialiasing is fixed per context)
  const device = detectDevice(),
    profile = useMemo(() => profileFor(performanceMode, device), [performanceMode]);
  const choosePerformance = mode => {
    writeMode(mode);
    setPerformanceMode(mode);
    setResolution(null);
    setGraphicsGeneration(n => n + 1);
  };
  useEffect(() => {
    // a hidden tab keeps simulating but only needs a snapshot a second
    const apply = () =>
      worker.current?.postMessage({type: 'config', stateMs: document.hidden ? 1000 : profile.stateMs});
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => document.removeEventListener('visibilitychange', apply);
  }, [profile.stateMs]);
  const notify = useCallback(s => {
    setToast(s);
    clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);
  const change = useCallback((fn, record = true) => {
    setProject(old => {
      const next = typeof fn === 'function' ? fn(structuredClone(old)) : fn;
      if (record) {
        history.current.undo.push(structuredClone(old));
        if (history.current.undo.length > 60) history.current.undo.shift();
        history.current.redo = [];
        setHistoryVersion(n => n + 1);
      }
      return next;
    });
  }, []);
  const updateComponent = (id, values, params = false, record = true) =>
    change(p => {
      p.components = p.components.map(c =>
        c.id === id ? (params ? {...c, params: {...c.params, ...values}} : {...c, ...values}) : c
      );
      return p;
    }, record);
  const undo = () => {
    const h = history.current;
    if (!h.undo.length) return;
    h.redo.push(structuredClone(current.current));
    setProject(h.undo.pop());
    setHistoryVersion(n => n + 1);
    notify('Change undone');
  };
  const redo = () => {
    const h = history.current;
    if (!h.redo.length) return;
    h.undo.push(structuredClone(current.current));
    setProject(h.redo.pop());
    setHistoryVersion(n => n + 1);
  };
  const choose = (ids, wire = null) => {
    setPinInfo(null);
    scene.current?.traceNet(null);
    if (ids.length || wire) setLibrary(false);
    setSelected(ids);
    setWireId(wire);
    setInspectorTab('properties');
  };
  const deleteSelection = () => {
    if (wireId) {
      change(p => {
        p.wires = p.wires.filter(w => w.id !== wireId);
        return p;
      });
      setWireId(null);
      notify('Wire disconnected');
    } else if (selected.length) {
      change(p => {
        const oldTarget = p.activeBoard ?? p.components.find(c => isBoard(c))?.id;
        const remaining = p.components.filter(c => !selected.includes(c.id));
        if (selected.includes(oldTarget)) {
          p.firmware ??= {};
          p.firmware[oldTarget] = {files: structuredClone(p.files), activeFile: p.activeFile};
          const next = remaining.find(c => isBoard(c));
          if (next) {
            p.files = structuredClone(filesForBoard(p, next.id));
            p.activeFile = p.firmware[next.id]?.activeFile ?? Object.keys(p.files)[0];
          }
          p.activeBoard = next?.id ?? null;
        }
        for (const id of selected) if (p.firmware) delete p.firmware[id];
        p.components = remaining;
        p.wires = p.wires.filter(
          w => ![w.a.split(':')[0], w.b.split(':')[0]].some(id => selected.includes(id))
        );
        return p;
      });
      setSelected([]);
    }
  };
  const duplicate = () => {
    if (project.components.length + selected.length > 200) {
      notify('The workspace supports up to 200 components.');
      return;
    }
    const ids = [];
    change(p => {
      for (const c of p.components.filter(c => selected.includes(c.id))) {
        const n = structuredClone(c);
        n.id = crypto.randomUUID();
        if (c.type === 'board') {
          p.firmware ??= {};
          p.firmware[n.id] = {files: structuredClone(filesForBoard(p, c.id)), activeFile: 'main.ino'};
        }
        n.position[0] += 10;
        n.position[2] += 10;
        p.components.push(n);
        ids.push(n.id);
      }
      return p;
    });
    setSelected(ids);
    notify('Components duplicated');
  };
  const rotate = (axis, deg) =>
    change(p => {
      p.components.forEach(c => {
        if (selected.includes(c.id)) {
          c.rotation[axis] += (deg * Math.PI) / 180;
          if (axis !== 1 && Math.abs(c.rotation[axis] % (2 * Math.PI)) > 0.1)
            c.position[1] = Math.max(c.position[1], isBoard(c) ? 8 : 5);
        }
      });
      return p;
    });
  const add = (type, pos) => {
    if (project.components.length >= 200) {
      notify('The workspace supports up to 200 components.');
      return;
    }
    const c = makeComponent(type, pos ?? [(Math.random() - 0.5) * 30, 0, 42]);
    change(p => {
      p.components.push(c);
      return reseat(p, [c.id]);
    });
    setSelected([c.id]);
    setWireId(null);
    setLibrary(false);
    notify(`${TYPES[type].name} added`);
  };
  const connectNodes = (a, b) => {
    if (!editingWire && project.wires.length >= 2000) {
      notify('The workspace supports up to 2,000 wires.');
      return;
    }
    if (!a || !b || a === b) {
      notify('Choose two different terminals.');
      return;
    }
    if (
      project.wires.some(w => w.id !== editingWire && ((w.a === a && w.b === b) || (w.a === b && w.b === a)))
    ) {
      notify('Those terminals are already connected.');
      return;
    }
    const gnd = a.includes('GND') || b.includes('GND');
    change(p => {
      if (editingWire) {
        Object.assign(
          p.wires.find(w => w.id === editingWire),
          {a, b}
        );
      } else
        p.wires.push({
          id: crypto.randomUUID(),
          a,
          b,
          color: gnd ? '#344d4b' : a.includes('3V3') || a.includes('5V') ? '#c76a53' : '#ba9453',
          lift: 10,
        });
      return p;
    });
    setPending(null);
    setConnect(false);
    setEditingWire(null);
    notify('Connection made');
  };
  const terminalClick = node => {
    if (!pending) {
      setPending(node);
      notify('Select a second terminal to connect.');
    } else connectNodes(pending, node);
  };
  callbacks.current = {
    onPin: pin => {
      choose([pin.node.split(':')[0]]);
      setPinInfo(pin);
    },
    onSelect: choose,
    onMove: items =>
      change(p => {
        for (const item of items) {
          const c = p.components.find(c => c.id === item.id);
          if (c) c.position = item.position;
        }
        return reseat(
          p,
          items.map(i => i.id)
        );
      }),
    onTransform: (id, position, rotation) => updateComponent(id, {position, rotation}),
    onTerminal: terminalClick,
    onHover: setHover,
    onBackend: setBackend,
    onResolution: setResolution,
    onRecover: message => {
      notify(message);
      setGraphicsGeneration(n => n + 1);
    },
    onError: message => {
      notify(message);
      setError({message});
    },
    onCamera: camera => change(p => ({...p, camera}), false),
    onAction: ({id, action, dx = 0, dy = 0}, pressed) => {
      const c = current.current.components.find(c => c.id === id);
      if (!c) return;
      const clamp = v => Math.min(1, Math.max(0, v)),
        start = handStart.current;
      if (action === 'turn') {
        if (pressed === true) handStart.current = {value: c.params.value, moved: false};
        else if (pressed === 'drag' && start && (start.moved || Math.hypot(dx, dy) > 4)) {
          start.moved = true;
          updateComponent(
            id,
            {value: Math.round(clamp(start.value + (dx - dy) * 0.0035) * 100) / 100},
            true,
            false
          );
        } else if (pressed === false) {
          /* a tap without turning selects the part */ if (!start?.moved) choose([id]);
          handStart.current = null;
        }
        return;
      }
      if (action === 'stick' || action === 'encoder') {
        const moved = Math.hypot(dx, dy) > 6;
        if (pressed === true) {
          handStart.current = {target: c.params.target ?? 0};
          updateComponent(id, {pressed: true, lastChange: simRef.current.time}, true, false);
        } else if (pressed === 'drag' && moved) {
          if (c.params.pressed)
            updateComponent(id, {pressed: false, lastChange: simRef.current.time}, true, false);
          if (action === 'stick')
            updateComponent(
              id,
              {
                x: Math.round(clamp(0.5 + dx * 0.006) * 100) / 100,
                y: Math.round(clamp(0.5 - dy * 0.006) * 100) / 100,
              },
              true,
              false
            );
          else if (start) updateComponent(id, {target: start.target + Math.round(dx / 14)}, true, false);
        } else if (pressed === false) {
          /* the KY-023 gimbal is spring-centred */ updateComponent(
            id,
            action === 'stick' ? {pressed: false, x: 0.5, y: 0.5} : {pressed: false},
            true,
            false
          );
          handStart.current = null;
        }
        return;
      }
      if (action === 'dial') {
        if (pressed === true) {
          const modes = ['V', 'A', 'Ω', 'continuity'];
          updateComponent(id, {mode: modes[(modes.indexOf(c.params.mode) + 1) % modes.length]}, true);
        }
        return;
      }
      if (action === 'tilt') {
        if (pressed === true) updateComponent(id, {tilted: !c.params.tilted}, true);
        return;
      }
      if (action === 'press') updateComponent(id, {pressed, lastChange: simRef.current.time}, true, false);
      else if (action === 'en') updateComponent(id, {enPressed: pressed}, true, false);
      else if (action === 'toggle' && pressed)
        updateComponent(id, {position: c.params.position ? 0 : 1}, true);
      else if (action === 'boot') updateComponent(id, {bootPressed: pressed}, true, false);
      else if (action.startsWith('key:'))
        updateComponent(id, {key: pressed ? action.slice(4) : ''}, true, false);
    },
    onWireRoute: (id, value) =>
      change(p => {
        Object.assign(
          p.wires.find(w => w.id === id),
          value
        );
        return p;
      }, false),
  };
  useEffect(() => {
    const w = new Worker(new URL('../../engines/runtime/sim.worker.js', import.meta.url), {type: 'module'});
    worker.current = w;
    w.onmessage = ({data}) => {
      if (data.type === 'state') setSim(data.state);
      if (data.type === 'compiled') {
        setError(null);
        setCompiled(true);
        notify(
          data.size
            ? `Compiled successfully · ${data.size} instructions`
            : 'Simulation running · no microcontroller firmware'
        );
      }
      if (data.type === 'error') {
        if (
          data.board &&
          data.board !== (current.current.activeBoard ?? current.current.components.find(c => isBoard(c))?.id)
        )
          selectBoard(data.board);
        let line = data.line ?? 1,
          file = 'main.ino';
        for (const [name, text] of Object.entries(current.current.files).sort(([a], [b]) =>
          a === 'main.ino' ? -1 : b === 'main.ino' ? 1 : a.localeCompare(b)
        )) {
          const count = text.split('\n').length;
          if (line <= count) {
            file = name;
            break;
          }
          line -= count;
        }
        setError({message: data.message, line, file});
        if (current.current.files[file] !== undefined) setProject(p => ({...p, activeFile: file}));
        setCompiled(false);
        setDrawer('diagnostics');
        notify(data.message);
      }
    };
    w.onerror = e => {
      setError({message: 'Simulation worker failed: ' + e.message});
      setDrawer('diagnostics');
    };
    w.postMessage({type: 'init', project: initial.current});
    w.postMessage({type: 'config', stateMs: document.hidden ? 1000 : profile.stateMs});
    return () => w.terminate();
  }, []);
  useEffect(() => {
    let dead = false,
      lab;
    preloadScene()
      .then(({LabScene}) => {
        if (dead) return;
        lab = new LabScene(
          sceneRoot.current,
          new Proxy(
            {},
            {
              get:
                (_, key) =>
                (...args) =>
                  callbacks.current[key]?.(...args),
            }
          ),
          profile
        );
        scene.current = lab;
        return lab.ready.then(() => {
          if (dead) return;
          // the engine arrives after the first render, so apply whatever the user has done meanwhile
          const now = latest.current;
          lab.update(current.current);
          lab.setTheme(current.current.appearance?.theme ?? 'dark');
          lab.restoreCamera(current.current.camera);
          lab.select(now.selected, now.wireId);
          lab.setMode(now.mode);
          lab.setPending(now.pending);
          lab.state(simRef.current);
        });
      })
      .catch(e => {
        setError({message: '3D graphics unavailable: ' + e.message});
        setBackend('Graphics unavailable');
      });
    return () => {
      dead = true;
      lab?.dispose();
    };
  }, [graphicsGeneration]);
  useEffect(() => {
    if (scene.current?.renderer) {
      scene.current.update(project);
      scene.current.setTheme(project.appearance?.theme ?? 'dark');
      if (!didCamera.current && project.camera) {
        scene.current.restoreCamera(project.camera);
        didCamera.current = true;
      }
    }
    worker.current?.postMessage({type: 'project', project});
    setSaveState('Saving…');
    const timer = setTimeout(() => {
      if (preserveBadSave.current) {
        setSaveState('Recovery required');
        return;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(project));
        setSaveState('Saved locally');
      } catch (e) {
        setSaveState('Save failed');
        notify('Local storage is full or unavailable. Export your project to keep it.');
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    scene.current?.ready.then(() => scene.current?.select(selected, wireId));
  }, [selected, wireId]);
  useEffect(() => {
    scene.current?.ready.then(() => scene.current?.setMode(mode));
  }, [mode]);
  useEffect(() => {
    scene.current?.setPending(pending);
  }, [pending]);
  useEffect(() => {
    scene.current?.state(sim);
    if (audio.current) {
      const buzz = project.components.find(
        c => (c.type === 'buzzer' || c.type === 'speaker') && sim.components[c.id]?.active
      );
      audio.current.gain.gain.setTargetAtTime(
        audioEnabled && buzz && sim.running ? 0.025 : 0,
        audio.current.ctx.currentTime,
        0.02
      );
      if (buzz)
        audio.current.osc.frequency.setValueAtTime(
          sim.components[buzz.id]?.frequency ?? 1000,
          audio.current.ctx.currentTime
        );
    }
  }, [sim, audioEnabled]);
  useEffect(() => {
    if (loadIssue.message) {
      notify(loadIssue.message);
      loadIssue.message = '';
    }
  }, []);
  useEffect(() => {
    serialBottom.current?.scrollIntoView({block: 'nearest'});
  }, [sim.logs.length, drawer]);
  useEffect(() => {
    const h = e => {
      const edit = e.target.closest('input,textarea,.cm-editor,[contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
        return;
      }
      if (edit) return;
      if (e.code === 'Space') {
        e.preventDefault();
        run();
      }
      if (e.key === 'Escape') {
        setPending(null);
        setMode('select');
        setMenu(false);
        setDocs(false);
        setConnect(false);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        duplicate();
      }
      if (e.key === 'w') setMode('wire');
      if (e.key === 'v') setMode('select');
      if (e.key === 'r') setMode('rotate');
      if (e.key === 'f') scene.current?.focus();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  useEffect(() => {
    change(p => ({...p, editor: {...p.editor, split, dock, panel, glass}}), false);
  }, [split, dock, panel, glass]);
  const send = (type, extra = {}) =>
    worker.current?.postMessage({type, ...(type === 'run' ? {project: current.current} : {}), ...extra});
  const selectBoard = id => {
    setError(null);
    change(p => {
      const currentId = p.activeBoard ?? p.components.find(c => isBoard(c))?.id;
      p.firmware ??= {};
      if (currentId) p.firmware[currentId] = {files: structuredClone(p.files), activeFile: p.activeFile};
      const files = filesForBoard(p, id);
      p.files = structuredClone(files);
      p.activeFile = p.firmware[id]?.activeFile ?? Object.keys(files)[0];
      p.activeBoard = id;
      return p;
    }, false);
  };
  const source = Object.entries(project.files)
    .sort(([a], [b]) => (a === 'main.ino' ? -1 : b === 'main.ino' ? 1 : a.localeCompare(b)))
    .map(([, text]) => text)
    .join('\n');
  const run = () => {
    if (sim.running) send('pause');
    else if (
      sim.boot === 'running' &&
      compiled &&
      runSource.current ===
        JSON.stringify(
          project.components.filter(c => isBoard(c)).map(c => [c.id, sourceForBoard(project, c.id)])
        )
    )
      send('pause');
    else {
      setError(null);
      runSource.current = JSON.stringify(
        project.components.filter(c => isBoard(c)).map(c => [c.id, sourceForBoard(project, c.id)])
      );
      send('run', {source});
    }
  };
  const save = () => {
    try {
      if (preserveBadSave.current) {
        localStorage.setItem(KEY + '-recovery', localStorage.getItem(KEY));
        preserveBadSave.current = false;
      }
      localStorage.setItem(KEY, JSON.stringify(current.current));
      notify('Project saved on this device');
      setSaveState('Saved locally');
    } catch (e) {
      notify('Save failed. Export the project instead.');
    }
  };
  const slug = () =>
    current.current.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'circuit';
  const exportProject = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(current.current, null, 2)], {type: 'application/json'})
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.circuitlab.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Project exported');
  };
  const importFile = async file => {
    if (/\.(ino|cpp|h|c|txt)$/i.test(file.name)) {
      if (file.size > 200000) {
        notify('Source files are limited to 200 KB.');
        return;
      }
      const text = await file.text(),
        name = file.name.replace(/\.txt$/i, '.ino').replace(/[^\w.-]/g, '_');
      change(p => {
        p.files[name] = text;
        p.activeFile = name;
        return p;
      });
      setCompiled(false);
      if (project.layout === '3d') setLayout('float');
      notify(
        `${name} added to ${project.components.find(c => c.id === (project.activeBoard ?? project.components.find(isBoard)?.id))?.name ?? 'the sketch'}`
      );
      return;
    }
    if (/\.(json|circuitlab)$/i.test(file.name)) {
      await importProject({target: {files: [file], value: ''}});
      return;
    }
    notify('Unsupported file. Drop a .circuitlab.json project or a .ino / .cpp / .h source file.');
  };
  const importProject = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/\.(json|circuitlab)$/i.test(file.name)) {
      await importFile(file);
      e.target.value = '';
      return;
    }
    try {
      if (file.size > 2000000) throw Error('Project file is larger than 2 MB.');
      const next = validateProject(JSON.parse(await file.text()));
      if (!window.confirm('Import this project? Your current project will remain available through Undo.'))
        return;
      send('stop');
      setCompiled(false);
      change(next);
      setSelected([]);
      scene.current?.restoreCamera(next.camera);
      notify('Project imported');
    } catch (e) {
      notify('Import failed: ' + e.message);
    } finally {
      e.target.value = '';
    }
  };
  const setLayout = layout => {
    if (layout !== '3d') {
      setLibrary(false);
      setSelected([]);
      setWireId(null);
    }
    setMore(false);
    change(p => ({...p, layout}), false);
    setMinimized(false);
  };
  const loadProject = def => {
    if (!window.confirm(`Open “${def.name}”? Your current circuit stays available through Undo.`)) return;
    send('stop');
    const p = def.build();
    p.appearance = project.appearance;
    change(p);
    setCompiled(false);
    setSelected([]);
    setWireId(null);
    setMenu(false);
    setGallery(false);
    if (p.camera) scene.current?.restoreCamera(p.camera);
    else setTimeout(() => scene.current?.focus(), 80);
    notify(`${def.name} loaded · press Run`);
  };
  const selectedComponent = project.components.find(c => c.id === selected[0]),
    selectedWire = project.wires.find(w => w.id === wireId),
    live = sim.components[selectedComponent?.id] ?? {};
  const diagnostics = [
    ...(error ? [{level: 'error', message: error.message}] : []),
    ...sim.diagnostics,
    ...sim.warnings.map(message => ({level: 'warning', message})),
  ];
  const startPanelDrag = e => {
    if (e.target.closest('button,input') || project.layout !== 'float') return;
    const origin = {x: e.clientX, y: e.clientY, ...panel};
    const x = e.clientX,
      y = e.clientY;
    const move = ev =>
      setPanel({
        x: Math.max(-window.innerWidth * 0.45, Math.min(window.innerWidth * 0.25, origin.x + ev.clientX - x)),
        y: Math.max(-60, Math.min(window.innerHeight - 220, origin.y + ev.clientY - y)),
      });
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const startSplit = e => {
    e.preventDefault();
    const move = ev =>
      setSplit(
        Math.max(
          25,
          Math.min(
            65,
            ((dock === 'left' ? ev.clientX : window.innerWidth - ev.clientX) / window.innerWidth) * 100
          )
        )
      );
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const enableAudio = () => {
    if (!audio.current) {
      const ctx = new AudioContext(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'square';
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      audio.current = {ctx, osc, gain};
    }
    audio.current.ctx.resume();
    setAudioEnabled(!audioEnabled);
  };
  /* Everything the extracted panels read; see context.js */
  const workbench = {
    performanceMode,
    choosePerformance,
    device,
    profile,
    resolution,
    audioEnabled,
    backend,
    cameraTools,
    change,
    choose,
    compiled,
    connectNodes,
    current,
    deleteSelection,
    diagnostics,
    dock,
    drawer,
    duplicate,
    editingWire,
    editorPanel,
    enableAudio,
    error,
    exportProject,
    fileName,
    full,
    glass,
    grid,
    history,
    hover,
    importRef,
    inspectorTab,
    library,
    live,
    loadProject,
    menu,
    minimized,
    mode,
    more,
    notify,
    pair,
    panel,
    pending,
    pinInfo,
    project,
    redo,
    rotate,
    run,
    runSource,
    save,
    saveState,
    scene,
    selectBoard,
    selected,
    selectedComponent,
    selectedWire,
    send,
    serialBottom,
    serialInput,
    setCameraTools,
    setCompiled,
    setConnect,
    setDock,
    setDocs,
    setDrawer,
    setEditingWire,
    setFileName,
    setGallery,
    setGlass,
    setGrid,
    setInspectorTab,
    setLayout,
    setLibrary,
    setMenu,
    setMinimized,
    setMode,
    setMore,
    setNewFile,
    setPair,
    setPending,
    setSerialInput,
    setTools,
    sim,
    slug,
    source,
    startPanelDrag,
    terminalClick,
    toggleFull,
    undo,
    updateComponent,
    wireId,
  };
  return (
    <WorkbenchContext.Provider value={workbench}>
      <div
        className={`app theme-${project.appearance?.theme ?? 'dark'} layout-${project.layout} dock-${dock} ${drawer ? 'has-drawer' : ''} ${full ? 'immersive' : ''} ${selected.length ? 'has-selection' : ''} ${profile.glass ? '' : 'low-power'}`}
        style={{'--split': `${split}%`, '--glass-alpha': project.appearance?.opacity ?? 0.36}}
      >
        <TopBar />
        {more && <WorkspaceMenu />}
        {menu && <ProjectMenu />}
        <input
          type="file"
          accept=".json,.circuitlab,.ino,.cpp,.h,.c,.txt"
          ref={importRef}
          hidden
          onChange={importProject}
        />
        <main className="workbench">
          <div
            className="canvas-region"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const type = e.dataTransfer.getData('component');
              if (TYPES[type]) add(type, scene.current?.dropPosition?.(e));
              else for (const f of e.dataTransfer.files ?? []) importFile(f);
            }}
          >
            <div ref={sceneRoot} className="scene-canvas" />
            <div className="canvas-vignette" />
            {library && <Library onAdd={key => add(key)} onClose={() => setLibrary(false)} />}
            {(selectedComponent || selectedWire) && <Inspector key={selectedComponent?.id || wireId} />}

            <CanvasControls />
          </div>
          {project.layout !== '3d' && <EditorPanel />}
          {project.layout === 'split' && (
            <div className="split-divider" onPointerDown={startSplit}>
              <GripVertical size={16} />
            </div>
          )}
          {drawer && <DiagnosticsDrawer />}
        </main>
        <StatusBar />
        {hover && !pending && <PinTooltip />}
        {toast && (
          <div className="toast glass" role="status">
            <CheckCircle2 size={15} />
            {toast}
          </div>
        )}
        {connect && <ConnectModal />}
        {gallery && <ProjectGallery onLoad={loadProject} onClose={() => setGallery(false)} />}
        {tools && <ToolsModal onClose={() => setTools(false)} />}
        {newFile && <NewFileModal />}
        {docs && <DocsModal />}
      </div>
    </WorkbenchContext.Provider>
  );
}

export default App;
