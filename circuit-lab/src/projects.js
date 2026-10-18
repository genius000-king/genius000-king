// Ready-to-run projects. Every project is built from real parts and explicit wires and is
// exercised by tests/projects.test.js (compile, run and check a visible outcome).
import {newProject,wirelessProject,makeComponent,EXAMPLES,terminals,breadboardTop,profileOf,isBoard} from './data.js';
import {reseat} from './snap.js';
const C={red:'#c8463a',black:'#2b2b30',yellow:'#d7b23a',green:'#3f9a52',blue:'#3a6fd0',orange:'#d9822b',white:'#d9d9de',purple:'#8a5ad0',gray:'#8d93a1',brown:'#7a4a2a'};
function base(name){const p=newProject();p.name=name;p.components=[];p.wires=[];p.files={'main.ino':''};delete p.activeBoard;delete p.firmware;p.camera=null;return p;}
function add(p,type,id,pos=[0,0,0],params={},ry=0){const c=makeComponent(type,pos,id);Object.assign(c.params,params);c.rotation=[0,ry,0];p.components.push(c);return c;}
function hole(p,bbId,h){const bb=p.components.find(c=>c.id===bbId),t=terminals(bb).find(t=>t.id===h);if(!t)throw Error(`No hole ${h} on ${bbId}`);return [bb.position[0]+t.p[0],bb.position[2]+t.p[2],bb.position[1]+breadboardTop(bb)];}
// Seat a part so its first terminal lands in the given hole.
function on(p,type,id,bbId,h,params={},ry=0){const c=add(p,type,id,[0,0,0],params,ry),t0=terminals(c)[0],[x,z,top]=hole(p,bbId,h),ox=t0.p[0]*Math.cos(ry)+t0.p[2]*Math.sin(ry),oz=-t0.p[0]*Math.sin(ry)+t0.p[2]*Math.cos(ry);c.position=[x-ox,top-(isBoard(c)?profileOf(c).seat:1),z-oz];return c;}
const get=(p,id)=>p.components.find(c=>c.id===id);
// Breadboard hole in the same five-hole strip as a seated part's pin (row letter chosen by the caller).
function at(p,bbId,partId,pinId,row){const bb=get(p,bbId),c=get(p,partId),t=terminals(c).find(t=>t.id===pinId),a=c.rotation[1],x=c.position[0]+t.p[0]*Math.cos(a)+t.p[2]*Math.sin(a)-bb.position[0],cols=bb.type==='bbfull'?63:bb.type==='bbhalf'?30:17;return `${bbId}:${row}${Math.round(x/2.54+(cols-1)/2)+1}`;}
// Rail hole (TP/TN/BP/BN) closest to a numbered column, so short rail jumpers stay vertical.
function rail(p,bbId,prefix,col){const bb=get(p,bbId),ts=terminals(bb),x=ts.find(t=>t.id==='A'+col).p[0];let best=null;for(const t of ts)if(t.id.startsWith(prefix)&&/^\d+$/.test(t.id.slice(2))&&(!best||Math.abs(t.p[0]-x)<Math.abs(best.p[0]-x)))best=t;return `${bbId}:${best.id}`;}
function w(p,a,b,color='yellow'){p.wires.push({id:'w'+(p.wires.length+1),a,b,color:C[color]??color,lift:10});}
function code(p,id,src){if(!p.activeBoard){p.activeBoard=id;p.files={'main.ino':src};p.activeFile='main.ino';}else{p.firmware??={};p.firmware[id]={files:{'main.ino':src},activeFile:'main.ino'};}}
function done(p,camera){reseat(p,p.components.map(c=>c.id));p.camera=camera??null;return p;}
const legacy=(key,name)=>()=>{if(key==='wifi')return wirelessProject();const p=newProject();p.files['main.ino']=EXAMPLES[key];p.name=name;
 if(key==='button'){p.components.push(makeComponent('button',[22,0,45],'button'));p.wires.push({id:'button1',a:'esp32:IO4',b:'button:1',color:'#8d93a1',lift:12},{id:'button2',a:'esp32:GND1',b:'button:2',color:'#344d4b',lift:14});}
 if(key==='analog'){p.components.push(makeComponent('pot',[22,0,45],'pot'));p.wires.push(...[['3V3','VCC'],['GND1','GND'],['VP','W']].map(([a,b],i)=>({id:'pot'+i,a:'esp32:'+a,b:'pot:'+b,color:i===1?'#344d4b':'#ba9453',lift:10+i*3})));}
 if(key==='oled'||key==='lcd'){p.components.push(makeComponent(key,key==='lcd'?[25,0,-48]:[21,0,-31],key));p.wires.push(...[['3V3','VCC'],['GND1','GND'],['IO21','SDA'],['IO22','SCL']].map(([a,b],i)=>({id:key+i,a:'esp32:'+a,b:key+':'+b,color:['#c76a53','#344d4b','#ba9453','#8d93a1'][i],lift:8+i*2})));}
 return p;};
