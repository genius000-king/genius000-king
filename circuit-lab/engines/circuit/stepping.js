import {isBoard} from '../catalog/boards.js';
import {terminals, ref, isBreadboard} from '../catalog/types.js';
import {SCOPE_SAMPLES} from './circuit.js';
import {ELEMENTS} from './elements/index.js';
import {solveMatrix} from './matrix.js';

// Circuit methods: step, pwmActive, drivers, deviceFor, substep
export const steppingMethods = {
step(hw,time){hw=this.sharedHardware??hw;if(this.count>700)throw Error('Circuit exceeds the 700-net solver budget.');if(this.t!==null&&time<this.t){this.state={};this.prevState={};this.t=null;this.ledAcc={};for(const k in this.samples)this.samples[k]={t:[],v:[]};}
  if(this.t===null){this.lastH=1e-6;this.prevState=this.state;this.state=this.substep(hw,time,1e-6,this.state,false);this.t=time;}
  else if(time>this.t){this.switching=this.transient||this.pwmActive(hw);const n=this.switching?Math.max(1,this.precision):1,h=(time-this.t)/n;this.ledAcc={};for(let j=1;j<=n;j++){this.prevState=this.state;this.state=this.substep(hw,this.t+h*j,h,this.prevState,true);}this.lastH=h;this.t=time;}
  else this.state=this.substep(hw,time,this.lastH,this.prevState,false);
  this.finalize();return this;},
pwmActive(hw){for(const c of this.project.components){if(!isBoard(c))continue;const g=this.deviceFor(hw,c)?.gpio;if(g)for(const s of Object.values(g))if(s.mode===1&&s.duty!==undefined&&!s.servo&&s.duty>0&&s.duty<1)return true;}return false;},
drivers(hw){const map=new Map();for(const c of this.project.components){if(!isBoard(c))continue;const dev=this.deviceFor(hw,c);if(!dev)continue;for(const t of terminals(c)){if(t.gpio===undefined)continue;const s=dev.gpio?.[t.gpio];if(!s||s.mode!==1)continue;if(s.duty!==undefined||s.servo){const net=this.netOf(ref(c,t.id));if(net!==undefined)map.set(net,{freq:s.frequency??0,duty:s.duty??0,servo:s.servo,board:c.id,pin:t.gpio});}}}return map;},
deviceFor(hw,c){if(!hw)return null;if(hw.boards)return hw.boards[c.id]??null;const own=hw.board?.();return !own||own.id===c.id?hw:null;},
substep(hw,t,hMs,base,accumulate){const n=this.count,M=this.matrix,rhs=this.rhs,h=hMs/1000,graph=this.graph;const lin=[],sources=[],leds=[],nls=[],posts=[],results=[],next={},refs=[];const prevX=this.last,drivers=this.drivers(hw),diags=[],edges=this.edges;
  const G=(a,b,g)=>{if(a===b)return;if(a!==undefined)M[a*n+a]+=g;if(b!==undefined&&b!==null)M[b*n+b]+=g;if(a!==undefined&&b!==undefined&&b!==null){M[a*n+b]-=g;M[b*n+a]-=g;}};
  const st={G,I:(a,b,i)=>{if(a!==undefined)rhs[a]-=i;if(b!==undefined&&b!==null)rhs[b]+=i;},M:(r,c,v)=>{if(r!==undefined&&c!==undefined)M[r*n+c]+=v;},rhs:(r,v)=>{if(r!==undefined)rhs[r]+=v;}};
  let x=prevX;
  for(const c of this.project.components){if(isBreadboard(c))continue;const idx=p=>graph.index[ref(c,p)];const s=base[c.id]??{},nx={...s};next[c.id]=nx;const digital=this.digital[c.id]??(this.digital[c.id]={});
   const k={c,p:c.params,id:c.id,t,h,s,next:nx,digital,hw,n:idx,
    R:(a,b,r)=>lin.push([idx(a),idx(b),1/Math.max(1e-6,r)]),
    S:(a,b,v,r,kind,opt={})=>{sources.push({a:idx(a),b:idx(b),v,g:1/r,kind,component:c.id,...opt});},
    ref:p=>refs.push(idx(p)),
    led:(a,b,vf,rd=15)=>leds.push({a:idx(a),b:idx(b),vf,rd,key:c.id+':'+a}),
    nl:f=>nls.push(f),post:f=>posts.push(f),result:f=>results.push([c,f]),
    v:p=>this.x?.[idx(p)]??0,vn:i=>this.x?.[i]??0,vprev:p=>prevX[idx(p)]??0,
    avg:(tag,inst)=>{const a=this.ledAcc[c.id+':'+tag];return this.switching&&a?.time>0?a.sum/a.time:inst;},
    drive:p=>drivers.get(idx(p)),edge:(p,level,at=t)=>{edges.push({net:idx(p),level,t:at});if(edges.length>64)edges.shift();},
    sample:vals=>{const b=this.samples[c.id]??(this.samples[c.id]={t:[],v:[]});if(b.t.length&&b.t.at(-1)>=t){b.v[b.v.length-1]=vals;return;}b.t.push(t);b.v.push(vals);if(b.t.length>SCOPE_SAMPLES){b.t.splice(0,b.t.length-SCOPE_SAMPLES);b.v.splice(0,b.v.length-SCOPE_SAMPLES);}},
    diag:(level,message)=>diags.push({level,component:c.id,message})};
   if(isBoard(c))this.boardElement(k,hw,t,hMs);else ELEMENTS[c.type]?.(k);}
  // Without a board the first supply's negative terminal is the 0 V reference, like a bench ground.
  const boardGround=this.project.components.some(isBoard);refs.forEach((r,i)=>{if(r!==undefined)lin.push([r,null,!boardGround&&r===refs.find(x=>x!==undefined)?1e3:1e-9]);});
  // Linear part of the matrix is identical for every Newton iteration.
  M.fill(0);rhs.fill(0);for(let i=0;i<n;i++)M[i*n+i]=1e-10;for(const [a,b,g]of lin)G(a,b,g);for(const s of sources){G(s.a,s.b,s.g);st.I(s.a,s.b,-s.g*s.v);}
  const baseM=M.slice(),baseR=rhs.slice(),nonlinear=leds.length||nls.length;let converged=!nonlinear,codes=[];
  for(let iter=0;iter<(nonlinear?120:1);iter++){if(iter){M.set(baseM);rhs.set(baseR);}const nextCodes=[];for(const l of leds){const on=(x[l.a]??0)-(x[l.b]??0)>l.vf;nextCodes.push(on);if(on){G(l.a,l.b,1/l.rd);st.I(l.a,l.b,-l.vf/l.rd);}else G(l.a,l.b,1e-10);}for(const f of nls)nextCodes.push(f(x,st));
   const sol=solveMatrix(M,rhs,n);let delta=0;for(let i=0;i<n;i++){const d=Math.abs(sol[i]-(x[i]??0));if(d>delta)delta=d;}const same=nextCodes.length===codes.length&&nextCodes.every((c,i)=>c===codes[i]);codes=nextCodes;x=iter>25&&delta>1?x.map((v,i)=>v+(sol[i]-v)*.5):sol;if(!nonlinear){converged=true;break;}let scale=0;for(let i=0;i<n;i++)scale=Math.max(scale,Math.abs(sol[i]));if(delta<1e-6+1e-7*scale&&same&&iter>0){converged=true;break;}}
  if(!converged)diags.push({level:'warning',message:'Nonlinear solver did not converge in 120 iterations. Results may be inaccurate.'});
  for(let i=0;i<n;i++){if(!Number.isFinite(x[i])||Math.abs(x[i])>1e6)throw Error('Electrical solver diverged. Check supplies and component values.');}
  this.x=x;this.last=x;this.sources=sources;this.leds=leds;
  if(accumulate)for(const l of leds){const i=Math.max(0,((x[l.a]??0)-(x[l.b]??0)-l.vf)/l.rd),a=this.ledAcc[l.key]??(this.ledAcc[l.key]={sum:0,time:0});a.sum+=i*hMs;a.time+=hMs;}
  for(const f of posts)f();this.pendingResults=results;this.pendingDiags=diags;this.lastTime=t;return next;}
};
