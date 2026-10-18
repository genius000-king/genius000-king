import * as THREE from 'three';
import {PROFILES} from '../../catalog/boards.js';
import {breadboardTerminals} from '../../catalog/breadboards.js';
import {box, black, gold, tin, text, pcbBoard, mountingHoles, femaleHeader, usbB, barrelJack, chip, dip, mat, crystal, tactile, elcap, maleHeader, ledSmd, line, usbMini, smdR, smdC, usbMicro, silver, plate} from '../geo.js';
import {IN} from './kit.js';

export function boardLeds(g,list){g.userData.boardLeds=list;}

export function headerDown(g,pins,pcbBottom,pcbTop,tail=1.5){const rows=new Map();for(const p of pins){const k=p[0].toFixed(2);if(!rows.has(k))rows.set(k,[]);rows.get(k).push(p[1]);}for(const [k,zs]of rows){zs.sort((a,b)=>a-b);box(g,2.5,2.5,zs.at(-1)-zs[0]+2.5,Number(k),pcbBottom-1.25,(zs[0]+zs.at(-1))/2,black());}for(const [x,z]of pins){box(g,.64,pcbTop+tail,.64,x,(pcbTop+tail)/2,z,gold());const pad=new THREE.Mesh(new THREE.TorusGeometry(.62,.2,6,12),tin());pad.rotation.x=Math.PI/2;pad.position.set(x,pcbTop+.1,z);g.add(pad);}}

export function silkLabels(g,pins,top,dx,color='#e8eef0',w=2.6){for(const t of pins)text(g,t.label.replace(/^GP(\d+) A\d$/,'GP$1'),t.p[0]+(t.p[0]<0?dx:-dx),top+.02,t.p[2],w,1,color);}

export function unoModel(g,c,mega=false){const prof=PROFILES[mega?'mega':'uno'],half=prof.size[0]/2,X=x=>x*IN-half,Z=y=>26.67-y*IN;const holes=(mega?[[.55,.1],[.6,2],[2.6,1.4],[2.6,.3],[3.8,.1],[3.95,2]]:[[.55,.1],[.6,2],[2.6,1.4],[2.6,.3]]).map(([x,y])=>[X(x),Z(y),1.6]);
 const top=pcbBoard(g,prof.size[0],prof.size[1],'#0e6a92',{r:1.6,holes});mountingHoles(g,top,holes.map(([x,z])=>[x,z,1.6]));
 femaleHeader(g,prof.pins.map(t=>[t.p[0],t.p[2]]),top,8.5);
 usbB(g,X(0)+8.2-6.2,top,Z(1.5));barrelJack(g,X(0)+7-1.8,top,Z(.33));
 if(mega)chip(g,14,14,1.4,X(2.1),top,Z(1.05),'ATMEGA2560',{legs:25,legSide:'all',rot:Math.PI/4});else{dip(g,28,X(1.82),top+.8,Z(.62),'ATMEGA328P-PU');box(g,37,1,10.2,X(1.82),top+.5,Z(.62),mat('#1e1e20',.05,.6));}
 chip(g,4.6,4.6,.9,X(.75),top,Z(1.45),'16U2',{legs:8,legSide:'all',pitch:.5});crystal(g,X(.86),top,Z(1.08),0,'16.000');
 const reset=tactile(g,X(.25),top,Z(1.95),6,'#c73a2a');reset.userData.action='en';
 box(g,6.6,1.6,3.6,X(.75),top+.8,Z(.42),mat('#1a1a1c'));text(g,'1117',X(.75),top+1.62,Z(.42),5,1.2,'#a9a9b2');
 elcap(g,X(.42),top,Z(.85),3,5.4,'#191919','47µ');elcap(g,X(.95),top,Z(.2),3,5.4,'#191919','47µ');
 maleHeader(g,[[X(2.55),Z(1.1)],[X(2.65),Z(1.1)],[X(2.55),Z(1)],[X(2.65),Z(1)],[X(2.55),Z(.9)],[X(2.65),Z(.9)]],top,{above:4,below:0,plastic:2.5});
 const ledL=ledSmd(g,X(.95),top,Z(1.73),'#ffb020'),ledTX=ledSmd(g,X(.95),top,Z(1.6),'#ffb020'),ledRX=ledSmd(g,X(.95),top,Z(1.5),'#ffb020'),ledON=ledSmd(g,X(mega?3.3:2.55),top,Z(1.62),'#30e060');
 text(g,'L',X(.85),top+.03,Z(1.73),1.6,1,'#e8eef0');text(g,'TX',X(.84),top+.03,Z(1.6),2,1,'#e8eef0');text(g,'RX',X(.84),top+.03,Z(1.5),2,1,'#e8eef0');text(g,'ON',X(mega?3.2:2.45),top+.03,Z(1.62),2,1,'#e8eef0');
 boardLeds(g,[{label:'ON',material:ledON},{label:'L',material:ledL},{label:'TX',material:ledTX},{label:'RX',material:ledRX}]);
 text(g,mega?'MEGA 2560':'UNO',mega?X(1.4):X(2.05),top+.03,Z(1.45),mega?20:13,5,'#f4f8fa',36,0,800,'sans-serif');text(g,'ARDUINO',mega?X(1.4):X(2.05),top+.03,Z(1.2),16,2.4,'#f4f8fa',36,0,700,'sans-serif');
 for(const t of prof.pins){const isTop=t.p[2]<0;if(t.p[0]>X(3.75))continue;text(g,t.label.replace(/^(D|A)(\d+)$/,(m,a,b)=>a==='D'?'~'.repeat(prof.pwm.includes(Number(b))?1:0)+b:a+b),t.p[0],top+.03,t.p[2]+(isTop?3.4:-3.4),2.4,1.1,'#e8eef0',36,isTop?Math.PI/2:-Math.PI/2);}
 for(let i=0;i<14;i++)line(g,[[X(.2)+i*1.4,.79,Z(1.9)],[X(.4)+i*1.6,.79,Z(.5)]],mat('#0b5576',.3,.5),.2);}