const P=[];const def=(id,name,board,level,tags,summary,build)=>P.push({id,name,board,level,tags,summary,build});
// ------------------------------------------------------------------ original ESP32 examples
def('blink','First light','ESP32','Beginner',['LED','GPIO'],'Blink an LED through a 220 Ω resistor.',legacy('blink','First light'));
def('button','A little push','ESP32','Beginner',['Input','Pull-up'],'Read a push button with the internal pull-up.',legacy('button','A little push'));
def('analog','Dial it in','ESP32','Beginner',['ADC'],'Read a potentiometer on GPIO 36.',legacy('analog','Dial it in'));
def('pwm','A softer glow','ESP32','Beginner',['PWM'],'Fade an LED with the LEDC peripheral.',legacy('pwm','A softer glow'));
def('oled','Hello, world','ESP32','Beginner',['I²C','Display'],'Text on a 128 × 64 OLED.',legacy('oled','Hello, world'));
def('lcd','LCD workbench','ESP32','Beginner',['I²C','Display'],'Text on a 16 × 2 LCD.',legacy('lcd','LCD workbench'));
def('wifi','Two boards · Wi-Fi','ESP32 × 2','Intermediate',['Wi-Fi','UDP','Multi-board'],'An access point broadcasts UDP; a station drives its LED.',legacy('wifi'));
// ------------------------------------------------------------------ Arduino Uno
def('uno-blink','Hello, Arduino','Arduino Uno','Beginner',['LED_BUILTIN'],'The classic: blink the onboard “L” LED on pin 13.',()=>{const p=base('Hello, Arduino');add(p,'uno','uno',[0,0,0]);code(p,'uno',`// The onboard L LED is wired to pin 13.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("L on");
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("L off");
  delay(1000);
}
`);return done(p,{position:[40,90,90],target:[0,0,0]});});
def('traffic','Traffic light','Arduino Uno','Beginner',['Breadboard','Functions'],'Three LEDs on a breadboard cycle through a traffic-light sequence.',()=>{const p=base('Traffic light');add(p,'uno','uno',[-62,0,0]);add(p,'bbhalf','bb',[30,0,0]);
 [['red','#ff3b30',12,'red'],['amber','#ffb020',11,'orange'],['green','#34c759',10,'green']].forEach(([n,col,pin,wc],i)=>{const c=5+i*8;on(p,'led','led_'+n,'bb','E'+c,{color:col});on(p,'resistor','r_'+n,'bb','C'+(c+1),{resistance:220});w(p,'uno:D'+pin,'bb:A'+c,wc);w(p,'bb:A'+(c+5),'bb:TN'+(4+i*6),'black');});w(p,'uno:GND2','bb:TN1','black');
 code(p,'uno',`const int RED = 12, AMBER = 11, GREEN = 10;

void show(int r, int a, int g, int ms) {
  digitalWrite(RED, r);
  digitalWrite(AMBER, a);
  digitalWrite(GREEN, g);
  delay(ms);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(AMBER, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  show(HIGH, LOW, LOW, 3000);   // stop
  show(HIGH, HIGH, LOW, 800);   // get ready
  show(LOW, LOW, HIGH, 3000);   // go
  show(LOW, HIGH, LOW, 1000);   // caution
}
`);return done(p,{position:[0,150,170],target:[0,0,0]});});
def('chaser','Knight Rider scanner','Arduino Uno','Beginner',['Arrays','sizeof','Breadboard'],'Six LEDs sweep back and forth using an array of pins.',()=>{const p=base('Knight Rider scanner');add(p,'uno','uno',[-105,0,0]);add(p,'bbfull','bb',[20,0,0]);const pins=[2,3,4,5,6,7];
 pins.forEach((pin,i)=>{const c=4+i*7;on(p,'resistor','r'+i,'bb','J'+c,{resistance:330});on(p,'led','led'+i,'bb','H'+(c+4),{color:'#ff3b30'});w(p,'uno:D'+pin,'bb:F'+c,'orange');w(p,'bb:F'+(c+5),'bb:BN'+(2+i*4),'black');});w(p,'uno:GND2','bb:BN1','black');
 code(p,'uno',`const byte leds[] = {2, 3, 4, 5, 6, 7};
const int COUNT = sizeof(leds) / sizeof(leds[0]);

void setup() {
  for (int i = 0; i < COUNT; i++) pinMode(leds[i], OUTPUT);
}

void light(int i) {
  digitalWrite(leds[i], HIGH);
  delay(80);
  digitalWrite(leds[i], LOW);
}

void loop() {
  for (int i = 0; i < COUNT; i++) light(i);
  for (int i = COUNT - 2; i > 0; i--) light(i);
}
`);return done(p,{position:[-20,190,210],target:[-20,0,0]});});
def('servo-pot','Servo follows a knob','Arduino Uno','Beginner',['Servo','ADC','map()'],'A potentiometer sets the angle of an SG90 servo.',()=>{const p=base('Servo follows a knob');add(p,'uno','uno',[-30,0,0]);add(p,'pot','pot',[45,0,30],{value:.25});add(p,'servo','servo',[45,0,-20]);
 w(p,'uno:5V','pot:VCC','red');w(p,'uno:GND1','pot:GND','black');w(p,'uno:A0','pot:W','yellow');w(p,'uno:5V','servo:VCC','red');w(p,'uno:GND3','servo:GND','black');w(p,'uno:D9','servo:SIG','orange');
 code(p,'uno',`#include <Servo.h>

Servo arm;

void setup() {
  arm.attach(9);
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);            // 0..1023
  int angle = map(raw, 0, 1023, 0, 180);
  arm.write(angle);
  Serial.print("angle ");
  Serial.println(angle);
  delay(20);
}
`);return done(p,{position:[20,110,150],target:[10,0,5]});});
def('sonar-lcd','Ultrasonic ruler','Arduino Uno','Intermediate',['HC-SR04','pulseIn','LCD I²C'],'Measure distance with an HC-SR04 and show it on a 16 × 2 LCD.',()=>{const p=base('Ultrasonic ruler');add(p,'uno','uno',[-40,0,10]);add(p,'hcsr04','sonar',[45,0,40],{distance:42});add(p,'lcd','lcd',[30,0,-45]);
 w(p,'uno:5V','sonar:VCC','red');w(p,'uno:GND1','sonar:GND','black');w(p,'uno:D9','sonar:TRIG','yellow');w(p,'uno:D10','sonar:ECHO','green');w(p,'uno:5V','lcd:VCC','red');w(p,'uno:GND3','lcd:GND','black');w(p,'uno:SDA','lcd:SDA','blue');w(p,'uno:SCL','lcd:SCL','purple');
 code(p,'uno',`#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int TRIG = 9, ECHO = 10;
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  lcd.init();
  lcd.backlight();
  lcd.print("Ultrasonic ruler");
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long echo = pulseIn(ECHO, HIGH, 30000);
  float cm = echo / 58.0;
  lcd.setCursor(0, 1);
  lcd.print(cm, 1);
  lcd.print(" cm      ");
  delay(200);
}
`);return done(p,{position:[10,140,160],target:[10,0,0]});});
def('weather','Weather station','Arduino Uno','Intermediate',['DHT22','LCD I²C','float'],'Temperature and humidity from a DHT22 on a 16 × 2 LCD.',()=>{const p=base('Weather station');add(p,'uno','uno',[-40,0,10]);add(p,'dht22','dht',[40,0,40],{temperature:22.5,humidity:48});add(p,'lcd','lcd',[30,0,-45]);
 w(p,'uno:5V','dht:VCC','red');w(p,'uno:GND1','dht:GND','black');w(p,'uno:D2','dht:DATA','yellow');w(p,'uno:5V','lcd:VCC','red');w(p,'uno:GND3','lcd:GND','black');w(p,'uno:A4','lcd:SDA','blue');w(p,'uno:A5','lcd:SCL','purple');
 code(p,'uno',`#include <DHT.h>
#include <LiquidCrystal_I2C.h>

DHT dht(2, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  dht.begin();
  lcd.init();
  lcd.backlight();
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  lcd.setCursor(0, 0);
  if (isnan(t)) {
    lcd.print("Sensor error    ");
  } else {
    lcd.print("Temp ");
    lcd.print(t, 1);
    lcd.print(" C   ");
    lcd.setCursor(0, 1);
    lcd.print("Hum  ");
    lcd.print(h, 1);
    lcd.print(" %   ");
  }
  delay(2000);
}
`);return done(p,{position:[10,140,160],target:[10,0,0]});});
def('melody','Play a melody','Arduino Uno','Beginner',['tone()','Arrays','Passive buzzer'],'Arrays of notes and durations played with tone().',()=>{const p=base('Play a melody');add(p,'uno','uno',[-30,0,0]);add(p,'buzzer','bz',[40,0,20],{active:false});w(p,'uno:D8','bz:+','orange');w(p,'uno:GND2','bz:-','black');
 code(p,'uno',`#define NOTE_C4 262
#define NOTE_D4 294
#define NOTE_E4 330
#define NOTE_F4 349
#define NOTE_G4 392
#define NOTE_A4 440

int melody[] = {NOTE_C4, NOTE_C4, NOTE_G4, NOTE_G4, NOTE_A4, NOTE_A4, NOTE_G4, 0,
                NOTE_F4, NOTE_F4, NOTE_E4, NOTE_E4, NOTE_D4, NOTE_D4, NOTE_C4, 0};

void setup() {
  Serial.begin(9600);
}

void loop() {
  for (int i = 0; i < 16; i++) {
    if (melody[i] > 0) tone(8, melody[i], 250);
    Serial.println(melody[i]);
    delay(300);
  }
  delay(1000);
}
`);return done(p,{position:[10,110,140],target:[5,0,5]});});
def('dice','7-segment counter','Arduino Uno','Intermediate',['7-segment','2-D arrays','Breadboard'],'Count 0–9 on a common-cathode display using a 2-D segment table.',()=>{const p=base('7-segment counter');add(p,'uno','uno',[-110,0,0]);add(p,'bbfull','bb',[20,0,0]);on(p,'sevenseg','seg','bb','H8');
 const segs=['A','B','C','D','E','F','G'],cols=['red','orange','yellow','green','blue','purple','gray'];segs.forEach((s,i)=>{const c=24+i*5;on(p,'resistor','r'+s,'bb','B'+c,{resistance:330});w(p,'uno:D'+(2+i),'bb:A'+c,cols[i]);const seg=at(p,'bb','seg',s,s==='C'||s==='D'||s==='E'?'J':'A');w(p,'bb:E'+(c+4),seg,cols[i]);});
 w(p,at(p,'bb','seg','COM1','J'),'bb:BN5','black');w(p,'uno:GND2','bb:BN1','black');
 code(p,'uno',`// Segments a..g on pins 2..8, common cathode to GND.
const byte segPins[7] = {2, 3, 4, 5, 6, 7, 8};
const byte digits[10][7] = {
  {1,1,1,1,1,1,0}, {0,1,1,0,0,0,0}, {1,1,0,1,1,0,1}, {1,1,1,1,0,0,1}, {0,1,1,0,0,1,1},
  {1,0,1,1,0,1,1}, {1,0,1,1,1,1,1}, {1,1,1,0,0,0,0}, {1,1,1,1,1,1,1}, {1,1,1,1,0,1,1}
};

void showDigit(int n) {
  for (int s = 0; s < 7; s++) digitalWrite(segPins[s], digits[n][s]);
}

void setup() {
  for (int s = 0; s < 7; s++) pinMode(segPins[s], OUTPUT);
}

void loop() {
  for (int n = 0; n <= 9; n++) {
    showDigit(n);
    delay(700);
  }
}
`);return done(p,{position:[-30,200,210],target:[-20,0,0]});});
def('shift','Shift register bar graph','Arduino Uno','Intermediate',['74HC595','shiftOut()','Breadboard'],'Drive eight segments of an LED bar graph through a 74HC595 using three pins.',()=>{const p=base('Shift register bar graph');add(p,'uno','uno',[-110,0,0]);add(p,'bbfull','bb',[20,0,0]);on(p,'hc595','sr','bb','F6');on(p,'ledbar','bar','bb','F44',{color:'#ff5a36'});
 const top=pin=>at(p,'bb','sr',pin,'A'),bot=pin=>at(p,'bb','sr',pin,'J');w(p,'uno:5V','bb:TP1','red');w(p,'uno:GND2','bb:TN1','black');w(p,'bb:TP25','bb:BP25','red');w(p,'bb:TN24','bb:BN24','black');
 w(p,top('VCC'),'bb:TP3','red');w(p,top('MR'),'bb:TP6','red');w(p,top('OE'),'bb:TN5','black');w(p,bot('GND'),'bb:BN5','black');w(p,'uno:D11',top('DS'),'yellow');w(p,'uno:D12',top('SHCP'),'green');w(p,'uno:D8',top('STCP'),'blue');
 const wc=['red','orange','yellow','green','blue','purple','gray','white'];for(let i=0;i<8;i++){const c=16+i*3;on(p,'resistor','r'+i,'bb',(i%2?'G':'I')+c,{resistance:330});w(p,i===0?top('Q0'):bot('Q'+i),'bb:'+(i%2?'F':'H')+c,wc[i]);w(p,'bb:'+(i%2?'H':'J')+(c+4),at(p,'bb','bar','A'+(i+1),'J'),wc[i]);w(p,at(p,'bb','bar','K'+(i+1),'A'),'bb:TN'+(14+i),'black');}
 code(p,'uno',`const int DATA = 11, CLOCK = 12, LATCH = 8;

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
}

void loop() {
  for (int n = 0; n <= 8; n++) {
    byte pattern = (1 << n) - 1;     // n lit segments
    digitalWrite(LATCH, LOW);
    shiftOut(DATA, CLOCK, MSBFIRST, pattern);
    digitalWrite(LATCH, HIGH);
    delay(250);
  }
}
`);return done(p,{position:[-20,210,220],target:[-20,0,0]});});
def('keypad-lock','Keypad door lock','Arduino Uno','Intermediate',['Keypad','char arrays','Matrix scan'],'Scan a 4 × 4 keypad by hand and unlock with a code.',()=>{const p=base('Keypad door lock');add(p,'uno','uno',[-50,0,-10]);add(p,'keypad','kp',[50,0,-25]);add(p,'led','ok',[0,0,55],{color:'#34c759'});add(p,'led','no',[20,0,55],{color:'#ff3b30'});add(p,'resistor','r1',[0,0,45],{resistance:220});add(p,'resistor','r2',[20,0,45],{resistance:220});
 ['D9','D8','D7','D6'].forEach((d,i)=>w(p,'uno:'+d,'kp:R'+(i+1),'orange'));['D5','D4','D3','D2'].forEach((d,i)=>w(p,'uno:'+d,'kp:C'+(i+1),'blue'));w(p,'uno:D12','r1:A','green');w(p,'r1:B','ok:A','green');w(p,'ok:K','uno:GND1','black');w(p,'uno:D13','r2:A','red');w(p,'r2:B','no:A','red');w(p,'no:K','uno:GND2','black');
 code(p,'uno',`const byte rows[4] = {9, 8, 7, 6};
const byte cols[4] = {5, 4, 3, 2};
const char keys[4][4] = {
  {'1','2','3','A'}, {'4','5','6','B'}, {'7','8','9','C'}, {'*','0','#','D'}
};
String entry = "";
const String CODE = "1234";
char last = 0;

char scan() {
  for (int r = 0; r < 4; r++) {
    digitalWrite(rows[r], LOW);
    for (int c = 0; c < 4; c++) {
      if (digitalRead(cols[c]) == LOW) {
        digitalWrite(rows[r], HIGH);
        return keys[r][c];
      }
    }
    digitalWrite(rows[r], HIGH);
  }
  return 0;
}

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < 4; i++) {
    pinMode(rows[i], OUTPUT);
    digitalWrite(rows[i], HIGH);
    pinMode(cols[i], INPUT_PULLUP);
  }
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
  Serial.println("Enter code, # to submit");
}

void loop() {
  char k = scan();
  if (k != 0 && k != last) {
    Serial.print(k);
    if (k == '#') {
      Serial.println();
      bool ok = entry == CODE;
      digitalWrite(12, ok);
      digitalWrite(13, !ok);
      Serial.println(ok ? "Unlocked" : "Wrong code");
      entry = "";
    } else if (k == '*') {
      entry = "";
    } else {
      entry += k;
    }
  }
  last = k;
  delay(20);
}
`);return done(p,{position:[10,170,180],target:[10,0,0]});});
def('rgb-joy','Joystick color mixer','Arduino Uno','Beginner',['Joystick','PWM','RGB LED'],'Two joystick axes mix red and blue on an RGB LED; press for green.',()=>{const p=base('Joystick color mixer');add(p,'uno','uno',[-40,0,0]);add(p,'joystick','joy',[45,0,35],{x:.8,y:.3});add(p,'rgbled','rgb',[45,0,-25]);['R','G','B'].forEach((ch,i)=>add(p,'resistor','r'+ch,[25+i*14,0,-10],{resistance:220},Math.PI/2));
 w(p,'uno:5V','joy:VCC','red');w(p,'uno:GND1','joy:GND','black');w(p,'uno:A0','joy:VRX','yellow');w(p,'uno:A1','joy:VRY','green');w(p,'uno:D2','joy:SW','blue');w(p,'uno:D9','rR:A','red');w(p,'rR:B','rgb:R','red');w(p,'uno:D10','rG:A','green');w(p,'rG:B','rgb:G','green');w(p,'uno:D11','rB:A','blue');w(p,'rB:B','rgb:B','blue');w(p,'rgb:K','uno:GND3','black');
 code(p,'uno',`void setup() {
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  int red = analogRead(A0) / 4;     // 0..255
  int blue = analogRead(A1) / 4;
  int green = digitalRead(2) == LOW ? 255 : 0;
  analogWrite(9, red);
  analogWrite(10, green);
  analogWrite(11, blue);
  delay(20);
}
`);return done(p,{position:[10,130,160],target:[5,0,5]});});
// ------------------------------------------------------------------ Nano / Mega
def('nightlight','Automatic night light','Arduino Nano','Beginner',['LDR','Voltage divider','Breadboard'],'An LDR divider dims an LED as the room gets darker.',()=>{const p=base('Automatic night light');add(p,'bbhalf','bb',[0,0,0]);on(p,'nano','nano','bb','H3',{},Math.PI/2);
 on(p,'ldr','ldr','bb','G21',{lux:30});on(p,'resistor','rd','bb','I22',{resistance:10000});on(p,'led','led','bb','B24',{color:'#ffd27a'});on(p,'resistor','rl','bb','D25',{resistance:220});
 w(p,at(p,'bb','nano','5V','J'),'bb:BP12','red');w(p,at(p,'bb','nano','GND1','J'),'bb:BN14','black');w(p,'bb:BN25','bb:TN25','black');w(p,'bb:J21','bb:BP19','red');w(p,'bb:J26','bb:BN21','black');w(p,at(p,'bb','nano','A0','J'),'bb:F22','yellow');w(p,at(p,'bb','nano','D9','A'),'bb:A24','orange');w(p,'bb:A29','bb:TN22','black');
 code(p,'nano',`// LDR from 5V to A0, 10 kΩ from A0 to GND.
void setup() {
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(A0);
  int glow = constrain(map(light, 200, 800, 255, 0), 0, 255);
  analogWrite(9, glow);
  Serial.print("light=");
  Serial.print(light);
  Serial.print(" glow=");
  Serial.println(glow);
  delay(100);
}
`);return done(p,{position:[0,140,150],target:[0,0,0]});});
def('thermometer','NTC thermometer','Arduino Nano','Intermediate',['Thermistor','Steinhart–Hart','float math'],'Convert an NTC divider voltage to °C with the Beta equation.',()=>{const p=base('NTC thermometer');add(p,'nano','nano',[-30,0,0]);add(p,'thermistor','ntc',[25,0,20],{temperature:31});add(p,'resistor','r',[25,0,-10],{resistance:10000},Math.PI/2);
 w(p,'nano:5V','ntc:A','red');w(p,'ntc:B','r:A','yellow');w(p,'r:B','nano:GND1','black');w(p,'nano:A1','ntc:B','yellow');
 code(p,'nano',`const float BETA = 3950.0, R0 = 10000.0, T0 = 298.15, RFIXED = 10000.0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A1);
  float v = raw * 5.0 / 1024.0;
  float rNtc = RFIXED * (5.0 - v) / v;
  float kelvin = 1.0 / (1.0 / T0 + log(rNtc / R0) / BETA);
  float celsius = kelvin - 273.15;
  Serial.print("Temperature: ");
  Serial.print(celsius, 1);
  Serial.println(" C");
  delay(500);
}
`);return done(p,{position:[0,110,120],target:[0,0,0]});});
def('mega-chaser','Mega pin chaser','Arduino Mega','Beginner',['Mega','for loop'],'Light eight LEDs on the Mega’s double-row header, pins 22–36.',()=>{const p=base('Mega pin chaser');add(p,'mega','mega',[-20,0,0]);for(let i=0;i<8;i++){add(p,'led','l'+i,[55+(i%4)*10,0,-25+Math.floor(i/4)*40],{color:i%2?'#3aa0ff':'#ff3b30'});add(p,'resistor','r'+i,[55+(i%4)*10,0,-10+Math.floor(i/4)*40],{resistance:330},Math.PI/2);w(p,'mega:D'+(22+i*2),'r'+i+':A','orange');w(p,'r'+i+':B','l'+i+':A','orange');w(p,'l'+i+':K','mega:GND'+(4+i%2),'black');}
 code(p,'mega',`void setup() {
  for (int pin = 22; pin <= 36; pin += 2) pinMode(pin, OUTPUT);
}

void loop() {
  for (int pin = 22; pin <= 36; pin += 2) {
    digitalWrite(pin, HIGH);
    delay(120);
    digitalWrite(pin, LOW);
  }
}
`);return done(p,{position:[20,180,200],target:[20,0,0]});});
// ------------------------------------------------------------------ Raspberry Pi Pico / STM32 / ESP8266
def('pico-breathe','Pico breathing LED','Raspberry Pi Pico','Beginner',['RP2040','PWM','Breadboard'],'Blink the internal GP25 LED and breathe an external LED on GP15.',()=>{const p=base('Pico breathing LED');add(p,'bbhalf','bb',[0,0,0]);on(p,'pico','pico','bb','H3',{},Math.PI/2);on(p,'resistor','r','bb','I24',{resistance:220});on(p,'led','led','bb','G28',{color:'#3aa0ff'});
 w(p,at(p,'bb','pico','GP15','J'),'bb:J24','orange');w(p,'bb:J29','bb:BN22','black');w(p,at(p,'bb','pico','GND4','J'),'bb:BN17','black');
 code(p,'pico',`void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  for (int v = 0; v < 255; v += 5) { analogWrite(15, v); delay(10); }
  digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  for (int v = 255; v > 0; v -= 5) { analogWrite(15, v); delay(10); }
}
`);return done(p,{position:[0,140,150],target:[0,0,0]});});
def('pico-rainbow','NeoPixel rainbow','Raspberry Pi Pico','Intermediate',['NeoPixel','ColorHSV','Libraries'],'An 8-LED WS2812B stick cycles through the color wheel.',()=>{const p=base('NeoPixel rainbow');add(p,'pico','pico',[-35,0,0]);add(p,'neopixel','strip',[30,0,0]);w(p,'pico:VBUS','strip:VCC','red');w(p,'pico:GND1','strip:GND','black');w(p,'pico:GP2','strip:DIN','green');
 code(p,'pico',`#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 2, NEO_GRB + NEO_KHZ800);
long hue = 0;

void setup() {
  strip.begin();
  strip.setBrightness(80);
}

void loop() {
  for (int i = 0; i < 8; i++) {
    strip.setPixelColor(i, strip.ColorHSV(hue + i * 8192, 255, 255));
  }
  strip.show();
  hue = (hue + 1024) % 65536;
  delay(30);
}
`);return done(p,{position:[0,110,120],target:[0,0,0]});});
def('stm32-button','Blue Pill interrupt','STM32 Blue Pill','Intermediate',['STM32','attachInterrupt','volatile'],'A button on PA0 toggles the active-low PC13 LED using an interrupt.',()=>{const p=base('Blue Pill interrupt');add(p,'bluepill','bp',[-25,0,0]);add(p,'button','btn',[30,0,20],{bounce:0});w(p,'bp:PA0','btn:1','yellow');w(p,'btn:2','bp:GND1','black');
 code(p,'bp',`volatile bool lit = false;

void toggle() {
  lit = !lit;
}

void setup() {
  pinMode(PC13, OUTPUT);
  pinMode(PA0, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PA0), toggle, FALLING);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(PC13, lit ? LOW : HIGH);   // PC13 LED is active low
  Serial.println(lit ? "on" : "off");
  delay(200);
}
`);return done(p,{position:[0,110,120],target:[0,0,0]});});
def('esp8266-remote','ESP8266 remote LED','ESP32 + ESP8266','Intermediate',['Wi-Fi','UDP','Heterogeneous boards'],'An ESP32 button sends UDP commands; a NodeMCU switches its LED.',()=>{const p=base('ESP8266 remote LED');add(p,'board','ap',[-60,0,0]);add(p,'esp8266','node',[45,0,0]);add(p,'button','btn',[-60,0,55],{bounce:0});add(p,'led','led',[80,0,45],{color:'#34c759'});add(p,'resistor','r',[80,0,25],{resistance:220},Math.PI/2);
 w(p,'ap:IO4','btn:1','yellow');w(p,'btn:2','ap:GND1','black');w(p,'node:D5','r:A','orange');w(p,'r:B','led:A','orange');w(p,'led:K','node:GND3','black');
 code(p,'ap',`#include <WiFi.h>
bool last = HIGH;

void setup() {
  pinMode(4, INPUT_PULLUP);
  Serial.begin(115200);
  WiFi.softAP("LabNet", "circuitlab");
  UDP.begin(4210);
}

void loop() {
  bool now = digitalRead(4);
  if (now != last) {
    UDP.beginPacket("192.168.4.255", 4210);
    UDP.print(now == LOW ? "ON" : "OFF");
    UDP.endPacket();
    Serial.println(now == LOW ? "sent ON" : "sent OFF");
    last = now;
  }
  delay(10);
}
`);code(p,'node',`#include <ESP8266WiFi.h>
#include <WiFiUdp.h>

WiFiUDP udp;

void setup() {
  pinMode(D5, OUTPUT);
  Serial.begin(115200);
  WiFi.begin("LabNet", "circuitlab");
  udp.begin(4210);
}

void loop() {
  if (udp.parsePacket()) {
    String cmd = udp.readString();
    digitalWrite(D5, cmd == "ON");
    Serial.println(cmd);
  }
  delay(5);
}
`);return done(p,{position:[0,170,190],target:[0,0,10]});});
def('uart-link','Wired UART link','Arduino Uno + ESP32','Advanced',['UART','Level shifting','Multi-board'],'An ESP32 sends readings over Serial2 to an Uno; a divider protects the ESP32 RX pin.',()=>{const p=base('Wired UART link');add(p,'board','esp',[-55,0,0]);add(p,'uno','uno',[45,0,0]);add(p,'resistor','r1',[-5,0,45],{resistance:2000},Math.PI/2);add(p,'resistor','r2',[5,0,45],{resistance:3300},Math.PI/2);
 w(p,'esp:IO17','uno:D0','green');w(p,'uno:D1','r1:A','blue');w(p,'r1:B','esp:IO16','blue');w(p,'r1:B','r2:A','blue');w(p,'r2:B','esp:GND1','black');w(p,'esp:GND2','uno:GND1','black');
 code(p,'esp',`int count = 0;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600);       // TX = GPIO17, RX = GPIO16
}

void loop() {
  Serial2.println(count);
  Serial.print("sent ");
  Serial.println(count);
  count++;
  if (Serial2.available()) {
    Serial.print("Uno says: ");
    Serial.println(Serial2.readStringUntil('\\n'));
  }
  delay(500);
}
`);code(p,'uno',`void setup() {
  Serial.begin(9600);        // pins 0 (RX) and 1 (TX)
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  if (Serial.available()) {
    int n = Serial.readStringUntil('\n').toInt();
    digitalWrite(LED_BUILTIN, n % 2);
    Serial.print("ack ");
    Serial.println(n);
  }
  delay(5);
}
`);return done(p,{position:[0,160,190],target:[0,0,10]});});
// ------------------------------------------------------------------ ESP32 sensors & actuators
def('imu','Tilt sensor (MPU-6050)','ESP32','Advanced',['I²C registers','Wire.requestFrom','int16_t'],'Wake an MPU-6050 and read raw accelerometer registers with Wire.',()=>{const p=base('Tilt sensor');add(p,'board','esp',[-30,0,0]);add(p,'mpu6050','imu',[30,0,10],{ax:.2,ay:-.35,az:.91});w(p,'esp:3V3','imu:VCC','red');w(p,'esp:GND1','imu:GND','black');w(p,'esp:IO21','imu:SDA','blue');w(p,'esp:IO22','imu:SCL','purple');
 code(p,'esp',`#include <Wire.h>
const int MPU = 0x68;

int16_t read16() {
  return (Wire.read() << 8) | Wire.read();
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU);
  Wire.write(0x6B);          // PWR_MGMT_1
  Wire.write(0);             // wake up
  Wire.endTransmission();
}

void loop() {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);          // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU, 6);
  float ax = read16() / 16384.0;
  float ay = read16() / 16384.0;
  float az = read16() / 16384.0;
  float pitch = atan2(ax, sqrt(ay * ay + az * az)) * 180 / PI;
  float roll = atan2(ay, az) * 180 / PI;
  Serial.printf("pitch %.1f  roll %.1f\\n", pitch, roll);
  delay(200);
}
`);return done(p,{position:[0,100,110],target:[0,0,0]});});
def('rtc-oled','Desk clock','ESP32','Advanced',['DS3231','BCD','SSD1306'],'Read a DS3231 real-time clock over I²C and draw the time on an OLED.',()=>{const p=base('Desk clock');add(p,'board','esp',[-35,0,0]);add(p,'ds3231','rtc',[35,0,35]);add(p,'oled','oled',[30,0,-25]);for(const id of ['rtc','oled']){w(p,'esp:3V3',id+':VCC','red');w(p,'esp:GND1',id+':GND','black');w(p,'esp:IO21',id+':SDA','blue');w(p,'esp:IO22',id+':SCL','purple');}
 code(p,'esp',`#include <Wire.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

int bcd(byte b) { return (b >> 4) * 10 + (b & 15); }

void setup() {
  Wire.begin(21, 22);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  Wire.beginTransmission(0x68);
  Wire.write(0);
  Wire.endTransmission();
  Wire.requestFrom(0x68, 3);
  int s = bcd(Wire.read()), m = bcd(Wire.read()), h = bcd(Wire.read() & 0x3F);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("DS3231 clock");
  display.setTextSize(2);
  display.setCursor(16, 28);
  if (h < 10) display.print("0");
  display.print(h);
  display.print(":");
  if (m < 10) display.print("0");
  display.print(m);
  display.print(":");
  if (s < 10) display.print("0");
  display.print(s);
  display.drawRect(0, 22, 128, 30, SSD1306_WHITE);
  display.display();
  delay(250);
}
`);return done(p,{position:[0,110,120],target:[0,0,0]});});
def('pir-alarm','Motion alarm','ESP32','Beginner',['PIR','Buzzer','Logic'],'A PIR sensor triggers a buzzer and LED for a few seconds.',()=>{const p=base('Motion alarm');add(p,'board','esp',[-35,0,0]);add(p,'pir','pir',[40,0,40],{motion:true});add(p,'buzzer','bz',[45,0,-10],{active:true});add(p,'led','led',[20,0,-35],{color:'#ff3b30'});add(p,'resistor','r',[5,0,-35],{resistance:220});
 w(p,'esp:5V','pir:VCC','red');w(p,'esp:GND1','pir:GND','black');w(p,'esp:IO27','pir:OUT','yellow');w(p,'esp:IO26','bz:+','orange');w(p,'bz:-','esp:GND2','black');w(p,'esp:IO25','r:A','red');w(p,'r:B','led:A','red');w(p,'led:K','esp:GND3','black');
 code(p,'esp',`const int PIR = 27, BUZZER = 26, LED = 25;
unsigned long until = 0;
bool wasAlarm = false;

void setup() {
  pinMode(PIR, INPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  if (digitalRead(PIR) == HIGH) until = millis() + 3000;
  bool alarm = millis() < until;
  if (alarm && !wasAlarm) Serial.println("Motion detected!");
  wasAlarm = alarm;
  digitalWrite(LED, alarm);
  digitalWrite(BUZZER, alarm && (millis() / 250) % 2);
  delay(10);
}
`);return done(p,{position:[0,120,140],target:[0,0,0]});});
def('plant','Plant watering','ESP32','Advanced',['Soil sensor','Relay','Transistor','Flyback diode'],'A capacitive soil sensor switches a pump motor through a transistor-driven relay.',()=>{const p=base('Plant watering');add(p,'board','esp',[-55,0,0]);add(p,'soil','soil',[-5,0,-40],{moisture:25},Math.PI/2);add(p,'relay','k',[25,0,30]);add(p,'npn','q',[-5,0,40]);add(p,'resistor','rb',[-20,0,40],{resistance:1000});add(p,'diode','d',[25,0,55],{model:'1N4007'});add(p,'aapack','batt',[75,0,-10],{cells:4});add(p,'motor','pump',[80,0,55]);
 w(p,'esp:3V3','soil:VCC','red');w(p,'esp:GND1','soil:GND','black');w(p,'esp:IO34','soil:AOUT','yellow');w(p,'esp:IO4','rb:A','orange');w(p,'rb:B','q:B','orange');w(p,'q:E','esp:GND2','black');w(p,'esp:5V','k:C1','red');w(p,'k:C2','q:C','gray');w(p,'d:K','k:C1','red');w(p,'d:A','k:C2','gray');w(p,'batt:+','k:COM','red');w(p,'k:NO','pump:+','orange');w(p,'pump:-','batt:-','black');
 code(p,'esp',`const int SOIL = 34, RELAY = 4;
// Capacitive sensor: ~2.8 V dry, ~1.2 V wet.

void setup() {
  pinMode(RELAY, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int mv = analogReadMilliVolts(SOIL);
  bool dry = mv > 2100;
  digitalWrite(RELAY, dry);
  Serial.print(mv);
  Serial.println(dry ? " mV  pump ON" : " mV  pump off");
  delay(500);
}
`);return done(p,{position:[10,170,190],target:[10,0,10]});});
def('motor-pwm','Motor speed control','ESP32','Intermediate',['MOSFET','PWM','Flyback diode'],'A knob sets the PWM duty on a logic-level MOSFET driving a DC motor.',()=>{const p=base('Motor speed control');add(p,'board','esp',[-50,0,0]);add(p,'pot','pot',[-50,0,55],{value:.7});add(p,'mosfet','q',[15,0,25],{model:'IRLZ44N'});add(p,'resistor','rg',[0,0,25],{resistance:220});add(p,'diode','d',[35,0,-15],{model:'1N5819'});add(p,'motor','m',[55,0,30]);add(p,'psu','ps',[60,0,-55],{voltage:6,limit:1.5});
 w(p,'esp:3V3','pot:VCC','red');w(p,'esp:GND1','pot:GND','black');w(p,'esp:IO34','pot:W','yellow');w(p,'esp:IO25','rg:A','orange');w(p,'rg:B','q:G','orange');w(p,'q:S','esp:GND2','black');w(p,'ps:-','esp:GND3','black');w(p,'ps:+','m:+','red');w(p,'m:-','q:D','gray');w(p,'d:K','ps:+','red');w(p,'d:A','q:D','gray');
 code(p,'esp',`void setup() {
  ledcAttach(25, 2000, 8);
  Serial.begin(115200);
}

void loop() {
  int duty = analogRead(34) / 16;      // 12-bit ADC → 8-bit duty
  ledcWrite(25, duty);
  Serial.println(duty);
  delay(50);
}
`);return done(p,{position:[10,170,190],target:[10,0,0]});});
// ------------------------------------------------------------------ analog circuits without a microcontroller
def('555-flasher','555 LED flasher','No microcontroller','Beginner',['NE555','Astable','RC timing'],'A 9 V NE555 astable blinks an LED at about 1.4 Hz: f = 1.44 / ((R1 + 2R2)·C).',()=>{const p=base('555 LED flasher');add(p,'bbhalf','bb',[0,0,0]);add(p,'battery','bat',[-70,0,-5]);on(p,'ne555','u','bb','F10');
 const top=pin=>at(p,'bb','u',pin,'A'),bot=pin=>at(p,'bb','u',pin,'J');on(p,'resistor','r1','bb','B11',{resistance:1000});on(p,'resistor','r2','bb','C12',{resistance:10000});on(p,'electrolytic','c','bb','G18',{capacitance:47e-6,rating:25});on(p,'resistor','rl','bb','I12',{resistance:470});on(p,'led','led','bb','H16',{color:'#ff3b30'});
 w(p,'bat:+','bb:TP1','red');w(p,'bat:-','bb:TN1','black');w(p,'bb:TP25','bb:BP25','red');w(p,'bb:TN24','bb:BN24','black');
 w(p,top('VCC'),'bb:TP6','red');w(p,bot('RESET'),'bb:BP9','red');w(p,bot('GND'),'bb:BN6','black');w(p,'bb:A15','bb:TP11','red');w(p,'bb:A16','bb:D11','yellow');w(p,'bb:A12','bb:J11','green');w(p,'bb:H11','bb:H18','green');w(p,'bb:J19','bb:BN14','black');w(p,'bb:J17','bb:BN12','black');
 return done(p,{position:[-10,150,160],target:[-10,0,0]});});
