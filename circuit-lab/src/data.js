import {PROFILES,isBoard,profileOf,boardPinInfo,ESP32_LEFT,ESP32_RIGHT} from './boards.js';
import {PARTS,breadboardTerminals,BREADBOARD_TOP} from './parts.js';
export {PROFILES,isBoard,profileOf} from './boards.js';
export const MM = 1; // The only millimetre → renderer conversion. All model geometry is in mm.
export const BOARD = {name:'ESP32-DevKitC V4',manufacturer:'Espressif',revision:'V4',module:'ESP32-WROOM-32E-N4',chip:'ESP32-D0WD-V3',width:27.94,length:48.26,pitch:2.54,rowSpacing:25.4,moduleSize:[18,25.5,3.1],estimated:{pcbThickness:1.6,cornerRadius:.7,headerPinWidth:.64,headerHeight:2.5,usbShell:[8,3,6],switchTravel:.25},sources:PROFILES.board.sources};
export const LEFT = ESP32_LEFT, RIGHT = ESP32_RIGHT;
export const GPIO = {VP:36,VN:39,TX:1,RX:3,SD2:9,SD3:10,CMD:11,SD1:8,SD0:7,CLK:6};
export const gpioNumber = label => label.startsWith('IO')?Number(label.slice(2)):GPIO[label];
export const ADC1 = [36,39,34,35,32,33];
export const ADC2 = [4,0,2,15,13,12,14,27,25,26];
export const inputOnly = [34,35,36,39];
export const reserved = [6,7,8,9,10,11];
export const strapping = [0,2,5,12,15];
export const pinDescription = label => boardPinInfo(PROFILES.board,PROFILES.board.pins.find(t=>t.id===label)??{id:label,label});
const BOARD_SUBTITLES={board:'Dual-core Wi-Fi + Bluetooth',uno:'The classic ATmega328P',nano:'Breadboard-sized ATmega328P',mega:'54 digital · 16 analog pins',pico:'RP2040 dual Cortex-M0+',esp8266:'ESP8266 Wi-Fi in DIP form',bluepill:'STM32F103 Cortex-M3'};
export const TYPES = {...Object.fromEntries(Object.values(PROFILES).map(b=>[b.key,{name:b.key==='board'?'ESP32 DevKit':b.name,subtitle:BOARD_SUBTITLES[b.key],spec:b.short.toUpperCase(),category:'Boards',size:b.size,params:{},board:true}])),...PARTS};
export const CATEGORIES=['All','Boards','Inputs','Sensors','Outputs','Passive','Semiconductors','ICs','Power','Instruments','Prototyping'];
export const isBreadboard = c=>!!PARTS[typeof c==='string'?c:c?.type]?.breadboard;
export const breadboardTop = c=>BREADBOARD_TOP[PARTS[c.type]?.breadboard]??0;
const termCache=new Map();
export function terminals(c){
 const prof=profileOf(c);if(prof){if(!termCache.has(prof.key))termCache.set(prof.key,prof.pins.map(t=>({...t,info:boardPinInfo(prof,t)})));return termCache.get(prof.key);}
 const def=PARTS[c.type];if(!def)return [];
 if(def.breadboard){const key='bb:'+def.breadboard;if(!termCache.has(key))termCache.set(key,breadboardTerminals(def.breadboard));return termCache.get(key);}
 if(typeof def.pins==='function')return def.pins(c).map(([id,x,y,z,info])=>({id,label:id,p:[x,y,z],info:info??id}));
 if(!termCache.has(c.type))termCache.set(c.type,def.pins.map(([id,x,y,z,info])=>({id,label:id,p:[x,y,z],info:info?`${id} · ${info}`:id})));return termCache.get(c.type);
}
export const ref = (c,p)=>`${typeof c==='string'?c:c.id}:${p}`;
export const makeComponent = (type,pos=[0,0,0],id=crypto.randomUUID())=>({id,type,name:TYPES[type].name,position:pos,rotation:[0,0,0],params:structuredClone(TYPES[type].params)});
export const BLINK = `// FIRST LIGHT\n// GPIO 2 → breadboard → 220 Ω resistor → LED → GND\n// Change the delay. Make it yours.\n\nconst int LED_PIN = 2;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(115200);\n  Serial.println("Hello, Circuit Lab.");\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  Serial.println("Light on");\n  delay(500);\n  digitalWrite(LED_PIN, LOW);\n  Serial.println("Light off");\n  delay(500);\n}\n`;
export const EXAMPLES = {blink:BLINK,button:`// Button: IO4 → terminal 1, GND → terminal 2\nvoid setup() {\n  pinMode(4, INPUT_PULLUP);\n  pinMode(2, OUTPUT);\n  Serial.begin(115200);\n}\nvoid loop() {\n  int pressed = digitalRead(4) == LOW;\n  digitalWrite(2, pressed);\n  Serial.println(pressed);\n  delay(20);\n}\n`,analog:`// Pot: VCC → 3V3, GND → GND, W → VP (GPIO 36)\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(36, INPUT);\n}\nvoid loop() {\n  int value = analogRead(36);\n  Serial.println(value);\n  delay(100);\n}\n`,oled:`// OLED: VCC → 3V3, GND → GND, SDA → IO21, SCL → IO22\n// OLED is a built-in Lab API, not the Adafruit library.\nvoid setup() {\n  Wire.begin(21, 22);\n  OLED.begin(0x3C);\n  OLED.clear();\n  OLED.println("Hello, world!");\n  OLED.println("Made in Circuit Lab");\n  OLED.display();\n}\nvoid loop() {\n  delay(100);\n}\n`,pwm:`// Averaged PWM electrical model, 8-bit resolution\nvoid setup() {\n  ledcAttach(2, 1000, 8);\n}\nvoid loop() {\n  for (int level = 0; level < 256; level += 5) {\n    ledcWrite(2, level);\n    delay(20);\n  }\n  for (int level = 255; level > 0; level -= 5) {\n    ledcWrite(2, level);\n    delay(20);\n  }\n}\n`};
EXAMPLES.lcd=`// Generic 3.3 V LCD backpack; Lab text API
void setup() {
  Wire.begin(21, 22);
  LCD.begin(0x27);
  LCD.clear();
  LCD.println("CIRCUIT LAB");
  LCD.println("Hello, hardware!");
  LCD.display();
}
void loop() { delay(100); }
`;
// The starter circuit is seated in the mini breadboard: GPIO 2 → 220 Ω → LED → GND, all through real strips.
const miniHole=(bb,col,row)=>[bb[0]+(col-9)*2.54,bb[2]+(row<5?row-5.5:row-3.5)*2.54];
export function newProject(){const bb=[26,0,13],[lx,lz]=miniHole(bb,8,4),[rx,rz]=miniHole(bb,4,2);return {version:2,name:'First light',appearance:{theme:'dark',opacity:.32},boardRevision:'Espressif ESP32-DevKitC V4 / ESP32-WROOM-32E',components:[makeComponent('board',[-27,0,-4],'esp32'),makeComponent('breadboard',bb,'breadboard'),makeComponent('led',[lx+1.27,3.3,lz],'led'),makeComponent('resistor',[rx+5.08,3.3,rz],'resistor')],wires:[{id:'wire1',a:'esp32:IO2',b:'breadboard:A4',color:'#d9822b',lift:10},{id:'wire3',a:'breadboard:A9',b:'esp32:GND3',color:'#2b2b30',lift:12},{id:'contact:led:A',a:'led:A',b:'breadboard:E8',kind:'contact'},{id:'contact:led:K',a:'led:K',b:'breadboard:E9',kind:'contact'},{id:'contact:resistor:A',a:'resistor:A',b:'breadboard:C4',kind:'contact'},{id:'contact:resistor:B',a:'resistor:B',b:'breadboard:C8',kind:'contact'}],files:{'main.ino':BLINK},activeFile:'main.ino',layout:'3d',camera:null,config:{timestep:1,speed:1,precision:5}};}
export function validateProject(raw){
 if(!raw||![1,2].includes(raw.version))throw Error('Unsupported project version. Expected Circuit Lab version 1 or 2.');
 if(!Array.isArray(raw.components)||!Array.isArray(raw.wires)||raw.components.length>250||raw.wires.length>2000)throw Error('Invalid project: maximum 250 components and 2000 wires.');
 const nodes=new Set(),ids=new Set();for(const c of raw.components){if(!TYPES[c.type]||typeof c.id!=='string'||ids.has(c.id)||c.id.includes(':'))throw Error('Invalid or duplicate component.');ids.add(c.id);for(const key of ['position','rotation'])if(!Array.isArray(c[key])||c[key].length!==3||c[key].some(n=>!Number.isFinite(n)||Math.abs(n)>10000))throw Error('Invalid component transform.');c.params={...TYPES[c.type].params,...c.params};for(const [k,v] of Object.entries(c.params))if(typeof v==='number'&&!Number.isFinite(v))throw Error(`Invalid parameter ${k}`);if(c.type==='resistor'&&c.params.resistance<=0)throw Error('Resistance must be positive.');if(c.type==='pot'&&(c.params.value<0||c.params.value>1||c.params.resistance<=0))throw Error('Invalid potentiometer.');if(c.type==='battery'&&(c.params.voltage<0||c.params.voltage>24||c.params.internalResistance<.1||c.params.maxCurrent<=0))throw Error('Invalid battery: 0–24 V and internal resistance ≥ 0.1 Ω required.');if(c.type==='ldr'&&(c.params.lux<.1||c.params.r10<=0||c.params.gamma<=0))throw Error('Invalid photoresistor.');if(c.type==='thermistor'&&(c.params.temperature<-100||c.params.temperature>200||c.params.r25<=0||c.params.beta<=0))throw Error('Invalid thermistor.');if(c.type==='switch'&&![0,1].includes(c.params.position))throw Error('Invalid switch position.');for(const ctl of TYPES[c.type].controls??[])if(ctl.type==='number'&&typeof c.params[ctl.key]==='number'&&(c.params[ctl.key]*(ctl.scale??1)<ctl.min-1e-9||c.params[ctl.key]*(ctl.scale??1)>ctl.max+1e-9))throw Error(`Invalid ${c.name} parameter: ${ctl.label}.`);if(['oled','lcd'].includes(c.type)&&(!Number.isInteger(c.params.address)||c.params.address<8||c.params.address>119))throw Error('Invalid I²C address.');terminals(c).forEach(t=>nodes.add(ref(c,t.id)));}
 const wireIds=new Set();for(const w of raw.wires){if(w.kind!==undefined&&w.kind!=='contact')throw Error('Invalid wire kind.');if(typeof w.id!=='string'||wireIds.has(w.id)||!nodes.has(w.a)||!nodes.has(w.b)||w.a===w.b)throw Error('A wire has a missing or invalid terminal.');wireIds.add(w.id);if(w.points!==undefined&&(!Array.isArray(w.points)||w.points.length>8||w.points.some(p=>!p||['x','y','z'].some(k=>!Number.isFinite(p[k])||Math.abs(p[k])>1000))))throw Error('Invalid wire route points.');if(w.lift!==undefined&&(!Number.isFinite(w.lift)||w.lift<0||w.lift>200))throw Error('Invalid wire route.');}
 if(raw.version===1){raw.files={'main.ino':raw.source||BLINK};raw.activeFile='main.ino';raw.version=2;}
 if(!raw.files||!Object.keys(raw.files).length||Object.values(raw.files).some(v=>typeof v!=='string'||v.length>200000))throw Error('Invalid firmware source files.');if(!raw.files[raw.activeFile])raw.activeFile=Object.keys(raw.files)[0];
 if(raw.firmware!==undefined){if(!raw.firmware||typeof raw.firmware!=='object'||Array.isArray(raw.firmware))throw Error('Invalid board firmware.');for(const [id,firmware]of Object.entries(raw.firmware)){if(!ids.has(id))continue;if(!firmware?.files||Object.values(firmware.files).some(v=>typeof v!=='string'||v.length>200000))throw Error('Invalid board source files.');}}if(raw.activeBoard&&!raw.components.some(c=>isBoard(c)&&c.id===raw.activeBoard))throw Error('Firmware target board is missing.');raw.layout=['3d','split','float'].includes(raw.layout)?raw.layout:'3d';raw.config={timestep:1,speed:1,precision:[1,5,20].includes(raw.config?.precision)?raw.config.precision:5};return raw;
}

