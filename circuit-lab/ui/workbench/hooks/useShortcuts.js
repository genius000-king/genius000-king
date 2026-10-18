import {useEffect} from 'react';

/** Keyboard shortcuts. */
export function useShortcuts(wb) {
  const {
    deleteSelection,
    duplicate,
    redo,
    run,
    save,
    scene,
    setConnect,
    setDocs,
    setMenu,
    setMode,
    setPending,
    undo,
  } = wb;
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
  return {};
}
