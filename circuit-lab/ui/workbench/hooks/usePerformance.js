import {useEffect, useMemo} from 'react';
import {detectDevice, profileFor, writeMode} from '../../../engines/performance/index.js';

/** The device tier, the user’s graphics mode and the simulation snapshot rate that follows them. */
export function usePerformance(wb) {
  const {performanceMode, setGraphicsGeneration, setPerformanceMode, setResolution, worker} = wb;
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
  return {device, profile, choosePerformance};
}
