import {ELEMENTS} from './index.js';
import {sensorR} from './sensing.js';

export const sensorsElements = {
mic(k){k.R('VCC','GND',3300);const supply=k.vprev('VCC')-k.vprev('GND');k.S('OUT','GND',supply>2?supply/2+Math.min(k.p.amplitude,supply/2)*Math.sin(k.t/1000*k.p.frequency*Math.PI*2):0,100,'microphone');k.result(()=>({voltage:k.v('OUT')-k.v('GND')}));},
ldr(k){const r=sensorR(k.c);k.R('A','B',r);k.result(()=>{const voltage=k.v('A')-k.v('B');return {voltage,resistance:r,current:voltage/r};});},
thermistor(k){ELEMENTS.ldr(k);},
dht22(k){k.R('VCC','GND',3300);k.R('DATA','VCC',10000);k.result(()=>{const v=k.v('VCC')-k.v('GND');if(v>.5&&v<3)k.diag('warning',`${k.c.name}: DHT22 needs 3.3–6 V (has ${v.toFixed(2)} V).`);return {voltage:v,temperature:k.p.temperature,humidity:k.p.humidity};});},
hcsr04(k){const d=k.digital,vcc=k.vprev('VCC')-k.vprev('GND');k.R('VCC','GND',333);const active=d.rise!==undefined&&k.t>=d.rise&&k.t<d.fall;k.S('ECHO','GND',active?Math.max(0,vcc):0,50,'HC-SR04 echo',{max:.05});
  k.post(()=>{const g=k.v('GND'),vc=k.v('VCC')-g,trig=k.v('TRIG')-g>2;if(trig&&!d.trig)d.trigAt=k.t;if(!trig&&d.trig&&vc>=4.5&&!(d.fall>k.t)){const dist=k.p.distance;d.rise=k.t+.45;d.fall=d.rise+(dist>=2&&dist<=400?dist*.05831:38);d.echo=(d.fall-d.rise)*1000;k.edge('ECHO',1,d.rise);k.edge('ECHO',0,d.fall);}d.trig=trig;});
  k.result(()=>{const vc=k.v('VCC')-k.v('GND');if(vc>.5&&vc<4.5)k.diag('warning',`${k.c.name}: HC-SR04 needs 5 V (has ${vc.toFixed(2)} V); it will not range reliably.`);return {echo:d.echo??0,voltage:vc};});},
pir(k){const d=k.digital,vcc=k.vprev('VCC')-k.vprev('GND');k.R('VCC','GND',60000);if(k.p.motion)d.last=k.t;const on=vcc>=4.5&&d.last!==undefined&&k.t-d.last<=k.p.hold;k.S('OUT','GND',on?3.3:0,1000,'PIR output');k.result(()=>{const vc=k.v('VCC')-k.v('GND');if(vc>.5&&vc<4.5)k.diag('warning',`${k.c.name}: HC-SR501 needs 4.5–20 V (has ${vc.toFixed(2)} V).`);return {out:k.v('OUT')-k.v('GND'),detecting:on};});},
soil(k){const vcc=k.vprev('VCC')-k.vprev('GND');k.R('VCC','GND',1000);const v=vcc>2.5?(2.85-1.65*k.p.moisture/100)*Math.min(1,vcc/3.3):0;k.S('AOUT','GND',v,1000,'soil sensor');k.result(()=>({out:k.v('AOUT')-k.v('GND')}));},
mq2(k){const H=k.s.heat??0,vcc=k.vprev('VCC')-k.vprev('GND');k.R('VCC','GND',33);const Rs=50000*Math.pow(k.p.ppm/200,-.6)*(1+9*(1-H)),ao=vcc>.5?vcc*5000/(Rs+5000):0;k.S('AO','GND',ao,1000,'MQ-2 AO');k.S('DO','GND',ao>k.p.threshold*vcc?0:Math.max(0,vcc),1000,'MQ-2 DO');
  k.post(()=>{const v=k.v('VCC')-k.v('GND'),P=v*v/33;k.next.heat=H+(Math.min(1,P/.75)-H)*Math.min(1,k.h/20);});k.result(()=>{if(H<.9)k.diag('warning',`${k.c.name}: heater warming up (${(H*100).toFixed(0)} %). Readings are high until stable.`);return {heat:H,ao:k.v('AO')-k.v('GND'),current:(k.v('VCC')-k.v('GND'))/33};});},
mpu6050(k){k.R('VCC','GND',800);k.R('SCL','VCC',4700);k.R('SDA','VCC',4700);k.R('AD0','GND',4700);k.S('INT','GND',0,1000,'MPU INT');k.result(()=>({voltage:k.v('VCC')-k.v('GND'),address:k.v('AD0')-k.v('GND')>1.5?0x69:0x68,powered:k.v('VCC')-k.v('GND')>2.3}));},
ds3231(k){k.R('VCC','GND',15000);k.R('SCL','VCC',4700);k.R('SDA','VCC',4700);k.R('SQW','VCC',4700);k.result(()=>({voltage:k.v('VCC')-k.v('GND'),powered:k.v('VCC')-k.v('GND')>2.3}));},
reed(k){const d=k.digital,dist=k.p.distance;d.closed=d.closed?dist<=11:dist<8;if(d.closed)k.R('A','B',.1);k.result(()=>({closed:d.closed,state:d.closed?'closed':'open'}));},
hall(k){const d=k.digital,f=k.p.field,vcc=k.vprev('VCC')-k.vprev('GND');d.on=d.on?f>=15:f>=20;k.R('VCC','GND',1100);if(d.on&&vcc>3.5)k.R('OUT','GND',25);else k.R('OUT','GND',1e8);
  k.result(()=>{const v=k.v('VCC')-k.v('GND');if(v>.5&&v<4.5)k.diag('warning',`${k.c.name}: A3144 needs 4.5–24 V (has ${v.toFixed(2)} V).`);return {out:k.v('OUT')-k.v('GND'),on:d.on&&v>3.5};});},
irsensor(k){const vcc=k.vprev('VCC')-k.vprev('GND'),powered=vcc>=3,detected=powered&&k.p.distance<=k.p.threshold;k.R('VCC','GND',220);k.S('OUT','GND',detected?.1:Math.max(0,vcc),detected?30:10000,'FC-51 output');
  k.result(()=>({out:k.v('OUT')-k.v('GND'),detected,powered}));}
};
