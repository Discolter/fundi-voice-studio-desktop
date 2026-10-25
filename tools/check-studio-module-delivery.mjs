import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'package','web');
const host=readFileSync(path.join(root,'package','LocalServer.cs'),'utf8');
const staticSet=host.match(/static readonly HashSet<string> StaticFiles[^{]*\{([\s\S]*?)\}/)?.[1];
assert.ok(staticSet,'Studio local HTTP server static allowlist not found');
const allowed=new Set([...staticSet.matchAll(/"([^"]+)"/g)].map(m=>m[1]));
const dependencies=new Set(['/app.js']);
for(const file of readdirSync(web).filter(name=>name.endsWith('.js'))){
  const source=readFileSync(path.join(web,file),'utf8');
  const imports=[
    ...source.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]/gm),
    ...source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
    ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)
  ];
  for(const match of imports){
    if(!match[1].startsWith('.'))continue;
    dependencies.add(path.posix.normalize(path.posix.join('/',path.posix.dirname(file),match[1])));
  }
}
for(const dep of dependencies){
  assert.ok(existsSync(path.join(web,dep.slice(1))),'Missing bundled JavaScript module: '+dep);
  assert.ok(allowed.has(dep),'Local desktop server returns 404 for imported module: '+dep);
}
assert.ok(dependencies.has('/age.js'),'Regression check must cover the project/role age module');
console.log('PASS desktop module delivery: '+dependencies.size+' imports served by local host');
