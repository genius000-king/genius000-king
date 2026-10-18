import {mixin} from '../shared/mixin.js';
import {boardElementMethods} from './board-element.js';
import {resultsMethods} from './results.js';
import {steppingMethods} from './stepping.js';
import {topologyMethods} from './topology.js';

export const electricalSignature=p=>JSON.stringify([p.components.map(c=>[c.id,c.type,c.params]),p.wires.map(w=>[w.a,w.b])]);

export const TRANSIENT=new Set(['acsource','transformer','transformerct','toroid','choke','fuse','stepper','cd4017','pwmgen','capacitor','electrolytic','inductor','relay','motor','servo','lamp','ne555','fgen','scope','logic','mq2','hcsr04','encoder','battery','aapack','lipo']);

export const SCOPE_SAMPLES=4000;

export class Circuit {
constructor(project){this.project=project;this.voltages={};this.components={};this.diagnostics=[];this.graph=null;this.digital={};this.precision=project.config?.precision??5;this.rebuild();this.resetState();}
resetState(){this.t=null;this.state={};this.prevState={};this.lastH=1;this.edges=[];this.samples={};this.ledAcc={};this.digital={};}
voltage(node){return this.voltages[node]??0;}
}

mixin(Circuit, topologyMethods, steppingMethods, boardElementMethods, resultsMethods);