def('rc-scope','RC filter on a scope','No microcontroller','Intermediate',['Capacitor','Oscilloscope','Time constant'],'A 2 Hz square wave charges a 100 µF capacitor through 1 kΩ; τ = RC = 100 ms.',()=>{const p=base('RC filter on a scope');add(p,'fgen','gen',[-80,0,-10],{wave:'square',frequency:2,amplitude:2.5,offset:2.5});add(p,'resistor','r',[-10,0,40],{resistance:1000});add(p,'electrolytic','c',[15,0,40],{capacitance:100e-6,rating:16});add(p,'scope','scope',[75,0,-10]);
 w(p,'gen:OUT','r:A','yellow');w(p,'r:B','c:+','green');w(p,'c:-','gen:GND','black');w(p,'gen:OUT','scope:CH1','yellow');w(p,'c:+','scope:CH2','blue');w(p,'scope:GND','gen:GND','black');return done(p,{position:[0,140,230],target:[0,20,0]});});
def('rl-scope','RL circuit and inductive current','No microcontroller','Intermediate',['Inductor','Oscilloscope','τ = L/R'],'A square wave drives 1 H in series with 100 Ω; the resistor voltage shows the current rising with τ = 10 ms.',()=>{const p=base('RL circuit');add(p,'fgen','gen',[-80,0,-10],{wave:'square',frequency:10,amplitude:2.5,offset:2.5});add(p,'inductor','l',[-10,0,40],{inductance:1,dcr:1,maxCurrent:200});add(p,'resistor','r',[15,0,40],{resistance:100});add(p,'scope','scope',[75,0,-10]);
 w(p,'gen:OUT','l:A','yellow');w(p,'l:B','r:A','green');w(p,'r:B','gen:GND','black');w(p,'gen:OUT','scope:CH1','yellow');w(p,'r:A','scope:CH2','blue');w(p,'scope:GND','gen:GND','black');return done(p,{position:[0,140,230],target:[0,20,0]});});
