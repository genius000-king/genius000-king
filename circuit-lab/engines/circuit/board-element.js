import {profileOf} from '../catalog/boards.js';
import {ref} from '../catalog/types.js';

// Circuit methods: boardElement
export const boardElementMethods = {
boardElement(k,hw,t,hMs){const c=k.c,prof=profileOf(c),dev=this.deviceFor(hw,c),p=c.params,L=prof.logic,gnd=prof.gnd[0];
  const src=(pin,v,r,kind,extra={})=>k.S(pin,gnd,v,r,kind,extra);
  // The board ground is the absolute reference.
  k.S(gnd,'__none__',0,1e-4,'ground');
  for(const [id,v,r,max]of prof.supplies)src(id,v,r,`${c.name} ${id.replace(/_\d$/,'')}`,{supply:true,max:max/1000});
  src(prof.reset,L,prof.resetR,'reset pull-up',{pull:true});for(const [a,b,r]of prof.extraPulls??[])k.R(a,b,r);
  if(c.type==='board')k.led('5V',gnd,1.8,2000);
  if(p.enPressed)k.R(prof.reset,gnd,.1);
  const gpio=dev?.gpio??{},pinOf=g=>prof.pins.find(t=>t.gpio===g)?.id;
  if(prof.strap==='esp32'){if(p.bootPressed)k.R('IO0',gnd,.1);for(const [label,value]of [['IO0',1],['IO2',0],['IO5',1],['IO12',0],['IO15',1]]){const pin=Number(label.slice(2));if(!gpio[pin])src(label,value*L,45000,'strapping pull',{pull:true});}}
  if(prof.strap==='esp8266'){if(p.bootPressed)k.R('D3',gnd,.1);k.R('D3','3V3_2',12000);k.R('D4','3V3_2',12000);k.R('D8',gnd,12000);}
  for(const tm of prof.pins){if(tm.gpio===undefined)continue;const s=gpio[tm.gpio];if(!s)continue;const label=tm.label;
   if(s.dac!==undefined){src(tm.id,s.dac,50,`DAC ${label}`,{gpio:tm.gpio,board:c.id});continue;}
   if(s.mode===1){let level=s.value??0;if(s.duty!==undefined){const period=s.frequency?1000/s.frequency:0;level=this.switching&&period>=4*hMs&&!s.servo?(((t/period)%1)<s.duty?1:0):s.duty;}src(tm.id,L*level,prof.outR,`GPIO ${tm.gpio}`,{gpio:tm.gpio,board:c.id,label,output:true});}
   else if(s.mode===2)src(tm.id,L,prof.pullR,`GPIO ${tm.gpio} pull-up`,{pull:true});else if(s.mode===3||s.mode===4)k.R(tm.id,gnd,prof.pullR);}
  k.result(()=>{const r={},v=p=>k.v(p)-k.v(gnd);if(c.type==='board')r.powerCurrent=Math.max(0,(v('5V')-1.8)/2000);
   r.leds=prof.leds.map(l=>{let on=0;if(l.power)on=1;else if(l.pin!==undefined){const id=pinOf(l.pin);on=id&&v(id)>prof.vih?1:0;}else if(l.gpio!==undefined){const s=gpio[l.gpio];const level=s?.mode===1?(s.duty??s.value??0):(prof.pins.some(t=>t.gpio===l.gpio)?(v(pinOf(l.gpio))>prof.vih?1:0):0);on=l.activeLow?(s?.mode===1||prof.pins.some(t=>t.gpio===l.gpio)?1-level:0):level;}else if(l.uart&&dev?.uartActivity){on=t-(dev.uartActivity[l.uart]??-1e9)<40?1:0;}return {label:l.label,color:l.color,on};});
   for(const tm of prof.pins){const pin=tm.gpio,value=v(tm.id);if(pin===undefined)continue;const limit=prof.tolerant?.includes(pin)?prof.toleranceV:prof.vmax;if(value>limit)k.diag('error',`GPIO ${pin}${tm.label!==`IO${pin}`?` (${tm.label})`:''}: ${value.toFixed(2)} V exceeds the ${limit} V limit.`);if(value<-.5)k.diag('error',`GPIO ${pin} (${tm.label}): ${value.toFixed(2)} V is below the −0.5 V limit.`);if(prof.reserved.includes(pin)&&this.connected.has(ref(c,tm.id)))k.diag('error',`GPIO ${pin} is reserved for module flash.`);}
   return r;});}
};
