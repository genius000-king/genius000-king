// Lists top-level declarations of a module with their size, to plan how it is split into engines.
import fs from 'node:fs';
import {parse} from '@babel/parser';
const file=process.argv[2],src=fs.readFileSync(file,'utf8');
const ast=parse(src,{sourceType:'module',plugins:['jsx']});
for(const n of ast.program.body){const size=n.end-n.start;let names=[];const d=n.type.startsWith('Export')&&n.declaration?n.declaration:n;
 if(d.type==='VariableDeclaration')names=d.declarations.map(x=>x.id.name+(x.init?.type==='ObjectExpression'?`{${x.init.properties.length}}`:''));else if(d.id)names=[d.id.name+(d.type==='ClassDeclaration'?`<class ${d.body.body.length} members>`:'')];else names=[n.type+(n.type==='ExpressionStatement'?':'+src.slice(n.start,n.start+30):'')];
 console.log(String(size).padStart(6),names.join(', '));}
