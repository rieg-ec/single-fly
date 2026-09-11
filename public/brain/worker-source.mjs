import {FlyBrain} from './engine.mjs';
import {predict} from './readout.mjs';
import {sha256} from './hash/sha256.mjs';
let brain,meta,frame,currentProfile,model,baseline,exposureCounts,exposureMs=0,runMs=0,runSpikes=0,loaded=0;
const send=(type,data={})=>self.postMessage({type,...data});
// Main-thread asset transport also works in preview hosts that proxy page requests.
const pending=new Map();let requestId=0;
function fetchResource(url){return new Promise((resolve,reject)=>{const id=++requestId;pending.set(id,{resolve,reject});send('fetch',{id,url});});}

async function verified(info){
 const response=await fetchResource('/brain/'+info.file).catch(e=>{throw Error(info.file+': '+e.message)});if(!response.ok)throw Error(`Could not download ${info.file} (${response.status})`);
 const compressed=await response.arrayBuffer();
 const raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(raw.byteLength!==info.rawBytes)throw Error('Connectome length check failed');
 const digest=crypto.subtle?new Uint8Array(await crypto.subtle.digest('SHA-256',raw)):sha256(new Uint8Array(raw));
 const hash=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==info.sha256)throw Error('Connectome integrity check failed');
 loaded+=info.bytes;send('loading',{progress:Math.round(100*loaded/meta.totalDownloadBytes),bytes:loaded});return raw;
}
async function load(){
 const res=await fetchResource('/brain/manifest.json').catch(e=>{throw Error('Manifest: '+e.message)});if(!res.ok)throw Error('Connectome manifest is unavailable');meta=await res.json();
 send('meta',{meta:{neurons:meta.neurons,edges:meta.edges,contacts:meta.synaptic_contacts,retina:meta.retina.length,points:meta.displayPoints,downloadBytes:meta.totalDownloadBytes,readouts:meta.readouts}});
 const ptr=new Uint32Array(await verified(meta.pointers)),post=new Uint32Array(meta.edges),weight=new Float32Array(meta.edges);
 const queue=[...meta.chunks];
 await Promise.all(Array.from({length:3},async()=>{while(queue.length){const info=queue.shift(),raw=await verified(info),u=new Uint32Array(raw),f=new Float32Array(raw);for(let k=0;k<info.count;k++){post[info.start+k]=u[k*2];weight[info.start+k]=f[k*2+1];}}}));
 for(let e=0;e<post.length;e++)if(post[e]>=meta.neurons||!Number.isFinite(weight[e]))throw Error('Invalid edge data');
 const modelRes=await fetchResource('/brain/readout.json');if(!modelRes.ok)throw Error('Trained model unavailable');model=await modelRes.json();
 meta.sensoryHalfSaturation=model.sensoryHalfSaturation;
 brain=new FlyBrain(ptr,post,weight,meta);
 const neutral=new Float32Array(1024).fill(.5);
 for(let i=0;i<model.settleMs/20;i++)brain.step(neutral);
 baseline=brain.snapshot();exposureCounts=new Uint32Array(meta.neurons);
 send('model',{evaluation:model.evaluation,version:model.version,exposureMs:model.exposureMs});send('ready');
}
async function input(path){
 if(currentProfile===path&&frame)return;
 const res=await fetchResource(path.replace(/\.jpg$/,'.retina.bin'));if(!res.ok)throw Error('Portrait sensory input unavailable');
 const bytes=new Uint8Array(await res.arrayBuffer());if(bytes.length!==1024)throw Error('Invalid portrait sensory input');
 frame=Float32Array.from(bytes,b=>b/255);
 brain.restore(baseline);exposureCounts.fill(0);exposureMs=0;
 currentProfile=path;send('retina',{pixels:Array.from(frame)});
}
let busy=false;
self.onmessage=async({data})=>{
 if(data.type==='fetched'){const p=pending.get(data.id);if(!p)return;pending.delete(data.id);if(data.error)p.reject(Error(data.error));else p.resolve(new Response(data.buffer,{status:data.status,headers:{'Content-Type':data.contentType||'application/octet-stream'}}));return;}

 if(busy){send('error',{message:'Overlapping simulation request'});return;}busy=true;
 try{
  if(data.type==='init')await load();
  if(data.type==='step'){
    if(!brain)throw Error('Brain has not loaded');await input(data.image);const t=performance.now();
    const result=brain.step(frame,20);exposureMs+=20;runMs+=20;runSpikes+=result.spikes;
    for(let i=0;i<exposureCounts.length;i++)exposureCounts[i]+=brain.counts[i];
    const prediction=exposureMs>=model.exposureMs?predict(exposureCounts,model):undefined;
    send('tick',{...result,simMs:runMs,totalSpikes:runSpikes,exposureMs,prediction,computeMs:performance.now()-t});
  }
  if(data.type==='reset'){brain.restore(baseline);frame=null;currentProfile=null;runMs=0;runSpikes=0;exposureCounts.fill(0);send('reset');}
 }catch(error){send('error',{message:error.message||String(error)});}finally{busy=false;}
};
