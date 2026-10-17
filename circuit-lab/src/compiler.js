// Preprocessor + lexer, recursive-descent parser, typed bytecode compiler and bounded stack VM.
// This is an explicitly restricted Arduino-style C++ subset, not an AVR/Xtensa/ARM emulator.
export class CompileError extends Error {constructor(message,line=1){super(message);this.line=line;this.name='CompileError';}}
const TYPE_WORDS=new Set(['void','int','float','double','bool','boolean','long','short','byte','char','unsigned','signed','word','size_t','uint8_t','int8_t','uint16_t','int16_t','uint32_t','int32_t','uint64_t','int64_t','String','auto']);
const QUALIFIERS=new Set(['const','volatile','static','constexpr','inline','unsigned','signed']);
export const CLASSES={Servo:'Servo',LiquidCrystal_I2C:'LiquidCrystal_I2C',Adafruit_SSD1306:'Adafruit_SSD1306',DHT:'DHT',Adafruit_NeoPixel:'Adafruit_NeoPixel',SoftwareSerial:'SoftwareSerial',WiFiUDP:'WiFiUDP'};
export const LIBRARIES=['Arduino.h','Wire.h','SPI.h','Servo.h','ESP32Servo.h','LiquidCrystal_I2C.h','Adafruit_GFX.h','Adafruit_SSD1306.h','DHT.h','DHT_U.h','Adafruit_Sensor.h','Adafruit_NeoPixel.h','SoftwareSerial.h','WiFi.h','ESP8266WiFi.h','WiFiUdp.h','EEPROM.h','math.h','stdint.h'];
export const CONSTANTS={HIGH:1,LOW:0,INPUT:0,OUTPUT:1,INPUT_PULLUP:2,CHANGE:1,RISING:2,FALLING:3,PI:Math.PI,HALF_PI:Math.PI/2,TWO_PI:Math.PI*2,DEG_TO_RAD:Math.PI/180,RAD_TO_DEG:180/Math.PI,EULER:Math.E,HEX:16,DEC:10,OCT:8,BIN:2,LSBFIRST:0,MSBFIRST:1,true:1,false:0,NULL:0,
 WL_IDLE_STATUS:0,WL_NO_SSID_AVAIL:1,WL_CONNECTED:3,WL_CONNECT_FAILED:4,WL_DISCONNECTED:6,WIFI_OFF:0,WIFI_STA:1,WIFI_AP:2,WIFI_AP_STA:3,ADC_0db:0,ADC_2_5db:1,ADC_6db:2,ADC_11db:3,DEFAULT:1,INTERNAL:3,EXTERNAL:0,
 NEO_GRB:82,NEO_RGB:6,NEO_RGBW:27,NEO_KHZ800:0,NEO_KHZ400:256,DHT11:11,DHT22:22,DHT21:21,AM2301:21,SSD1306_SWITCHCAPVCC:2,SSD1306_EXTERNALVCC:1,SSD1306_WHITE:1,SSD1306_BLACK:0,SSD1306_INVERSE:2,WHITE:1,BLACK:0,INVERSE:2,NAN:NaN,INFINITY:Infinity,Serial:1,SERIAL_8N1:6};
const FLOAT_CONSTANTS=new Set(['PI','HALF_PI','TWO_PI','DEG_TO_RAD','RAD_TO_DEG','EULER','NAN','INFINITY']);
// Return types of host calls. Unlisted calls return int.
const RET={millis:'ulong',micros:'ulong',pulseIn:'ulong',pulseInLong:'ulong',map:'long',random:'long',sqrt:'double',sin:'double',cos:'double',tan:'double',atan:'double',atan2:'double',asin:'double',acos:'double',exp:'double',log:'double',log10:'double',pow:'double',floor:'double',ceil:'double',fabs:'double',round:'long',sq:'*',abs:'*',min:'*',max:'*',constrain:'*',
 String:'String',F:'String','String.substring':'String','String.toUpperCase':'String','String.toLowerCase':'String','String.trim':'String','String.replace':'String','String.concat':'String','String.c_str':'String','String.toFloat':'float','String.toInt':'long','String.toString':'String',
 'Serial.readString':'String','Serial.readStringUntil':'String','Serial.parseFloat':'float','Serial.parseInt':'long','Serial.read':'int','Serial.peek':'int','WiFi.localIP':'String','WiFi.softAPIP':'String','WiFi.macAddress':'String','WiFi.SSID':'String','UDP.readString':'String','UDP.remoteIP':'String','WiFiUDP.readString':'String','WiFiUDP.remoteIP':'String','SoftwareSerial.readString':'String',
 'DHT.readTemperature':'float','DHT.readHumidity':'float','DHT.computeHeatIndex':'float','Adafruit_NeoPixel.Color':'u32','Adafruit_NeoPixel.ColorHSV':'u32','Adafruit_NeoPixel.gamma32':'u32','analogReadMilliVolts':'u32'};
const CORE=['pinMode','digitalWrite','digitalRead','analogRead','analogWrite','analogReference','analogReadResolution','analogWriteResolution','analogWriteFreq','analogWriteRange','analogReadMilliVolts','analogSetAttenuation','dacWrite','ledcAttach','ledcWrite','ledcSetup','ledcAttachPin','ledcWriteTone','tone','noTone','delay','delayMicroseconds','millis','micros','pulseIn','pulseInLong','shiftOut','shiftIn','attachInterrupt','detachInterrupt','digitalPinToInterrupt','interrupts','noInterrupts','timerEvery','timerCancel','random','randomSeed','min','max','abs','sq','sqrt','pow','sin','cos','tan','atan','atan2','asin','acos','exp','log','log10','floor','ceil','round','fabs','map','constrain','bitRead','bitWrite','bitSet','bitClear','bit','highByte','lowByte','isnan','isinf','F','String','yield','ESP.restart',
 'Serial.begin','Serial.end','Serial.print','Serial.println','Serial.printf','Serial.write','Serial.available','Serial.read','Serial.peek','Serial.readString','Serial.readStringUntil','Serial.parseInt','Serial.parseFloat','Serial.flush','Serial.setTimeout',
 'Wire.begin','Wire.beginTransmission','Wire.write','Wire.endTransmission','Wire.requestFrom','Wire.available','Wire.read','Wire.setClock','SPI.begin','SPI.transfer','SPI.beginTransaction','SPI.endTransaction','SPI.end',
 'WiFi.softAP','WiFi.begin','WiFi.status','WiFi.localIP','WiFi.softAPIP','WiFi.disconnect','WiFi.softAPdisconnect','WiFi.mode','WiFi.macAddress','WiFi.SSID','UDP.begin','UDP.beginPacket','UDP.print','UDP.write','UDP.endPacket','UDP.parsePacket','UDP.readString','UDP.read','UDP.remoteIP','UDP.remotePort','UDP.stop',
 'LCD.begin','LCD.clear','LCD.setCursor','LCD.print','LCD.println','LCD.display','OLED.begin','OLED.clear','OLED.clearDisplay','OLED.setCursor','OLED.print','OLED.println','OLED.display','EEPROM.read','EEPROM.write','EEPROM.update','EEPROM.begin','EEPROM.commit','EEPROM.length'];