export function nanoModel(g,c){const prof=PROFILES.nano,pb=8.5,top=pcbBoard(g,18,45,'#13579b',{y:pb,r:.8});headerDown(g,prof.pins.map(t=>[t.p[0],t.p[2]]),pb,top);
 usbMini(g,0,top,-20.8,Math.PI);chip(g,7,7,1,0,top,3,'ATMEGA328P',{legs:8,legSide:'all',pitch:.8,rot:Math.PI/4});const reset=tactile(g,0,top,-7.5,3.6,'#f2f2f2');reset.userData.action='en';
 crystal(g,-4.6,top,10.5,Math.PI/2,'16M').scale.set(.45,.6,.45);box(g,6.5,1.6,3.5,4.2,top+.8,14,mat('#1a1a1c'));
 const L=ledSmd(g,-3.2,top,-13.5,'#ffb020',1.2),TX=ledSmd(g,-1,top,-13.5,'#ffb020',1.2),RX=ledSmd(g,1.2,top,-13.5,'#ffb020',1.2),ON=ledSmd(g,3.4,top,-13.5,'#30e060',1.2);boardLeds(g,[{label:'POW',material:ON},{label:'L',material:L},{label:'TX',material:TX},{label:'RX',material:RX}]);
 silkLabels(g,prof.pins,top,2.9,'#eef4f6',2.6);text(g,'NANO',0,top+.03,18,8,2,'#eef4f6',36,0,800,'sans-serif');
 for(let i=0;i<6;i++)smdR(g,-5+i*2,top,-17.5);for(let i=0;i<4;i++)smdC(g,-4+i*2.6,top,7.2,Math.PI/2);}

