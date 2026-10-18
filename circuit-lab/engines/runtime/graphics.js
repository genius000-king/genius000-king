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
