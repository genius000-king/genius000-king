import {useEffect} from 'react';

/** Layout: 3D / split / floating editor, the split divider, the floating panel and the serial scroll. */
export function usePanels(wb) {
  const {
    change,
    dock,
    drawer,
    glass,
    panel,
    project,
    serialBottom,
    setLibrary,
    setMinimized,
    setMore,
    setPanel,
    setSelected,
    setSplit,
    setWireId,
    sim,
    split,
  } = wb;
  useEffect(() => {
    serialBottom.current?.scrollIntoView({block: 'nearest'});
  }, [sim.logs.length, drawer]);
  useEffect(() => {
    change(p => ({...p, editor: {...p.editor, split, dock, panel, glass}}), false);
  }, [split, dock, panel, glass]);
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
  return {setLayout, startPanelDrag, startSplit};
}