export function picoModel(g,c){const prof=PROFILES.pico,pb=8.5,top=pcbBoard(g,21,51,'#1c6b3d',{y:pb,thick:1,r:.6,holes:[[-5.7,-23.5,1.05],[5.7,-23.5,1.05],[-5.7,23.5,1.05],[5.7,23.5,1.05]]});headerDown(g,prof.pins.map(t=>[t.p[0],t.p[2]]),pb,top,1.2);
 for(const t of prof.pins){const pad=box(g,1.6,.08,1.4,t.p[0]+(t.p[0]<0?-.7:.7),top+.02,t.p[2],gold());}
 usbMicro(g,0,top,-24.2,Math.PI);chip(g,7,7,.9,0,top,1.5,'RP2-B2',{legs:14,legSide:'all',pitch:.4,color:'#151517'});text(g,'RP2040',0,top+.95,3.4,5,.9,'#8c8c96');
 chip(g,5.2,4,1.2,0,top,-11,'W25Q16',{legs:4,legSide:'x',pitch:1.27});const boot=tactile(g,-3.8,top,-16.2,3.4,'#f4f4f4');boot.userData.action='boot';
 const led=ledSmd(g,-6,top,-21.2,'#3ddc5b',1.2);boardLeds(g,[{label:'LED',material:led}]);box(g,3.2,.8,2.5,4.8,top+.4,8.5,silver());
 text(g,'Raspberry Pi Pico ©2020',0,top+.03,19.5,15,1.6,'#eef4ee',36,0,600,'sans-serif');for(const [i,l]of ['SWCLK','GND','SWDIO'].entries()){box(g,1.3,.08,1.3,(i-1)*2.54,top+.02,24.2,gold());}
 silkLabels(g,prof.pins,top,3.2,'#eef4ee',2.6);for(let i=0;i<8;i++)smdC(g,-5+i*1.5,top,-6,Math.PI/2);}

export function nodemcuModel(g,c){const prof=PROFILES.esp8266,pb=8.5,top=pcbBoard(g,25.6,48.3,'#1c2532',{y:pb,r:1,holes:[[-10.4,-21.6,1.5],[10.4,-21.6,1.5],[-10.4,21.6,1.5],[10.4,21.6,1.5]]});headerDown(g,prof.pins.map(t=>[t.p[0],t.p[2]]),pb,top);
 plate(g,16,24,.8,top,mat('#14161a',.1,.5),.5,[],0,-11.6);box(g,12,2.3,15,0,top+.8+1.15,-7.5,silver());text(g,'ESP8266MOD',0,top+3.15,-9,10,1.4,'#55595d');text(g,'AI-THINKER',0,top+3.15,-5.8,8,1,'#55595d');
 line(g,[[-6,top+.85,-23],[-6,top+.85,-19.5],[-4,top+.85,-19.5],[-4,top+.85,-22.5],[-2,top+.85,-22.5],[-2,top+.85,-19.5],[0,top+.85,-19.5],[0,top+.85,-22.5],[2,top+.85,-22.5],[2,top+.85,-19.5],[4,top+.85,-19.5],[4,top+.85,-22.5],[6,top+.85,-22.5]],gold(),.18);
 const esp=ledSmd(g,4.5,top+.8,-2.5,'#3d8bff',1);usbMicro(g,0,top,21.6);chip(g,5,5,.9,0,top,12,'CP2102',{legs:7,legSide:'all',pitch:.5});box(g,6.5,1.6,3.5,-6.5,top+.8,5,mat('#1a1a1c'));text(g,'1117',-6.5,top+1.62,5,5,1.1,'#a9a9b2');
 const rst=tactile(g,-7.2,top,18.4,3.6,'#202022'),fl=tactile(g,7.2,top,18.4,3.6,'#202022');rst.userData.action='en';fl.userData.action='boot';text(g,'RST',-7.2,top+.03,15.6,3,1,'#e8eef0');text(g,'FLASH',7.2,top+.03,15.6,4,1,'#e8eef0');
 const led2=ledSmd(g,-4.5,top,9,'#ff3d3d',1.2);boardLeds(g,[{label:'ESP',material:esp},{label:'LED',material:led2}]);silkLabels(g,prof.pins,top,3.1,'#e8eef0',2.6);text(g,'NodeMCU',0,top+.03,2,10,1.8,'#e8eef0',36,0,700,'sans-serif');}

