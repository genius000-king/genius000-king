/** Project name, new/open/import/export and examples. */
import {Save, Download, FolderOpen, Box, FileDown, FileCode2, Image} from 'lucide-react';
import {PROJECTS} from '../../engines/projects/index.js';
import {download, bomCsv, spiceNetlist} from '../../engines/workspace/exporters.js';
import {useWorkbench} from './context.js';

export default function ProjectMenu() {
  const {
    change,
    current,
    exportProject,
    importRef,
    loadProject,
    notify,
    project,
    save,
    scene,
    setGallery,
    setMenu,
    slug,
  } = useWorkbench();
  return (
    <>
      <div className="menu-backdrop" onClick={() => setMenu(false)} />
      <div className="project-menu glass">
        <label className="menu-project-label">
          PROJECT NAME
          <input value={project.name} onChange={e => change(p => ({...p, name: e.target.value}), false)} />
        </label>
        <button onClick={save}>
          <Save size={15} />
          Save project<span>⌘ S</span>
        </button>
        <button onClick={exportProject}>
          <Download size={15} />
          Export .circuitlab.json
        </button>
        <button onClick={() => importRef.current.click()}>
          <FolderOpen size={15} />
          Open file…<span>project / .ino</span>
        </button>
        <div className="menu-rule" />
        <div className="eyebrow">PROJECTS</div>
        <button
          onClick={() => {
            setGallery(true);
            setMenu(false);
          }}
        >
          <FolderOpen size={15} />
          Browse {PROJECTS.length} projects<span>gallery</span>
        </button>
        <button onClick={() => loadProject(PROJECTS[0])}>
          <Box size={15} />
          New · first light<span>ESP32</span>
        </button>
        <div className="menu-rule" />
        <div className="eyebrow">EXPORT</div>
        <button
          onClick={() => {
            download(slug() + '-bom.csv', bomCsv(current.current), 'text/csv');
            notify('Bill of materials exported');
          }}
        >
          <FileDown size={15} />
          Bill of materials<span>.csv</span>
        </button>
        <button
          onClick={() => {
            download(slug() + '.cir', spiceNetlist(current.current));
            notify('SPICE netlist exported');
          }}
        >
          <FileDown size={15} />
          SPICE netlist<span>.cir</span>
        </button>
        <button
          onClick={() => {
            for (const [n, t] of Object.entries(current.current.files)) download(n, t);
            notify('Sketch files downloaded');
          }}
        >
          <FileCode2 size={15} />
          Sketch files<span>.ino</span>
        </button>
        <button
          onClick={() => {
            const url = scene.current?.capture();
            if (url) {
              fetch(url)
                .then(r => r.blob())
                .then(b => download(slug() + '.png', b));
              notify('Workspace image saved');
            }
          }}
        >
          <Image size={15} />
          Workspace image<span>.png</span>
        </button>
      </div>
    </>
  );
}
