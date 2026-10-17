// Microcontroller board profiles. Millimetres are canonical; +Z points toward the viewer.
// Outline, header pitch and header order come from the cited references. Fine local
// geometry (connector bodies, chip placement, exact header x offsets) is approximate.
const IN = 25.4;
const LEFT32 = ['3V3','EN','VP','VN','IO34','IO35','IO32','IO33','IO25','IO26','IO27','IO14','IO12','GND1','IO13','SD2','SD3','CMD','5V'];
const RIGHT32 = ['GND2','IO23','IO22','TX','RX','IO21','GND3','IO19','IO18','IO5','IO17','IO16','IO4','IO0','IO2','IO15','SD1','SD0','CLK'];
const ESP_GPIO = {VP:36,VN:39,TX:1,RX:3,SD2:9,SD3:10,CMD:11,SD1:8,SD0:7,CLK:6};
const range = (n,f)=>Array.from({length:n},(_,i)=>f(i));
const pin = (id,x,y,z,gpio,label=id)=>({id,label,p:[x,y,z],gpio});
// Shield-header coordinate helper: inches from the lower-left datum of the Uno/Mega drawing.
const shield = (half,y)=>(id,xin,yin,gpio,label)=>pin(id,xin*IN-half,y,26.67-yin*IN,gpio,label);

function esp32Pins(){return [...LEFT32.map((id,i)=>pin(id,-12.7,7.1,-22.86+i*2.54,id.startsWith('IO')?Number(id.slice(2)):ESP_GPIO[id],id.replace(/GND\d/,'GND').replace(/^SD/,'D'))),...RIGHT32.map((id,i)=>pin(id,12.7,7.1,-22.86+i*2.54,id.startsWith('IO')?Number(id.slice(2)):ESP_GPIO[id],id.replace(/GND\d/,'GND').replace(/^SD/,'D')))];}
function unoPins(mega=false){
 const s=shield(mega?50.8:34.29,12.1),a=[];
 range(8,i=>a.push(s('D'+i,2.6-i*.1,2,i)));range(6,i=>a.push(s('D'+(8+i),1.74-i*.1,2,8+i)));
 a.push(s('GND2',1.14,2,undefined,'GND'),s('AREF',1.04,2),s('SDA',.94,2,undefined,'SDA'),s('SCL',.84,2,undefined,'SCL'));
 [['NC',1],['IOREF',1.1],['RESET',1.2],['3V3',1.3],['5V',1.4],['GND1',1.5],['GND3',1.6],['VIN',1.7]].forEach(([id,x])=>a.push(s(id,x,.1,undefined,id.replace(/GND\d/,'GND'))));
 const analog=mega?16:6,base=mega?54:14;range(analog,i=>a.push(s('A'+i,i<8?1.9+i*.1:2.8+(i-8)*.1,.1,base+i)));
 if(mega){range(8,i=>a.push(s('D'+(14+i),2.8+i*.1,2,14+i,['TX3','RX3','TX2','RX2','TX1','RX1','SDA','SCL'][i]+' '+(14+i))));
  a.push(s('5V2',3.8,2,undefined,'5V'),s('5V3',3.9,2,undefined,'5V'),s('GND4',3.8,.3,undefined,'GND'),s('GND5',3.9,.3,undefined,'GND'));
  range(16,r=>{a.push(s('D'+(22+r*2),3.8,1.9-r*.1,22+r*2));a.push(s('D'+(23+r*2),3.9,1.9-r*.1,23+r*2));});}
 return a;}
