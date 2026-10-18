import {DIODE_MODELS, MOS_MODELS, BRIDGE_MODELS} from '../../catalog/device-models.js';
import {diodeStamp, bjt, softplus, sigmoid} from './junctions.js';

export const semiconductorsElements = {
diode(k){const m=DIODE_MODELS[k.p.model]??DIODE_MODELS['1N4007'];const read=diodeStamp(k,k.n('A'),k.n('K'),m);k.result(()=>{const {v,i}=read();if(Math.abs(i)>m.imax)k.diag('error',`${k.c.name} (${k.p.model}): ${Math.abs(i*1000).toFixed(0)} mA exceeds its ${m.imax*1000} mA rating.`);if(!m.bv&&-v>m.vrrm)k.diag('error',`${k.c.name}: reverse voltage ${(-v).toFixed(0)} V exceeds ${m.vrrm} V.`);return {voltage:v,current:i,zener:!!m.bv};});},
npn(k){bjt(k,true);},
pnp(k){bjt(k,false);},
mosfet(k){const m=MOS_MODELS[k.p.model]??MOS_MODELS.IRLZ44N,pol=m.p?-1:1,vth=Math.abs(m.vth),G=k.n('G'),D=k.n('D'),S=k.n('S');let vgsOld=0,vdsOld=0;
  const iv=(vgs,vds)=>{const s=.04,vov=softplus(vgs-vth,s),dvov=sigmoid(vgs-vth,s),cl=1+m.lambda*vds;if(vds<vov){const id=m.k*(2*vov*vds-vds*vds)*cl;return {id,gm:m.k*2*vds*dvov*cl,gds:m.k*(2*vov-2*vds)*cl+m.lambda*m.k*(2*vov*vds-vds*vds)};}const id=m.k*vov*vov*cl;return {id,gm:2*m.k*vov*dvov*cl,gds:m.lambda*m.k*vov*vov};};
  const ev=(vgs,vds)=>{if(vds>=0){const r=iv(vgs,vds);return {id:r.id,dg:r.gm,dd:r.gds};}const r=iv(vgs-vds,-vds);return {id:-r.id,dg:-r.gm,dd:r.gm+r.gds};};
  k.nl((x,st)=>{let vgs=pol*((x[G]??0)-(x[S]??0)),vds=pol*((x[D]??0)-(x[S]??0));if(Math.abs(vgs-vgsOld)>.5)vgs=vgsOld+Math.sign(vgs-vgsOld)*.5;if(Math.abs(vds-vdsOld)>1.5)vds=vdsOld+Math.sign(vds-vdsOld)*1.5;vgsOld=vgs;vdsOld=vds;
   const {id,dg,dd}=ev(vgs,vds),c=pol*(id-dg*vgs-dd*vds);st.M(D,G,dg);st.M(D,D,dd);st.M(D,S,-dg-dd);st.rhs(D,-c);st.M(S,G,-dg);st.M(S,D,-dd);st.M(S,S,dg+dd);st.rhs(S,c);st.G(G,S,1e-12);st.G(D,S,1e-9);return Math.round(vgs*1e5)+':'+Math.round(vds*1e5);});
  const body=m.p?diodeStamp(k,D,S,{is:1e-10,n:1.3}):diodeStamp(k,S,D,{is:1e-10,n:1.3});
  k.result(()=>{const vgs=pol*(k.v('G')-k.v('S')),vds=pol*(k.v('D')-k.v('S'));const id=ev(vgs,vds).id;const vov=vgs-vth;const region=vov<=0?'cutoff':Math.abs(vds)<vov?'triode (on)':'saturation';
   if(Math.abs(id)>m.idmax)k.diag('error',`${k.c.name} (${k.p.model}): ${Math.abs(id).toFixed(2)} A exceeds ${m.idmax} A.`);if(Math.abs(vds)>m.vdsmax)k.diag('error',`${k.c.name}: V DS ${Math.abs(vds).toFixed(0)} V exceeds ${m.vdsmax} V breakdown rating.`);
   if(vov>0&&vov<1.5&&Math.abs(vds)>1&&Math.abs(id)>.02)k.diag('warning',`${k.c.name}: only partially enhanced (V GS ${vgs.toFixed(2)} V, V DS ${vds.toFixed(2)} V). ${m.logic?'Raise the gate drive.':`${k.p.model} is not a logic-level MOSFET.`}`);
   if(Math.abs(vgs)>20)k.diag('error',`${k.c.name}: V GS exceeds ±20 V gate rating.`);return {vgs,vds,id,region,current:id,power:Math.abs(id*vds)};});},
bridge(k){const m=BRIDGE_MODELS[k.p.model]??Object.values(BRIDGE_MODELS)[0],dm=DIODE_MODELS[m.diode],P=k.n('+'),N=k.n('-'),A1=k.n('AC1'),A2=k.n('AC2');const d1=diodeStamp(k,A1,P,dm),d2=diodeStamp(k,A2,P,dm);diodeStamp(k,N,A1,dm);diodeStamp(k,N,A2,dm);
  k.result(()=>{const i=d1().i+d2().i;if(i>m.imax)k.diag('error',`${k.c.name}: ${i.toFixed(2)} A exceeds the ${m.imax} A rating of the ${k.p.model.split(' ')[0]}.`);return {vdc:k.v('+')-k.v('-'),current:i};});},
pc817(k){k.led('A','K',1,10);const ifPrev=Math.max(0,(k.vprev('A')-k.vprev('K')-1)/10),src=k.p.ctr*ifPrev,C=k.n('C'),E=k.n('E');
  let vOld=0;k.nl((x,st)=>{let vce=(x[C]??0)-(x[E]??0);/* the near-step saturation knee makes Newton overshoot; limit each move */if(Math.abs(vce-vOld)>.2)vce=vOld+Math.sign(vce-vOld)*.2;vOld=vce;const t=Math.tanh(vce/.15),ic=src*t,g=src*(1-t*t)/.15+1e-9;st.G(C,E,g);st.I(C,E,ic-g*vce);return Math.round(vce*1e3);});
  k.result(()=>{const iF=Math.max(0,(k.v('A')-k.v('K')-1)/10),vce=k.v('C')-k.v('E'),ic=src*Math.tanh(vce/.15);if(iF>.05)k.diag('error',`${k.c.name}: LED current ${(iF*1000).toFixed(0)} mA exceeds 50 mA. Add a series resistor.`);if(vce>35)k.diag('error',`${k.c.name}: V CE exceeds 35 V.`);return {if:iF,ic,ctr:k.p.ctr};});}
};
