import {useEffect} from 'react';

/** Real fullscreen where the browser allows it, an immersive layout where it does not (iPhone). */
export function useFullscreen(wb) {
  const {full, setFull} = wb;
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
  return {toggleFull};
}
