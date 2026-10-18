import {diodeStamp} from './junctions.js';
import {gates, QUAD, HEX} from './logic.js';

export const icsElements = {
opamp(k){for(const u of ['1','2']){const O=k.n('OUT'+u),P=k.n('IN'+u+'+'),N=k.n('IN'+u+'-'),VCC=k.n('VCC'),GND=k.n('GND'),g=1/20,A=1e5;let lastOut=0,prevRegion='lin';k.nl((x,st)=>{const vcc=x[VCC]??0,vee=x[GND]??0,hi=vcc-1.5,lo=vee+.005;const vd=(x[P]??0)-(x[N]??0);let vt,kk,region;if(hi<=lo){vt=vee;kk=0;region='off';}else{const mid=(hi+lo)/2,lin=mid+A*vd;region=lin>hi?(prevRegion==='lo'?'lin':'hi'):lin<lo?(prevRegion==='hi'?'lin':'lo'):'lin';if(region==='hi'){vt=hi;kk=0;}else if(region==='lo'){vt=lo;kk=0;}else{vt=mid+A*vd;kk=A;}}prevRegion=region;
   const iout=g*(vt-(x[O]??0));st.M(O,O,g);st.M(O,P,-g*kk);st.M(O,N,g*kk);st.rhs(O,g*(vt-kk*vd));st.M(GND,O,-g);st.M(GND,P,g*kk);st.M(GND,N,-g*kk);st.rhs(GND,-g*(vt-kk*vd));const src=iout>1e-5&&region!=='off';if(src){st.M(VCC,O,-g);st.M(VCC,P,g*kk);st.M(VCC,N,-g*kk);st.rhs(VCC,-g*(vt-kk*vd));st.M(GND,O,g);st.M(GND,P,-g*kk);st.M(GND,N,g*kk);st.rhs(GND,g*(vt-kk*vd));}return region+(src?'+':'-');});}
  k.R('VCC','GND',7000);k.result(()=>{const vcc=k.v('VCC')-k.v('GND');if(vcc>32)k.diag('error',`${k.c.name}: supply ${vcc.toFixed(1)} V exceeds 32 V.`);return {out1:k.v('OUT1')-k.v('GND'),out2:k.v('OUT2')-k.v('GND'),supply:vcc};});},
ne555(k){const d=k.digital;d.q??=0;k.R('VCC','CTRL',5000);k.R('CTRL','GND',10000);k.R('VCC','GND',1500);const vcc=k.vprev('VCC')-k.vprev('GND');k.S('OUT','GND',d.q?Math.max(0,vcc-1.7):.1,10,'555 output',{max:.2});if(!d.q)k.R('DIS','GND',10);
  k.post(()=>{const g=k.v('GND'),vc=k.v('VCC')-g,th=k.v('CTRL')-g;let q=d.q;if(vc<4.5||k.v('RESET')-g<.7)q=0;else if(k.v('TRIG')-g<th/2)q=1;else if(k.v('THR')-g>th)q=0;if(q!==d.q){d.q=q;k.edge('OUT',q);}});
  k.result(()=>{const vc=k.v('VCC')-k.v('GND');if(vc>16)k.diag('error',`${k.c.name}: supply ${vc.toFixed(1)} V exceeds 16 V.`);if(vc>0&&vc<4.5)k.diag('warning',`${k.c.name}: the bipolar NE555 needs at least 4.5 V (has ${vc.toFixed(2)} V).`);return {out:k.v('OUT')-k.v('GND'),state:d.q?'set · output high':'reset · output low'};});},
hc595(k){const d=k.digital;d.shift??=0;d.latch??=0;d.last??={sh:0,st:0};k.R('VCC','GND',100000);const vcc=k.vprev('VCC')-k.vprev('GND'),powered=vcc>1.8;
  if(powered){if(k.vprev('OE')-k.vprev('GND')<vcc/2)for(let i=0;i<8;i++)k.S('Q'+i,'GND',(d.latch>>i)&1?vcc:0,50,'74HC595 Q'+i,{max:.035});k.S('Q7S','GND',(d.shift>>7)&1?vcc:0,50,'74HC595 Q7S',{max:.035});}
  k.post(()=>{const g=k.v('GND'),vc=k.v('VCC')-g;if(vc<1.8)return;const lv=p=>k.v(p)-g>vc/2?1:0;const sh=lv('SHCP'),stc=lv('STCP');if(!lv('MR'))d.shift=0;else if(sh&&!d.last.sh)d.shift=((d.shift<<1)|lv('DS'))&255;if(stc&&!d.last.st)d.latch=d.shift;d.last={sh,st:stc};});
  k.result(()=>({latch:d.latch.toString(2).padStart(8,'0'),bits:d.latch,powered}));},
hc00(k){gates(k,QUAD,(a,b)=>!(a&&b));},
hc02(k){gates(k,QUAD,(a,b)=>!(a||b));},
hc08(k){gates(k,QUAD,(a,b)=>a&&b);},
hc32(k){gates(k,QUAD,(a,b)=>a||b);},
hc86(k){gates(k,QUAD,(a,b)=>a!==b);},
hc04(k){gates(k,HEX,a=>!a);},
hc14(k){gates(k,HEX,a=>!a,true);},
cd4017(k){const d=k.digital;d.count??=0;d.clk??=0;const vdd=k.vprev('VDD')-k.vprev('VSS'),on=vdd>=3;k.R('VDD','VSS',1e5);const r=Math.max(200,6000/Math.max(1,vdd));
  for(let i=0;i<10;i++){if(on)k.S('Q'+i,'VSS',i===d.count?vdd:0,r,'CD4017 Q'+i,{max:.02});else k.R('Q'+i,'VSS',1e6);}if(on)k.S('CO','VSS',d.count<5?vdd:0,r,'CD4017 CO',{max:.02});
  k.post(()=>{const g=k.v('VSS'),vd=k.v('VDD')-g;if(vd<3)return;const v=pin=>k.v(pin)-g;/* Schmitt-trigger clock input */const clk=d.clk?v('CLK')>.3*vd:v('CLK')>.7*vd;if(v('MR')>vd/2)d.count=0;else if(clk&&!d.clk&&v('CE')<vd/2)d.count=(d.count+1)%10;d.clk=clk?1:0;});
  k.result(()=>({count:d.count}));},
l293d(k){const vcc1=k.vprev('VCC1')-k.vprev('GND1'),vcc2=k.vprev('VCC2')-k.vprev('GND1'),logic=vcc1>=4.5,hi=p=>k.vprev(p)-k.vprev('GND1')>2.3;k.R('VCC1','GND1',300);k.R('VCC2','GND1',3000);const out=[];
  for(const [en,a,y]of [['EN12','1A','1Y'],['EN12','2A','2Y'],['EN34','3A','3Y'],['EN34','4A','4Y']]){const enabled=logic&&hi(en),level=hi(a);if(enabled&&level)k.S('VCC2',y,1.4,.5,'L293D '+y+' high side',{max:1.2});else if(enabled)k.S(y,'GND1',1.2,.5,'L293D '+y+' low side',{max:1.2});else k.R(y,'GND1',1e6);
   diodeStamp(k,k.n(y),k.n('VCC2'),{is:1e-9,n:1.8});diodeStamp(k,k.n('GND1'),k.n(y),{is:1e-9,n:1.8});out.push(`${y}=${enabled?level?'H':'L':'Z'}`);}
  k.result(()=>{const v1=k.v('VCC1')-k.v('GND1'),v2=k.v('VCC2')-k.v('GND1');if(v1>.5&&v1<4.5)k.diag('warning',`${k.c.name}: logic supply VCC1 is ${v1.toFixed(2)} V; it needs 4.5–7 V.`);if(v2>36)k.diag('error',`${k.c.name}: motor supply exceeds 36 V.`);if(logic&&v2<4.5&&out.some(o=>!o.endsWith('Z')))k.diag('warning',`${k.c.name}: motor supply VCC2 is ${v2.toFixed(2)} V; connect 4.5–36 V for the outputs.`);return {state:out.join(' ')};});},
uln2003(k){const out=[];for(let i=1;i<=7;i++){k.R('IN'+i,'GND',4000);const on=k.vprev('IN'+i)-k.vprev('GND')>1.8;if(on)k.S('OUT'+i,'GND',.85,1.6,'ULN2003 OUT'+i,{max:.6});else k.R('OUT'+i,'GND',1e7);diodeStamp(k,k.n('OUT'+i),k.n('COM'),{is:1e-9,n:1.8});out.push(on?'■':'□');}
  k.result(()=>({state:out.join('')}));},
lm393(k){const d=k.digital;k.R('VCC','GND',5000);for(const u of ['1','2']){if(d['low'+u]&&k.vprev('VCC')-k.vprev('GND')>2)k.R('OUT'+u,'GND',60);else k.R('OUT'+u,'GND',1e8);}
  k.post(()=>{for(const u of ['1','2'])d['low'+u]=k.v('IN'+u+'-')>k.v('IN'+u+'+');});
  k.result(()=>{const vcc=k.v('VCC')-k.v('GND');if(vcc>36)k.diag('error',`${k.c.name}: supply exceeds 36 V.`);/* TI: the output is correct as long as at least one input stays within the common-mode range (0 … VCC − 1.5 V) */for(const u of ['1','2'])if(vcc>2&&k.v('IN'+u+'+')-k.v('GND')>vcc-1.5&&k.v('IN'+u+'-')-k.v('GND')>vcc-1.5)k.diag('warning',`${k.c.name}: both inputs of comparator ${u} are above VCC − 1.5 V (outside the common-mode range); its output is undefined.`);return {out1:k.v('OUT1')-k.v('GND'),out2:k.v('OUT2')-k.v('GND')};});}
};
