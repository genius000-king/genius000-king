export const sensorR=c=>c.type==='ldr'?Math.max(10,Math.min(1e7,c.params.r10*Math.pow(10/Math.max(.1,c.params.lux),c.params.gamma))):c.params.r25*Math.exp(c.params.beta*(1/(c.params.temperature+273.15)-1/298.15));

export const sensorResistance=sensorR;

export function display(k){k.R('VCC','GND',330);k.R('SDA','VCC',4700);k.R('SCL','VCC',4700);k.result(()=>{const v=k.v('VCC')-k.v('GND');const powered=k.c.type==='lcd'?v>2.7&&v<5.5:v>2.7&&v<5.5;if(!powered)k.diag('warning',`${k.c.name}: connect VCC to 3.3–5 V and GND to ground.`);return {voltage:v,powered};});}
