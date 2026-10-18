/** Properties, live readouts and pins of the selected part or wire. */
import {X, RotateCw, RotateCcw, Info, Plus, Copy, Layers, Trash2, Link2, Unplug} from 'lucide-react';
import {isBoard, profileOf} from '../../engines/catalog/boards.js';
import {TYPES, terminals, ref} from '../../engines/catalog/types.js';
import {IconButton} from '../common/IconButton.jsx';
import {BoardInfo} from '../panels/BoardInfo.jsx';
import {PartControls} from '../panels/PartControls.jsx';
import {Thumb} from '../panels/Thumb.jsx';
import {useWorkbench} from './context.js';

export default function Inspector() {
  const {
    audioEnabled,
    change,
    choose,
    deleteSelection,
    duplicate,
    enableAudio,
    inspectorTab,
    live,
    mode,
    pending,
    pinInfo,
    project,
    rotate,
    scene,
    selected,
    selectedComponent,
    selectedWire,
    setConnect,
    setEditingWire,
    setInspectorTab,
    setMode,
    setPair,
    setPending,
    sim,
    terminalClick,
    updateComponent,
    wireId,
  } = useWorkbench();
  return (
    <aside className="inspector glass">
      <div className="panel-title">
        <span>{selected.length > 1 ? `${selected.length} selected` : 'Inspector'}</span>
        <IconButton icon={X} label="Close inspector" onClick={() => choose([])} />
      </div>
      {selectedComponent ? (
        <>
          <div className="inspector-identity">
            <div className="inspector-art">
              <Thumb type={selectedComponent.type} size={64} />
            </div>
            <div>
              <div className="eyebrow">{TYPES[selectedComponent.type].category}</div>
              <h3>
                {isBoard(selectedComponent) ? profileOf(selectedComponent).name : selectedComponent.name}
              </h3>
              <div className="model-caption">
                {isBoard(selectedComponent)
                  ? profileOf(selectedComponent).mcu
                  : TYPES[selectedComponent.type].subtitle}
              </div>
            </div>
          </div>
          {pinInfo && (
            <div className="pin-detail">
              <strong>{pinInfo.label}</strong>
              <p>{pinInfo.info}</p>
              <b>{(sim.voltages[pinInfo.node] ?? 0).toFixed(3)} V</b>
              <div>
                <button
                  onClick={() => {
                    scene.current?.traceNet(pinInfo.node, sim.netIndex);
                  }}
                >
                  Trace net
                </button>
                <button
                  onClick={() => {
                    setMode('wire');
                    setPending(pinInfo.node);
                  }}
                >
                  Connect
                </button>
              </div>
            </div>
          )}
          <div className="inspector-tabs">
            <button
              className={inspectorTab === 'properties' ? 'selected' : ''}
              onClick={() => setInspectorTab('properties')}
            >
              Properties
            </button>
            <button
              className={inspectorTab === 'pins' ? 'selected' : ''}
              onClick={() => setInspectorTab('pins')}
            >
              Terminals <span>{terminals(selectedComponent).length}</span>
            </button>
          </div>
          <div className="inspector-content">
            {inspectorTab === 'properties' ? (
              <>
                <details className="inspector-group" open>
                  <summary>
                    {isBoard(selectedComponent)
                      ? 'Board information'
                      : TYPES[selectedComponent.type].category}
                  </summary>
                  {isBoard(selectedComponent) ? (
                    <BoardInfo c={selectedComponent} sim={sim} update={updateComponent} />
                  ) : (
                    <PartControls
                      c={selectedComponent}
                      live={live}
                      update={updateComponent}
                      time={sim.time}
                      audioEnabled={audioEnabled}
                      onAudio={enableAudio}
                      display={sim.oled?.[selectedComponent.id]}
                    />
                  )}
                </details>
                <details
                  className="inspector-group transform-group"
                  open={mode === 'translate' || mode === 'rotate'}
                >
                  <summary>
                    Transform <span>mm / °</span>
                  </summary>
                  <div className="transform-label">Position</div>
                  <div className="axis-inputs">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <label key={axis}>
                        <span className={'axis-' + axis.toLowerCase()}>{axis}</span>
                        <input
                          aria-label={`Position ${axis}`}
                          type="number"
                          step="1"
                          value={Number(selectedComponent.position[i].toFixed(1))}
                          onChange={e => {
                            const position = [...selectedComponent.position];
                            position[i] =
                              i === 1 ? Math.max(0, Number(e.target.value)) : Number(e.target.value);
                            updateComponent(selectedComponent.id, {position});
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="transform-label">Rotation</div>
                  <div className="axis-inputs">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <label key={axis}>
                        <span className={'axis-' + axis.toLowerCase()}>{axis}</span>
                        <input
                          aria-label={`Rotation ${axis}`}
                          type="number"
                          step="15"
                          value={Math.round((selectedComponent.rotation[i] * 180) / Math.PI)}
                          onChange={e => {
                            const rotation = [...selectedComponent.rotation];
                            rotation[i] = (Number(e.target.value) * Math.PI) / 180;
                            updateComponent(selectedComponent.id, {
                              rotation,
                              position: [
                                selectedComponent.position[0],
                                i === 1
                                  ? selectedComponent.position[1]
                                  : Math.max(selectedComponent.position[1], 8),
                                selectedComponent.position[2],
                              ],
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="rotation-actions">
                    <button onClick={() => rotate(1, 90)}>
                      <RotateCw size={13} />
                      90°
                    </button>
                    <button onClick={() => rotate(0, 180)}>
                      <RotateCcw size={13} />
                      Flip 180°
                    </button>
                    <button
                      title="Reset transform"
                      onClick={() =>
                        updateComponent(selectedComponent.id, {
                          rotation: [0, 0, 0],
                          position: [
                            ...selectedComponent.position.slice(0, 1),
                            0,
                            selectedComponent.position[2],
                          ],
                        })
                      }
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </details>
                <div className="inspector-note">
                  <Info size={12} />
                  <span>
                    {isBoard(selectedComponent)
                      ? 'Outline, header pitch and pin order from the cited references. Small parts are approximated.'
                      : 'Package dimensions follow common datasheet outlines; electrical model documented in Reference.'}
                  </span>
                </div>
              </>
            ) : (
              <div className="pin-list">
                {terminals(selectedComponent).map(t => {
                  const node = ref(selectedComponent, t.id),
                    connected = project.wires.some(w => w.a === node || w.b === node);
                  return (
                    <button
                      title={t.info || t.id}
                      key={t.id}
                      className={pending === node ? 'pending' : ''}
                      onClick={() => {
                        setMode('wire');
                        terminalClick(node);
                      }}
                    >
                      <span className={connected ? 'pin-dot connected' : 'pin-dot'} />
                      <b>{t.label || t.id}</b>
                      <span>{(sim.voltages[node] ?? 0).toFixed(2)} V</span>
                      <Plus size={11} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="inspector-bottom">
            <button onClick={duplicate}>
              <Copy size={13} />
              Duplicate
            </button>
            {selected.length > 1 && (
              <button
                onClick={() =>
                  change(p => {
                    p.components.forEach(c => {
                      if (selected.includes(c.id)) c.position[2] = selectedComponent.position[2];
                    });
                    return p;
                  })
                }
              >
                <Layers size={13} />
                Align
              </button>
            )}
            <IconButton icon={Trash2} label="Delete selection" onClick={deleteSelection} />
          </div>
        </>
      ) : (
        <>
          <div className="wire-title">
            <span style={{background: selectedWire.color}} />
            <h3>Jumper wire</h3>
          </div>
          <div className="inspector-content">
            <div className="section-label">CONNECTION</div>
            <div className="connection-label">{selectedWire.a.replace(':', ' / ')}</div>
            <div className="connection-line" />
            <div className="connection-label">{selectedWire.b.replace(':', ' / ')}</div>
            <div className="data-row">
              <span>Net voltage</span>
              <b>{(sim.voltages[selectedWire.a] ?? 0).toFixed(3)} V</b>
            </div>
            <details className="inspector-group">
              <summary>Routing</summary>
              <div className="wire-swatches">
                {[
                  '#c8463a',
                  '#2b2b30',
                  '#d9822b',
                  '#d7b23a',
                  '#3f9a52',
                  '#3a6fd0',
                  '#8a5ad0',
                  '#8d93a1',
                  '#d9d9de',
                ].map(col => (
                  <button
                    key={col}
                    aria-label={`Wire color ${col}`}
                    style={{background: col}}
                    className={selectedWire.color === col ? 'selected' : ''}
                    onClick={() =>
                      change(p => {
                        p.wires.find(w => w.id === wireId).color = col;
                        return p;
                      })
                    }
                  />
                ))}
              </div>
              <label className="parameter-row">
                Wire color
                <input
                  type="color"
                  value={selectedWire.color}
                  onChange={e =>
                    change(p => {
                      p.wires.find(w => w.id === wireId).color = e.target.value;
                      return p;
                    })
                  }
                />
              </label>
              <label className="slider-label">
                Route height<b>{(selectedWire.lift ?? 10).toFixed(0)} mm</b>
              </label>
              <input
                aria-label="Wire height"
                className="range"
                type="range"
                min="2"
                max="50"
                value={selectedWire.lift ?? 10}
                onChange={e =>
                  change(p => {
                    Object.assign(
                      p.wires.find(w => w.id === wireId),
                      {lift: Number(e.target.value), route: 'manual'}
                    );
                    return p;
                  }, false)
                }
              />
              <div className="wire-route-actions">
                <button
                  className="small-action"
                  onClick={() =>
                    change(p => {
                      const w = p.wires.find(w => w.id === wireId);
                      w.route = 'manual';
                      w.points ??= [{x: w.bendX ?? 0, y: w.lift ?? 10, z: w.bendZ ?? 0}];
                      if (w.points.length < 8) w.points.push({x: 0, y: w.lift ?? 10, z: 5});
                      return p;
                    })
                  }
                >
                  <Plus size={13} />
                  Add bend
                </button>
                <button
                  className="small-action"
                  onClick={() =>
                    change(p => {
                      const w = p.wires.find(w => w.id === wireId);
                      delete w.points;
                      delete w.bendX;
                      delete w.bendZ;
                      w.route = 'auto';
                      return p;
                    })
                  }
                >
                  <RotateCcw size={13} />
                  Auto route
                </button>
              </div>
              <p className="inline-note">
                {selectedWire.route === 'manual' || selectedWire.points?.length
                  ? 'Manual route · drag bends, Shift to lift.'
                  : 'Automatic clearance and crossing heights.'}
              </p>
            </details>
            <button
              className="small-action"
              onClick={() => {
                setPair([selectedWire.a, selectedWire.b]);
                setEditingWire(selectedWire.id);
                setConnect(true);
              }}
            >
              <Link2 size={14} />
              Reconnect terminals
            </button>
          </div>
          <div className="inspector-bottom">
            <button className="danger-text" onClick={deleteSelection}>
              <Unplug size={14} />
              Disconnect wire
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