def('opamp-amp','Op-amp amplifier','No microcontroller','Intermediate',['LM358','Gain','Oscilloscope'],'A non-inverting LM358 stage with gain 1 + 20k/10k = 3 amplifies a 0.5 V sine.',()=>{const p=base('Op-amp amplifier');add(p,'bbhalf','bb',[0,0,0]);add(p,'psu','vcc',[-100,0,-60],{voltage:9,limit:.5});add(p,'fgen','gen',[-100,0,55],{wave:'sine',frequency:5,amplitude:.5,offset:1.5});add(p,'scope','scope',[115,0,0]);on(p,'opamp','u','bb','F10');
 const top=pin=>at(p,'bb','u',pin,'A'),bot=pin=>at(p,'bb','u',pin,'J');on(p,'resistor','rf','bb','I6',{resistance:20000});on(p,'resistor','rg','bb','G11',{resistance:10000});
 w(p,'vcc:+','bb:TP1','red');w(p,'vcc:-','bb:TN1','black');w(p,'bb:TN25','bb:BN25','black');w(p,top('VCC'),'bb:TP5','red');w(p,bot('GND'),'bb:BN9','black');
 // 20 kΩ feedback from OUT1 (column 10) via I6–I10 to IN1− (column 11); 10 kΩ from IN1− to ground.
 w(p,'bb:J6','bb:H11','green');w(p,'bb:J15','bb:BN13','black');
 w(p,'gen:OUT',bot('IN1+'),'yellow');w(p,'gen:GND','bb:BN3','black');w(p,'gen:OUT','scope:CH1','yellow');w(p,'bb:H10','scope:CH2','blue');w(p,'scope:GND','bb:BN20','black');w(p,top('IN2+'),'bb:TN8','black');w(p,top('IN2-'),top('OUT2'),'gray');
 return done(p,{position:[0,190,230],target:[0,10,0]});});
