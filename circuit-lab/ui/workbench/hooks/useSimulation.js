import {useEffect} from 'react';
import {isBoard} from '../../../engines/catalog/boards.js';
import {filesForBoard, sourceForBoard} from '../../../engines/workspace/project.js';

/** The simulation worker: start, messages, compile errors mapped to files, run/pause, board choice. */
export function useSimulation(wb) {
  const {
    change,
    compiled,
    current,
    initial,
    notify,
    profile,
    project,
    runSource,
    setCompiled,
    setDrawer,
    setError,
    setProject,
    setSim,
    sim,
    worker,
  } = wb;
  useEffect(() => {
    const w = new Worker(new URL('../../../engines/runtime/sim.worker.js', import.meta.url), {type: 'module'});
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
  return {send, selectBoard, source, run};
}
