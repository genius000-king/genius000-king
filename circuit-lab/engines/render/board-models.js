import * as THREE from 'three';
import {BOARD} from '../catalog/esp32-devkit.js';
import {terminals} from '../catalog/types.js';
import {box, gold, mat, pcb, dark, silver, cyl, text, line} from './geo.js';

export function boardLayer(g,w,h,d,y,material){const shape=new THREE.Shape(),r=BOARD.estimated.cornerRadius;shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);for(const side of [-1,1])for(let i=0;i<19;i++){const hole=new THREE.Path();hole.absarc(side*12.7,-22.86+i*2.54,.48,0,Math.PI*2,true);shape.holes.push(hole);}const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:6}),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=y-h/2;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}

export function pin(g,x,y,z){box(g,.64,5.6,.64,x,y,z,gold());}

export function boardModel(g,c){
 boardLayer(g,BOARD.width,1.44,BOARD.length,1.5,mat('#366f56',.1,.7));boardLayer(g,BOARD.width,.08,BOARD.length,2.26,pcb());boardLayer(g,BOARD.width,.08,BOARD.length,.74,pcb());
 // Header pitch and board outline are sourced; local package details are estimates.
 for(const side of [-1,1]){box(g,2.35,2.1,48.0,side*12.7,3.4,0,dark());for(let i=0;i<19;i++){const z=-22.86+i*2.54;pin(g,side*12.7,4.2,z);const solder=new THREE.Mesh(new THREE.TorusGeometry(.6,.19,6,12),silver());solder.rotation.x=Math.PI/2;solder.position.set(side*12.7,.6,z);g.add(solder);const underside=cyl(g,.33,1.7,side*12.7,-.1,z,gold(),8);}}
 const antennaZ=-23.2;box(g,18,.8,25.5,0,2.8,-14,mat('#26423b',.2,.5));box(g,15.8,2.3,17.4,0,4.3,-10.7,silver());box(g,15.5,.1,17.1,0,5.49,-10.7,mat('#c6cbc8',.94,.29));
 text(g,'ESPRESSIF',0,5.57,-14,12,1.8,'#4a5350');text(g,'ESP32-WROOM-32E',0,5.58,-10.9,14,1.25,'#434c48');text(g,'Wi-Fi  ·  BT  ·  BLE',0,5.58,-8.5,12,1,'#65706a');text(g,'FCC  CE',0,5.58,-5.8,6,1.3,'#48544d');
 // Antenna meander is approximate visual artwork, not an RF model.
 line(g,[[-7,3.3,-20.4],[-7,3.3,-24.6],[-5,3.3,-24.6],[-5,3.3,-21.7],[-3,3.3,-21.7],[-3,3.3,-24.6],[-1,3.3,-24.6],[-1,3.3,-21.7],[1,3.3,-21.7],[1,3.3,-24.6],[3,3.3,-24.6],[3,3.3,-21.7],[5,3.3,-21.7],[5,3.3,-24.6],[7,3.3,-24.6]],gold(),.2);
 for(let side of [-1,1])for(let i=0;i<14;i++)box(g,.7,.2,.7,side*8.8,3.3,-18.5+i*1.25,gold());
 // USB UART, regulator, oscillator and discrete passives are distinct meshes.
 box(g,4.7,1,4.7,0,3.0,6.7,dark());text(g,'CP2102N',0,3.57,6.7,4.3,.8,'#b4bcb6');for(let i=0;i<7;i++)for(let side of [-1,1])box(g,.4,.18,.3,side*2.7,2.65,5.1+i*.5,silver());
 for(let i=0;i<7;i++)for(const side of [-1,1])box(g,.3,.18,.4,-1.6+i*.5,2.65,6.7+side*2.7,silver());for(const [x,z]of [[-3.8,9],[3.8,9]]){box(g,1.6,.85,2.8,x,2.85,z,dark());for(const dz of [-.8,.8])box(g,.9,.18,.45,x-.9,2.45,z+dz,silver());box(g,.9,.18,.45,x+.9,2.45,z,silver());}box(g,3.8,1.5,6.2,-5.6,3.1,15.6,dark());box(g,3.5,.25,2,-5.6,4,12.5,silver());text(g,'AMS',-5.6,3.9,15,3,.8,'#a6b5ab');for(let i=0;i<3;i++)box(g,.55,.2,2,-6.6+i,2.5,19.5,silver());
 for(const [x,z,w,d]of [[5,13,2,3],[5.2,17,2,3],[-6,7,1.3,2],[5,7,1.3,2],[7,2,1,2],[-7,1,1,2],[-3,0,1,2],[2,1,1,2],[-8,17,1,2]]){box(g,w,.75,d,x,2.8,z,mat('#ad8e5d',.1,.6));box(g,w+.1,.8,.5,x,2.8,z-d/2,silver());box(g,w+.1,.8,.5,x,2.8,z+d/2,silver());}
 for(const [x,label]of [[-8,'EN'],[8,'BOOT']]){box(g,4.2,1.7,4.2,x,3.1,21.2,silver());for(const dx of [-1.5,1.5])for(const dz of [-1.5,1.5])cyl(g,.28,.12,x+dx,4,21.2+dz,silver(),8);const b=box(g,2.6,1,2.6,x,4.25,21.2,dark());b.userData.action=label.toLowerCase();text(g,label,x,2.44,17.2,4.1,1.2);}
 // Hollow-looking Micro-B receptacle: shell walls, black tongue and gold contacts.
 box(g,8,.35,5.8,0,5.35,23.7,silver());box(g,8,.35,5.8,0,2.25,23.7,silver());for(const side of [-1,1]){box(g,.35,3.1,5.8,side*3.825,3.8,23.7,silver());box(g,1.1,.25,1.6,side*4.3,2.4,22.5,silver());}box(g,6.8,2.1,.15,0,3.8,26.45,mat('#101a16'));box(g,5.8,.6,3.8,0,3.55,25,mat('#353b37'));for(let i=0;i<5;i++)box(g,.4,.15,2,-1.6+i*.8,3.95,25,gold());
 const power=box(g,1.2,.8,2,8.3,2.9,12.2,new THREE.MeshStandardMaterial({color:'#a92316',emissive:'#e53118',emissiveIntensity:.65}));power.userData.power=true;g.userData.powerMaterial=power.material;text(g,'PWR',8,2.46,14.5,3,1);
 for(const t of terminals(c))text(g,t.label,t.p[0]<0?-10:10,2.44,t.p[2],2.9,1.2,'#d2dcc5');text(g,'ESP32-DevKitC V4',0,2.44,10.6,14,1.3);
 // Underside fabrication details remain visible when flipped.
 const back=text(g,'ESP32-DevKitC V4',0,.53,1,18,2.3,'#cad5bd');back.rotation.x=Math.PI/2;for(let i=0;i<12;i++)line(g,[[-11,.56,-16+i*2.6],[-5+i*.3,.56,-16+i*2.6],[6,.56,-13+i*2.6],[11,.56,-13+i*2.6]],mat('#255541',.4,.5),.13);
}

