import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';import {join,relative} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const exclude=new Set(['node_modules','.git','.pnpm-store','.agents','.codex','dist','dist-pages','coverage','source','.DS_Store','connectome_data','outputs','work','__pycache__']);
const files=[];
async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){if(exclude.has(ent.name)||ent.name.startsWith('.env')||ent.name.startsWith('.dev.vars')||ent.name.endsWith('.tsbuildinfo')||ent.name.endsWith('.bin.gz'))continue;if(ent.isDirectory()&&((ent.name.startsWith('.')&&ent.name!=='.github')||/^dist(?:-|$)/.test(ent.name)))continue;const path=join(dir,ent.name);if(ent.isDirectory())await walk(path);else if(ent.isFile())files.push({path:relative(root,path),base64:(await readFile(path)).toString('base64')});}}
await walk(root);
await mkdir(join(root,'public/source'),{recursive:true});await writeFile(join(root,'public/source/app-files.json'),JSON.stringify(files));console.log(`Bundled ${files.length} source files; brain chunks are appended in the browser.`);
