import {isBoard} from '../../../engines/catalog/boards.js';
import {validateProject} from '../../../engines/workspace/project.js';
import {KEY} from '../storage.js';

/** Saving, exporting, importing (projects and .ino sources) and opening example projects. */
export function useProjectFiles(wb) {
  const {
    change,
    current,
    notify,
    preserveBadSave,
    project,
    scene,
    send,
    setCompiled,
    setGallery,
    setMenu,
    setSaveState,
    setSelected,
    setWireId,
  } = wb;
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
      if (project.layout === '3d') wb.setLayout('float');
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
  return {save, slug, exportProject, importFile, importProject, loadProject};
}