def('regulator','9 V to 5 V regulator','No microcontroller','Beginner',['LM7805','Multimeter','Power'],'An LM7805 regulates a 9 V battery to 5 V; a multimeter confirms the output.',()=>{const p=base('9 V to 5 V regulator');add(p,'battery','bat',[-60,0,0]);add(p,'regulator','u',[0,0,20]);add(p,'electrolytic','cin',[-15,0,40],{capacitance:10e-6,rating:25});add(p,'electrolytic','cout',[15,0,40],{capacitance:10e-6,rating:16});add(p,'resistor','r',[35,0,10],{resistance:330},Math.PI/2);add(p,'led','led',[45,0,30],{color:'#34c759'});add(p,'multimeter','dmm',[70,0,-60],{mode:'V'});
 w(p,'bat:+','u:IN','red');w(p,'bat:-','u:GND','black');w(p,'u:IN','cin:+','red');w(p,'cin:-','u:GND','black');w(p,'u:OUT','cout:+','orange');w(p,'cout:-','u:GND','black');w(p,'u:OUT','r:A','orange');w(p,'r:B','led:A','orange');w(p,'led:K','u:GND','black');w(p,'dmm:VΩ','u:OUT','red');w(p,'dmm:COM','bat:-','black');return done(p,{position:[0,170,220],target:[0,10,0]});});
