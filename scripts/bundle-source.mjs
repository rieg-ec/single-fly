import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';import {join,relative} from 'node:path';
const root=new URL('../',import.meta.url).pathname;
const exclude=new Set(['node_modules','.git','.wrangler','.sites-runtime','.next','dist','dist-cloudflare','dist-pages','source','.openai','.DS_Store','connectome_data','outputs','__pycache__']);
const files=[];
async function walk(dir){for(const ent of await readdir(dir,{withFileTypes:true})){if(exclude.has(ent.name)||ent.name.startsWith('.env')||ent.name.startsWith('.dev.vars')||ent.name.endsWith('.tsbuildinfo')||ent.name.endsWith('.bin.gz'))continue;const path=join(dir,ent.name);if(ent.isDirectory())await walk(path);else if(ent.isFile())files.push({path:relative(root,path),base64:(await readFile(path)).toString('base64')});}}
await walk(root);files.push({path:'.openai/hosting.json',base64:Buffer.from(JSON.stringify({d1:null,r2:null},null,2)).toString('base64')});
await mkdir(join(root,'public/source'),{recursive:true});await writeFile(join(root,'public/source/app-files.json'),JSON.stringify(files));console.log(`Bundled ${files.length} source files; brain chunks are appended in the browser.`);
