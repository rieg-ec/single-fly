'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {RotateCcw} from 'lucide-react';
import type {Meta,Tick} from '@/hooks/use-fly';
import type {SceneHandle,StageState} from '@/lib/three-scenes';
export function FlyScene({state,fallback}:{state:StageState;fallback:ReactNode}){
 const host=useRef<HTMLDivElement>(null),handle=useRef<SceneHandle<StageState>|undefined>(undefined),latest=useRef(state);latest.current=state;const [failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;void import('@/lib/three-scenes').then(({createFlyScene})=>{if(cancelled||!host.current)return;try{handle.current=createFlyScene(host.current);handle.current.update(latest.current);}catch{setFailed(true);}}).catch(()=>{if(!cancelled)setFailed(true);});return()=>{cancelled=true;handle.current?.dispose();handle.current=undefined;};},[]);
 useEffect(()=>{handle.current?.update(state);},[state]);
 return <div className="scene-shell"><div ref={host} className="webgl-host"/>{failed?<div className="scene-fallback">{fallback}<span>3D unavailable on this device</span></div>:<><span className="orbit-hint">Drag to orbit</span><button className="reset-view" aria-label="Reset fly camera" onClick={()=>handle.current?.reset()}><RotateCcw size={15}/></button></>}</div>;
}
export function BrainScene({meta,tick,fallback}:{meta?:Meta;tick?:Tick;fallback:ReactNode}){
 const host=useRef<HTMLDivElement>(null),handle=useRef<SceneHandle<{meta?:Meta;tick?:Tick}>|undefined>(undefined),latest=useRef({meta,tick});latest.current={meta,tick};const [failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;void import('@/lib/three-scenes').then(({createBrainScene})=>{if(cancelled||!host.current)return;try{handle.current=createBrainScene(host.current);handle.current.update(latest.current);}catch{setFailed(true);}}).catch(()=>{if(!cancelled)setFailed(true);});return()=>{cancelled=true;handle.current?.dispose();handle.current=undefined;};},[]);
 useEffect(()=>{handle.current?.update({meta,tick});},[meta,tick]);
 return <div className="scene-shell"><div ref={host} className="webgl-host"/>{failed?fallback:<><span className="orbit-hint">Drag to rotate</span><button className="reset-view" aria-label="Reset neuron camera" onClick={()=>handle.current?.reset()}><RotateCcw size={15}/></button></>}</div>;
}
