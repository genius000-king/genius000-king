import * as THREE from 'three';
import {drawGfx, lcdFace} from './displays.js';

// LabScene methods: state
export const visualsMethods = {
state(state){let changed=false;const set=(m,v,key='emissiveIntensity')=>{if(m&&Math.abs(m[key]-v)>.005){m[key]=v;changed=true;}};
  for(const [id,g]of this.objects){const c=state.components?.[id],ud=g.userData,comp=this.project?.components.find(x=>x.id===id);if(!comp)continue;
   if(ud.powerMaterial)set(ud.powerMaterial,(c?.powerCurrent??0)*500);if(ud.ledMaterial){const b=c?.brightness??0,base=new THREE.Color(comp.params.color);set(ud.ledMaterial,b*1.25);const col=base.clone().multiplyScalar(.35+.65*Math.min(1,b*1.5));if(!ud.ledMaterial.color.equals(col)){ud.ledMaterial.color.copy(col);changed=true;}}if(ud.halo){const lvl=comp.type==='rgbled'?Math.max(c?.redLevel??0,c?.greenLevel??0,c?.blueLevel??0):comp.type==='lamp'?Math.min(1,c?.glow??0):(c?.brightness??0);if(comp.type==='rgbled'&&lvl>0)ud.halo.material.color.setRGB(c.redLevel,c.greenLevel,c.blueLevel);if(Math.abs(ud.halo.material.opacity-lvl*.85)>.01){ud.halo.material.opacity=lvl*.85;changed=true;}}
   if(ud.segments)for(const [key,material]of Object.entries(ud.segments))set(material,(c?.segments?.[key]??0)*3);
   if(ud.rgbMaterial){const r=c?.redLevel??0,gg=c?.greenLevel??0,b=c?.blueLevel??0;const col=new THREE.Color(r,gg,b);if(!ud.rgbMaterial.emissive.equals(col)){ud.rgbMaterial.emissive.copy(col).multiplyScalar(2.2);changed=true;}}
   if(ud.bars)ud.bars.forEach((m,i)=>set(m,(c?.levels?.[i]??0)*3));
   if(ud.tlLeds)for(const l of ud.tlLeds){const lvl=c?.[l.key+'Level']??0;set(l.material,lvl*2.6);if(l.halo&&Math.abs(l.halo.material.opacity-lvl*.85)>.01){l.halo.material.opacity=lvl*.85;changed=true;}}
   if(ud.stepShaft){const a=-(c?.angle??0)*Math.PI/180;if(ud.stepShaft.rotation.y!==a){ud.stepShaft.rotation.y=a;changed=true;}}
   if(ud.cone){ud.coneY??=ud.cone.position.y;const y=ud.coneY+Math.max(-1,Math.min(1,(c?.voltage??0)/2.8))*.6;if(ud.cone.position.y!==y){ud.cone.position.y=y;changed=true;}}
   if(ud.fuseOk){const blown=!!c?.blown;if(ud.fuseOk.visible===blown){ud.fuseOk.visible=!blown;if(ud.fuseBlown)ud.fuseBlown.visible=blown;changed=true;}}
   if(ud.reedMagnet){const z=-(3.25+(comp.params.distance??30));if(ud.reedMagnet.position.z!==z){ud.reedMagnet.position.z=z;changed=true;}}
   if(ud.slideKnob){const x=((comp.params.value??.5)-.5)*60;if(ud.slideKnob.position.x!==x){ud.slideKnob.position.x=x;changed=true;}}
   if(ud.acKnob){const r=-(comp.params.vrms??0)/250*Math.PI*1.5;if(ud.acKnob.rotation.z!==r){ud.acKnob.rotation.z=r;changed=true;}}
   if(ud.acLamp){const hot=comp.params.on&&comp.params.vrms>50;set(ud.acLamp,hot?2.2:0);if(ud.acHalo&&Math.abs(ud.acHalo.material.opacity-(hot?.7:0))>.01){ud.acHalo.material.opacity=hot?.7:0;changed=true;}}
   if(ud.buckLed)set(ud.buckLed,c?.powered?2:0);if(ud.irLeds){set(ud.irLeds.pwr,c?.powered?2:0);set(ud.irLeds.obs,c?.detected?2.4:0);}
   if(ud.pixels){const cols=c?.colors??[];ud.pixels.forEach((m,i)=>{const p=cols[i]??[0,0,0],lvl=Math.max(p[0],p[1],p[2])/255,col=lvl?new THREE.Color(p[0]/255/lvl,p[1]/255/lvl,p[2]/255/lvl):new THREE.Color(0,0,0);/* A dimmed WS2812B still shows its hue — only the intensity drops */if(!m.emissive.equals(col)){m.emissive.copy(col);m.color.copy(lvl?col.clone().multiplyScalar(.08):new THREE.Color('#f2f2ee'));changed=true;}set(m,lvl>0?.5+.6*Math.sqrt(lvl):0);});}
   if(ud.lamp){set(ud.lamp.fil,(c?.glow??0)*4);set(ud.lamp.glass,(c?.glow??0)*1.5);}
   if(ud.boardLeds){const leds=c?.leds??[];for(const l of ud.boardLeds){const s=leds.find(x=>x.label===l.label);set(l.material,(s?.on??0)*2.5);}}
   if(ud.horn&&c?.angle!==undefined){const r=-(c.angle-90)*Math.PI/180;if(Math.abs(ud.horn.rotation.y-r)>.002){ud.horn.rotation.y=r;changed=true;}}
   if(ud.motorShaft&&c?.angle!==undefined){if(Math.abs(ud.motorShaft.rotation.x-c.angle)>.002){ud.motorShaft.rotation.x=c.angle;changed=true;}}
   if(ud.armature&&c){const r=c.closed?-.12:0;if(ud.armature.rotation.x!==r){ud.armature.rotation.x=r;changed=true;}}
   if(ud.pirLed)set(ud.pirLed,c?.detecting?2:0);if(ud.mqLeds){set(ud.mqLeds[0],(c?.current??0)>.05?2:0);set(ud.mqLeds[1],(c?.ao??0)>comp.params.threshold*5?2:0);}
   if(ud.display){const d=ud.display;let key,draw;
    if(comp.type==='oled'||comp.type==='lcd'){const s=c?.powered?(state.oled?.[id]??''):'',gx=state.gfx?.[id];key=JSON.stringify([s,c?.powered,gx]);draw=ctx=>{if(d.lcd){const lit=c?.powered&&gx?.backlight!==false;ctx.fillStyle=c?.powered?(lit?'#a4b85d':'#7d8a4c'):'#65724d';ctx.fillRect(0,0,d.canvas.width,d.canvas.height);ctx.fillStyle='#243824';ctx.font='42px monospace';s.split('\n').slice(0,2).forEach((l,i)=>ctx.fillText(l,7,48+i*57));}else if(gx?.cmds&&c?.powered)drawGfx(ctx,gx,d.canvas.width,d.canvas.height);else{ctx.fillStyle='#071415';ctx.fillRect(0,0,d.canvas.width,d.canvas.height);ctx.fillStyle='#9ce7df';ctx.font='18px monospace';s.split('\n').slice(0,6).forEach((l,i)=>ctx.fillText(l,7,20+i*20));}};}
    else if(comp.type==='panelmeter'){key=c?.display??'';draw=ctx=>lcdFace(ctx,d.canvas.width,d.canvas.height,'#140405','#ff3b2b',[c?.display??''],'bold 104px monospace');}
    else if(comp.type==='pwmgen'){const p=comp.params,f=p.frequency>=1000?`F${(p.frequency/1000).toFixed(p.frequency>=10000?1:2)}k`:`F${String(Math.round(p.frequency)).padStart(3,'0')}`;key=JSON.stringify([f,p.duty,c?.powered]);draw=ctx=>lcdFace(ctx,d.canvas.width,d.canvas.height,c?.powered?'#2c5fd0':'#1b2433','#e9f2ff',c?.powered?[f,`D${String(Math.round(p.duty*100)).padStart(3,'0')}`]:['',''],'bold 48px monospace');}
    else if(comp.type==='acsource'){const p=comp.params;key=JSON.stringify([p.vrms,p.frequency,p.on]);draw=ctx=>lcdFace(ctx,d.canvas.width,d.canvas.height,'#160a04','#ffb03a',p.on?[`${p.vrms.toFixed(1)} V~`,`${p.frequency} Hz`]:['OFF',''],'bold 36px monospace');}
    else if(comp.type==='multimeter'){key=c?.display??'';draw=ctx=>lcdFace(ctx,d.canvas.width,d.canvas.height,'#a9b39a','#1c221a',[` ${c?.display??'0.000'}`],'bold 56px monospace');}
    else if(comp.type==='psu'){key=JSON.stringify([c?.voltage?.toFixed(2),c?.current?.toFixed(3),c?.mode]);draw=ctx=>lcdFace(ctx,d.canvas.width,d.canvas.height,'#061a10','#5dff9a',[`${(c?.voltage??0).toFixed(2).padStart(5,'0')} V`,`${(c?.current??0).toFixed(3)} A  ${(c?.mode??'').slice(0,2)}`],'bold 34px monospace');}
    else if(comp.type==='fgen'){const p=comp.params;key=JSON.stringify(p);draw=ctx=>{lcdFace(ctx,d.canvas.width,d.canvas.height,'#04121c','#6fd2ff',[`${p.wave.toUpperCase()}  ${p.frequency} Hz`,`${p.amplitude} Vp  ${p.offset>=0?'+':''}${p.offset} V`],'bold 26px monospace');};}
    else if(comp.type==='scope'){const sc=state.scope?.[id];key=sc?sc.t.length+':'+sc.t[sc.t.length-1]:'none';draw=ctx=>{const W=d.canvas.width,H=d.canvas.height;ctx.fillStyle='#050807';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#1d3a2c';for(let i=1;i<10;i++){ctx.beginPath();ctx.moveTo(i*W/10,0);ctx.lineTo(i*W/10,H);ctx.stroke();}for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(0,i*H/8);ctx.lineTo(W,i*H/8);ctx.stroke();}if(!sc)return;const n=sc.t.length,max=Math.max(1,...sc.v.flat().map(Math.abs));['#f2d235','#3ac0e8'].forEach((col,ch)=>{ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();sc.v.forEach((v,i)=>{const x=i/(n-1||1)*W,y=H/2-v[ch]/max*H*.45;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});};}
    if(draw&&d.last!==key){draw(d.canvas.getContext('2d'));d.texture.needsUpdate=true;d.last=key;changed=true;}}}
  if(changed)this.dirty=true;}
};
