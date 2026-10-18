import {useEffect} from 'react';
import {preloadScene} from '../scene-loader.js';
import {KEY} from '../storage.js';

/** The 3D scene’s life cycle and keeping it, the worker and the autosave in step with the project. */
export function useScene(wb) {
  const {
    audio,
    audioEnabled,
    callbacks,
    current,
    didCamera,
    graphicsGeneration,
    latest,
    mode,
    notify,
    pending,
    preserveBadSave,
    profile,
    project,
    scene,
    sceneRoot,
    selected,
    setBackend,
    setError,
    setSaveState,
    sim,
    simRef,
    wireId,
    worker,
  } = wb;
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
  return {};
}
