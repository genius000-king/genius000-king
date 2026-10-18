import {useCallback} from 'react';

/** Project edits with undo/redo (60 steps). */
export function useHistory(wb) {
  const {current, history, notify, setHistoryVersion, setProject} = wb;
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
  return {change, updateComponent, undo, redo};
}
