import * as THREE from 'three';
import {cyl, mat, resistorBands, text, elcap, copper, line, sphere} from '../geo.js';
import {roundLead, lead, eiTransformer, lathe} from './kit.js';

export const passiveModels = {
resistor(g,c){for(const s of [-1,1])roundLead(g,[[s*5.08,1,0],[s*5.08,2.4,0],[s*3.4,2.4,0]]);const body=cyl(g,1.2,6.3,0,2.4,0,mat('#d4c49a',0,.68),20);body.rotation.z=Math.PI/2;for(const [i,col]of resistorBands(c.params.resistance).entries()){const r=cyl(g,1.22,.55,[-1.9,-.9,.1,2][i],2.4,0,mat(col,.15,.55),20);r.rotation.z=Math.PI/2;}for(const s of [-1,1]){const cap=cyl(g,1.32,1.1,s*2.85,2.4,0,mat('#d4c49a',0,.68),20);cap.rotation.z=Math.PI/2;}},
capacitor(g,c){for(const x of [-1.27,1.27])roundLead(g,[[x,1,0],[x,3.5,0],[x*.6,4.2,0]]);const d=cyl(g,2.6,1.6,0,6.6,0,mat('#c86a2c',.05,.6),24);d.rotation.x=Math.PI/2;const nf=c.params.capacitance*1e9;const code=nf>=1?String(Math.round(Math.min(99,nf>=100?nf/Math.pow(10,Math.floor(Math.log10(nf))-1):nf))).padEnd(2,'0').slice(0,2)+String(Math.max(0,Math.floor(Math.log10(nf*1000))-1)):'R'+Math.round(nf*1000);const t=text(g,code,0,6.6,.85,3.6,1.6,'#2a1608');t.rotation.set(0,0,0);},
electrolytic(g,c){roundLead(g,[[-1.27,1,0],[-1.27,2,0]]);roundLead(g,[[1.27,1,0],[1.27,2,0]]);const uf=c.params.capacitance*1e6,r=uf>=470?4:uf>=100?3.15:2.5,h=uf>=470?11:uf>=100?7:5;const e=elcap(g,0,2,0,r,h,'#1d2f57',`${uf>=1?Math.round(uf):uf.toFixed(1)}µF ${c.params.rating}V`,Math.PI/2);},
inductor(g,c){for(const x of [-2.54,2.54])lead(g,x,0,1,2);cyl(g,4,1,0,2.5,0,mat('#2e2e30',.3,.6),28);cyl(g,3.4,4.5,0,5.2,0,copper(),28);for(let i=0;i<8;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(3.4,.18,6,28),copper());ring.rotation.x=Math.PI/2;ring.position.y=3.3+i*.55;g.add(ring);}cyl(g,4,1,0,7.9,0,mat('#2e2e30',.3,.6),28);text(g,`${(c.params.inductance*1000).toFixed(c.params.inductance<.01?1:0)}mH`,0,8.42,0,6,2,'#d9d9de');},
transformer(g,c){eiTransformer(g,c,false);},
transformerct(g,c){eiTransformer(g,c,true);},
toroid(g,c){/* T50-26 iron-powder ring: Ø12.7 OD × Ø7.7 ID × 4.83, lying flat, ≈15 turns of enamelled wire; both ends leave through the bore */const ri=3.85,ro=6.35,y0=.8,y1=5.63,cr=.55,ring=[];
  for(const [cx,cy,a0]of [[ro-cr,y0+cr,-Math.PI/2],[ro-cr,y1-cr,0],[ri+cr,y1-cr,Math.PI/2],[ri+cr,y0+cr,Math.PI]])for(let i=0;i<=4;i++){const a=a0+i/4*Math.PI/2;ring.push([cx+Math.cos(a)*cr,cy+Math.sin(a)*cr]);}ring.push(ring[0]);
  lathe(g,ring,mat('#d9c23a',.05,.5),48);const top=new THREE.Mesh(new THREE.RingGeometry(ri+.5,ro-.5,48),mat('#ecebe2',.02,.6));top.rotation.x=-Math.PI/2;top.position.y=y1+.004;g.add(top);
  const rc=(ri+ro)/2,yc=(y0+y1)/2,a=(ro-ri)/2+.33,b=(y1-y0)/2+.33,turns=15,t0=-Math.PI/2+.42,span=Math.PI*2-.84,pts=[],sg=v=>Math.sign(v)*Math.abs(v)**.35;
  for(let i=0;i<=turns*14;i++){const u=i/(turns*14),th=t0+u*span,ph=Math.PI-u*turns*Math.PI*2,r=rc+a*sg(Math.cos(ph)),y=yc+b*sg(Math.sin(ph));pts.push([r*Math.cos(th),y,r*Math.sin(th)]);}
  const wire=mat('#b4602c',.75,.28);line(g,pts,wire,.3);
  for(const [th,x]of [[t0,2.54],[t0+span,-2.54]]){const r=ri-.4;line(g,[[r*Math.cos(th),y0+.2,r*Math.sin(th)],[r*Math.cos(th)*.9,.35,r*Math.sin(th)*.8],[x,.32,-.4],[x,.3,0]],wire,.3);roundLead(g,[[x,.3,0],[x,0,0]]);}},
choke(g,c){/* Colour-coded axial RF choke: Ø3.5 × 10 epoxy body, bands in µH (10 µH = brown-black-black, silver ±10 %) */const uh=(c.params.inductance??1e-5)*1e6,bands=resistorBands(uh);bands[3]='#c3c7cb';const body=mat('#79b38a',.05,.42);
  for(const s of [-1,1])roundLead(g,[[s*5.08,0,0],[s*5.08,1.95,0],[s*4.95,2.5,0],[s*4.4,2.62,0]]);const b=cyl(g,1.75,8.2,0,2.62,0,body,24);b.rotation.z=Math.PI/2;for(const s of [-1,1]){const e=sphere(g,1.75,s*4.1,2.62,0,body,20,12);e.scale.x=.5;}
  bands.forEach((col,i)=>{const r=cyl(g,1.78,.75,[-2.7,-1.55,-.4,2.5][i],2.62,0,mat(col,.15,.5),24);r.rotation.z=Math.PI/2;});}
};