def('zener','Zener reference','No microcontroller','Beginner',['Zener diode','Load line','Bench supply'],'A 1N4733A holds about 5 V across its terminals while the supply varies.',()=>{const p=base('Zener reference');add(p,'psu','ps',[-70,0,-30],{voltage:12,limit:.2});add(p,'resistor','r',[0,0,30],{resistance:470});add(p,'diode','z',[30,0,30],{model:'1N4733A (5.1 V Zener)'});add(p,'multimeter','dmm',[70,0,-40],{mode:'V'});
 w(p,'ps:+','r:A','red');w(p,'r:B','z:K','orange');w(p,'z:A','ps:-','black');w(p,'dmm:VΩ','z:K','red');w(p,'dmm:COM','ps:-','black');return done(p,{position:[0,170,220],target:[0,10,0]});});
def('transistor-lamp','Transistor lamp switch','No microcontroller','Beginner',['BJT','Saturation','Push button'],'A button feeds base current to a 2N2222A that switches a 6 V lamp.',()=>{const p=base('Transistor lamp switch');add(p,'aapack','batt',[-70,0,0],{cells:4});add(p,'button','btn',[-15,0,40],{bounce:0});add(p,'resistor','rb',[5,0,40],{resistance:1000});add(p,'npn','q',[25,0,40]);add(p,'lamp','lamp',[40,0,0]);
 w(p,'batt:+','btn:1','red');w(p,'btn:2','rb:A','orange');w(p,'rb:B','q:B','orange');w(p,'q:E','batt:-','black');w(p,'batt:+','lamp:A','red');w(p,'lamp:B','q:C','gray');return done(p,{position:[0,130,170],target:[0,5,10]});});
def('dmm-ohms','Measuring with a multimeter','No microcontroller','Beginner',['Multimeter','Voltage divider','Ohm’s law'],'Measure a divider: volts across R2, and the resistance of R1 alone.',()=>{const p=base('Measuring with a multimeter');add(p,'battery','bat',[-60,0,0]);add(p,'resistor','r1',[0,0,30],{resistance:4700});add(p,'resistor','r2',[25,0,30],{resistance:10000});add(p,'multimeter','dmm',[60,0,-50],{mode:'V'});add(p,'resistor','rx',[0,0,-40],{resistance:2200});add(p,'multimeter','ohm',[-60,0,-90],{mode:'Ω'});
 w(p,'bat:+','r1:A','red');w(p,'r1:B','r2:A','yellow');w(p,'r2:B','bat:-','black');w(p,'dmm:VΩ','r2:A','red');w(p,'dmm:COM','r2:B','black');w(p,'ohm:VΩ','rx:A','red');w(p,'ohm:COM','rx:B','black');return done(p,{position:[0,200,230],target:[0,10,-10]});});

// ------------------------------------------------------------------ power, magnetics and signals
def('linear-psu','Linear power supply','No microcontroller','Intermediate',['Transformer','Bridge rectifier','7805','Ripple'],'230 V AC → 12 V transformer → bridge → 1000 µF → 7805. The scope shows the 100 Hz ripple on the capacitor and the flat 5 V after the regulator.',()=>{const p=base('Linear power supply');add(p,'acsource','ac',[-175,0,-10],{vrms:230});add(p,'transformer','t',[-85,0,0]);add(p,'bridge','br',[-35,0,0]);add(p,'electrolytic','c',[-10,0,10],{capacitance:1000e-6,rating:25});add(p,'regulator','u',[15,0,10]);add(p,'electrolytic','co',[35,0,10],{capacitance:10e-6,rating:16});add(p,'resistor','rl',[55,0,25],{resistance:330},Math.PI/2);add(p,'led','led',[55,0,45],{color:'#34c759'});add(p,'multimeter','dmm',[10,0,-110],{mode:'V'});add(p,'scope','scope',[150,0,-20]);
 w(p,'ac:L','t:P1','red');w(p,'ac:N','t:P2','black');w(p,'t:S1','br:AC1','yellow');w(p,'t:S2','br:AC2','yellow');w(p,'br:+','c:+','red');w(p,'br:-','c:-','black');w(p,'c:+','u:IN','red');w(p,'c:-','u:GND','black');w(p,'u:OUT','co:+','orange');w(p,'co:-','u:GND','black');w(p,'u:OUT','rl:A','orange');w(p,'rl:B','led:A','orange');w(p,'led:K','c:-','black');
 w(p,'dmm:VΩ','u:OUT','red');w(p,'dmm:COM','c:-','black');w(p,'scope:CH1','c:+','yellow');w(p,'scope:CH2','u:OUT','blue');w(p,'scope:GND','c:-','black');return done(p,{position:[-10,230,260],target:[-10,0,-10]});});
def('ct-rectifier','Center-tap full-wave rectifier','No microcontroller','Intermediate',['Center-tap transformer','Diodes','Full wave'],'A 9-0-9 V transformer and two diodes rectify both half-cycles; the center tap is 0 V.',()=>{const p=base('Center-tap full-wave rectifier');add(p,'acsource','ac',[-165,0,-10],{vrms:230});add(p,'transformerct','t',[-75,0,0]);add(p,'diode','d1',[-25,0,-15],{model:'1N4007'});add(p,'diode','d2',[-25,0,15],{model:'1N4007'});add(p,'electrolytic','c',[5,0,0],{capacitance:470e-6,rating:25});add(p,'resistor','r',[30,0,0],{resistance:1000},Math.PI/2);add(p,'scope','scope',[130,0,-20]);
 w(p,'ac:L','t:P1','red');w(p,'ac:N','t:P2','black');w(p,'t:S1','d1:A','yellow');w(p,'t:S2','d2:A','yellow');w(p,'d1:K','c:+','red');w(p,'d2:K','c:+','red');w(p,'t:CT','c:-','black');w(p,'c:+','r:A','red');w(p,'r:B','c:-','black');w(p,'scope:CH1','t:S1','yellow');w(p,'scope:CH2','c:+','blue');w(p,'scope:GND','t:CT','black');return done(p,{position:[-10,200,230],target:[-10,0,0]});});
def('4017-chaser','555 + CD4017 LED chaser','No microcontroller','Intermediate',['NE555','CD4017','Decade counter'],'The 555 clocks a CD4017 about 7 times a second; its ten outputs walk one lit segment along an LED bar. The 4017’s weak CMOS outputs limit the LED current.',()=>{const p=base('555 + CD4017 LED chaser');add(p,'bbfull','bb',[0,0,0]);add(p,'battery','bat',[-125,0,-5]);on(p,'ne555','t','bb','F10');on(p,'resistor','r1','bb','B11',{resistance:1000});on(p,'resistor','r2','bb','C12',{resistance:10000});on(p,'electrolytic','c','bb','G18',{capacitance:10e-6,rating:25});
 on(p,'cd4017','u','bb','F30');on(p,'ledbar','bar','bb','F45',{color:'#ff5a36'});const top=pin=>at(p,'bb','t',pin,'A'),bot=pin=>at(p,'bb','t',pin,'J');
 w(p,'bat:+','bb:TP1','red');w(p,'bat:-','bb:TN1','black');w(p,'bb:TP50','bb:BP50','red');w(p,'bb:TN49','bb:BN49','black');
 w(p,top('VCC'),rail(p,'bb','TP',10),'red');w(p,bot('RESET'),rail(p,'bb','BP',13),'red');w(p,bot('GND'),rail(p,'bb','BN',10),'black');w(p,'bb:A15',rail(p,'bb','TP',15),'red');w(p,'bb:A16','bb:D11','yellow');w(p,'bb:A12','bb:J11','green');w(p,'bb:H11','bb:H18','green');w(p,'bb:J19',rail(p,'bb','BN',19),'black');
 const ut=pin=>at(p,'bb','u',pin,'A'),ub=(pin,row='J')=>at(p,'bb','u',pin,row);w(p,ut('VDD'),rail(p,'bb','TP',30),'red');w(p,ub('VSS'),rail(p,'bb','BN',37),'black');w(p,ut('CE'),rail(p,'bb','TN',33),'black');w(p,ut('MR'),rail(p,'bb','TN',31),'black');w(p,'bb:I12',ut('CLK').replace(':A',':B'),'yellow');
 const anode=i=>at(p,'bb','bar','A'+i,'J'),cath=i=>at(p,'bb','bar','K'+i,'A');for(let i=1;i<=10;i++)w(p,cath(i),rail(p,'bb','TN',+cath(i).slice(4)),'black');
 const q=['Q0','Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8','Q9'],rows='GHIJ';q.forEach((pin,i)=>{const t=terminals(get(p,'u')).find(t=>t.id===pin),topRow=t.p[2]<0;w(p,topRow?ut(pin).replace(':A',':'+'BCD'[i%3]):ub(pin,rows[i%4]),anode(i+1).replace(':J',':'+(topRow?'G':rows[(i+1)%4])),['orange','yellow','green','blue','purple','white','gray','orange','yellow','green'][i]);});
 return done(p,{position:[0,190,170],target:[0,0,0]});});