export function bluepillModel(g,c){const prof=PROFILES.bluepill,pb=8.5,top=pcbBoard(g,22.86,53,'#1650a8',{y:pb,r:.8});headerDown(g,prof.pins.map(t=>[t.p[0],t.p[2]]),pb,top);
 usbMicro(g,0,top,-24.6,Math.PI);chip(g,7,7,1.4,0,top,3,'STM32F103',{legs:12,legSide:'all',pitch:.5,rot:Math.PI/4});text(g,'C8T6',0,top+1.45,4.6,4,.9,'#8c8c96');
 const reset=tactile(g,0,top,-15,3.6,'#f2f2f2');reset.userData.action='en';crystal(g,4.5,top,11,Math.PI/2,'8M').scale.set(.45,.6,.45);box(g,1.6,1,3.2,-4.5,top+.5,11,silver());
 for(const [x,col]of [[-4.5,0],[4.5,1]]){for(const dz of [-2.54,0,2.54])box(g,.64,4,.64,x+(col?0:0),top+2,17+dz,gold());}for(const x of [-4.5,4.5]){box(g,2.5,2.5,5.1,x,top+3.5,15.73,mat('#f2c230',.05,.5));}text(g,'BOOT0',-4.5,top+.03,21,4,1,'#eef2fa');text(g,'BOOT1',4.5,top+.03,21,4,1,'#eef2fa');
 for(let i=0;i<4;i++){const p=box(g,.64,.64,8,(i-1.5)*2.54,top+1.25,27,gold());}box(g,10.2,2.5,2.5,0,top+1.25,25.2,black());
 const pwr=ledSmd(g,-7,top,-19,'#ff3030',1.2),pc13=ledSmd(g,7,top,-19,'#38d65a',1.2);boardLeds(g,[{label:'PWR',material:pwr},{label:'PC13',material:pc13}]);silkLabels(g,prof.pins,top,2.9,'#eef2fa',2.6);for(let i=0;i<6;i++)smdR(g,-5+i*2,top,-10);}

export function largeBreadboard(g,kind){const full=kind==='full',w=full?165:82.5,d=54.5,h=8.5;box(g,w,h,d,0,h/2,0,mat('#ececE6',0,.62));box(g,w-2,.2,3,0,h+.05,0,mat('#d2d2cc',0,.8));
 const ts=breadboardTerminals(kind),hole=new THREE.BoxGeometry(1.2,.1,1.2),inst=new THREE.InstancedMesh(hole,mat('#2a2a2c',0,.9),ts.length),m4=new THREE.Matrix4();ts.forEach((t,i)=>{m4.makeTranslation(t.p[0],h+.02,t.p[2]);inst.setMatrixAt(i,m4);});inst.receiveShadow=true;g.add(inst);
 for(const [z,col]of [[-23.5,'#d43a32'],[-17.1,'#2f5fd0'],[17.1,'#2f5fd0'],[23.5,'#d43a32']])box(g,w-10,.08,.5,0,h+.05,z,mat(col,0,.6));
 const cols=full?63:30,c0=(cols-1)/2;for(let i=0;i<cols;i+=5)for(const z of [-15.6,15.6])text(g,String(i+1),(i-c0)*2.54,h+.06,z,2.6,1.2,'#8a8a90');for(let r=0;r<10;r++)for(const s of [-1,1])text(g,String.fromCharCode(97+r),s*((c0+1.4)*2.54),h+.06,(r<5?r-5.5:r-3.5)*2.54,1.4,1.4,'#8a8a90');
 for(const [z,l]of [[-24.6,'+'],[-16,'−'],[16,'−'],[24.6,'+']])for(const s of [-1,1])text(g,l,s*(w/2-3),h+.06,z,2,2,l==='+'?'#d43a32':'#2f5fd0');}
