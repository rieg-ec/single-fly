/** Reproducible full-connectome feature extraction; labels never enter the simulator. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {FlyBrain} from '../public/brain/engine.mjs';
const [datasetPath,outDir,shard='0',shards='1']=process.argv.slice(2);
if(!datasetPath||!outDir)throw Error('Usage: node scripts/extract-training.mjs dataset.json output-directory [shard] [shards]');
const root=new URL('../public/brain/',import.meta.url),meta=JSON.parse(readFileSync(new URL('manifest.json',root)));
meta.sensoryHalfSaturation=.25;
const unpack=name=>{const b=gunzipSync(readFileSync(new URL(name,root)));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const ptr=new Uint32Array(unpack(meta.pointers.file)),post=new Uint32Array(meta.edges),weight=new Float32Array(meta.edges);
for(const info of meta.chunks){const raw=unpack(info.file),u=new Uint32Array(raw),f=new Float32Array(raw);for(let k=0;k<info.count;k++){post[info.start+k]=u[k*2];weight[info.start+k]=f[k*2+1];}}
const brain=new FlyBrain(ptr,post,weight,meta),neutral=new Float32Array(1024).fill(.5);
for(let i=0;i<10;i++)brain.step(neutral);const baseline=brain.snapshot();
mkdirSync(outDir,{recursive:true});
const dataset=JSON.parse(readFileSync(datasetPath));let done=0;
for(let index=0;index<dataset.length;index++){
 if(index%Number(shards)!==Number(shard))continue;
 const row=dataset[index],path=outDir+'/'+row.id+'.bin';if(existsSync(path))continue;
 brain.restore(baseline);const counts=new Uint16Array(meta.neurons),pixels=Float32Array.from(row.pixels);const start=performance.now();let left=0,right=0;
 for(let step=0;step<10;step++){const r=brain.step(pixels);left+=r.left;right+=r.right;for(let i=0;i<counts.length;i++)counts[i]+=brain.counts[i];}
 writeFileSync(path,Buffer.from(counts.buffer));writeFileSync(outDir+'/'+row.id+'.json',JSON.stringify({id:row.id,left,right,computeMs:performance.now()-start}));
 if(++done%10===0)console.log(JSON.stringify({shard,done,last:row.id,ms:Math.round(performance.now()-start)}));
}
console.log('Extraction complete');