def('half-adder','Half adder with logic gates','No microcontroller','Beginner',['74HC86','74HC08','Truth table'],'Two buttons are the inputs A and B (10 kΩ pull-downs keep them LOW when released). XOR gives the sum bit and AND gives the carry bit: 1 + 1 = 10 in binary.',()=>{const p=base('Half adder with logic gates');add(p,'bbfull','bb',[0,0,0]);add(p,'aapack','bat',[-125,0,-5],{cells:3});
 on(p,'button','ba','bb','E5');on(p,'resistor','pa','bb','I7',{resistance:10000});on(p,'button','bb2','bb','E14');on(p,'resistor','pb','bb','I16',{resistance:10000});on(p,'hc86','x','bb','F25');on(p,'hc08','a','bb','F40');
 on(p,'resistor','rs','bb','G52',{resistance:330});on(p,'led','sum','bb','H56',{color:'#34c759'});on(p,'resistor','rc','bb','B52',{resistance:330});on(p,'led','carry','bb','C56',{color:'#ff3b30'});
 w(p,'bat:+','bb:TP1','red');w(p,'bat:-','bb:TN1','black');w(p,'bb:TP50','bb:BP50','red');w(p,'bb:TN49','bb:BN49','black');
 w(p,'bb:A5',rail(p,'bb','TP',5),'red');w(p,'bb:J11',rail(p,'bb','BN',11),'black');w(p,'bb:A14',rail(p,'bb','TP',14),'red');w(p,'bb:J20',rail(p,'bb','BN',20),'black');
 const xt=pin=>at(p,'bb','x',pin,'A'),xb=(pin,r='J')=>at(p,'bb','x',pin,r),at2=pin=>at(p,'bb','a',pin,'A'),ab=(pin,r='J')=>at(p,'bb','a',pin,r);
 w(p,xt('VCC'),rail(p,'bb','TP',25),'red');w(p,xb('GND'),rail(p,'bb','BN',31),'black');w(p,at2('VCC'),rail(p,'bb','TP',40),'red');w(p,ab('GND'),rail(p,'bb','BN',46),'black');
 w(p,'bb:G7',xb('1A'),'yellow');w(p,'bb:H7',ab('1A'),'yellow');w(p,'bb:G16',xb('1B'),'blue');w(p,'bb:H16',ab('1B'),'blue');
 w(p,xb('1Y','I'),'bb:J52','green');w(p,'bb:J57',rail(p,'bb','BN',57),'black');w(p,ab('1Y','I'),'bb:D52','orange');w(p,'bb:A57',rail(p,'bb','TN',57),'black');
 // CMOS inputs must never float: tie every unused gate input to ground.
 for(const id of ['x','a'])for(const pin of ['2A','2B','3A','3B','4A','4B']){const t=terminals(get(p,id)).find(t=>t.id===pin),top=t.p[2]<0;w(p,at(p,'bb',id,pin,top?'D':'G'),rail(p,'bb',top?'TN':'BN',+at(p,'bb',id,pin,'A').slice(4)),'black');}
 return done(p,{position:[0,190,170],target:[0,0,0]});});
def('h-bridge','H-bridge motor direction','Arduino Uno','Intermediate',['L293D','H-bridge','PWM'],'An L293D reverses a DC motor: forward, stop, reverse, with PWM on the enable pin for speed.',()=>{const p=base('H-bridge motor direction');add(p,'uno','uno',[-80,0,0]);add(p,'l293d','drv',[10,0,20]);add(p,'motor','m',[70,0,25]);add(p,'battery','bat',[30,0,-50]);
 w(p,'uno:5V','drv:VCC1','red');w(p,'uno:GND1','drv:GND1','black');w(p,'bat:+','drv:VCC2','red');w(p,'bat:-','drv:GND2','black');w(p,'uno:D9','drv:EN12','orange');w(p,'uno:D7','drv:1A','yellow');w(p,'uno:D8','drv:2A','green');w(p,'drv:1Y','m:+','blue');w(p,'drv:2Y','m:-','purple');
 code(p,'uno',`const int EN = 9, IN1 = 7, IN2 = 8;\n\nvoid drive(int speed, bool forward) {\n  digitalWrite(IN1, forward ? HIGH : LOW);\n  digitalWrite(IN2, forward ? LOW : HIGH);\n  analogWrite(EN, speed);\n}\n\nvoid setup() {\n  pinMode(EN, OUTPUT);\n  pinMode(IN1, OUTPUT);\n  pinMode(IN2, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println("forward");\n  drive(255, true);\n  delay(1500);\n  Serial.println("stop");\n  analogWrite(EN, 0);\n  delay(700);\n  Serial.println("reverse");\n  drive(200, false);\n  delay(1500);\n  analogWrite(EN, 0);\n  delay(700);\n}\n`);return done(p,{position:[0,170,200],target:[0,0,0]});});
def('stepper','Stepper motor with ULN2003','Arduino Uno','Intermediate',['28BYJ-48','ULN2003','Half-step'],'Half-stepping a 28BYJ-48 through a ULN2003: 4096 half-steps make one turn of the geared shaft.',()=>{const p=base('Stepper motor with ULN2003');add(p,'uno','uno',[-80,0,0]);add(p,'uln2003','drv',[5,0,20]);add(p,'stepper','m',[60,0,0]);
 for(const [i,pin]of [[1,8],[2,9],[3,10],[4,11]])w(p,'uno:D'+pin,'drv:IN'+i,['blue','purple','yellow','orange'][i-1]);w(p,'uno:GND1','drv:GND','black');w(p,'uno:5V','drv:COM','red');w(p,'uno:5V','m:RED','red');w(p,'drv:OUT1','m:BLUE','blue');w(p,'drv:OUT2','m:PINK','purple');w(p,'drv:OUT3','m:YELLOW','yellow');w(p,'drv:OUT4','m:ORANGE','orange');
 code(p,'uno',`// Half-step sequence: Blue, Blue+Pink, Pink, Pink+Yellow, …\nconst int coil[4] = {8, 9, 10, 11};\nconst byte steps[8] = {0b0001, 0b0011, 0b0010, 0b0110, 0b0100, 0b1100, 0b1000, 0b1001};\nint phase = 0;\nlong count = 0;\n\nvoid setup() {\n  for (int i = 0; i < 4; i++) pinMode(coil[i], OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  for (int i = 0; i < 4; i++) digitalWrite(coil[i], (steps[phase] >> i) & 1);\n  phase = (phase + 1) % 8;\n  count++;\n  if (count % 512 == 0) {\n    Serial.print("turned ");\n    Serial.print(count * 360 / 4096);\n    Serial.println(" degrees");\n  }\n  delay(2);\n}\n`);return done(p,{position:[0,170,190],target:[0,0,0]});});
def('lm317-supply','Adjustable LM317 supply','No microcontroller','Beginner',['LM317','Panel meter','Vout = 1.25 (1 + R2/R1)'],'Turn the pot: the LM317 keeps 1.25 V across the 240 Ω resistor, so Vout = 1.25 V × (1 + R2/240 Ω). A panel meter shows it.',()=>{const p=base('Adjustable LM317 supply');add(p,'psu','ps',[-110,0,-10],{voltage:15,limit:1});add(p,'lm317','u',[-25,0,10]);add(p,'resistor','r1',[0,0,-5],{resistance:240});add(p,'pot','pot',[-5,0,35],{value:.75,resistance:5000});add(p,'electrolytic','co',[25,0,10],{capacitance:10e-6,rating:25});add(p,'resistor','load',[45,0,10],{resistance:1000},Math.PI/2);add(p,'panelmeter','vm',[60,0,-45]);
 w(p,'ps:+','u:IN','red');w(p,'u:OUT','r1:B','orange');w(p,'r1:A','u:ADJ','yellow');w(p,'u:ADJ','pot:VCC','yellow');w(p,'pot:W','pot:GND','gray');w(p,'pot:GND','ps:-','black');w(p,'u:OUT','co:+','orange');w(p,'co:-','ps:-','black');w(p,'u:OUT','load:A','orange');w(p,'load:B','ps:-','black');w(p,'ps:+','vm:V+','red');w(p,'u:OUT','vm:VIN','yellow');w(p,'vm:GND','ps:-','black');return done(p,{position:[-10,170,190],target:[-10,0,0]});});
def('buck-converter','12 V to 5 V buck converter','No microcontroller','Beginner',['LM2596','Switching regulator','Efficiency'],'An LM2596 module steps 12 V down to 5 V. Input current is lower than output current: power in = power out ÷ efficiency.',()=>{const p=base('12 V to 5 V buck converter');add(p,'psu','ps',[-110,0,-10],{voltage:12,limit:2});add(p,'buck','b',[-20,0,10],{vout:5});add(p,'lamp','lamp',[40,0,25],{ratedVoltage:6,ratedCurrent:.1});add(p,'panelmeter','vm',[40,0,-35]);add(p,'multimeter','dmm',[-110,0,110],{mode:'A'});
 w(p,'ps:+','dmm:A','red');w(p,'dmm:COM','b:IN+','red');w(p,'ps:-','b:IN-','black');w(p,'b:OUT+','lamp:A','orange');w(p,'lamp:B','b:OUT-','black');w(p,'b:OUT+','vm:V+','red');w(p,'b:OUT+','vm:VIN','yellow');w(p,'vm:GND','b:OUT-','black');return done(p,{position:[-30,210,230],target:[-30,0,20]});});
def('opto-isolation','Optocoupler isolation','Arduino Uno','Intermediate',['PC817','Isolation','Separate grounds'],'The Uno blinks the PC817’s internal LED; light crosses the isolation gap and switches an LED powered by a separate 9 V battery with its own ground.',()=>{const p=base('Optocoupler isolation');add(p,'uno','uno',[-80,0,0]);add(p,'resistor','rin',[0,0,0],{resistance:330});add(p,'pc817','opto',[25,0,0]);add(p,'battery','bat',[85,0,-35]);add(p,'resistor','rl',[55,0,25],{resistance:1000},Math.PI/2);add(p,'led','led',[75,0,40],{color:'#34c759'});
 w(p,'uno:D4','rin:A','yellow');w(p,'rin:B','opto:A','yellow');w(p,'opto:K','uno:GND1','black');w(p,'bat:+','rl:A','red');w(p,'rl:B','led:A','orange');w(p,'led:K','opto:C','green');w(p,'opto:E','bat:-','black');
 code(p,'uno',`void setup() {\n  pinMode(4, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(4, HIGH);\n  delay(400);\n  digitalWrite(4, LOW);\n  delay(400);\n}\n`);return done(p,{position:[0,150,170],target:[0,0,0]});});
