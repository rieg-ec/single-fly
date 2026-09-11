import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {FlyBrain} from '../public/brain/engine.mjs';
const f=JSON.parse(readFileSync(new URL('./reference-kernel.json',import.meta.url)));
const b=new FlyBrain(Uint32Array.from(f.ptr),Uint32Array.from(f.post),Float32Array.from(f.weight),{retina:[0],uv:[[0,0]],lamina:[2],readouts:[],displayPoints:[]});
let maxError=0;
for(const r of f.records){b.step(new Float32Array(1024).fill(r.input));assert.deepEqual(Array.from(b.counts),r.counts);for(let i=0;i<b.n;i++){maxError=Math.max(maxError,Math.abs(b.v[i]-r.v[i]),Math.abs(b.g[i]-r.g[i]));assert.ok(Math.abs(b.v[i]-r.v[i])<.002);assert.ok(Math.abs(b.g[i]-r.g[i])<.002);}}
console.log('PASS: upstream C++ fixture, exact spike counts; max float error',maxError);
b.reset();assert.equal(b.totalSpikes,0);assert.equal(b.clock,0);assert.ok(b.v.every(v=>v===-52));console.log('PASS: reset clears all neural state');