function nanoPins(){const left=['D13','3V3','AREF','A0','A1','A2','A3','A4','A5','A6','A7','5V','RST1','GND1','VIN'],right=['D12','D11','D10','D9','D8','D7','D6','D5','D4','D3','D2','GND2','RST2','D0','D1'];const g=id=>id[0]==='D'?Number(id.slice(1)):id[0]==='A'&&id!=='AREF'?14+Number(id.slice(1)):undefined;const lab=id=>id==='D0'?'RX0':id==='D1'?'TX1':id.replace(/(GND|RST)\d/,'$1');return [...left.map((id,i)=>pin(id,-7.62,6.6,-16.78+i*2.54,g(id),lab(id))),...right.map((id,i)=>pin(id,7.62,6.6,-16.78+i*2.54,g(id),lab(id)))];}
function picoPins(){const names=[];let gnd=0,gp=0;const leftFn=i=>[2,7,12,17].includes(i)?'GND':'GP';for(let i=0;i<20;i++){if(leftFn(i)==='GND')names.push(['GND'+(++gnd)]);else names.push(['GP'+gp,gp++]);}
 const right=[['GP16',16],['GP17',17],['GND'],['GP18',18],['GP19',19],['GP20',20],['GP21',21],['GND'],['GP22',22],['RUN'],['GP26',26,'GP26 A0'],['GP27',27,'GP27 A1'],['GND'],['GP28',28,'GP28 A2'],['ADC_VREF'],['3V3'],['3V3_EN'],['GND'],['VSYS'],['VBUS']].map(([id,g,l])=>id==='GND'?['GND'+(++gnd),undefined,'GND']:[id,g,l]);
 return [...names.map(([id,g],i)=>pin(id,-8.89,6.1,-24.13+i*2.54,g,id.replace(/GND\d/,'GND'))),...right.map(([id,g,l],i)=>pin(id,8.89,6.1,24.13-i*2.54,g,l??id))];}
function nodemcuPins(){const left=['A0','RSV1','RSV2','SD3','SD2','SD1','CMD','SD0','CLK','GND1','3V3_1','EN','RST','GND2','VIN'],right=['D0','D1','D2','D3','D4','3V3_2','GND3','D5','D6','D7','D8','RX','TX','GND4','3V3_3'];const map={A0:17,SD3:10,SD2:9,SD1:8,CMD:11,SD0:7,CLK:6,D0:16,D1:5,D2:4,D3:0,D4:2,D5:14,D6:12,D7:13,D8:15,RX:3,TX:1};const lab=id=>id.replace(/(GND|3V3|RSV)_?\d/,'$1');return [...left.map((id,i)=>pin(id,-11.43,6.6,-13.28+i*2.54,map[id],lab(id))),...right.map((id,i)=>pin(id,11.43,6.6,-13.28+i*2.54,map[id],lab(id)))];}
const stmNum = id=>{const m=/^P([ABC])(\d+)$/.exec(id);return m?{A:0,B:16,C:32}[m[1]]+Number(m[2]):undefined;};
function bluepillPins(){const h1=['VB','PC13','PC14','PC15','PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7','PB0','PB1','PB10','PB11','NRST','3V3_1','GND1','GND2'],h2=['3V3_2','GND3','5V','PB9','PB8','PB7','PB6','PB5','PB4','PB3','PA15','PA12','PA11','PA10','PA9','PA8','PB15','PB14','PB13','PB12'];const lab=id=>id.replace(/(GND|3V3)_?\d/,'$1');return [...h1.map((id,i)=>pin(id,-7.62,6.4,24.13-i*2.54,stmNum(id),lab(id))),...h2.map((id,i)=>pin(id,7.62,6.4,24.13-i*2.54,stmNum(id),lab(id)))];}
const stmConstants=()=>{const c={};for(const port of ['A','B','C'])for(let n=0;n<16;n++)c[`P${port}${n}`]={A:0,B:16,C:32}[port]+n;['PA0','PA1','PA2','PA3','PA4','PA5','PA6','PA7','PB0','PB1'].forEach((p,i)=>c['A'+i]=c[p]);c.LED_BUILTIN=c.PC13;return c;};