const STRING_METHODS={length:0,toInt:0,toFloat:0,indexOf:0,lastIndexOf:0,substring:0,charAt:0,startsWith:0,endsWith:0,equals:0,equalsIgnoreCase:0,compareTo:0,c_str:0,toString:0,toUpperCase:1,toLowerCase:1,trim:1,replace:1,concat:1};
const METHODS={Servo:['attach','write','writeMicroseconds','read','readMicroseconds','attached','detach'],LiquidCrystal_I2C:['init','begin','backlight','noBacklight','clear','home','setCursor','print','println','display','noDisplay'],Adafruit_SSD1306:['begin','clearDisplay','display','setTextSize','setTextColor','setCursor','print','println','drawPixel','drawLine','drawRect','fillRect','drawCircle','fillCircle','fillScreen','invertDisplay','width','height','setRotation','dim'],DHT:['begin','readTemperature','readHumidity','computeHeatIndex'],Adafruit_NeoPixel:['begin','show','clear','setPixelColor','Color','ColorHSV','gamma32','setBrightness','getBrightness','numPixels','fill'],SoftwareSerial:['begin','print','println','write','available','read','peek','readString','listen','end'],WiFiUDP:['begin','beginPacket','print','write','endPacket','parsePacket','readString','read','remoteIP','remotePort','stop','available']};
export const API=new Set([...CORE,...Object.entries(METHODS).flatMap(([c,m])=>m.map(n=>c+'.'+n))]);
const FAMILY_ONLY={'ledcAttach':['esp32'],'ledcWrite':['esp32'],'ledcSetup':['esp32'],'ledcAttachPin':['esp32'],'ledcWriteTone':['esp32'],'analogReadMilliVolts':['esp32'],'analogSetAttenuation':['esp32'],'dacWrite':['esp32'],'ESP.restart':['esp32','esp8266'],'analogReference':['avr'],'analogReadResolution':['esp32','rp2040','stm32'],'analogWriteResolution':['esp32','rp2040','stm32'],'analogWriteFreq':['esp8266','rp2040'],'analogWriteRange':['esp8266','rp2040'],'Serial.printf':['esp32','esp8266','rp2040','stm32'],'pulseInLong':['avr','esp32','esp8266','rp2040','stm32']};
export function apiProblem(name,profile){if(!profile)return null;const fam=profile.family;if(/^(WiFi|UDP|WiFiUDP)\./.test(name)&&!profile.wifi)return `${name} needs a Wi-Fi board. ${profile.name} has no radio in Circuit Lab.`;const only=FAMILY_ONLY[name];if(only&&!only.includes(fam))return `${name} is not available on ${profile.name} (${profile.core} core).${name.startsWith('ledc')?' Use analogWrite().':''}`;if(name==='SoftwareSerial.begin'&&fam!=='avr'&&fam!=='esp8266')return `SoftwareSerial is not provided by the ${profile.core} core in Circuit Lab. Use a hardware Serial port.`;return null;}
const SERIAL_PORT=/^(Serial[1-3])\.(.+)$/;
export function lex(source,{defines={}}={}){
 let i=0,line=1,lineStart=true;const out=[],macros=new Map(Object.entries(defines).map(([k,v])=>[k,[{kind:'num',value:v,line:0,float:!Number.isInteger(v)}]])),cond=[];
 const skipping=()=>cond.some(c=>!c.active);
 const push=(t,depth=0)=>{if(t.kind==='id'&&macros.has(t.value)&&depth<20){for(const m of macros.get(t.value))push({...m,line:t.line},depth+1);return;}out.push(t);};
 const lexLine=text=>{const sub=lex(text,{});sub.pop();return sub;};
 while(i<source.length){let c=source[i];
  if(c==='\n'){line++;i++;lineStart=true;continue;}if(c==='\\'&&source[i+1]==='\n'){i+=2;line++;continue;}if(/\s/.test(c)){i++;continue;}
  if(source.startsWith('//',i)){while(i<source.length&&source[i]!=='\n')i++;continue;}
  if(source.startsWith('/*',i)){const start=line;i+=2;while(i<source.length&&!source.startsWith('*/',i)){if(source[i++]==='\n')line++;}if(i>=source.length)throw new CompileError('Unterminated comment',start);i+=2;continue;}
  if(c==='#'&&lineStart){let d='';while(i<source.length&&source[i]!=='\n'){if(source[i]==='\\'&&source[i+1]==='\n'){i+=2;line++;continue;}d+=source[i++];}d=d.replace(/\/\/.*$/,'').replace(/\/\*.*?\*\//g,'').trim();const [,word='',rest='']=/^#\s*(\w*)\s*(.*)$/.exec(d)??[];
   if(['ifdef','ifndef'].includes(word)){const has=macros.has(rest.trim());cond.push({active:word==='ifdef'?has:!has,taken:false});cond.at(-1).taken=cond.at(-1).active;continue;}
   if(word==='if'){const v=rest.trim().replace(/defined\s*\(?\s*(\w+)\s*\)?/g,(_,n)=>macros.has(n)?'1':'0');const val=/^\d+$/.test(v)?Number(v)!==0:macros.has(v)?Number(macros.get(v)[0]?.value)!==0:false;cond.push({active:val,taken:val});continue;}
   if(word==='else'||word==='elif'){const top=cond.at(-1);if(!top)throw new CompileError('#else without #if',line);top.active=!top.taken;top.taken=true;continue;}
   if(word==='endif'){if(!cond.pop())throw new CompileError('#endif without #if',line);continue;}
   if(skipping())continue;
   if(word==='include'){const h=/[<"]([^>"]+)[>"]/.exec(rest)?.[1];if(!h||!LIBRARIES.includes(h))throw new CompileError(`Library “${h??rest}” is not installed in Circuit Lab. Available: ${LIBRARIES.join(', ')}.`,line);continue;}
   if(word==='define'){const m=/^([A-Za-z_]\w*)(\()?\s*(.*)$/.exec(rest);if(!m)throw new CompileError('Malformed #define',line);if(m[2])throw new CompileError(`Function-like macro ${m[1]}() is unsupported. Write a function instead.`,line);macros.set(m[1],m[3]?lexLine(m[3]):[]);continue;}
   if(word==='undef'){macros.delete(rest.trim());continue;}
   if(word==='pragma')continue;if(word==='error')throw new CompileError('#error '+rest,line);
   throw new CompileError(`Unsupported preprocessor directive #${word}`,line);}
  lineStart=false;if(skipping()){i++;continue;}
  if(/[a-zA-Z_]/.test(c)){let s='';while(i<source.length&&/\w/.test(source[i]))s+=source[i++];if(/^B[01]{1,8}$/.test(s)&&!macros.has(s)){push({kind:'num',value:parseInt(s.slice(1),2),line});continue;}push({kind:'id',value:s,line});continue;}
  if(/[0-9]/.test(c)||(c==='.'&&/[0-9]/.test(source[i+1]))){let s='',float=false;if(/^0[xX]/.test(source.slice(i,i+2))){s=source.slice(i,i+2);i+=2;while(/[0-9a-fA-F']/.test(source[i]??''))s+=source[i++];}else if(/^0[bB][01]/.test(source.slice(i,i+3))){i+=2;let b='';while(/[01']/.test(source[i]??''))b+=source[i++];s=String(parseInt(b.replace(/'/g,''),2));}else{while(/[0-9.']/.test(source[i]??''))s+=source[i++];if(/[eE]/.test(source[i]??'')&&/[-+0-9]/.test(source[i+1]??'')){s+=source[i++];if(/[-+]/.test(source[i]))s+=source[i++];while(/[0-9]/.test(source[i]??''))s+=source[i++];float=true;}if(s.includes('.'))float=true;}
   let suffix='';while(/[uUlLfF]/.test(source[i]??''))suffix+=source[i++].toLowerCase();if(suffix.includes('f'))float=true;s=s.replace(/'/g,'');const value=Number(s);if(!Number.isFinite(value))throw new CompileError('Invalid number '+s,line);push({kind:'num',value,line,float,suffix});continue;}
  if(c==='"'){const start=line;let s='';i++;while(i<source.length&&source[i]!=='"'){if(source[i]==='\n')throw new CompileError('Unterminated string',start);if(source[i]==='\\'){i++;const e=source[i++];if(e==='x'){let h='';while(/[0-9a-fA-F]/.test(source[i]??'')&&h.length<2)h+=source[i++];s+=String.fromCharCode(parseInt(h,16));}else s+=({n:'\n',t:'\t',r:'\r','0':'\0'}[e]??e);}else s+=source[i++];}if(i>=source.length)throw new CompileError('Unterminated string',start);i++;const last=out.at(-1);if(last?.kind==='str')last.value+=s;else push({kind:'str',value:s,line});continue;}
  if(c==="'"){i++;let ch=source[i++];if(ch==='\\'){const e=source[i++];ch=({n:'\n',t:'\t',r:'\r','0':'\0'}[e]??e);}if(source[i]!=="'")throw new CompileError('Character literal must contain one character',line);i++;push({kind:'chr',value:ch.charCodeAt(0),line});continue;}
  const three=source.slice(i,i+3);if(['<<=','>>='].includes(three)){push({kind:'op',value:three,line});i+=3;continue;}
  const two=source.slice(i,i+2);if(['==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','%=','&=','|=','^=','<<','>>','->','::'].includes(two)){if(two==='->'||two==='::')throw new CompileError(`“${two}” is unsupported: pointers, namespaces and classes are outside the Lab subset.`,line);push({kind:'op',value:two,line});i+=2;continue;}
  if('{}()[],;.+-*/%!=<>?:&|^~'.includes(c)){push({kind:'op',value:c,line});i++;continue;}
  throw new CompileError(`Unexpected character ${c}`,line);}
 if(cond.length)throw new CompileError('Missing #endif',line);out.push({kind:'eof',value:'EOF',line});return out;}

// --------------------------------------------------------------------------- types
export function typeInfo(t,intBits=32,doubleBits=64){switch(t){case'int':return{k:'i',bits:intBits,s:true};case'uint':return{k:'i',bits:intBits,s:false};case'long':case's32':return{k:'i',bits:32,s:true};case'ulong':case'u32':return{k:'i',bits:32,s:false};case'short':case's16':return{k:'i',bits:16,s:true};case'u16':return{k:'i',bits:16,s:false};case'byte':case'u8':return{k:'i',bits:8,s:false};case'char':case's8':return{k:'i',bits:8,s:true};case'bool':return{k:'b'};case'float':return{k:'f32'};case'double':return doubleBits===32?{k:'f32'}:{k:'f64'};case'String':return{k:'s'};default:return{k:'any'};}}
export function castValue(v,t){switch(t.k){case'i':{if(typeof v==='string')v=parseInt(v)||0;if(!Number.isFinite(v))return 0;v=Math.trunc(v);if(t.bits===32)return t.s?v|0:v>>>0;const m=2**t.bits;v=((v%m)+m)%m;return t.s&&v>=m/2?v-m:v;}case'f32':return Math.fround(Number(v));case'f64':return Number(v);case'b':return v?1:0;case's':return String(v);default:return v;}}
function normalizeType(words,line){const w=words.filter(x=>!['const','volatile','static','constexpr','inline','signed'].includes(x));const has=x=>w.includes(x);if(has('auto'))return 'double';if(has('void'))return 'void';if(has('String'))return 'String';if(has('bool')||has('boolean'))return 'bool';if(has('float'))return 'float';if(has('double'))return 'double';
 if(has('uint8_t')||has('byte'))return 'byte';if(has('int8_t'))return 's8';if(has('uint16_t')||has('word'))return 'u16';if(has('int16_t'))return 's16';if(has('uint32_t'))return 'u32';if(has('int32_t'))return 's32';if(has('uint64_t')||has('int64_t'))return 'double';if(has('size_t'))return 'uint';
 const u=words.includes('unsigned');if(has('char'))return u?'byte':'char';if(has('short'))return u?'u16':'short';if(has('long'))return u?'ulong':'long';return u?'uint':'int';}
const isFloatT=t=>t==='float'||t==='double';const isIntT=t=>!isFloatT(t)&&t!=='String'&&t!=='void'&&!t?.startsWith?.('obj:');
const RANK={bool:1,char:1,s8:1,byte:1,short:1,s16:1,u16:1,int:2,uint:2,long:3,s32:3,ulong:3,u32:3};
function arith(a,b,intBits){if(a==='String'||b==='String')return 'String';if(isFloatT(a)||isFloatT(b))return a==='double'||b==='double'?'double':'float';const pa=(RANK[a]??2)<2||(intBits===32&&['u16'].includes(a))?'int':a,pb=(RANK[b]??2)<2||(intBits===32&&['u16'].includes(b))?'int':b;const ra=RANK[pa]??2,rb=RANK[pb]??2;const pick=ra>rb?pa:rb>ra?pb:(['uint','ulong','u32'].includes(pa)?pa:pb);return pick==='s32'?'long':pick==='u32'?'ulong':pick;}

// --------------------------------------------------------------------------- parser
class Parser {
 constructor(tokens){this.t=tokens;this.i=0;}get cur(){return this.t[this.i];}peek(n=1){return this.t[this.i+n];}is(v){return this.cur.kind!=='str'&&this.cur.value===v;}take(v){if(this.is(v))return this.t[this.i++];return null;}need(v){if(!this.take(v))this.err(`Expected “${v}”, found “${this.cur.value}”`);}err(s,line=this.cur.line){throw new CompileError(s,line);}
 id(){if(this.cur.kind!=='id')this.err('Expected an identifier');return this.t[this.i++].value;}
 isTypeStart(at=0){const t=this.t[this.i+at];return t.kind==='id'&&(TYPE_WORDS.has(t.value)||QUALIFIERS.has(t.value));}
 typeSpec(){const words=[];while(this.cur.kind==='id'&&(TYPE_WORDS.has(this.cur.value)||QUALIFIERS.has(this.cur.value)))words.push(this.t[this.i++].value);if(!words.some(w=>TYPE_WORDS.has(w)||w==='unsigned'||w==='signed'))this.err('Expected a supported value type');let type=normalizeType(words,this.cur.line);if(this.is('*')){if(type!=='char'&&type!=='byte')this.err('Pointers are unsupported. Use arrays or String.');while(this.take('*')||this.take('const'));type='String';}if(this.is('&'))this.err('References are unsupported. Pass values or use a global variable.');return {type,static:words.includes('static'),const:words.includes('const')||words.includes('constexpr')};}
 program(){const items=[];while(this.cur.kind!=='eof'){const line=this.cur.line;if(this.take(';'))continue;
  if(['struct','class','typedef','enum','template','namespace','union','using'].includes(this.cur.value))this.err(`“${this.cur.value}” declarations are outside the Lab subset.`);
  if(this.cur.kind==='id'&&CLASSES[this.cur.value]){items.push(this.objectDecl());continue;}
  const spec=this.typeSpec(),name=this.id();
  if(this.take('(')){const params=[];if(!this.is(')')&&!(this.is('void')&&this.peek().value===')')){do{const p=this.typeSpec(),pname=this.id();let array=false;while(this.take('[')){array=true;if(!this.is(']'))this.expr();this.need(']');}params.push({name:pname,type:p.type,array});}while(this.take(','));}else this.take('void');this.need(')');if(this.take(';')){items.push({type:'prototype',name,line});continue;}items.push({type:'function',name,ret:spec.type,params,body:this.block(),line});}
  else items.push(...this.declRest(spec,name,line));}
  return items;}
 objectDecl(){const line=this.cur.line,cls=this.id(),name=this.id();let args=[];if(this.take('(')){if(!this.is(')'))do{args.push(this.expr());}while(this.take(','));this.need(')');}else if(this.take('=')){const c2=this.id();if(c2!==cls)this.err(`Expected ${cls}(…) initializer`);this.need('(');if(!this.is(')'))do{args.push(this.expr());}while(this.take(','));this.need(')');}this.need(';');return {type:'object',cls,name,args,line};}
 declRest(spec,name,line){const out=[];for(;;){const dims=[];while(this.take('[')){dims.push(this.is(']')?null:this.expr());this.need(']');}let init=null;if(this.take('='))init=this.is('{')?this.initList():this.expr();else if(this.is('{'))init=this.initList();out.push({type:'declare',name,vtype:spec.type,dims,init,static:spec.static,const:spec.const,line});if(!this.take(','))break;name=this.id();}this.need(';');return out;}
 initList(){this.need('{');const items=[];if(!this.is('}'))do{if(this.is('}'))break;items.push(this.is('{')?this.initList():this.expr());}while(this.take(','));this.need('}');return {type:'list',items};}
 block(){this.need('{');const body=[];while(!this.is('}')){if(this.cur.kind==='eof')this.err('Missing closing }');body.push(...this.stmtList());}this.need('}');return {type:'block',body};}
 stmtList(){const line=this.cur.line;if(this.isTypeStart()&&!(this.peek().value==='('&&!QUALIFIERS.has(this.cur.value)&&this.t[this.i+2]?.kind!=='id')){const spec=this.typeSpec();return this.declRest(spec,this.id(),line);}if(this.cur.kind==='id'&&CLASSES[this.cur.value]&&this.peek().kind==='id')return [this.objectDecl()];return [this.stmt()];}
 stmt(){const line=this.cur.line;if(this.is('{'))return this.block();if(this.take(';'))return {type:'empty'};
  if(this.take('if')){this.need('(');const test=this.expr();this.need(')');const yes=this.body(),no=this.take('else')?this.body():null;return {type:'if',test,yes,no,line};}
  if(this.take('while')){this.need('(');const test=this.expr();this.need(')');return {type:'while',test,body:this.body(),line};}
  if(this.take('do')){const body=this.body();this.need('while');this.need('(');const test=this.expr();this.need(')');this.need(';');return {type:'do',test,body,line};}
  if(this.take('for')){this.need('(');let init=null;if(!this.take(';')){init=this.stmtList();}const test=this.is(';')?{type:'literal',value:1,vtype:'int'}:this.expr();this.need(';');const steps=[];if(!this.is(')'))do{steps.push(this.expr());}while(this.take(','));this.need(')');return {type:'for',init,test,steps,body:this.body(),line};}
  if(this.take('switch')){this.need('(');const test=this.expr();this.need(')');this.need('{');const cases=[];let current=null;while(!this.take('}')){if(this.cur.kind==='eof')this.err('Missing closing } for switch');const l=this.cur.line;if(this.take('case')){const value=this.expr();this.need(':');current={value,body:[],line:l};cases.push(current);continue;}if(this.take('default')){this.need(':');current={value:null,body:[],line:l};cases.push(current);continue;}if(!current)this.err('Statement before the first case label');current.body.push(...this.stmtList());}return {type:'switch',test,cases,line};}
  if(this.take('return')){const value=this.is(';')?null:this.expr();this.need(';');return {type:'return',value,line};}
  if(this.take('break')){this.need(';');return {type:'break',line};}if(this.take('continue')){this.need(';');return {type:'continue',line};}
  if(this.is('goto'))this.err('goto is unsupported');
  const value=this.expr();this.need(';');return {type:'expression',value,line};}
 body(){const line=this.cur.line;const list=this.stmtList();return list.length===1?list[0]:{type:'block',body:list,line};}
 expr(){let e=this.assign();while(this.is(',')&&this.inParens){this.i++;e={type:'comma',left:e,right:this.assign()};}return e;}
 assign(){const left=this.ternary();if(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>='].includes(this.cur.value)&&this.cur.kind==='op'){const op=this.t[this.i++].value,line=this.cur.line;if(!['variable','index'].includes(left.type))this.err('Assignment requires a variable or array element',line);return {type:'assign',target:left,op,value:this.assign(),line:left.line??line};}return left;}
 ternary(){const test=this.binary(0);if(this.take('?')){const yes=this.assign();this.need(':');return {type:'ternary',test,yes,no:this.assign(),line:test.line};}return test;}
 binary(level){const levels=[['||'],['&&'],['|'],['^'],['&'],['==','!='],['<','>','<=','>='],['<<','>>'],['+','-'],['*','/','%']];if(level===levels.length)return this.unary();let left=this.binary(level+1);while(this.cur.kind==='op'&&levels[level].includes(this.cur.value)){const op=this.t[this.i++].value;left={type:'binary',op,left,right:this.binary(level+1),line:left.line};}return left;}
 unary(){const line=this.cur.line;if(this.cur.kind==='op'&&['!','-','+','~'].includes(this.cur.value)){const op=this.t[this.i++].value;return {type:'unary',op,value:this.unary(),line};}
  if(this.cur.kind==='op'&&['++','--'].includes(this.cur.value)){const op=this.t[this.i++].value,target=this.unary();if(!['variable','index'].includes(target.type))this.err('++/-- requires a variable');return {type:'assign',target,op:op==='++'?'+=':'-=',value:{type:'literal',value:1,vtype:'int'},line};}
  if(this.is('&')){this.i++;const name=this.id();return {type:'literal',value:0,vtype:'int',ref:name,line};}
  if(this.is('*'))this.err('Pointer dereference is unsupported');
  if(this.take('sizeof')){this.need('(');let n;if(this.isTypeStart()){n={type:'sizeofType',vtype:this.typeSpec().type,line};}else n={type:'sizeof',value:this.expr(),line};this.need(')');return n;}
  if(this.is('(')&&this.isTypeStart(1)){let j=this.i+1;while(this.t[j].kind==='id'&&(TYPE_WORDS.has(this.t[j].value)||QUALIFIERS.has(this.t[j].value)))j++;while(this.t[j].value==='*')j++;if(this.t[j].value===')'){this.i++;const {type}=this.typeSpec();this.need(')');return {type:'cast',vtype:type,value:this.unary(),line};}}
  return this.postfix();}
 postfix(){let e=this.primary();for(;;){const line=this.cur.line;if(this.take('[')){const index=this.expr();this.need(']');e={type:'index',base:e,index,line};continue;}
  if(this.is('.')&&e.type!=='variable'){this.i++;const method=this.id();this.need('(');const args=this.args();e={type:'method',target:e,method,args,line};continue;}
  if(this.take('++'))e={type:'assign',target:e,postfix:true,op:'+=',value:{type:'literal',value:1,vtype:'int'},line};else if(this.take('--'))e={type:'assign',target:e,postfix:true,op:'-=',value:{type:'literal',value:1,vtype:'int'},line};else break;}return e;}
 args(){const a=[];const prev=this.inParens;this.inParens=false;if(!this.is(')'))do{a.push(this.assign());}while(this.take(','));this.need(')');this.inParens=prev;return a;}
 primary(){const t=this.cur;if(this.take('(')){const prev=this.inParens;this.inParens=true;const v=this.expr();this.inParens=prev;this.need(')');return v;}
  if(t.kind==='num'){this.i++;return {type:'literal',value:t.value,vtype:t.float?(t.suffix?.includes('f')?'float':'double'):t.suffix?.includes('u')?(t.suffix.includes('l')?'ulong':'uint'):t.suffix?.includes('l')?'long':'int?',line:t.line};}
  if(t.kind==='str'){this.i++;return {type:'literal',value:t.value,vtype:'String',line:t.line};}
  if(t.kind==='chr'){this.i++;return {type:'literal',value:t.value,vtype:'char',line:t.line};}
  if(t.kind==='id'){if(TYPE_WORDS.has(t.value)&&this.peek().value==='('){const {type}=this.typeSpec();this.need('(');const args=this.args();if(type==='String')return {type:'call',name:'String',args,line:t.line};if(args.length!==1)this.err('A function-style cast takes one value');return {type:'cast',vtype:type,value:args[0],line:t.line};}
   let name=this.id();while(this.is('.')&&this.peek().kind==='id'){this.i++;name+='.'+this.id();}if(this.take('(')){return {type:'call',name,args:this.args(),line:t.line};}return {type:'variable',name,line:t.line};}
  this.err(`Unexpected token “${t.value}”. Pointers, structs, classes and lambdas are unsupported.`);}
}

// --------------------------------------------------------------------------- compiler
export function compile(source,options={}){
 const profile=options.profile??null,intBits=profile?.intBits??32,doubleBits=profile?.doubleBits??64;
 const consts={...CONSTANTS,...(profile?.pulldown!==false?{INPUT_PULLDOWN:3}:{}),...(profile?.constants??{LED_BUILTIN:2,A0:36})};
 const items=new Parser(lex(source)).program(),funcs={},code=[],globalVars=new Map(),objects=new Map(),fnDefs=new Map();
 for(const it of items)if(it.type==='function'){if(fnDefs.has(it.name))throw new CompileError(`Duplicate function ${it.name}`,it.line);fnDefs.set(it.name,it);}
 if(!fnDefs.has('setup')||!fnDefs.has('loop'))throw new CompileError('Define both void setup() and void loop()',items[0]?.line??1);
 let locals=null,loops=[],currentFn=null;const ti=t=>typeInfo(t,intBits,doubleBits);
 const emit=(op,a,b,line)=>{code.push({op,a,b,line});return code.length-1;};
 const lookup=name=>locals?.get(name)??globalVars.get(name);
 const elemSize=t=>({char:1,byte:1,s8:1,bool:1,short:2,s16:2,u16:2,int:intBits/8,uint:intBits/8,long:4,ulong:4,s32:4,u32:4,float:4,double:doubleBits/8,String:intBits===16?6:12}[t]??4);
 const castTo=(t,line)=>{const info=ti(t);if(info.k!=='any')emit('cast',info,null,line);};
 const fixLiteralType=n=>{if(n.vtype!=='int?')return n.vtype;const v=n.value;if(v>=-(2**(intBits-1))&&v<2**(intBits-1))return 'int';if(v<2**31)return 'long';return 'ulong';};
 const check=(name,line)=>{const p=apiProblem(name,profile);if(p)throw new CompileError(p,line);};
 // Returns the static type of the compiled expression.
 const expr=n=>{switch(n.type){
  case'literal':{if(n.ref&&n.ref!=='Wire')throw new CompileError('Address-of is only supported as &Wire in display constructors',n.line);emit('push',n.value);return fixLiteralType(n);}
  case'variable':{const v=lookup(n.name);if(v){emit('load',v.slot??n.name);return v.array?'array:'+v.type:v.obj?'obj:'+v.obj:v.type;}if(objects.has(n.name)){emit('load',n.name);return 'obj:'+objects.get(n.name);}if(Object.hasOwn(consts,n.name)){emit('push',consts[n.name]);return FLOAT_CONSTANTS.has(n.name)?'double':'int';}if(fnDefs.has(n.name)){emit('push',n.name);return 'fn';}throw new CompileError(`Unknown variable “${n.name}”${/^(A\d+|D\d+|P[ABC]\d+|INPUT_PULLDOWN)$/.test(n.name)&&profile?` on ${profile.name}`:''}`,n.line);}
  case'index':{const base=n.base.type==='index'?null:lookup(n.base.name);const {arr,flat}=indexInfo(n);emit('load',arr.slot??arr.name);expr(flat);emit('aload',null,null,n.line);return arr.type;}
  case'assign':return assign(n);
  case'comma':expr(n.left);emit('pop');return expr(n.right);
  case'unary':{const t=expr(n.value);emit('unary',n.op);if(n.op==='!')return 'bool';if(n.op==='~'||n.op==='-'){const r=isFloatT(t)?t:arith(t,'int',intBits);if(isIntT(r))castTo(r,n.line);return r;}return t;}
  case'cast':{const from=expr(n.value);if(n.vtype==='String'){emit('call','String',1);return 'String';}castTo(n.vtype,n.line);return n.vtype;}
  case'sizeof':{if(n.value.type==='variable'){const v=lookup(n.value.name);if(v?.array){emit('load',v.slot??n.value.name);emit('alen');emit('push',elemSize(v.type)*(v.stride??1)/(v.stride??1));emit('binary','*');return 'uint';}if(v){emit('push',elemSize(v.type));return 'uint';}}if(n.value.type==='index'){const {arr}=indexInfo(n.value,true);emit('push',elemSize(arr.type)*(n.value.base.type==='variable'&&arr.dims?.length>1?arr.stride:1));return 'uint';}throw new CompileError('sizeof needs a variable, array or type',n.line);}
  case'sizeofType':emit('push',elemSize(n.vtype));return 'uint';
  case'binary':{if(n.op==='&&'||n.op==='||'){expr(n.left);emit('truthy');emit('dup');const j=emit(n.op==='&&'?'jz':'jnz',0);emit('pop');expr(n.right);emit('truthy');code[j].a=code.length;return 'bool';}
   const lt=expr(n.left),rt=expr(n.right);
   if(['==','!=','<','>','<=','>='].includes(n.op)){emit('binary',n.op);return 'bool';}
   const r=n.op==='<<'||n.op==='>>'?arith(lt,'int',intBits):arith(lt,rt,intBits);
   if(r==='String'){if(isFloatT(lt))throw new CompileError('Convert floats with String(value) before concatenating',n.line);if(lt==='char'||rt==='char'){emit('strchar',lt==='char'?1:0,rt==='char'?1:0);}if(isFloatT(rt)){emit('fmtf');}emit('binary','+');return 'String';}
   if(n.op==='/'&&isIntT(r)){emit('binary','i/');castTo(r,n.line);return r;}
   if(n.op==='%'&&isFloatT(r))throw new CompileError('% needs integer operands. Use fmod() for floating-point values.',n.line);
   emit('binary',n.op==='>>'&&['uint','ulong','u32'].includes(r)?'>>>':n.op);if(isIntT(r))castTo(r,n.line);else if(r==='float'&&doubleBits===32)castTo('float',n.line);return r;}
  case'ternary':{expr(n.test);const j=emit('jz',0);const a=expr(n.yes);const end=emit('jump',0);code[j].a=code.length;const b=expr(n.no);code[end].a=code.length;return a===b?a:arith(a,b,intBits);}
  case'method':{const t=expr(n.target);if(t==='String'||t==='int'||t.startsWith?.('array')===false){return stringMethod(n.method,n.args,n.line,null,t);}throw new CompileError(`Method ${n.method}() is not available on this value`,n.line);}
  case'call':return call(n);
  default:throw new CompileError('Unsupported expression',n.line);}};
 const indexInfo=(n,typeOnly=false)=>{const idx=[];let b=n;while(b.type==='index'){idx.unshift(b.index);b=b.base;}if(b.type!=='variable')throw new CompileError('Only named arrays can be indexed',n.line);const v=lookup(b.name);if(!v?.array){if(v?.type==='String'&&idx.length===1){return {arr:{...v,name:b.name,type:'char',stringIndex:true},flat:idx[0]};}throw new CompileError(`“${b.name}” is not an array`,n.line);}if(typeOnly)return {arr:{...v,name:b.name}};let flat=idx[0];if(v.dims.length===2&&idx.length===2)flat={type:'binary',op:'+',left:{type:'binary',op:'*',left:idx[0],right:{type:'literal',value:v.dims[1],vtype:'int'}},right:idx[1]};else if(idx.length!==v.dims.length&&!(v.dims.length===1&&idx.length===1))throw new CompileError(`Array “${b.name}” needs ${v.dims.length} index value${v.dims.length>1?'s':''}`,n.line);return {arr:{...v,name:b.name},flat};};
 const stringMethod=(method,args,line,targetVar,t)=>{if(!(method in STRING_METHODS))throw new CompileError(`String method ${method}() is unsupported`,line);args.forEach(expr);emit('call','String.'+method,args.length+1,line);if(STRING_METHODS[method]&&targetVar){emit('store',targetVar.slot??targetVar.name);}return RET['String.'+method]??(method==='charAt'?'char':'int');};
 const assign=n=>{const tgt=n.target;if(tgt.type==='index'){const {arr,flat}=indexInfo(tgt);if(arr.const)throw new CompileError(`Cannot modify const array “${arr.name}”`,n.line);emit('load',arr.slot??arr.name);expr(flat);if(n.op==='='){expr(n.value);castTo(arr.type,n.line);emit('astore',null,null,n.line);}else{expr(n.value);emit('aupd',n.op.slice(0,-1),{post:!!n.postfix,t:ti(arr.type),div:isIntT(arr.type)},n.line);}return arr.type;}
  const v=lookup(tgt.name);if(!v){if(Object.hasOwn(consts,tgt.name))throw new CompileError(`“${tgt.name}” is a constant`,n.line);throw new CompileError(`Unknown variable “${tgt.name}”`,n.line);}if(v.const)throw new CompileError(`Cannot assign to const “${tgt.name}”`,n.line);if(v.array)throw new CompileError(`Cannot assign to whole array “${tgt.name}”`,n.line);const slot=v.slot??tgt.name;
  if(n.op==='='){const rt=expr(n.value);if(v.type==='String'&&rt==='char')emit('call','String.fromChar',1);else if(v.type==='String'&&isFloatT(rt))emit('fmtf');castTo(v.type,n.line);emit('store',slot);return v.type;}
  const rt=expr(n.value);if(v.type==='String'){if(n.op!=='+=')throw new CompileError('Only += is valid on String',n.line);if(rt==='char')emit('call','String.fromChar',1);else if(isFloatT(rt))emit('fmtf');}
  emit('vupd',slot,{op:n.op.slice(0,-1),post:!!n.postfix,t:ti(v.type),div:isIntT(v.type)&&isIntT(rt)},n.line);return v.type;};
 const printTag=t=>t==='char'?'c':isFloatT(t)?'f':t==='String'?'s':['uint','ulong','u32','u16','byte'].includes(t)?'u':'i';
 const call=n=>{let name=n.name;const parts=name.split('.');
  if(parts.length===2&&objects.has(parts[0])){const cls=objects.get(parts[0]);if(!METHODS[cls].includes(parts[1]))throw new CompileError(`${cls}.${parts[1]}() is unsupported in Circuit Lab`,n.line);const full=cls+'.'+parts[1];check(full,n.line);emit('load',parts[0]);return hostCall(full,n.args,n.line,1);}
  if(parts.length===2&&lookup(parts[0])){const v=lookup(parts[0]);if(v.type==='String'||isIntT(v.type)){emit('load',v.slot??parts[0]);return stringMethod(parts[1],n.args,n.line,v,v.type);}}
  if(parts.length>2)throw new CompileError(`Chained call ${name}() is unsupported`,n.line);
  if(fnDefs.has(name)){const f=fnDefs.get(name);if(n.args.length!==f.params.length)throw new CompileError(`Incorrect argument count for ${name}()`,n.line);n.args.forEach((a,i)=>{const t=expr(a);if(!f.params[i].array)castTo(f.params[i].type,n.line);});emit('call',name,n.args.length,n.line);return f.ret;}
  const port=SERIAL_PORT.exec(name);let lookupName=name;if(port){if(profile&&!profile.uarts[port[1]])throw new CompileError(`${port[1]} does not exist on ${profile.name}`,n.line);lookupName='Serial.'+port[2];}
  if(name==='fmod'){n.args.forEach(expr);emit('binary','%');return 'double';}
  if(!API.has(lookupName))throw new CompileError(`Unsupported API “${name}”. See the supported firmware reference.`,n.line);check(lookupName,n.line);
  return hostCall(name,n.args,n.line,0,lookupName);};
 const hostCall=(name,args,line,extra,lookupName=name)=>{const types=args.map(a=>expr(a));if(['attachInterrupt','timerEvery'].includes(name)){const cb=args[1];if(cb?.type!=='variable'||!fnDefs.has(cb.name))throw new CompileError(`${name} needs the name of a void function as its callback`,line);}
  let argc=args.length+extra;if(/\.(print|println)$/.test(lookupName)){emit('push',args.length?printTag(types[0]):'');argc++;}
  if(name==='Serial.printf'||/^Serial\d\.printf$/.test(name)){emit('push',types.map(printTag).join(''));argc++;}
  emit('call',name,argc,line);const r=RET[lookupName];if(r==='*')return types.reduce((a,b)=>arith(a,b,intBits),types[0]??'int');return r??(lookupName.startsWith('Serial.')&&['available','read','peek'].some(s=>lookupName.endsWith(s))?'int':'int');};
 const declare=(d,isGlobal)=>{const scope=isGlobal?globalVars:locals;if(d.vtype==='void')throw new CompileError('Variables cannot be void',d.line);let slot=d.name;if(d.static&&!isGlobal){slot=currentFn+'::'+d.name;}
  if(d.dims.length){if(d.dims.length>2)throw new CompileError('Arrays support at most two dimensions',d.line);if(d.vtype==='char'&&d.dims.length===1&&d.init?.type==='literal'&&typeof d.init.value==='string'){scope.set(d.name,{type:'String',slot});if(d.static&&!isGlobal)staticInit.push(()=>{emit('push',d.init.value);emit('declare',slot);});else{emit('push',d.init.value);emit('declare',slot);}return;}
   const dims=d.dims.map((x,i)=>{if(x===null)return null;if(x.type==='literal')return x.value;if(x.type==='variable'&&lookup(x.name)?.constValue!==undefined)return lookup(x.name).constValue;if(x.type==='variable'&&Object.hasOwn(consts,x.name))return consts[x.name];throw new CompileError('Array sizes must be constant',d.line);});
   const flat=[];const walk=(node,depth)=>{for(const it of node.items){if(it.type==='list'){if(depth+1>=dims.length)throw new CompileError('Too many braces in initializer',d.line);const start=flat.length;walk(it,depth+1);while(flat.length<start+(dims[1]??0))flat.push(null);}else flat.push(it);}};
   if(d.init){if(d.init.type!=='list'){if(d.vtype==='char'&&typeof d.init.value==='string'){d.init={type:'list',items:[...d.init.value,'\0'].map(ch=>({type:'literal',value:ch.charCodeAt(0),vtype:'char'}))};}else throw new CompileError('Arrays need a { … } initializer',d.line);}walk(d.init,0);}
   if(dims[0]===null)dims[0]=dims.length===2?Math.ceil(flat.length/dims[1]):flat.length;if(dims.some(x=>!Number.isInteger(x)||x<1||x>4096))throw new CompileError('Array size must be 1–4096',d.line);const total=dims.reduce((a,b)=>a*b,1);if(flat.length>total)throw new CompileError(`Too many initializers for “${d.name}”`,d.line);
   scope.set(d.name,{type:d.vtype,array:true,dims,stride:dims[1]??1,const:d.const,slot});const build=()=>{for(const it of flat){if(it){expr(it);castTo(d.vtype,d.line);}else emit('push',0);}emit('mkarr',flat.length,{total,fill:ti(d.vtype).k==='s'?'':0});emit('declare',slot);};if(d.static&&!isGlobal)staticInit.push(build);else build();return;}
  const info={type:d.vtype,const:d.const,slot};if(d.const&&d.init?.type==='literal'&&typeof d.init.value==='number')info.constValue=d.init.value;
  const build=()=>{if(d.init){if(d.init.type==='list')throw new CompileError('Only arrays use { } initializers',d.line);const t=expr(d.init);if(d.vtype==='String'&&t==='char')emit('call','String.fromChar',1);else if(d.vtype==='String'&&isFloatT(t))emit('fmtf');}else emit('push',d.vtype==='String'?'':0);castTo(d.vtype,d.line);emit('declare',slot);};
  scope.set(d.name,info);if(d.static&&!isGlobal)staticInit.push(build);else build();};
 const staticInit=[];
 const stmt=n=>{if(!n)return;switch(n.type){
  case'block':n.body.forEach(stmt);break;case'empty':break;
  case'declare':declare(n,false);break;
  case'object':throw new CompileError(`Declare ${n.cls} objects globally, outside functions`,n.line);
  case'expression':expr(n.value);emit('pop');break;
  case'if':{expr(n.test);const j=emit('jz',0);stmt(n.yes);if(n.no){const e=emit('jump',0);code[j].a=code.length;stmt(n.no);code[e].a=code.length;}else code[j].a=code.length;break;}
  case'while':case'for':{if(n.type==='for'&&n.init)n.init.forEach(stmt);const start=code.length;expr(n.test);const stop=emit('jz',0);loops.push({breaks:[],continues:[],loop:true});stmt(n.body);const cont=code.length;if(n.steps)for(const s of n.steps){expr(s);emit('pop');}emit('jump',start);code[stop].a=code.length;const l=loops.pop();l.breaks.forEach(k=>code[k].a=code.length);l.continues.forEach(k=>code[k].a=cont);break;}
  case'do':{const start=code.length;loops.push({breaks:[],continues:[],loop:true});stmt(n.body);const cont=code.length;expr(n.test);emit('jnz',start);const l=loops.pop();l.breaks.forEach(k=>code[k].a=code.length);l.continues.forEach(k=>code[k].a=cont);break;}
  case'switch':{expr(n.test);const jumps=[];let def=null;for(const c of n.cases){if(c.value===null){def=c;continue;}emit('dup');expr(c.value);emit('binary','==');jumps.push([emit('jnz',0),c]);}const toDefault=emit('jump',0);loops.push({breaks:[],switch:true});const starts=new Map();for(const c of n.cases){starts.set(c,code.length);c.body.forEach(stmt);}const end=code.length;for(const [j,c]of jumps)code[j].a=starts.get(c);code[toDefault].a=def?starts.get(def):end;const l=loops.pop();l.breaks.forEach(k=>code[k].a=end);emit('pop');
   // Break jumps land on the pop that removes the switch value.
   break;}
  case'break':{if(!loops.length)throw new CompileError('break outside a loop or switch',n.line);loops.at(-1).breaks.push(emit('jump',0));break;}
  case'continue':{const l=[...loops].reverse().find(l=>l.loop);if(!l)throw new CompileError('continue outside a loop',n.line);let pops=0;for(let i=loops.length-1;loops[i]!==l;i--)if(loops[i].switch)pops++;for(let i=0;i<pops;i++)emit('pop');l.continues.push(emit('jump',0));break;}
  case'return':{if(n.value){const t=expr(n.value);const f=fnDefs.get(currentFn);if(f.ret==='void')throw new CompileError('A void function cannot return a value',n.line);castTo(f.ret,n.line);}else emit('push',0);let pops=loops.filter(l=>l.switch).length;emit('return',pops);break;}
  default:throw new CompileError('Unsupported statement',n.line);}};
 // Switch break targets must also drop the switch value: place breaks before the final pop.
 for(const it of items){if(it.type==='declare')declare(it,true);else if(it.type==='object'){if(objects.has(it.name)||globalVars.has(it.name))throw new CompileError(`Duplicate name ${it.name}`,it.line);objects.set(it.name,it.cls);it.args.forEach(a=>expr(a));emit('call','new.'+it.cls,it.args.length,it.line);emit('declare',it.name);}}
 const staticAt=code.length;emit('nop');emit('call','setup',0);emit('pop');const repeat=code.length;emit('call','loop',0);emit('pop');emit('yield');emit('jump',repeat);
 for(const [name,f]of fnDefs){funcs[name]={pc:code.length,params:f.params.map(p=>p.name)};currentFn=name;locals=new Map(f.params.map(p=>[p.name,{type:p.type,array:p.array,dims:p.array?[0]:undefined}]));loops=[];stmt(f.body);emit('push',0);emit('return',0);}
 locals=null;if(staticInit.length){const jump=code.length;code[staticAt]={op:'jump',a:jump};staticInit.forEach(b=>b());emit('jump',staticAt+1);}
 return {code,funcs,globals:[...globalVars.keys()],objects:Object.fromEntries(objects),size:code.length,profile:profile?.key??null};}

// --------------------------------------------------------------------------- VM
const BIN={'+':(a,b)=>a+b,'-':(a,b)=>a-b,'*':(a,b)=>a*b,'/':(a,b)=>a/b,'i/':(a,b)=>Math.trunc(a/b),'%':(a,b)=>a%b,'<':(a,b)=>+(a<b),'>':(a,b)=>+(a>b),'<=':(a,b)=>+(a<=b),'>=':(a,b)=>+(a>=b),'==':(a,b)=>+(a==b),'!=':(a,b)=>+(a!=b),'&':(a,b)=>a&b,'|':(a,b)=>a|b,'^':(a,b)=>a^b,'<<':(a,b)=>a<<b,'>>':(a,b)=>a>>b,'>>>':(a,b)=>a>>>b};
export class VM {
 constructor(program,host){this.program=program;this.host=host;this.pc=0;this.stack=[];this.frames=[];this.globals={};this.locals=null;this.sleepUntil=0;this.instructions=0;this.halted=false;this.noYield=0;this.pending=[];this.waiting=null;}
 callback(name){if(this.program.funcs[name]&&this.pending.length<32)this.pending.push(name);}
 call(name,args,now){const f=this.program.funcs[name];if(f){if(this.frames.length>=48)throw Error('Maximum call depth exceeded (stack overflow)');this.frames.push({pc:this.pc,locals:this.locals,stack:this.stack.length});this.locals=Object.fromEntries(f.params.map((n,i)=>[n,args[i]??0]));this.pc=f.pc;return;}
  const result=this.host.call(name,args);if(result&&typeof result==='object'&&result.wait){this.waiting=result;return 'wait';}this.stack.push(result??0);}
 get(name){return this.locals&&Object.hasOwn(this.locals,name)?this.locals[name]:this.globals[name];}
 set(name,v){if(this.locals&&Object.hasOwn(this.locals,name))this.locals[name]=v;else this.globals[name]=v;}
 run(now,budget=4000){if(this.halted)return;if(this.waiting){if(!this.waiting.done)return;this.stack.push(this.waiting.result??0);this.waiting=null;}
  if(this.pending.length&&!this.frames.some(f=>f.isr)){const name=this.pending.shift(),savedSleep=this.sleepUntil;this.call(name,[]);this.frames.at(-1).restoreSleep=savedSleep;this.frames.at(-1).isr=true;this.sleepUntil=now;}
  if(now<this.sleepUntil)return;let spent=0;const st=this.stack,pop=()=>st.pop()??0;
  while(spent++<budget){const c=this.program.code[this.pc++];if(!c)throw Error('Invalid program counter');this.instructions++;
   switch(c.op){case'push':st.push(c.a);break;case'load':st.push(this.get(c.a));break;case'declare':(this.locals??this.globals)[c.a]=pop();break;case'store':{const v=pop();this.set(c.a,v);st.push(v);break;}
   case'pop':pop();break;case'dup':st.push(st.at(-1));break;case'nop':break;case'truthy':st.push(pop()?1:0);break;
   case'unary':{const u=pop();st.push(c.a==='!'?(!u?1:0):c.a==='-'?-u:c.a==='~'?~u:+u);break;}
   case'binary':{const b=pop(),a=pop();if((c.a==='i/'||c.a==='%')&&b===0&&typeof a==='number'&&!(c.a==='%'&&!Number.isInteger(a)))throw Error('Division by zero');st.push(BIN[c.a](a,b));break;}
   case'cast':st.push(castValue(pop(),c.a));break;
   case'fmtf':{const v=pop();st.push(Number.isFinite(v)?v.toFixed(2):(Number.isNaN(v)?'nan':'inf'));break;}
   case'strchar':{const b=pop(),a=pop();st.push(c.a?String.fromCharCode(a):a);st.push(c.b?String.fromCharCode(b):b);break;}
   case'mkarr':{const n=c.a,arr=st.splice(st.length-n,n);while(arr.length<c.b.total)arr.push(c.b.fill);st.push(arr);break;}
   case'aload':{const i=pop(),a=pop();if(typeof a==='string'){st.push(i>=0&&i<a.length?a.charCodeAt(i):0);break;}if(!Array.isArray(a))throw Error('Indexing a value that is not an array');if(!Number.isInteger(i)||i<0||i>=a.length)throw Error(`Array index ${i} is out of bounds (size ${a.length}). Real hardware would read unrelated memory.`);st.push(a[i]);break;}
   case'astore':{const v=pop(),i=pop(),a=pop();if(!Array.isArray(a))throw Error('Writing an element of a value that is not an array');if(!Number.isInteger(i)||i<0||i>=a.length)throw Error(`Array index ${i} is out of bounds (size ${a.length}). Real hardware would corrupt memory.`);a[i]=v;st.push(v);break;}
   case'aupd':{const rhs=pop(),i=pop(),a=pop();if(!Array.isArray(a)||!Number.isInteger(i)||i<0||i>=a.length)throw Error(`Array index ${i} is out of bounds`);const old=a[i];const op=c.a==='/'&&c.b.div?'i/':c.a;if((op==='i/'||op==='%')&&rhs===0)throw Error('Division by zero');const v=castValue(BIN[op](old,rhs),c.b.t);a[i]=v;st.push(c.b.post?old:v);break;}
   case'vupd':{const rhs=pop(),old=this.get(c.a);const op=c.b.op==='/'&&c.b.div?'i/':c.b.op;if((op==='i/'||op==='%')&&rhs===0)throw Error('Division by zero');const v=castValue(BIN[op](old,rhs),c.b.t);this.set(c.a,v);st.push(c.b.post?old:v);break;}
   case'alen':{const a=pop();st.push(Array.isArray(a)||typeof a==='string'?a.length:0);break;}
   case'jump':this.pc=c.a;break;case'jz':if(!pop())this.pc=c.a;break;case'jnz':if(pop())this.pc=c.a;break;
   case'call':{const args=st.splice(st.length-c.b,c.b);if(c.a==='delay'||c.a==='delayMicroseconds'){const ms=c.a==='delay'?Number(args[0]):Number(args[0])/1000;if(!(ms>=0))throw Error(`${c.a} needs a non-negative duration`);this.sleepUntil=now+Math.max(c.a==='delay'?1:.001,ms);st.push(0);this.noYield=0;return;}
    if(this.call(c.a,args,now)==='wait'){this.noYield=0;return;}break;}
   case'return':{let result=pop();for(let k=0;k<c.a;k++)pop();const frame=this.frames.pop();if(!frame)throw Error('Return outside a function');st.length=frame.stack;st.push(result);this.pc=frame.pc;this.locals=frame.locals;if(frame.restoreSleep!==undefined){this.sleepUntil=frame.restoreSleep;pop();if(now<this.sleepUntil)return;}break;}
   case'yield':this.noYield=0;return;}
   if(st.length>4096)throw Error('Firmware stack overflow');}
  this.noYield++;if(this.noYield>250)throw Error('Firmware did not yield for 1,000,000 instructions. Add delay() to a long-running loop.');}
}