export function breadboardModel(g){const shape=new THREE.Shape(),w=46,d=35,r=1.2;shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);for(const t of terminals({type:'breadboard'})){const x=t.p[0],z=-t.p[2],hole=new THREE.Path();hole.moveTo(x-.55,z-.65);hole.lineTo(x-.55,z+.65);hole.lineTo(x+.55,z+.65);hole.lineTo(x+.55,z-.65);hole.closePath();shape.holes.push(hole);}const body=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:4,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:1,curveSegments:8}),mat('#dddcd3',0,.58));body.rotation.x=-Math.PI/2;body.castShadow=true;body.receiveShadow=true;g.add(body);box(g,45.5,.16,1.5,0,4.06,0,mat('#aeb6aa',0,.8));box(g,44,.15,32,0,.12,0,mat('#49554a',.1,.8));for(let col=0;col<17;col++)for(const side of [-1,1])box(g,1,.12,10.4,(col-8)*2.54,1.4,side*8.9,mat('#a9a58a',.78,.42));for(let i=0;i<17;i+=2)text(g,String(i+1),(i-8)*2.54,4.16,-16,1.5,1.1,'#8b928a');for(let j=0;j<10;j++)text(g,String.fromCharCode(97+j),-22,4.16,(j<5?j-5.5:j-3.5)*2.54,1.2,1.2,'#92998f');text(g,'CIRCUIT LAB',12,4.16,16.2,14,1,'#a9b0a6');}
