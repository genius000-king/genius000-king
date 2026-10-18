// The engine layout. Each source file maps its top-level names to new modules; anything unlisted
// goes to the file's default. Classes are split into mixin modules, big objects into category files.
import {PARTS} from '../src/parts.js';
import {ELEMENTS} from '../src/elements.js';
import {PART_MODELS} from '../src/models.js';
const category=k=>PARTS[k].category.toLowerCase(),group=o=>{const g={};for(const k of Object.keys(o))(g[category(k)]??=[]).push(k);return g;};
const groups={parts:group(PARTS),elements:group(ELEMENTS),models:group(PART_MODELS)};
const cats=Object.keys(groups.parts);
const byCategory=(dir,kind,suffix)=>Object.fromEntries(Object.entries(groups[kind]).map(([c,keys])=>[`${dir}/${c}.js`,keys]));
const names=(dir,kind,suffix)=>Object.fromEntries(Object.keys(groups[kind]).map(c=>[`${dir}/${c}.js`,c+suffix]));
const all=(target,list)=>Object.fromEntries(list.map(n=>[n,target]));
export default {
 mixin:'engines/shared/mixin.js',
 moved:{'src/sim.worker.js?worker&inline':'engines/runtime/sim.worker.js?worker&inline','src/styles.css':'ui/styles.css'},
 files:{
  'src/boards.js':{default:'engines/catalog/boards.js'},
  'src/parts.js':{default:'engines/catalog/device-models.js',targets:{...all('engines/catalog/schema.js',['row','dip','num','range','select','ro','V','I','P']),...all('engines/catalog/breadboards.js',['BREADBOARD_TOP','breadboardTerminals'])},
   objects:{PARTS:{index:'engines/catalog/parts/index.js',groups:byCategory('engines/catalog/parts','parts'),names:names('engines/catalog/parts','parts','Parts')}}},
  'src/data.js':{default:'engines/catalog/types.js',targets:{...all('engines/catalog/esp32-devkit.js',['BOARD','LEFT','RIGHT','GPIO','gpioNumber','ADC1','ADC2','inputOnly','reserved','strapping','pinDescription']),...all('engines/workspace/examples.js',['BLINK','EXAMPLES','WIFI_SENDER','WIFI_RECEIVER']),...all('engines/workspace/project.js',['miniHole','newProject','validateProject','EMPTY_FIRMWARE','filesForBoard','sourceForBoard','wirelessProject'])}},
  'src/elements.js':{default:'engines/circuit/elements/junctions.js',targets:{KEYPAD:'engines/catalog/keypad.js',...all('engines/circuit/elements/sources.js',['ALKALINE','LIION','battery']),...all('engines/circuit/elements/sensing.js',['sensorR','sensorResistance','display']),...all('engines/circuit/elements/logic.js',['QUAD','HEX','gates']),...all('engines/circuit/elements/magnetics.js',['windings','invert'])},
   objects:{ELEMENTS:{index:'engines/circuit/elements/index.js',groups:byCategory('engines/circuit/elements','elements'),names:names('engines/circuit/elements','elements','Elements')}}},
  'src/engine.js':{default:'engines/circuit/circuit.js',targets:{Union:'engines/circuit/graph.js',solveMatrix:'engines/circuit/matrix.js',READ_ONLY:'engines/runtime/simulator.js',UART_PER_BYTE:'engines/runtime/serial.js',stringCall:'engines/runtime/strings.js'},
   classes:{
    Circuit:{core:'engines/circuit/circuit.js',groups:{'engines/circuit/topology.js':['rebuild','same','linked','netOf'],'engines/circuit/stepping.js':['step','pwmActive','drivers','deviceFor','substep'],'engines/circuit/board-element.js':['boardElement'],'engines/circuit/results.js':['finalize','scope','snapshot']}},
    Simulator:{core:'engines/runtime/simulator.js',groups:{'engines/runtime/pins.js':['pinName','pin','node','voltageAt','settle','read','analogPin','adcRead'],'engines/runtime/bus.js':['wireDevices','wireDevice','transaction','devState','ensureWire'],'engines/runtime/serial.js':['fmt','printf','serialWrite','serialRead','receiveUart','serialCall','deliverUart'],'engines/runtime/libraries.js':['objectFor','newObject','objectCall','lcdFrame','neoShow','dhtRead'],'engines/runtime/timing.js':['pulseWait','checkWatchers'],'engines/runtime/net-api.js':['netCall'],'engines/runtime/api.js':['call']}}}},
  'src/compiler.js':{default:'engines/firmware/codegen.js',targets:{CompileError:'engines/firmware/errors.js',...all('engines/firmware/language.js',['TYPE_WORDS','QUALIFIERS','CLASSES','LIBRARIES']),...all('engines/firmware/api.js',['CONSTANTS','FLOAT_CONSTANTS','RET','CORE','STRING_METHODS','METHODS','API','FAMILY_ONLY','apiProblem','SERIAL_PORT']),lex:'engines/firmware/lexer.js',...all('engines/firmware/types.js',['typeInfo','castValue','normalizeType','isFloatT','isIntT','RANK','arith']),Parser:'engines/firmware/parser.js',VM:'engines/firmware/vm.js'}},
  'src/devices.js':{default:'engines/runtime/i2c-devices.js',targets:{Gfx:'engines/runtime/graphics.js'}},
  'src/network.js':{default:'engines/runtime/network.js'},
  'src/world.js':{default:'engines/runtime/world.js'},
  'src/sim.worker.js':{default:'engines/runtime/sim.worker.js'},
  'src/routing.js':{default:'engines/render/routing.js'},
  'src/geo.js':{default:'engines/render/geo.js'},
  'src/thumbs.js':{default:'engines/render/thumbs.js'},
  'src/models.js':{default:'engines/render/models/kit.js',targets:{...all('engines/render/models/boards.js',['unoModel','nanoModel','picoModel','nodemcuModel','bluepillModel','largeBreadboard','boardLeds','headerDown','silkLabels'])},
   objects:{PART_MODELS:{index:'engines/render/models/index.js',lazy:true,groups:byCategory('engines/render/models','models'),names:names('engines/render/models','models','Models')}}},
  'src/scene.js':{default:'engines/render/scene.js',targets:{...all('engines/render/board-models.js',['boardLayer','pin','boardModel','breadboardModel']),...all('engines/render/components.js',['DYNAMIC_KEYS','mergeStaticMeshes','GEOMETRY_PARAMS','geometryKey','componentModel','termOf','AXIAL','FRONT','DIPS']),...all('engines/render/displays.js',['drawGfx','lcdFace']),...all('engines/render/wires.js',['INSTRUMENTS','wireTin','black14'])},
   classes:{LabScene:{core:'engines/render/scene.js',groups:{'engines/render/camera.js':['getCamera','restoreCamera','phoneView','fit','focus','view','zoom','nudgeCamera'],'engines/render/wires.js':['endpoint','terminalNormal','isHole','housingOffset','typeOf','layoutKey','benchBoxes','roundedRoute','wireCurve','manualCurve','updateWires','traceNet'],'engines/render/interaction.js':['setMode','select','refreshOutlines','cast','componentOf','attachedTo','down','move','up','setPending','dropPosition','showTerminals'],'engines/render/visuals.js':['state']}}}},
  'src/snap.js':{default:'engines/workspace/snap.js'},
  'src/exporters.js':{default:'engines/workspace/exporters.js'},
  'src/App.jsx':{default:'ui/App.jsx'},
  'src/Panels.jsx':{default:'ui/Panels.jsx'},
  'src/Editor.jsx':{default:'ui/Editor.jsx'},
  'src/ComponentArt.jsx':{default:'ui/ComponentArt.jsx'},
  'src/main.jsx':{default:'ui/main.jsx'},
  'src/projects.js':{default:'engines/projects/projects.js'},
 },
};
