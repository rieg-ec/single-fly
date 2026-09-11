import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {FlyBrain} from '../public/brain/engine.mjs';
const root=new URL('../public/brain/',import.meta.url);const meta=JSON.parse(readFileSync(new URL('manifest.json',root)));
function unpack(name){const b=gunzipSync(readFileSync(new URL(name,root)));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
const ptr=new Uint32Array(unpack(meta.pointers.file)),post=new Uint32Array(meta.edges),weight=new Float32Array(meta.edges);
for(const info of meta.chunks){const raw=unpack(info.file),u=new Uint32Array(raw),f=new Float32Array(raw);for(let k=0;k<info.count;k++){post[info.start+k]=u[2*k];weight[info.start+k]=f[2*k+1];}}
const brain=new FlyBrain(ptr,post,weight,meta);
const portraits=JSON.parse(readFileSync(new URL('./portrait-inputs.json',import.meta.url)));
const summaries=[];
for(const profile of portraits){let left=0,right=0,spikes=0;const start=performance.now();for(let i=0;i<20;i++){const r=brain.step(Float32Array.from(profile.pixels));left+=r.left;right+=r.right;spikes+=r.spikes;}summaries.push({profile:profile.id,computeMs:Math.round(performance.now()-start),spikes,left,right,decision:right>left?'like':left>right?'pass':'hold'});}
console.log(JSON.stringify({neurons:meta.neurons,edges:meta.edges,observations:summaries},null,2));
if(summaries.some(s=>s.spikes===0))throw Error('Network did not fire');
