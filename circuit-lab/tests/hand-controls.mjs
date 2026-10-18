// Operates parts by hand in the 3D view (knob, joystick, multimeter dial) and checks the circuit reacts.
// Usage: node tests/hand-controls.mjs   (expects `npm run dev` on 127.0.0.1:5173)
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const out=new URL('../screenshots/',import.meta.url).pathname;
const b=await chromium.launch({executablePath:process.env.CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.addInitScript(()=>sessionStorage.setItem('circuit-lab-force-webgl','1'));
const open=async name=>{await p.getByRole('button',{name:'Projects',exact:true}).first().evaluate(e=>e.click());await p.getByLabel('Search projects').fill(name);await p.locator('.project-card').first().click();await p.waitForFunction(()=>window.__circuitLab.scene().objects.size>0);await p.waitForTimeout(1500);};
// Screen point of a named userData group inside a component, so the pointer lands on the actual knob.
const at=(id,key,lift=1)=>p.evaluate(([id,key,lift])=>{const s=window.__circuitLab.scene(),g=s.objects.get(id),o=g.userData[key]??g;const v=o.getWorldPosition(o.position.clone());v.y+=lift;v.project(s.camera);const r=s.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};},[id,key,lift]);
const params=id=>p.evaluate(id=>window.__circuitLab.project().components.find(c=>c.id===id).params,id);
const focus=id=>p.evaluate(id=>{const s=window.__circuitLab.scene(),g=s.objects.get(id),t=g.position.clone();s.controls.target.copy(t);s.camera.position.copy(t).add(new s.camera.position.constructor(0,90,70));s.camera.lookAt(t);s.controls.update();s.dirty=true;},id);
await p.goto('http://127.0.0.1:5173/');await p.waitForFunction(()=>window.__circuitLab?.scene()?.objects.size>0);
await open('Servo follows');await focus('pot');await p.waitForTimeout(600);await p.locator('.run-button').first().click();await p.waitForTimeout(1500);
const before=(await params('pot')).value;let pt=await at('pot','knob',9.5);await p.mouse.move(pt.x,pt.y);await p.mouse.down();for(let i=1;i<=10;i++)await p.mouse.move(pt.x+i*14,pt.y-i*6);await p.mouse.up();
const after=(await params('pot')).value;assert.ok(after>before+.3,`knob turned ${before}→${after}`);await p.waitForTimeout(2500);
const angle=await p.evaluate(()=>window.__circuitLab.state().components?.servo?.angle);console.log('pot',before,'→',after,'servo angle',angle);await p.screenshot({path:out+'15-hand-knob-servo.png'});
await open('Joystick color');const joy=await p.evaluate(()=>window.__circuitLab.project().components.find(c=>c.type==='joystick').id);await focus(joy);await p.waitForTimeout(600);
pt=await at(joy,'stick',10);await p.mouse.move(pt.x,pt.y);await p.mouse.down();for(let i=1;i<=8;i++)await p.mouse.move(pt.x+i*8,pt.y);const held=await params(joy);await p.screenshot({path:out+'16-hand-joystick.png'});await p.mouse.up();const released=await params(joy);
console.log('joystick held',held.x,held.y,'released',released.x,released.y);assert.ok(held.x>.8);assert.equal(released.x,.5);
await open('Multimeter');const dmm=await p.evaluate(()=>window.__circuitLab.project().components.find(c=>c.type==='multimeter').id);await focus(dmm);await p.waitForTimeout(600);const m0=(await params(dmm)).mode;pt=await at(dmm,'dial');await p.mouse.click(pt.x,pt.y);await p.waitForTimeout(300);const m1=(await params(dmm)).mode;console.log('dial',m0,'→',m1);assert.notEqual(m0,m1);
console.log('errors',errors);assert.deepEqual(errors,[]);await b.close();
