'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {assetPath} from '@/lib/asset-path';
import {profileAt, type Profile} from '@/lib/profiles';
export type Readout={index:number;id:string;type:string;side:string;spikes:number;rate:number};
export type Evaluation={train:number;validation:number;test:number;selected:string;neural:{accuracy:number;correct:number;total:number;accuracy95CI:number[];likes:number;passes:number};alwaysLike:{accuracy:number};comparisons:Record<string,{accuracy:number}>;shuffledLabels:{meanAccuracy:number}};
export type Tick={prediction?:{score:number;decision:'like'|'pass';modelVersion:string};spikes:number;totalSpikes:number;activeCells:number;simMs:number;readouts:Readout[];left:number;right:number;activity:number[];computeMs:number};
export type Swipe={score?:number;modelVersion?:string;id:string;session:string;profile:Profile;decision:'like'|'pass'|'hold';at:string;left:number;right:number;brainMs:number;computeMs:number;totalSpikes:number};
export type Meta={neurons:number;edges:number;contacts:number;retina:number;points:number[][];downloadBytes:number;readouts:Readout[]};
const STORAGE='fly-swipe-history-v1';
const uuid=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export function useFly(){
 const [evaluation,setEvaluation]=useState<Evaluation>();
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[error,setError]=useState(''),[progress,setProgress]=useState(0),[meta,setMeta]=useState<Meta>();
 const [running,setRunning]=useState(true),[speed,setSpeed]=useState('1'),[index,setIndex]=useState(0),[tick,setTick]=useState<Tick>(),[retina,setRetina]=useState<number[]>([]),[trace,setTrace]=useState<Tick[]>([]);
 const [history,setHistory]=useState<Swipe[]>([]),[decision,setDecision]=useState<Swipe>(),[windowMs,setWindowMs]=useState(0),[votes,setVotes]=useState({left:0,right:0}),[session,setSession]=useState(''),[storageWarning,setStorageWarning]=useState(false);
 const [runStats,setRunStats]=useState({observed:0,likes:0,passes:0,holds:0});
 const historyRef=useRef<Swipe[]>([]);
 const worker=useRef<Worker|null>(null),controls=useRef({running:true,speed:1,one:false}),cursor=useRef(0),ready=useRef(false),busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),sessionRef=useRef(''),acc=useRef({ms:0,left:0,right:0,compute:0,spikes:0}),disposed=useRef(false),transitioning=useRef(false),completed=useRef(false);
 const request=useCallback(()=>{if(disposed.current||!ready.current||busy.current||transitioning.current||(!controls.current.running&&!controls.current.one))return;if(completed.current){completed.current=false;cursor.current++;setIndex(cursor.current);acc.current={ms:0,left:0,right:0,compute:0,spikes:0};setWindowMs(0);setVotes({left:0,right:0});setDecision(undefined);}busy.current=true;worker.current?.postMessage({type:'step',image:profileAt(cursor.current).image});},[]);
 useEffect(()=>{
  disposed.current=false;sessionRef.current=uuid();setSession(sessionRef.current);
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(parsed)){historyRef.current=parsed.filter(x=>x&&typeof x.id==='string'&&['like','pass','hold'].includes(x.decision)&&x.profile?.image?.startsWith('/profiles/')&&Number.isFinite(x.left)&&Number.isFinite(x.right)).slice(0,2000);setHistory(historyRef.current);};}catch{setStorageWarning(true);}
  let cancelled=false,activeWorker:Worker|null=null,workerUrl='';
  const boot=async()=>{
  const response=await fetch(assetPath('/brain/worker.mjs'));if(!response.ok)throw Error('Simulation code unavailable');const source=await response.text();if(cancelled)return;
  workerUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  const w=new Worker(workerUrl);activeWorker=w;worker.current=w;ready.current=false;busy.current=false;
  w.onerror=(event)=>{setError('Worker startup: '+(event.message||'The simulation worker could not start.'));setStatus('error');setRunning(false);controls.current.running=false;};
  w.onmessage=({data})=>{
   if(cancelled)return;
   if(data.type==='fetch'){
    if(!/^\/(brain|profiles)\/[a-zA-Z0-9/_.-]+$/.test(data.url)){w.postMessage({type:'fetched',id:data.id,error:'Invalid asset path'});return;}
    fetch(assetPath(data.url)).then(async response=>{const buffer=await response.arrayBuffer();if(!cancelled)w.postMessage({type:'fetched',id:data.id,buffer,status:response.status,contentType:response.headers.get('Content-Type')},[buffer]);}).catch(e=>{if(!cancelled)w.postMessage({type:'fetched',id:data.id,error:String(e)});});return;
   }
   if(data.type==='model')setEvaluation(data.evaluation);
   if(data.type==='meta')setMeta(data.meta);
   if(data.type==='loading')setProgress(data.progress);
   if(data.type==='error'){busy.current=false;setError("Brain: "+data.message);setStatus('error');setRunning(false);controls.current.running=false;}
   if(data.type==='ready'||data.type==='reset'){ready.current=true;busy.current=false;setStatus('ready');setProgress(100);request();}
   if(data.type==='retina')setRetina(data.pixels);
   if(data.type==='tick'){
    busy.current=false;const t=data as Tick;setTick(t);setTrace(p=>[...p,t].slice(-70));
    const a=acc.current;a.ms+=20;a.left+=t.left;a.right+=t.right;a.compute+=t.computeMs;a.spikes+=t.spikes;setWindowMs(a.ms);setVotes({left:a.left,right:a.right});
    if(t.prediction){
     const sw:Swipe={id:uuid(),session:sessionRef.current,profile:profileAt(cursor.current),decision:t.prediction.decision,score:t.prediction.score,modelVersion:t.prediction.modelVersion,at:new Date().toISOString(),left:a.left,right:a.right,brainMs:a.ms,computeMs:a.compute,totalSpikes:a.spikes};
     setRunStats(s=>({observed:s.observed+1,likes:s.likes+(sw.decision==='like'?1:0),passes:s.passes+(sw.decision==='pass'?1:0),holds:s.holds+(sw.decision==='hold'?1:0)}));
     setDecision(sw);const next=[sw,...historyRef.current].slice(0,2000);historyRef.current=next;setHistory(next);try{localStorage.setItem(STORAGE,JSON.stringify(next));}catch{setStorageWarning(true);}
     transitioning.current=true;completed.current=true;controls.current.one=false;
     timer.current=setTimeout(()=>{if(disposed.current)return;transitioning.current=false;request();},1200);
    }else{timer.current=setTimeout(request,Math.max(0,180/controls.current.speed-t.computeMs));}
   }
  };w.postMessage({type:'init'});
  };void boot().catch(e=>{if(cancelled)return;setError(String(e));setStatus('error');setRunning(false);controls.current.running=false;});
  return()=>{cancelled=true;disposed.current=true;clearTimeout(timer.current);activeWorker?.terminate();if(workerUrl)URL.revokeObjectURL(workerUrl);worker.current=null;};
 },[request]);
 const toggle=()=>{const value=!controls.current.running;controls.current.running=value;setRunning(value);if(value)request();};
 const changeSpeed=(value:string)=>{controls.current.speed=Number(value);setSpeed(value);};
 const single=()=>{controls.current.running=false;controls.current.one=true;setRunning(false);request();};
 return {evaluation,runStats,status,error,progress,meta,running,speed,profile:profileAt(index),index,tick,retina,trace,history,decision,windowMs,votes,session,storageWarning,toggle,changeSpeed,single};
}
