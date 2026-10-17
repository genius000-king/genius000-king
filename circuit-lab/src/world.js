import {Circuit,Simulator} from './engine.js';
import {compile} from './compiler.js';
import {sourceForBoard,isBoard,profileOf} from './data.js';
import {VirtualNetwork} from './network.js';
export class LabWorld {
 constructor(project){this.project=project;this.circuit=new Circuit(project);this.devices=new Map();this.network=new VirtualNetwork();this.time=0;this.running=false;this.signature='';this.update(project);this.network.enabled=id=>{const s=this.devices.get(id);return !!s&&s.boot==='running';};}
 get active(){return this.devices.get(this.project.activeBoard)??this.devices.values().next().value;}
 get program(){return this.active?.program;}
 get vm(){return this.active?.vm;}
 update(project){this.project=project;const boards=project.components.filter(isBoard);for(const [id,s]of this.devices){const b=boards.find(c=>c.id===id);if(!b||b.type!==s.boardType){this.devices.delete(id);this.network.nodes.delete(id);}}this.circuit.project=project;
  for(const board of boards){let s=this.devices.get(board.id);if(!s){s=new Simulator(project,board.id,this.circuit);s.boardType=board.type;s.network=profileOf(board).wifi?this.network:null;s.world=this;s.time=this.time;this.devices.set(board.id,s);}s.project=project;}
  this.circuit.sharedHardware={boards:Object.fromEntries(this.devices)};const signature=JSON.stringify([project.components.map(c=>[c.id,c.type,c.params]),project.wires.map(w=>[w.a,w.b]),project.config?.precision]);if(signature!==this.signature){this.signature=signature;this.circuit.rebuild();this.circuit.step(this.circuit.sharedHardware,this.time);}
 }
 compile(source){if(!this.active)throw Error('Add a microcontroller board to compile firmware.');return this.active.compile(source);}
 start(){const programs=new Map();for(const [id,s]of this.devices){try{programs.set(id,compile(sourceForBoard(this.project,id),{profile:s.profile}));}catch(e){e.message=`${s.board().name}: ${e.message}`;e.board=id;throw e;}}if(!programs.size)throw Error('Add a microcontroller board before running firmware.');this.network.reset();this.time=0;this.circuit.resetState();for(const [id,s]of this.devices){s.program=programs.get(id);s.start();}this.running=true;}
 stop(){this.running=false;for(const s of this.devices.values())s.stop();}
 reset(){const running=this.running;this.network.reset();this.time=0;this.circuit.resetState();for(const s of this.devices.values())s.reset();this.running=running;for(const s of this.devices.values())if(s.vm)s.boot=s.bootState();}
 tick(ms=1){for(let i=0;i<ms;i++){this.network.tick(this.time);for(const s of this.devices.values()){if(s.vm||s.boot==='reset held'){s.tick(1);}else s.time++;}const all=[...this.devices.values()];for(const s of all)s.deliverUart(all);this.time++;this.network.tick(this.time);this.circuit.step(this.circuit.sharedHardware,this.time);if(all.some(s=>s.boot==='runtime error'))this.running=false;}}
 serial(text){this.active?.uart.push(...Array.from(text+'\n').map(c=>c.charCodeAt(0)));}
 clear(){for(const s of this.devices.values())s.logs=[];}
 snapshot(){const active=this.active,all=Array.from(this.devices.values());return {...(active?.snapshot()??{gpio:{},logs:[],warnings:[],transactions:[],trace:[],boot:'idle',instructions:0}),...this.circuit.snapshot(),time:this.time,running:this.running,oled:Object.assign({},...all.map(s=>s.oled.screens)),gfx:Object.assign({},...all.map(s=>s.oled.gfx)),boards:Object.fromEntries(Array.from(this.devices,([id,s])=>[id,{gpio:s.gpio,boot:s.boot,time:s.time,name:s.board()?.name,profile:s.profile.key,uartActivity:s.uartActivity}])),warnings:[...new Set(all.map(s=>s.warnings).flat())],network:this.network.snapshot()};}
}
