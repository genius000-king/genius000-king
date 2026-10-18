/** Add a source file to the active board. */
import {X} from 'lucide-react';
import {IconButton} from '../../common/IconButton.jsx';
import {useWorkbench} from '../context.js';

export default function NewFileModal() {
  const {change, fileName, notify, project, setFileName, setNewFile} = useWorkbench();
  return (
    <div className="modal-backdrop">
      <div className="modal connect-modal glass">
        <div className="modal-heading">
          <h2>A new source file.</h2>
          <IconButton icon={X} label="Close" onClick={() => setNewFile(false)} />
        </div>
        <p>Files share one compilation unit in the Lab compiler.</p>
        <input
          className="filename-input"
          value={fileName}
          onChange={e => setFileName(e.target.value)}
          aria-label="Source filename"
        />
        <button
          className="primary-button"
          onClick={() => {
            if (!/^[a-zA-Z0-9_-]+\.(ino|cpp|h)$/.test(fileName) || Object.hasOwn(project.files, fileName)) {
              notify('Choose a unique .ino, .cpp or .h filename.');
              return;
            }
            change(p => {
              p.files[fileName] = '// ' + fileName + '\n';
              p.activeFile = fileName;
              return p;
            });
            setNewFile(false);
          }}
        >
          Create file
        </button>
      </div>
    </div>
  );
}