def('comparator-night','Comparator night light','No microcontroller','Beginner',['LM393','LDR','Pull-up'],'No code: an LM393 compares an LDR divider with a reference from a pot. In the dark the divider falls below the reference and the open-collector output pulls the LED’s cathode low.',()=>{const p=base('Comparator night light');add(p,'aapack','bat',[-110,0,0],{cells:4});add(p,'lm393','u',[0,0,0]);add(p,'ldr','ldr',[-40,0,30],{lux:2});add(p,'resistor','rd',[-40,0,-25],{resistance:10000},Math.PI/2);add(p,'pot','ref',[-25,0,55],{value:.5});add(p,'resistor','rl',[40,0,-25],{resistance:330},Math.PI/2);add(p,'led','led',[45,0,10],{color:'#ffcc00'});
 w(p,'bat:+','u:VCC','red');w(p,'bat:-','u:GND','black');w(p,'bat:+','ldr:A','red');w(p,'ldr:B','rd:A','yellow');w(p,'rd:B','bat:-','black');w(p,'ldr:B','u:IN1+','yellow');w(p,'bat:+','ref:VCC','red');w(p,'ref:GND','bat:-','black');w(p,'ref:W','u:IN1-','blue');w(p,'bat:+','rl:A','red');w(p,'rl:B','led:A','orange');w(p,'led:K','u:OUT1','green');return done(p,{position:[-20,150,170],target:[-20,0,10]});});
def('traffic-module','Traffic light module','Arduino Uno','Beginner',['Traffic light','Timing','digitalWrite'],'A ready-made traffic light module (resistors on board) runs a real cycle: green, yellow, red, red + yellow.',()=>{const p=base('Traffic light module');add(p,'uno','uno',[-50,0,0]);add(p,'trafficlight','tl',[30,0,-5]);
 w(p,'uno:D2','tl:R','red');w(p,'uno:D3','tl:Y','yellow');w(p,'uno:D4','tl:G','green');w(p,'uno:GND2','tl:GND','black');
 code(p,'uno',`const int RED = 2, YELLOW = 3, GREEN = 4;\n\nvoid show(bool r, bool y, bool g, int ms) {\n  digitalWrite(RED, r);\n  digitalWrite(YELLOW, y);\n  digitalWrite(GREEN, g);\n  delay(ms);\n}\n\nvoid setup() {\n  pinMode(RED, OUTPUT);\n  pinMode(YELLOW, OUTPUT);\n  pinMode(GREEN, OUTPUT);\n}\n\nvoid loop() {\n  show(0, 0, 1, 3000);\n  show(0, 1, 0, 1000);\n  show(1, 0, 0, 3000);\n  show(1, 1, 0, 800);\n}\n`);return done(p,{position:[0,140,150],target:[0,0,0]});});
def('solar-meter','Solar panel under load','No microcontroller','Beginner',['Solar panel','I–V curve','Multimeter'],'A 6 V 1 W panel lights a 6 V bulb. Change the sunlight: the current follows the light, and the bulb dims well before the panel voltage collapses.',()=>{const p=base('Solar panel under load');add(p,'solar','pv',[-60,0,0],{irradiance:800});add(p,'lamp','load',[30,0,30],{ratedVoltage:6,ratedCurrent:.1});add(p,'multimeter','dmm',[60,0,-60],{mode:'V'});add(p,'multimeter','amm',[-20,0,110],{mode:'A'});
 w(p,'pv:+','amm:A','red');w(p,'amm:COM','load:A','red');w(p,'load:B','pv:-','black');w(p,'dmm:VΩ','load:A','red');w(p,'dmm:COM','pv:-','black');return done(p,{position:[0,220,230],target:[0,0,10]});});
def('fuse-protection','Fuse protection','No microcontroller','Beginner',['Fuse','Short circuit','I²t'],'A 500 mA fast fuse feeds a lamp. Hold the “fault” button to short the lamp: the fuse blows in milliseconds and the circuit stays open until you replace it.',()=>{const p=base('Fuse protection');add(p,'psu','ps',[-100,0,-10],{voltage:6,limit:3});add(p,'fuse','f',[-20,0,10]);add(p,'lamp','lamp',[25,0,10],{ratedVoltage:6,ratedCurrent:.1});add(p,'button','fault',[25,0,45]);
 w(p,'ps:+','f:A','red');w(p,'f:B','lamp:A','red');w(p,'lamp:B','ps:-','black');w(p,'lamp:A','fault:1','orange');w(p,'fault:2','lamp:B','orange');return done(p,{position:[-20,140,160],target:[-20,0,10]});});
def('door-alarm','Reed switch door alarm','ESP32','Beginner',['Reed switch','INPUT_PULLUP','Buzzer'],'A magnet on the door keeps the reed switch closed. Open the door (move the magnet away) and the ESP32 sounds the buzzer.',()=>{const p=base('Reed switch door alarm');add(p,'board','esp',[-50,0,0]);add(p,'reed','reed',[20,0,-20],{distance:3});add(p,'buzzer','bz',[25,0,25]);
 w(p,'esp:IO27','reed:A','yellow');w(p,'reed:B','esp:GND1','black');w(p,'esp:IO26','bz:+','red');w(p,'bz:-','esp:GND1','black');
 code(p,'esp',`const int REED = 27, BUZZER = 26;\n\nvoid setup() {\n  pinMode(REED, INPUT_PULLUP);\n  pinMode(BUZZER, OUTPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  bool open = digitalRead(REED) == HIGH;  // magnet gone: contacts open, pull-up wins\n  digitalWrite(BUZZER, open);\n  if (open) Serial.println("Door open!");\n  delay(200);\n}\n`);return done(p,{position:[0,130,150],target:[0,0,0]});});
def('ir-obstacle','IR obstacle detector','Arduino Nano','Beginner',['FC-51','Active LOW','LED'],'An FC-51 infrared sensor pulls its output LOW when something comes within range; the Nano lights its L LED and prints the event.',()=>{const p=base('IR obstacle detector');add(p,'nano','nano',[-30,0,0]);add(p,'irsensor','ir',[35,0,0],{distance:40,threshold:15});
 w(p,'nano:5V','ir:VCC','red');w(p,'nano:GND1','ir:GND','black');w(p,'nano:D2','ir:OUT','yellow');
 code(p,'nano',`void setup() {\n  pinMode(2, INPUT);\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  bool blocked = digitalRead(2) == LOW;\n  digitalWrite(13, blocked);\n  Serial.println(blocked ? "obstacle" : "clear");\n  delay(250);\n}\n`);return done(p,{position:[0,110,120],target:[0,0,0]});});
def('pwm-scope','PWM generator on the scope','No microcontroller','Beginner',['XY-LPWM','Duty cycle','Oscilloscope'],'An XY-LPWM module makes a 20 Hz, 30 % square wave at its supply voltage. The scope shows the pulses and the LED brightness follows the duty cycle.',()=>{const p=base('PWM generator on the scope');add(p,'psu','ps',[-110,0,-10],{voltage:9,limit:1});add(p,'pwmgen','g',[-20,0,10],{frequency:20,duty:.3});add(p,'resistor','r',[30,0,30],{resistance:470},Math.PI/2);add(p,'led','led',[45,0,45],{color:'#3a8bff'});add(p,'scope','scope',[110,0,-20]);
 w(p,'ps:+','g:VIN+','red');w(p,'ps:-','g:VIN-','black');w(p,'g:PWM','r:A','yellow');w(p,'r:B','led:A','yellow');w(p,'led:K','g:GND','black');w(p,'scope:CH1','g:PWM','yellow');w(p,'scope:GND','g:GND','black');return done(p,{position:[0,180,220],target:[0,0,0]});});
def('speaker-tone','Speaker with a transistor driver','Arduino Uno','Beginner',['Speaker','tone()','NPN driver'],'tone() on D8 switches an NPN transistor that drives an 8 Ω speaker through 100 Ω. Straight from the pin the speaker would try to draw over 100 mA.',()=>{const p=base('Speaker with a transistor driver');add(p,'uno','uno',[-70,0,0]);add(p,'resistor','rb',[0,0,0],{resistance:1000});add(p,'npn','q',[25,0,0],{model:'2N2222A'});add(p,'resistor','rs',[45,0,-25],{resistance:100},Math.PI/2);add(p,'speaker','spk',[75,0,-30]);add(p,'diode','d',[55,0,25],{model:'1N4148'});
 w(p,'uno:D8','rb:A','yellow');w(p,'rb:B','q:B','yellow');w(p,'q:E','uno:GND1','black');w(p,'uno:5V','rs:A','red');w(p,'rs:B','spk:+','red');w(p,'spk:-','q:C','blue');w(p,'d:K','spk:+','gray');w(p,'d:A','spk:-','gray');
 code(p,'uno',`const int notes[] = {262, 330, 392, 523};\n\nvoid setup() {}\n\nvoid loop() {\n  for (int i = 0; i < 4; i++) {\n    tone(8, notes[i]);\n    delay(300);\n  }\n  noTone(8);\n  delay(600);\n}\n`);return done(p,{position:[0,150,170],target:[0,0,0]});});
export const PROJECTS=P;
export const projectById=id=>P.find(x=>x.id===id);
