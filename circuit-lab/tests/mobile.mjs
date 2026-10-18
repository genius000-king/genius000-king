// Phone checks on an emulated iPhone 13: framing fills the screen, a tap never triggers a ghost click,
// the inspector is a bottom sheet, and the full-screen button works.  Usage: node tests/mobile.mjs
import {chromium,devices} from '@playwright/test';
import assert from 'node:assert/strict';
const out=new URL('../screenshots/',import.meta.url).pathname;
const b=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const ctx=await b.newContext({...devices['iPhone 13'],defaultBrowserType:undefined}),p=await ctx.newPage(),errors=[];p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.addInitScript(()=>(sessionStorage.setItem('circuit-lab-force-webgl','1'),sessionStorage.setItem('circuit-lab-debug','1')));
const btn=name=>p.getByRole('button',{name,exact:true}).first().evaluate(e=>e.click());
// Fraction of the screen width covered by the projected bounds of every part.
const coverage=()=>p.evaluate(()=>{const s=window.__circuitLab.scene();let min=1,max=-1,ymin=1,ymax=-1;for(const g of s.objects.values()){const bx=g.userData.localBounds.clone().applyMatrix4(g.matrixWorld);for(const x of [bx.min.x,bx.max.x])for(const y of [bx.min.y,bx.max.y])for(const z of [bx.min.z,bx.max.z]){const v=new s.camera.position.constructor(x,y,z).project(s.camera);min=Math.min(min,v.x);max=Math.max(max,v.x);ymin=Math.min(ymin,v.y);ymax=Math.max(ymax,v.y);}}return {min,max,ymin,ymax,width:(max-min)/2,height:(ymax-ymin)/2};});
await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>window.__circuitLab?.scene()?.objects.size>0);await p.waitForTimeout(2500);
await btn('Projects');await p.getByLabel('Search projects').fill('Traffic');await p.locator('.project-card').first().click();await p.waitForTimeout(3000);
let c=await coverage();console.log('traffic coverage',c);assert.ok(c.min>=-1.001&&c.max<=1.001,'whole circuit on screen');assert.ok(c.ymin>=-1.001&&c.ymax<=1.001,'whole circuit on screen vertically');assert.ok(Math.max(c.max,-c.min)>.8||Math.max(c.ymax,-c.ymin)>.65,'framing is tight in at least one direction');
await p.locator('.run-button').first().evaluate(e=>e.click());await p.waitForTimeout(3000);await p.screenshot({path:out+'mobile-traffic.png'});
// Tap a part: it must select, open the sheet, and not duplicate anything.
const before=await p.evaluate(()=>window.__circuitLab.project().components.length);
const pt=await p.evaluate(()=>{const s=window.__circuitLab.scene(),v=s.objects.get('uno').position.clone();v.y+=3;v.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};});
await p.touchscreen.tap(pt.x,pt.y);await p.waitForTimeout(1200);
assert.equal(await p.evaluate(()=>window.__circuitLab.project().components.length),before,'a tap must not duplicate parts');
const sheet=await p.locator('.inspector').boundingBox(),vp=p.viewportSize();console.log('sheet',sheet);assert.ok(sheet&&sheet.y>vp.height*.35&&sheet.width>vp.width*.85,'inspector is a bottom sheet');
await p.screenshot({path:out+'mobile-sheet.png'});await btn('Close inspector');
await btn('Full screen');await p.waitForTimeout(1200);assert.ok(await p.evaluate(()=>document.querySelector('.app').classList.contains('immersive')));await p.screenshot({path:out+'mobile-fullscreen.png'});
await btn('Exit full screen');await p.waitForTimeout(600);assert.ok(!(await p.evaluate(()=>document.querySelector('.app').classList.contains('immersive'))));
// Turning the phone sideways re-frames the circuit for the new shape.
await p.setViewportSize({width:844,height:390});await p.waitForTimeout(1500);c=await coverage();console.log('landscape coverage',c);assert.ok(c.min>=-1.001&&c.max<=1.001&&c.ymin>=-1.001&&c.ymax<=1.001);assert.ok(c.width>.5,'landscape re-orients the circuit to use the width');await p.screenshot({path:out+'mobile-landscape.png'});
console.log('errors',errors);assert.deepEqual(errors,[]);await b.close();
