import {useEffect, useState} from 'react';
import {isBoard} from '../../../engines/catalog/boards.js';
import {filesForBoard} from '../../../engines/workspace/project.js';
import {fileLine, globalLine} from '../../../engines/workspace/source-map.js';

/** Breakpoints (per board and file), the debugger's halt reports, and the commands that leave a halt. */
export function useDebugger(wb) {
  const {current, project, selectBoard, setDrawer, setProject, worker} = wb;
  const [breakpoints, setBreakpoints] = useState({}), // {boardId: {file: [line, …]}}
    [debug, setDebug] = useState(null); // the last report: line, frames, locals, globals, halted
  const activeId = p => p.activeBoard ?? p.components.find(c => isBoard(c))?.id;
  const boardId = activeId(project);
  const fileBreakpoints = breakpoints[boardId]?.[project.activeFile] ?? [];
  const toggleBreakpoint = line =>
    setBreakpoints(all => {
      const board = {...all[boardId]},
        lines = board[project.activeFile] ?? [];
      board[project.activeFile] = lines.includes(line)
        ? lines.filter(l => l !== line)
        : [...lines, line].sort((a, b) => a - b);
      return {...all, [boardId]: board};
    });
  const clearBreakpoints = () => setBreakpoints({});
  const removeBreakpoint = ({board, file, line}) =>
    setBreakpoints(all => ({
      ...all,
      [board]: {...all[board], [file]: all[board][file].filter(l => l !== line)},
    }));
  // the worker knows breakpoints as lines of each board's compiled text
  useEffect(() => {
    for (const board of project.components.filter(isBoard)) {
      const files = filesForBoard(project, board.id),
        lines = Object.entries(breakpoints[board.id] ?? {}).flatMap(([file, ls]) =>
          files[file] === undefined ? [] : ls.map(l => globalLine(files, file, l))
        );
      worker.current?.postMessage({type: 'breakpoints', board: board.id, lines});
    }
  }, [breakpoints, project.files, project.firmware, project.activeBoard]);
  /** Called by the simulation hook for every 'debug' message from the worker. */
  const onDebug = info => {
    setDebug(info);
    if (!info?.halted) return;
    const p = current.current,
      at = fileLine(filesForBoard(p, info.board), info.line);
    if (info.board !== activeId(p)) selectBoard(info.board);
    setProject(q => (q.files[at.file] === undefined ? q : {...q, activeFile: at.file}));
    setDrawer('debug');
  };
  const debugAction = action => {
    setDebug(d => d && {...d, halted: false});
    worker.current?.postMessage({type: 'debug', action});
  };
  const inspect = () => worker.current?.postMessage({type: 'inspect', board: boardId});
  // where the halted board stands, in the file the editor shows
  const halt = debug?.halted && debug.board === boardId ? fileLine(project.files, debug.line) : null;
  const pausedLine = halt?.file === project.activeFile ? halt.line : null;
  return {
    breakpoints,
    fileBreakpoints,
    toggleBreakpoint,
    clearBreakpoints,
    removeBreakpoint,
    debug,
    setDebug,
    onDebug,
    debugAction,
    inspect,
    pausedLine,
  };
}
