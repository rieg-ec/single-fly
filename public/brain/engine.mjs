/** JavaScript port of DOOMFLY doom/kernel.cpp (MIT; see vendor/doomfly).
 * Exact lazy subthreshold LIF integration, full retained CSR graph.
 * Model constants and event ordering match upstream baseline, dt = 0.1 ms.
 */
export class FlyBrain {
  constructor(ptr, post, weight, meta) {
    this.ptr=ptr;this.post=post;this.weight=weight;this.meta=meta;this.n=ptr.length-1;
    if(ptr[0]!==0 || ptr[this.n]!==post.length || post.length!==weight.length)throw Error('Invalid connectome dimensions');
    for(let i=0;i<this.n;i++)if(ptr[i]>ptr[i+1])throw Error('Invalid CSR pointers');
    this.av=Float64Array.from({length:1024},(_,i)=>Math.exp(-.1*i/20));
    this.ag=Float64Array.from({length:1024},(_,i)=>Math.exp(-.1*i/5));
    this.reset();
  }
  reset(){
    const n=this.n;
    this.v=new Float32Array(n).fill(-52);this.g=new Float32Array(n);this.ref=new Int16Array(n);
    this.drive=new Float32Array(n);this.prev=new Float32Array(n);this.last=new Float64Array(n).fill(-1);
    this.queue=Array.from({length:19},()=>new Int32Array(n));this.qc=new Uint32Array(19);
    this.active=new Int32Array(n);this.flags=new Uint8Array(n);this.na=0;this.clock=0;
    this.counts=new Uint32Array(n);this.luminance=new Float32Array(this.meta.retina.length);
    this.totalSpikes=0;this.rates=new Float64Array(this.meta.readouts.length);
  }
  snapshot(){
    const state={};
    for(const key of ['v','g','ref','drive','prev','last','qc','active','flags','counts','luminance','rates'])state[key]=this[key].slice();
    state.queue=this.queue.map(a=>a.slice());
    for(const key of ['na','clock','totalSpikes'])state[key]=this[key];
    return state;
  }
  restore(state){
    for(const key of ['v','g','ref','drive','prev','last','qc','active','flags','counts','luminance','rates'])this[key].set(state[key]);
    state.queue.forEach((a,i)=>this.queue[i].set(a));
    for(const key of ['na','clock','totalSpikes'])this[key]=state[key];
  }
  evolve(i,now,current){
    let d=now-this.last[i];if(d<=0)return;
    const frozen=this.ref[i]>0?this.ref[i]-1:0;
    const skip=Math.min(d,frozen);this.ref[i]=d>=this.ref[i]?0:this.ref[i]-d;d-=skip;
    if(d>0){const a=d<1024?this.av[d]:Math.exp(-.1*d/20),b=d<1024?this.ag[d]:Math.exp(-.1*d/5);
      this.v[i]=-52+(this.v[i]+52)*a+current*(1-a)+this.g[i]*(a-b)/3;this.g[i]*=b;
    }this.last[i]=now;
  }
  awaken(i){if(!this.flags[i]){this.flags[i]=1;this.active[this.na++]=i;}}
  step(pixels, ms=20){
    if(pixels.length!==32*32)throw Error('Expected 32 × 32 luminance input');
    const steps=Math.round(ms/.1),alpha=1-Math.exp(-ms/10);this.counts.fill(0);
    for(const i of this.meta.lamina)this.drive[i]=12;
    for(let k=0;k<this.meta.retina.length;k++){
      const [u,v]=this.meta.uv[k];const luminance=pixels[Math.min(31,Math.round(v*31))*32+Math.min(31,Math.round(u*31))];
      this.luminance[k]+=alpha*(luminance-this.luminance[k]);
      this.drive[this.meta.retina[k]]=30*this.luminance[k]/((this.meta.sensoryHalfSaturation??.02)+this.luminance[k]);
    }
    for(let i=0;i<this.n;i++)if(this.drive[i]!==this.prev[i]){
      this.evolve(i,this.clock-1,this.prev[i]);this.prev[i]=this.drive[i];this.awaken(i);
    }
    for(let t=0;t<steps;t++,this.clock++){
      const slot=this.clock%19,future=(this.clock+18)%19;let kept=0;const original=this.na;
      for(let k=0;k<original;k++){
        const i=this.active[k];this.evolve(i,this.clock,this.drive[i]);
        if(this.ref[i]===0&&this.v[i]>-45){this.queue[future][this.qc[future]++]=i;this.counts[i]++;}
        if(this.v[i]>-45||this.drive[i]>7||this.drive[i]+this.g[i]>7)this.active[kept++]=i;else this.flags[i]=0;
      }this.na=kept;
      for(let q=0;q<this.qc[slot];q++){
        const i=this.queue[slot][q];
        for(let e=this.ptr[i];e<this.ptr[i+1];e++){
          const j=this.post[e];this.evolve(j,this.clock,this.drive[j]);
          if(this.ref[j]===0){this.g[j]+=this.weight[e];this.awaken(j);}
        }
      }this.qc[slot]=0;
      for(let q=0;q<this.qc[future];q++){const i=this.queue[future][q];this.v[i]=-52;this.g[i]=0;this.ref[i]=22;}
    }
    let spikes=0,activeCells=0;for(let i=0;i<this.n;i++){this.evolve(i,this.clock-1,this.drive[i]);spikes+=this.counts[i];if(this.counts[i])activeCells++;}
    this.totalSpikes+=spikes;
    const decay=Math.exp(-ms/100);
    const readouts=this.meta.readouts.map((r,k)=>{this.rates[k]=this.rates[k]*decay+this.counts[r.index]/(ms/1000)*(1-decay);return {...r,spikes:this.counts[r.index],rate:this.rates[k]};});
    const sum=(side)=>readouts.filter(r=>r.type==='DNp20'&&r.side===side).reduce((s,r)=>s+r.spikes,0);
    return {spikes,totalSpikes:this.totalSpikes,activeCells,simMs:this.clock*.1,readouts,left:sum('L'),right:sum('R'),activity:this.meta.displayPoints.map(p=>this.counts[p[0]])};
  }
}
