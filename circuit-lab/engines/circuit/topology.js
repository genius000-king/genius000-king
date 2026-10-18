import {profileOf} from '../catalog/boards.js';
import {terminals, ref, TYPES, isBreadboard} from '../catalog/types.js';
import {TRANSIENT} from './circuit.js';
import {Union} from './graph.js';

// Circuit methods: rebuild, same, linked, netOf
export const topologyMethods = {
rebuild(){const u=new Union(),nodes=[];for(const c of this.project.components){const ts=terminals(c);ts.forEach(t=>{const r=ref(c,t.id);u.root(r);nodes.push(r);});const prof=profileOf(c);if(prof){for(const g of prof.gnd.slice(1))u.join(ref(c,prof.gnd[0]),ref(c,g));for(const [a,b]of prof.joins)u.join(ref(c,a),ref(c,b));}for(const [a,b]of TYPES[c.type]?.joins??[])u.join(ref(c,a),ref(c,b));if(isBreadboard(c)){const strips={};ts.forEach(t=>{if(strips[t.strip])u.join(strips[t.strip],ref(c,t.id));else strips[t.strip]=ref(c,t.id);});}}
  this.invalid=[];for(const w of this.project.wires){if(!u.m.has(w.a)||!u.m.has(w.b)){this.invalid.push(`Wire ${w.id} has a disconnected endpoint`);continue;}u.join(w.a,w.b);}
  const active=new Set(this.project.components.filter(c=>!isBreadboard(c)).flatMap(c=>terminals(c).map(t=>u.root(ref(c,t.id)))));for(const w of this.project.wires){if(u.m.has(w.a))active.add(u.root(w.a));if(u.m.has(w.b))active.add(u.root(w.b));}
  const roots=[...new Set(nodes.map(n=>u.root(n)))].filter(r=>active.has(r)),map=new Map(roots.map((r,i)=>[r,i]));this.graph={u,nodes,roots,index:Object.fromEntries(nodes.map(n=>[n,map.get(u.root(n))]))};
  const old=this.count;this.count=roots.length;this.matrix=new Float64Array(this.count*this.count);this.rhs=new Float64Array(this.count);if(old!==this.count||!this.last)this.last=new Float64Array(this.count);
  this.connected=new Set(this.project.wires.flatMap(w=>[w.a,w.b]));this.transient=this.project.components.some(c=>TRANSIENT.has(c.type));this.precision=this.project.config?.precision??this.precision??5;},
same(a,b){return this.graph.u.m.has(a)&&this.graph.u.m.has(b)&&this.graph.u.root(a)===this.graph.u.root(b);},
linked(a,b){const ia=this.netOf(a),ib=this.netOf(b);if(ia===undefined||ib===undefined)return false;if(ia===ib)return true;const adj=new Map();for(const c of this.project.components){if(c.type!=='resistor'||c.params.resistance>100000)continue;const x=this.netOf(ref(c,'A')),y=this.netOf(ref(c,'B'));if(x===undefined||y===undefined)continue;(adj.get(x)??adj.set(x,[]).get(x)).push(y);(adj.get(y)??adj.set(y,[]).get(y)).push(x);}const seen=new Set([ia]),q=[ia];while(q.length){const n=q.shift();for(const m of adj.get(n)??[]){if(m===ib)return true;if(!seen.has(m)){seen.add(m);q.push(m);}}}return false;},
netOf(node){return this.graph.index[node];}
};
