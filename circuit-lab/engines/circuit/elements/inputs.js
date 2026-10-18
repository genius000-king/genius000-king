import {KEYPAD} from '../../catalog/keypad.js';
import {ELEMENTS} from './index.js';

export const inputsElements = {
button(k){const p=k.p;let closed=p.pressed;if(p.lastChange!==undefined&&k.t-p.lastChange<(p.bounce??0))closed=p.pressed?(Math.floor((k.t-p.lastChange)*2)%2===0):false;if(closed)k.R('1','2',.2);k.result(()=>({closed}));},
switch(k){k.R('COM',k.p.position?'B':'A',.1);k.result(()=>({voltage:k.v('COM')-k.v(k.p.position?'B':'A'),closed:k.p.position?'B':'A'}));},
tilt(k){if(k.p.tilted)k.R('A','B',.5);k.result(()=>({closed:!!k.p.tilted}));},
pot(k){k.R('VCC','W',Math.max(1,k.p.resistance*(1-k.p.value)));k.R('W','GND',Math.max(1,k.p.resistance*k.p.value));k.result(()=>({voltage:k.v('W')-k.v('GND'),current:(k.v('VCC')-k.v('GND'))/k.p.resistance}));},
joystick(k){const R=k.p.resistance;for(const [axis,pin]of [['x','VRX'],['y','VRY']]){k.R('VCC',pin,Math.max(1,R*(1-k.p[axis])));k.R(pin,'GND',Math.max(1,R*k.p[axis]));}if(k.p.pressed)k.R('SW','GND',.5);k.result(()=>({x:k.v('VRX')-k.v('GND'),y:k.v('VRY')-k.v('GND')}));},
encoder(k){const d=k.digital;d.q??=0;d.next??=0;const target=Math.round((k.p.target??0)*4);k.R('CLK','VCC',10000);k.R('DT','VCC',10000);const phase=((d.q%4)+4)%4;if(phase===1||phase===2)k.R('CLK','GND',1);if(phase===2||phase===3)k.R('DT','GND',1);if(k.p.pressed)k.R('SW','GND',1);
  k.post(()=>{if(d.q!==target&&k.t>=d.next){d.q+=Math.sign(target-d.q);d.next=k.t+2;}});k.result(()=>({position:Math.round(d.q/4)}));},
keypad(k){const i=KEYPAD.indexOf(k.p.key);if(i>=0)k.R('R'+(Math.floor(i/4)+1),'C'+(i%4+1),.5);k.result(()=>({key:k.p.key}));},
trimpot(k){ELEMENTS.pot(k);},
slidepot(k){ELEMENTS.pot(k);}
};
