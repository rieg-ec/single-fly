import ts from 'typescript';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const base of ['/', '/single-fly/']){
 const compiled=ts.transpileModule(readFileSync('lib/asset-path.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replaceAll('__FLY_ASSET_BASE__',JSON.stringify(base));
 const {assetPath}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 for(const path of ['/brain/worker.mjs','/brain/manifest.json','/brain/readout.json','/source/app-files.json','/profiles/CF296.jpg','/profiles/CF296.retina.bin']){
  assert.equal(assetPath(path),base+path.slice(1));assert.ok(existsSync('public'+path));
 }
 assert.equal(assetPath('/'),base);
}
const html=readFileSync('dist-pages/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 assert.ok(match[1].startsWith('/single-fly/'),match[1]);assert.ok(existsSync('dist-pages/'+match[1].slice('/single-fly/'.length)));
}
const bundle=JSON.parse(readFileSync('public/source/app-files.json'));
for(const path of ['.github/workflows/pages.yml','lib/asset-path.ts','vite.cloudflare.config.ts'])assert.ok(bundle.some(f=>f.path===path));
console.log('PASS: root and GitHub Pages asset paths, built entrypoints, and downloadable deployment source.');