export const EMPTY_FIRMWARE='void setup() {\n}\nvoid loop() {\n  delay(100);\n}\n';
export const filesForBoard=(p,id)=>id===(p.activeBoard??p.components.find(c=>isBoard(c))?.id)?p.files:p.firmware?.[id]?.files??{'main.ino':EMPTY_FIRMWARE};
export const sourceForBoard=(p,id)=>Object.entries(filesForBoard(p,id)).sort(([a],[b])=>a==='main.ino'?-1:b==='main.ino'?1:a.localeCompare(b)).map(([,text])=>text).join('\n');
export const WIFI_SENDER=`// Virtual Wi-Fi + UDP. This board creates the access point.
int state = 0;
void setup() {
  Serial.begin(115200);
  WiFi.softAP("CircuitLab", "learn1234", 6);
  UDP.begin(4210);
}
void loop() {
  state = !state;
  UDP.beginPacket("192.168.4.255", 4210);
  UDP.print(state);
  UDP.endPacket();
  Serial.println(state);
  delay(500);
}
`;
export const WIFI_RECEIVER=`// This board joins the AP and drives its wired LED.
void setup() {
  pinMode(2, OUTPUT);
  Serial.begin(115200);
  WiFi.begin("CircuitLab", "learn1234", 6);
  UDP.begin(4210);
}
void loop() {
  if (UDP.parsePacket()) {
    String message = UDP.readString();
    digitalWrite(2, message == "1");
    Serial.println(message);
  }
  delay(1);
}
`;
export function wirelessProject(){const p=newProject();p.name='Two boards · Wi-Fi';p.components[0].name='Receiver';p.components[0].position=[-15,0,0];const sender=makeComponent('board',[-65,0,-20],'sender');sender.name='Sender';p.components.push(sender);p.activeBoard='sender';p.files={'main.ino':WIFI_SENDER};p.firmware={esp32:{files:{'main.ino':WIFI_RECEIVER},activeFile:'main.ino'},sender:{files:p.files,activeFile:'main.ino'}};p.camera={position:[115,145,185],target:[-8,0,0]};return p;}
