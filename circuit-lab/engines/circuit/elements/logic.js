export const QUAD=[[['1A','1B'],'1Y'],[['2A','2B'],'2Y'],[['3A','3B'],'3Y'],[['4A','4B'],'4Y']];

export const HEX=[1,2,3,4,5,6].map(i=>[[i+'A'],i+'Y']);

export function gates(k,list,fn,schmitt=false){const d=k.digital;d.o??=list.map(()=>false);d.in??={};const vcc=k.vprev('VCC')-k.vprev('GND'),on=vcc>=1.8;k.R('VCC','GND',1e5);
 list.forEach(([,y],i)=>{if(on)k.S(y,'GND',d.o[i]?vcc:0,50,k.c.name+' '+y,{max:.025});else k.R(y,'GND',1e6);});
 k.post(()=>{const g=k.v('GND'),vc=k.v('VCC')-g;if(vc<1.8)return;d.bad=[];list.forEach(([ins,],i)=>{const lv=ins.map(p=>{const v=k.v(p)-g;let h;if(schmitt)h=d.in[p]?v>.4*vc:v>.6*vc;else h=v>vc/2;if(!schmitt&&v>.3*vc&&v<.7*vc)d.bad.push(p);d.in[p]=h;return h;});d.o[i]=!!fn(...lv);});});
 k.result(()=>{const vc=k.v('VCC')-k.v('GND');if(vc>.5&&vc<2)k.diag('warning',`${k.c.name}: supply ${vc.toFixed(2)} V is below the 2 V minimum.`);if(vc>6)k.diag('error',`${k.c.name}: 74HC parts are rated for 2–6 V (has ${vc.toFixed(1)} V).`);if(d.bad?.length)k.diag('warning',`${k.c.name}: ${[...new Set(d.bad)].join(', ')} between 0.3 and 0.7 × VCC; a real CMOS input is undefined there (floating or a weak divider?).`);return {state:list.map(([,y],i)=>`${y}=${d.o[i]?1:0}`).join(' ')};});}
