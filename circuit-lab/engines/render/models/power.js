import * as THREE from 'three';
import {box, mat, cyl, silver, text, line, pcbBoard, elcap, tin, smdR, smdC, ledSmd, plate, polyline, sphere} from '../geo.js';
import {to220, pad, pinUp, INK, rbox, trimmer3296, solarTexture, standing, roundLead} from './kit.js';

export const powerModels = {
regulator(g,c){to220(g,c.params.model);},
battery(g,c){box(g,26.5,46,17.5,0,23,0,mat('#373d39',.5,.34));box(g,26.7,12,17.6,0,6.1,0,mat('#b59862',.7,.32));box(g,25,1,16,0,46.5,0,mat('#343935'));cyl(g,2.1,2.4,-5,48,0,silver());cyl(g,3,2.4,5,48,0,silver(),6);cyl(g,1.8,.1,5,49.25,0,mat('#303a34'));text(g,'9V',0,47.1,5.8,6,2);const b=text(g,'BATTERY',0,0,0,18,4,'#d5d6c5');b.rotation.set(0,0,0);b.position.set(0,26,8.85);},
aapack(g,c){const n=c.params.cells,w=n*14.5+3;box(g,w,15,58,0,7.5,0,mat('#1a1a1c',.05,.55));for(let i=0;i<n;i++){const x=(i-(n-1)/2)*14.5;const cell=cyl(g,7,50,x,9,0,mat('#3a8f4a',.2,.4),24);cell.rotation.x=Math.PI/2;const cap=cyl(g,7.05,6,x,9,(i%2?1:-1)*20,mat('#c9a14a',.7,.35),24);cap.rotation.x=Math.PI/2;const nub=cyl(g,2.2,1.2,x,9,(i%2?-1:1)*25.4,silver(),12);nub.rotation.x=Math.PI/2;}for(const [x,col]of [[-2.54,'#c8302a'],[2.54,'#1d1d1f']])line(g,[[x*2,6,28],[x,3,31],[x,1.2,34]],mat(col,.05,.5),.6);text(g,`${n} × AA · ${(n*1.5).toFixed(1)} V`,0,15.05,0,w*.7,3,'#d8d8de');},
lipo(g,c){box(g,21,10,77,0,5,0,mat('#1a1a1c',.05,.55));const cell=cyl(g,9.2,65,0,10.5,0,mat('#2a62c8',.25,.35),28);cell.rotation.x=Math.PI/2;const cap=cyl(g,9.25,2,0,10.5,-32.5,silver(),28);cap.rotation.x=Math.PI/2;text(g,'18650  3.7 V',0,19.75,0,12,3,'#eef2ff',36,Math.PI/2);for(const [x,col]of [[-2.54,'#c8302a'],[2.54,'#1d1d1f']])line(g,[[x*2,6,38],[x,3,41],[x,1.2,44]],mat(col,.05,.5),.6);},
lm317(g){to220(g,'LM317T');},
buck(g,c){/* LM2596S DC-DC module: 43 × 21 blue PCB, TO-263-5 LM2596S, 47 µH shielded inductor, SS34, 220 µF caps, 3296W trimmer */const top=pcbBoard(g,43,21,'#1b4fae',{y:1,r:.8});
  for(const [x,z,l]of [[-20.32,-6.35,'IN+'],[-20.32,6.35,'IN-'],[20.32,-6.35,'OUT+'],[20.32,6.35,'OUT-']]){pad(g,x,z,top,1.25,.55);pinUp(g,x,z,top+1.4);text(g,l,x+(x<0?3.6:-3.8),top+.02,z+(z<0?-2.8:2.8),4.4,1.3,'#eef2fb',36,0,700,'sans-serif');}
  elcap(g,-15.6,top,-2.5,4,11,'#1a1a1d','220µF 35V',Math.PI/2);elcap(g,15.5,top,-2.5,3.15,11,'#1a1a1d','220µF 16V',-Math.PI/2);
  const ic=new THREE.Group();ic.position.set(-7,top,4.3);g.add(ic);box(ic,10.1,.6,7.6,0,.3,-.3,mat('#c9ccd0',.85,.3));box(ic,10.1,4.4,8.3,0,2.2,.4,mat('#19191b',.05,.55));text(ic,'LM2596S',0,4.42,-.6,8,1.5,INK);text(ic,'-ADJ  P+',0,4.42,1.6,6,1.1,INK);for(let i=0;i<5;i++){const x=(i-2)*1.7;box(ic,.8,.25,2.2,x,.4,5.6,tin());}
  rbox(g,12,7,12,4,top+3.5,-3.5,mat('#1c1c1f',.15,.6),1.2);cyl(g,4.6,.08,4,top+7.02,-3.5,mat('#2a2a2e',.2,.4),32);text(g,'470',4,top+7.1,-3.5,5,2,'#d8d8de',36,0,700);for(const s of [-1,1])box(g,2.4,1,1.2,4+s*6.3,top+.5,-3.5,tin());
  box(g,4.3,2.1,2.6,4,top+1.05,6.6,mat('#202022',.05,.55));box(g,.6,.03,2.4,5.5,top+2.12,6.6,mat('#c9c9cf'));text(g,'SS34',3.6,top+2.13,6.6,2.6,1,INK);
  trimmer3296(g,-7.2,top,-7);smdR(g,-1,top,7.6,Math.PI/2);smdC(g,13,top,4);smdR(g,13,top,6.2);g.userData.buckLed=ledSmd(g,9.6,top,8,'#ff2a1f',1.6);text(g,'LM2596',-12,top+.02,9.4,6,1.2,'#eef2fb',36,0,700,'sans-serif');},
solar(g,c){/* 6 V 1 W epoxy mini panel: 110 × 60 × 3, 12 polycrystalline cells (6 × 2) in series */plate(g,110,60,2.9,0,mat('#121316',.1,.45),1.6);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(106,56),new THREE.MeshPhysicalMaterial({map:solarTexture(),metalness:.25,roughness:.32,clearcoat:1,clearcoatRoughness:.04}));face.rotation.x=-Math.PI/2;face.position.y=2.92;face.receiveShadow=true;g.add(face);
  text(g,'6V 1W',48,2.94,29,4,1.2,'#b9bdc4',36,0,700,'sans-serif');cyl(g,3,1.2,0,.6,26,mat('#0e0e10',.05,.6),20);
  for(const [s,col]of [[-1,'#c8302a'],[1,'#1d1d1f']]){line(g,[[s*1.4,1.1,26.5],[s*1.8,1.05,29.5],[s*2.54,1,31.5],[s*2.54,1,32.8]],mat(col,.05,.5),.55);polyline(g,[[s*2.54,1,32.6],[s*2.54,1,34]],tin(),.3);}},
