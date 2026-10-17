// Logical I²C peripherals and a bounded display list for SSD1306-style graphics.
// Register maps follow the datasheets for the subset listed; other registers read back what was written.
const bcd=v=>((Math.floor(v/10)<<4)|(v%10))&255,unbcd=b=>(b>>4)*10+(b&15);
function mpuInit(st){if(!st.regs){st.regs=new Array(128).fill(0);st.regs[0x6B]=0x40;st.ptr=0;}}
function mpuReg(st,r,c){if(r===0x75)return 0x68;if(r>=0x3B&&r<=0x48){if(st.regs[0x6B]&0x40)return 0;const afs=[16384,8192,4096,2048][(st.regs[0x1C]>>3)&3],gfs=[131,65.5,32.8,16.4][(st.regs[0x1B]>>3)&3],p=c.params;const vals=[p.ax*afs,p.ay*afs,p.az*afs,(p.temp-36.53)*340,p.gx*gfs,p.gy*gfs,p.gz*gfs].map(v=>Math.max(-32768,Math.min(32767,Math.round(v)))&0xffff);const v=vals[Math.floor((r-0x3B)/2)];return (r-0x3B)%2===0?v>>8:v&255;}return st.regs[r]??0;}
function rtcInit(st,c,sim){if(st.base===undefined){const d=new Date(String(c.params.start).replace(/Z?$/,'Z'));st.base=Number.isFinite(d.getTime())?d.getTime():Date.UTC(2026,0,1,12);st.setAt=sim.time;st.ptr=0;st.regs=new Array(19).fill(0);}}
function rtcNow(st,sim){return new Date(st.base+(sim.time-st.setAt));}
function rtcReg(st,r,c,sim){const d=rtcNow(st,sim);switch(r){case 0:return bcd(d.getUTCSeconds());case 1:return bcd(d.getUTCMinutes());case 2:return bcd(d.getUTCHours());case 3:return d.getUTCDay()+1;case 4:return bcd(d.getUTCDate());case 5:return bcd(d.getUTCMonth()+1)|(d.getUTCFullYear()>=2100?0x80:0);case 6:return bcd(d.getUTCFullYear()%100);case 0x11:return Math.floor(c.params.temp)&255;case 0x12:return (Math.round((c.params.temp%1)*4)&3)<<6;default:return st.regs[r]??0;}}
export const I2C_DEVICES={
 oled:{address:c=>c.params.address},
 lcd:{address:c=>c.params.address},
 mpu6050:{address:(c,circuit)=>circuit.components[c.id]?.address??0x68,
  write(st,bytes){mpuInit(st);if(!bytes.length)return;st.ptr=bytes[0]&127;for(let i=1;i<bytes.length;i++){st.regs[st.ptr]=bytes[i]&255;st.ptr=(st.ptr+1)&127;}},
  read(st,n,c){mpuInit(st);const out=[];for(let i=0;i<n;i++){out.push(mpuReg(st,st.ptr,c));st.ptr=(st.ptr+1)&127;}return out;}},
 ds3231:{address:()=>0x68,
  write(st,bytes,c,sim){rtcInit(st,c,sim);if(!bytes.length)return;st.ptr=bytes[0]%19;const data=bytes.slice(1);if(st.ptr===0&&data.length>=7){const [s,m,h,,date,mon,y]=data;st.base=Date.UTC(2000+unbcd(y),unbcd(mon&0x1f)-1,unbcd(date),unbcd(h&0x3f),unbcd(m),unbcd(s&0x7f));st.setAt=sim.time;st.ptr=7;data.splice(0,7);}for(const b of data){st.regs[st.ptr]=b;st.ptr=(st.ptr+1)%19;}},
  read(st,n,c,sim){rtcInit(st,c,sim);const out=[];for(let i=0;i<n;i++){out.push(rtcReg(st,st.ptr,c,sim));st.ptr=(st.ptr+1)%19;}return out;}},
};
export const i2cAddress=(c,circuit)=>I2C_DEVICES[c.type]?.address(c,circuit);
// Display list in Adafruit-GFX coordinates (6 × 8 px character cells at text size 1).
export class Gfx{
 constructor(w=128,h=64){this.w=w;this.h=h;this.cmds=[];this.cursor=[0,0];this.size=1;this.color=1;this.invert=false;}
 push(c){this.cmds.push(c);if(this.cmds.length>600)this.cmds.splice(0,this.cmds.length-600);}
 write(s){for(const ch of s){if(ch==='\n'){this.cursor=[0,this.cursor[1]+8*this.size];continue;}if(ch==='\r')continue;if(this.cursor[0]+6*this.size>this.w){this.cursor=[0,this.cursor[1]+8*this.size];}const last=this.cmds.at(-1),[x,y]=this.cursor;if(last?.t==='text'&&last.y===y&&last.s===this.size&&last.c===this.color&&last.x+last.str.length*6*this.size===x)last.str+=ch;else this.push({t:'text',x,y,s:this.size,c:this.color,str:ch});this.cursor=[x+6*this.size,y];}}
 call(m,a,sim){const n=i=>Math.round(Number(a[i]??0));switch(m){case'clearDisplay':case'clear':this.cmds=[];this.cursor=[0,0];return 0;case'setTextSize':this.size=Math.max(1,Math.min(8,n(0)));return 0;case'setTextColor':this.color=n(0);return 0;case'setCursor':this.cursor=[n(0),n(1)];return 0;
  case'print':case'println':{const s=sim.fmt(a[0]??'',a.at(-1),a.length>2?a[1]:undefined)+(m==='println'?'\n':'');this.write(s);return s.length;}
  case'drawPixel':this.push({t:'px',x:n(0),y:n(1),c:n(2)});return 0;case'drawLine':this.push({t:'line',x:n(0),y:n(1),x1:n(2),y1:n(3),c:n(4)});return 0;
  case'drawRect':case'fillRect':this.push({t:'rect',x:n(0),y:n(1),w:n(2),h:n(3),c:n(4),fill:m==='fillRect'});return 0;case'drawCircle':case'fillCircle':this.push({t:'circle',x:n(0),y:n(1),r:n(2),c:n(3),fill:m==='fillCircle'});return 0;
  case'fillScreen':this.cmds=[];this.push({t:'rect',x:0,y:0,w:this.w,h:this.h,c:n(0),fill:true});return 0;case'invertDisplay':this.invert=!!a[0];return 0;case'setRotation':case'dim':return 0;default:throw Error(`Unsupported display operation ${m}`);}}
 list(){return {cmds:this.cmds.map(c=>({...c})),invert:this.invert,w:this.w,h:this.h};}
 text(){let out='',lastY=null;for(const c of this.cmds){if(c.t!=='text')continue;if(lastY!==null&&c.y!==lastY)out+='\n';out+=c.str;lastY=c.y;}return out+(this.cursor[0]===0&&this.cmds.some(c=>c.t==='text')?'\n':'');}
 bytes(){return Array.from(this.text().slice(0,24),ch=>ch.charCodeAt(0));}
}
