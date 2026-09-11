/** Execute the shipped classic worker through its actual asset/message protocol.
 * No browser/DOM required. Checks every held-out portrait, not cached predictions.
 */
import {readFile,writeFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';import assert from 'node:assert/strict';
import {predict} from '../public/brain/readout.mjs';
const root=new URL('../public/',import.meta.url),profiles=JSON.parse(await readFile(new URL('../lib/evaluation-profiles.json',import.meta.url))),expected=JSON.parse(await readFile(new URL('../research/predictions.json',import.meta.url))).filter(r=>r.split==='test');
const expectedById=new Map(expected.map(r=>[r.id,r]));let last,metadata,actual=[],assetRequests=[];const self={};
self.postMessage=({type,...data})=>{
 if(type==='fetch'){
  assetRequests.push(data.url);
  const path=data.url==='/profiles/alias.retina.bin'?profiles[0].image.replace('.jpg','.retina.bin'):data.url;
  readFile(new URL(path.slice(1),root)).then(bytes=>self.onmessage({data:{type:'fetched',id:data.id,status:200,buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}})).catch(e=>self.onmessage({data:{type:'fetched',id:data.id,error:String(e)}}));
 }else{last={type,...data};if(type==='model')metadata=data;if(type==='error')throw Error(data.message);}
};
globalThis.self=self;
await import(new URL('brain/worker.mjs',root));
await self.onmessage({data:{type:'init'}});assert.equal(last.type,'ready');
async function observe(image){for(let i=0;i<10;i++){await self.onmessage({data:{type:'step',image}});assert.equal(last.type,'tick');assert.equal(!!last.prediction,i===9,'Decisions must occur only after a complete exposure');}return {...last.prediction,spikes:last.spikes};}
for(const p of profiles){const result=await observe(p.image),ref=expectedById.get(p.id);assert.ok(Math.abs(result.score-ref.score)<1e-10,`${p.id}: live ${result.score} != training ${ref.score}`);assert.equal(result.decision,ref.prediction?'like':'pass');actual.push({id:p.id,...result});if(actual.length%10===0)console.log(`${actual.length}/${profiles.length} live-worker decisions match offline evaluation`);}
const repeated=await observe(profiles[0].image);assert.equal(repeated.score,actual[0].score,'History must not change a portrait decision');
const alias=await observe('/profiles/alias.jpg');assert.equal(alias.score,actual[0].score,'Changing identity metadata cannot change a pixel-driven decision');
assert.ok(actual.some(r=>r.decision==='like')&&actual.some(r=>r.decision==='pass'));
assert.ok(assetRequests.every(u=>u.startsWith('/brain/')||u.endsWith('.retina.bin')),'No labels or feature caches loaded by runtime');
const model=JSON.parse(await readFile(new URL('brain/readout.json',root)));const zero=predict(new Uint32Array(166700),model);
const result={passed:true,portraits:actual.length,exactScoreMatches:true,orderInvariant:true,identityAliasInvariant:true,likes:actual.filter(r=>r.decision==='like').length,passes:actual.filter(r=>r.decision==='pass').length,zeroActivityScore:zero.score,worker:'public/brain/worker.mjs',model:metadata.version};
await writeFile(new URL('../research/worker-verification.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
