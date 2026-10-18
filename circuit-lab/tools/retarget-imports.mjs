// Rewrites `import {…} from '../src/x.js'` in test/tool files to the engine entry point that exports each name.
import fs from 'node:fs';
import path from 'node:path';
const engines=['catalog','circuit','firmware','runtime','workspace','projects','render'];
const exportsOf={};
for(const e of engines){try{exportsOf[e]=Object.keys(await import(path.resolve('engines',e,'index.js')));}catch(err){exportsOf[e]=[];if(e!=='render'&&e!=='projects')console.warn(e,err.message);}}
for(const file of process.argv.slice(2)){let src=fs.readFileSync(file,'utf8');const dir=path.dirname(file);
 src=src.replace(/import\s*\{([^}]*)\}\s*from\s*'(\.\.\/src\/[\w.]+)';/g,(m,list,from)=>{const names=list.split(',').map(s=>s.trim()).filter(Boolean),by={};
  for(const n of names){const [orig,alias]=n.split(/\s+as\s+/);const e=engines.find(e=>exportsOf[e].includes(orig));if(!e)throw Error(`${file}: nobody exports ${orig}`);(by[e]??=[]).push(n);}
  return Object.entries(by).map(([e,ns])=>`import {${ns.join(',')}} from '${path.relative(dir,path.resolve('engines',e,'index.js')).split(path.sep).join('/')}';`).join('\n');});
 fs.writeFileSync(file,src);console.log('retargeted',file);}