fuse(g,c){const model=c.params.model??'',ptc=/PTC/.test(model);
  if(ptc){/* Bourns MF-R050 radial PTC: 7.4 wide × 3 thick dipped disc, leads bent out to the holder footprint */const d=sphere(g,3.7,0,8.2,0,mat('#d1c23a',.05,.42),28,18);d.scale.set(1,1.08,.42);const neck=sphere(g,1.6,0,4.6,0,mat('#d1c23a',.05,.42),16,10);neck.scale.set(1.2,.9,.55);standing(text(g,'R050',0,8.8,1.62,4.4,1.5,'#3a3410',36,0,700));standing(text(g,'MF',0,6.9,1.58,3,1.1,'#3a3410',36,0,700));
   for(const s of [-1,1])roundLead(g,[[s*1.3,4.4,0],[s*2.55,2.6,0],[s*2.55,1.4,0],[s*3.3,.6,0],[s*10.9,.6,0],[s*11.43,.3,0],[s*11.43,0,0]]);return;}
  /* 5 × 20 mm glass fuse in two PCB fuse clips (clip pins at the holder footprint) */const clipM=mat('#d7d9db',.9,.25),ax=4.1;
  for(const s of [-1,1]){box(g,8.4,.35,4.6,s*7.6,1.1,0,clipM);for(const z of [-1,1]){const arm=box(g,5.2,4,.3,s*7.2,3.1,z*2.75,clipM);arm.rotation.x=-z*.16;box(g,5.2,.3,.9,s*7.2,5.05,z*2.25,clipM);}box(g,.35,3.6,3.2,s*10.65,2.9,0,clipM);box(g,.7,1.1,.5,s*11.43,.55,0,clipM);box(g,.7,1.1,.5,s*4.4,.55,0,clipM);}
  const capM=mat('#cfd2d4',.9,.26);for(const s of [-1,1]){const cap=cyl(g,2.6,6,s*7,ax,0,capM,28);cap.rotation.z=Math.PI/2;const rim=cyl(g,2.45,.3,s*10.05,ax,0,capM,28);rim.rotation.z=Math.PI/2;}
  const code=model.split(' ')[0]||'F500mA';text(g,`${code}L250V`,7,ax+2.62,0,5.4,1.1,'#6a6e72',36,0,700);text(g,'5×20',-7,ax+2.62,0,3,1.1,'#6a6e72',36,0,700);
  const glass=cyl(g,2.5,8.1,0,ax,0,new THREE.MeshPhysicalMaterial({color:'#e8f2f4',transparent:true,opacity:.28,roughness:.04,transmission:.6,clearcoat:1,depthWrite:false}),28);glass.rotation.z=Math.PI/2;
  const wireM=mat('#d9dcde',.9,.3),ok=new THREE.Group(),blown=new THREE.Group();g.add(ok);g.add(blown);blown.visible=false;
  if(/T\d/.test(code)){const pts=[];for(let i=0;i<=240;i++){const t=i/240,a=t*Math.PI*2*26;pts.push([-3.6+t*7.2,ax+Math.sin(a)*.42,Math.cos(a)*.42]);}line(ok,pts,mat('#c8b27a',.8,.35),.07);cyl(ok,.22,7.6,0,ax,0,mat('#e6e2d4',.05,.6),8).rotation.z=Math.PI/2;sphere(ok,.55,0,ax,0,mat('#c9ccce',.85,.3),12,8);
   const half=[];for(let i=0;i<=100;i++){const t=i/100,a=t*Math.PI*2*11;half.push([-3.6+t*3,ax+Math.sin(a)*.42,Math.cos(a)*.42]);}line(blown,half,mat('#3c3328',.6,.5),.07);line(blown,half.map(([x,y,z])=>[-x,y,-z]),mat('#3c3328',.6,.5),.07);cyl(blown,.22,7.6,0,ax,0,mat('#5c5244',.05,.7),8).rotation.z=Math.PI/2;}
  else{polyline(ok,[[-4.2,ax-.9,0],[4.2,ax+.9,0]],wireM,.06);polyline(blown,[[-4.2,ax-.9,0],[-.9,ax-.2,0]],wireM,.06);polyline(blown,[[1.1,ax+.25,0],[4.2,ax+.9,0]],wireM,.06);sphere(blown,.16,-.9,ax-.2,0,wireM,8,6);sphere(blown,.16,1.1,ax+.25,0,wireM,8,6);}
  const smudge=cyl(blown,2.42,3.6,.1,ax,0,new THREE.MeshStandardMaterial({color:'#2b2723',transparent:true,opacity:.55,roughness:.8,depthWrite:false}),24);smudge.rotation.z=Math.PI/2;g.userData.fuseOk=ok;g.userData.fuseBlown=blown;}
};