export const PROFILES = {
 board:{key:'board',name:'ESP32 DevKitC V4',short:'ESP32',vendor:'Espressif',mcu:'ESP32-D0WD-V3 · dual-core Xtensa LX6 · 240 MHz',memory:'4 MB flash · 520 KB SRAM',core:'esp32',family:'esp32',size:[27.94,48.26],pcb:'#123b2c',logic:3.3,vil:.825,vih:2.475,vmax:3.6,outR:40,pinMax:40,pullR:45000,pins:esp32Pins(),gnd:['GND1','GND2','GND3'],joins:[],supplies:[['3V3',3.3,.2,500],['5V',5,.2,500]],reset:'EN',resetR:10000,
  adc:{pins:[36,39,34,35,32,33,4,0,2,15,13,12,14,27,25,26],bits:12,minBits:9,maxBits:12,vref:3.3,attenuation:true},pwm:'all',pwmFreq:1000,pwmBits:8,inputOnly:[34,35,36,39],reserved:[6,7,8,9,10,11],invalid:[20,24,28,29,30,31,37,38],pulldown:true,interrupts:'all',i2c:[21,22],spi:{sck:18,miso:19,mosi:23,ss:5},uarts:{Serial:{tx:1,rx:3,usb:true},Serial2:{tx:17,rx:16}},dac:[25,26],intBits:32,doubleBits:64,wifi:true,ledc:true,maxPin:39,
  constants:{LED_BUILTIN:2,A0:36,A3:39,A4:32,A5:33,A6:34,A7:35,A10:4,A11:0,A12:2,A13:15,A14:13,A15:12,A16:14,A17:27,A18:25,A19:26,DAC1:25,DAC2:26},strap:'esp32',leds:[{label:'PWR',power:true,color:'#e53118'}],
  sources:[{title:'ESP32-DevKitC V4 user guide',url:'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html'},{title:'Official V4 dimensions',url:'https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf'},{title:'ESP32-WROOM-32E datasheet',url:'https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32e_esp32-wroom-32ue_datasheet_en.pdf'}]},
 uno:{key:'uno',name:'Arduino Uno R3',short:'Uno',vendor:'Arduino',mcu:'ATmega328P · 8-bit AVR · 16 MHz',memory:'32 KB flash · 2 KB SRAM · 1 KB EEPROM',core:'avr',family:'avr',size:[68.58,53.34],pcb:'#0f6b8f',logic:5,vil:1.5,vih:3,vmax:5.5,outR:25,pinMax:40,pinRec:20,pullR:35000,pins:unoPins(),gnd:['GND1','GND2','GND3'],joins:[['SDA','A4'],['SCL','A5'],['IOREF','5V']],supplies:[['5V',5,.15,500],['3V3',3.3,.5,150]],reset:'RESET',resetR:10000,
  adc:{pins:[14,15,16,17,18,19],channelBase:14,bits:10,fixed:true,vref:5,reference:true},pwm:[3,5,6,9,10,11],pwmFreq:490,pwmFast:[5,6],pwmBits:8,inputOnly:[],reserved:[],invalid:[],pulldown:false,interrupts:{2:0,3:1},i2c:[18,19],spi:{sck:13,miso:12,mosi:11,ss:10},uarts:{Serial:{tx:1,rx:0,usb:true}},intBits:16,doubleBits:32,maxPin:19,
  constants:{LED_BUILTIN:13,A0:14,A1:15,A2:16,A3:17,A4:18,A5:19,SS:10,MOSI:11,MISO:12,SCK:13,SDA:18,SCL:19},leds:[{label:'ON',power:true,color:'#38d65a'},{label:'L',pin:13,color:'#f5a623',buffered:true},{label:'TX',uart:'tx',color:'#f5a623'},{label:'RX',uart:'rx',color:'#f5a623'}],
  sources:[{title:'Arduino UNO R3 product reference',url:'https://docs.arduino.cc/hardware/uno-rev3/'},{title:'ATmega328P datasheet',url:'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf'}]},
 nano:{key:'nano',name:'Arduino Nano',short:'Nano',vendor:'Arduino',mcu:'ATmega328P · 8-bit AVR · 16 MHz',memory:'32 KB flash · 2 KB SRAM',core:'avr',family:'avr',size:[18,45],pcb:'#155e86',logic:5,vil:1.5,vih:3,vmax:5.5,outR:25,pinMax:40,pinRec:20,pullR:35000,pins:nanoPins(),gnd:['GND1','GND2'],joins:[['RST1','RST2']],supplies:[['5V',5,.2,500],['3V3',3.3,1,50]],reset:'RST1',resetR:10000,
  adc:{pins:[14,15,16,17,18,19,20,21],channelBase:14,bits:10,fixed:true,vref:5,reference:true,analogOnly:[20,21]},pwm:[3,5,6,9,10,11],pwmFreq:490,pwmFast:[5,6],pwmBits:8,inputOnly:[],reserved:[],invalid:[],pulldown:false,interrupts:{2:0,3:1},i2c:[18,19],spi:{sck:13,miso:12,mosi:11,ss:10},uarts:{Serial:{tx:1,rx:0,usb:true}},intBits:16,doubleBits:32,maxPin:21,
  constants:{LED_BUILTIN:13,A0:14,A1:15,A2:16,A3:17,A4:18,A5:19,A6:20,A7:21,SS:10,MOSI:11,MISO:12,SCK:13,SDA:18,SCL:19},leds:[{label:'POW',power:true,color:'#38d65a'},{label:'L',pin:13,color:'#f5a623',buffered:true},{label:'TX',uart:'tx',color:'#f5a623'},{label:'RX',uart:'rx',color:'#f5a623'}],
  sources:[{title:'Arduino Nano product reference',url:'https://docs.arduino.cc/hardware/nano/'}]},
 mega:{key:'mega',name:'Arduino Mega 2560 Rev3',short:'Mega',vendor:'Arduino',mcu:'ATmega2560 · 8-bit AVR · 16 MHz',memory:'256 KB flash · 8 KB SRAM · 4 KB EEPROM',core:'avr',family:'avr',size:[101.6,53.34],pcb:'#0f6b8f',logic:5,vil:1.5,vih:3,vmax:5.5,outR:25,pinMax:40,pinRec:20,pullR:35000,pins:unoPins(true),gnd:['GND1','GND2','GND3','GND4','GND5'],joins:[['SDA','D20'],['SCL','D21'],['IOREF','5V'],['5V2','5V'],['5V3','5V']],supplies:[['5V',5,.15,500],['3V3',3.3,.5,50]],reset:'RESET',resetR:10000,
  adc:{pins:range(16,i=>54+i),channelBase:54,bits:10,fixed:true,vref:5,reference:true},pwm:[2,3,4,5,6,7,8,9,10,11,12,13,44,45,46],pwmFreq:490,pwmFast:[4,13],pwmBits:8,inputOnly:[],reserved:[],invalid:[],pulldown:false,interrupts:{2:0,3:1,18:5,19:4,20:3,21:2},i2c:[20,21],spi:{sck:52,miso:50,mosi:51,ss:53},uarts:{Serial:{tx:1,rx:0,usb:true},Serial1:{tx:18,rx:19},Serial2:{tx:16,rx:17},Serial3:{tx:14,rx:15}},intBits:16,doubleBits:32,maxPin:69,
  constants:{LED_BUILTIN:13,...Object.fromEntries(range(16,i=>['A'+i,54+i])),SS:53,MOSI:51,MISO:50,SCK:52,SDA:20,SCL:21},leds:[{label:'ON',power:true,color:'#38d65a'},{label:'L',pin:13,color:'#f5a623',buffered:true},{label:'TX',uart:'tx',color:'#f5a623'},{label:'RX',uart:'rx',color:'#f5a623'}],
  sources:[{title:'Arduino Mega 2560 Rev3 reference',url:'https://docs.arduino.cc/hardware/mega-2560/'}]},
 pico:{key:'pico',name:'Raspberry Pi Pico',short:'Pico',vendor:'Raspberry Pi',mcu:'RP2040 · dual-core Arm Cortex-M0+ · 133 MHz',memory:'2 MB flash · 264 KB SRAM',core:'rp2040',family:'rp2040',size:[21,51],pcb:'#1a5c35',logic:3.3,vil:.8,vih:2,vmax:3.63,outR:70,pinMax:12,pullR:50000,pins:picoPins(),gnd:range(8,i=>'GND'+(i+1)),joins:[],supplies:[['3V3',3.3,.3,300],['VBUS',5,.2,500],['VSYS',4.7,.4,500]],reset:'RUN',resetR:50000,extraPulls:[['3V3_EN','VSYS',100000],['ADC_VREF','3V3',200]],
  adc:{pins:[26,27,28],bits:10,minBits:8,maxBits:12,vref:3.3},pwm:'all',pwmFreq:1000,pwmBits:8,inputOnly:[],reserved:[],invalid:[23,24,29],internal:[23,24,25,29],pulldown:true,interrupts:'all',i2c:[4,5],spi:{sck:18,miso:16,mosi:19,ss:17},uarts:{Serial:{usb:true},Serial1:{tx:0,rx:1},Serial2:{tx:8,rx:9}},intBits:32,doubleBits:64,maxPin:29,
  constants:{LED_BUILTIN:25,PIN_LED:25,A0:26,A1:27,A2:28,A3:29},leds:[{label:'LED',gpio:25,color:'#3ddc5b'}],
  sources:[{title:'Raspberry Pi Pico datasheet (RP-008307-DS)',url:'https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf'},{title:'RP2040 datasheet',url:'https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf'}]},
 esp8266:{key:'esp8266',name:'NodeMCU ESP8266 (Amica V2)',short:'ESP8266',vendor:'Espressif · NodeMCU',mcu:'ESP8266EX · Tensilica L106 · 80 MHz',memory:'4 MB flash · 80 KB user RAM',core:'esp8266',family:'esp8266',size:[25.6,48.3],pcb:'#1d2633',logic:3.3,vil:.8,vih:2.5,vmax:3.6,outR:50,pinMax:12,pullR:40000,pins:nodemcuPins(),gnd:['GND1','GND2','GND3','GND4'],joins:[['3V3_1','3V3_2'],['3V3_1','3V3_3']],supplies:[['3V3_1',3.3,.25,600],['VIN',4.7,.4,500]],reset:'RST',resetR:12000,extraPulls:[['EN','3V3_1',12000]],
  adc:{pins:[17],bits:10,fixed:true,vref:3.3,divider:true},pwm:range(16,i=>i).filter(p=>p<6||p>11),pwmFreq:1000,pwmBits:8,inputOnly:[],reserved:[6,7,8,9,10,11],invalid:[17],noInterrupt:[16],noPwm:[16],pulldown:false,pulldown16:true,interrupts:'all',i2c:[4,5],spi:{sck:14,miso:12,mosi:13,ss:15},uarts:{Serial:{tx:1,rx:3,usb:true},Serial1:{tx:2}},intBits:32,doubleBits:64,wifi:true,maxPin:17,
  constants:{LED_BUILTIN:2,A0:17,D0:16,D1:5,D2:4,D3:0,D4:2,D5:14,D6:12,D7:13,D8:15,D9:3,D10:1,INPUT_PULLDOWN_16:4},strap:'esp8266',leds:[{label:'ESP',gpio:2,activeLow:true,color:'#3d8bff'},{label:'LED',gpio:16,activeLow:true,color:'#ff3d3d'}],
  sources:[{title:'ESP8266EX datasheet',url:'https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf'},{title:'NodeMCU Amica dimensions (0.9 in row spacing)',url:'https://www.etechnophiles.com/nodemcu-esp8266-pinout-specs-board-layout/'}]},
 bluepill:{key:'bluepill',name:'STM32 Blue Pill',short:'STM32',vendor:'STMicroelectronics MCU · generic board',mcu:'STM32F103C8T6 · Arm Cortex-M3 · 72 MHz',memory:'64 KB flash · 20 KB SRAM',core:'stm32',family:'stm32',size:[22.86,53],pcb:'#1652a8',logic:3.3,vil:1.16,vih:1.83,vmax:3.6,tolerant:[8,9,10,11,12,15,18,19,20,22,23,24,25,26,27,28,29,30,31],toleranceV:5.5,outR:50,pinMax:25,pullR:40000,pins:bluepillPins(),gnd:['GND1','GND2','GND3'],joins:[['3V3_1','3V3_2']],supplies:[['3V3_1',3.3,.3,300],['5V',5,.2,500]],reset:'NRST',resetR:40000,
  adc:{pins:[0,1,2,3,4,5,6,7,16,17],bits:10,minBits:8,maxBits:12,vref:3.3},pwm:[0,1,2,3,6,7,8,9,10,11,16,17,22,23,24,25],pwmFreq:1000,pwmBits:8,inputOnly:[],reserved:[],invalid:[],weak:{45:3,46:3,47:3},pulldown:true,interrupts:'all',i2c:[23,22],spi:{sck:5,miso:6,mosi:7,ss:4},uarts:{Serial:{tx:9,rx:10,usb:true},Serial2:{tx:2,rx:3},Serial3:{tx:26,rx:27}},intBits:32,doubleBits:64,maxPin:47,
  constants:stmConstants(),leds:[{label:'PWR',power:true,color:'#ff3030'},{label:'PC13',gpio:45,activeLow:true,color:'#38d65a'}],
  sources:[{title:'STM32F103C8T6 Blue Pill (stm32-base)',url:'https://stm32-base.org/boards/STM32F103C8T6-Blue-Pill.html'},{title:'STM32F103x8 datasheet',url:'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf'}]},
};
export const BOARD_TYPES = Object.keys(PROFILES);
export const isBoard = c=>!!PROFILES[typeof c==='string'?c:c?.type];
export const profileOf = c=>PROFILES[typeof c==='string'?c:c?.type];
export const ESP32_LEFT = LEFT32, ESP32_RIGHT = RIGHT32;
export const pinsOf = c=>profileOf(c)?.pins??[];
export function boardPinInfo(profile,t){
 const n=t.gpio,adc=profile.adc.pins.includes(n),pwm=profile.pwm==='all'?!profile.noPwm?.includes(n):profile.pwm.includes(n);
 if(/^GND/.test(t.id))return 'Ground · 0 V reference';
 const supply=profile.supplies.find(s=>s[0]===t.id||profile.joins.some(([a,b])=>(a===t.id&&b===s[0])||(b===t.id&&a===s[0])));
 if(supply)return `${supply[1]} V supply · modeled ${supply[3]} mA limit`;
 if(t.id===profile.reset)return 'Reset · active low';
 if(n===undefined)return t.label+' · not a GPIO';
 const parts=[`${t.label} · GPIO ${n}`];
 if(profile.reserved.includes(n))parts.push('reserved for flash');else if(profile.inputOnly.includes(n))parts.push('input only, no internal pulls');else if(profile.adc.analogOnly?.includes(n))parts.push('analog input only');else parts.push(pwm?'digital I/O · PWM':'digital I/O');
 if(adc)parts.push('ADC');if(profile.i2c.includes(n))parts.push(n===profile.i2c[0]?'I²C SDA':'I²C SCL');
 if(profile.strap==='esp32'&&[0,2,5,12,15].includes(n))parts.push('boot strapping');if(profile.strap==='esp8266'&&[0,2,15].includes(n))parts.push('boot strapping');
 if(profile.tolerant?.includes(n))parts.push('5 V tolerant');
 return parts.join(' · ');
}
