import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createFly} from './fly-model';
import type {Meta,Tick} from '@/hooks/use-fly';
export type StageState={image:string;decision?:'like'|'pass'|'hold';running:boolean};
export type SceneHandle<S>={update:(state:S)=>void;reset:()=>void;dispose:()=>void};
function setup(container:HTMLElement,cameraPosition:T.Vector3,target:T.Vector3){
 const scene=new T.Scene();
 const camera=new T.PerspectiveCamera(42,1,.05,80);camera.position.copy(cameraPosition);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.setClearColor(0x080e10,0);container.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Interactive 3D view; drag to rotate');
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=true;controls.enablePan=false;controls.enableZoom=false;controls.saveState();
 const resize=()=>{const r=container.getBoundingClientRect();camera.aspect=r.width/Math.max(r.height,1);camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);};
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 let frame=0,disposed=false,last=performance.now();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animate=(draw:(time:number,dt:number)=>void)=>{const loop=(now:number)=>{if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;draw(now/1000,dt);controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);};
 const dispose=()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(object=>{const mesh=object as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);const ms=mesh.material?Array.isArray(mesh.material)?mesh.material:[mesh.material]:[];ms.forEach(m=>{materials.add(m);Object.values(m).forEach(v=>{if(v instanceof T.Texture)textures.add(v);});});});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 return {scene,camera,renderer,controls,animate,dispose,reduced};
}
function floorLabel(text:string,color:string){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d')!;
 ctx.font='500 48px monospace';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,256,80);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const plane=new T.Mesh(new T.PlaneGeometry(1.5,.375),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.7}));plane.rotation.x=-Math.PI/2;return plane;
}
export function createFlyScene(container:HTMLElement):SceneHandle<StageState>{
 const view=setup(container,new T.Vector3(3.8,3.5,7.8),new T.Vector3(0,1.35,-.5));const {scene,controls}=view;
 scene.fog=new T.FogExp2(0x080e10,.045);controls.minPolarAngle=.55;controls.maxPolarAngle=1.45;controls.minAzimuthAngle=-.7;controls.maxAzimuthAngle=.7;
 scene.add(new T.HemisphereLight(0xe6fae2,0x19212a,2.4));const key=new T.DirectionalLight(0xffffff,3.3);key.position.set(2,7,4);scene.add(key);
 const rim=new T.PointLight(0xa1e9cf,13,12);rim.position.set(-3,3,-2);scene.add(rim);
 const ground=new T.Mesh(new T.PlaneGeometry(60,60),new T.MeshStandardMaterial({color:0x0c1518,roughness:.92}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
 const grid=new T.GridHelper(40,40,0x223c37,0x18282a);(grid.material as T.Material).transparent=true;(grid.material as T.Material).opacity=.65;scene.add(grid);
 const fly=createFly();fly.root.scale.setScalar(.058);fly.root.position.set(0,.7,1.65);fly.root.rotation.y=Math.PI/2;scene.add(fly.root);
 const platform=new T.Mesh(new T.CylinderGeometry(1.03,1.09,.08,64),new T.MeshStandardMaterial({color:0x17282a,metalness:.6,roughness:.5}));platform.position.set(0,.04,1.65);scene.add(platform);
 const platformRing=new T.Mesh(new T.TorusGeometry(1.08,.012,8,64),new T.MeshBasicMaterial({color:0x587b68}));platformRing.rotation.x=-Math.PI/2;platformRing.position.set(0,.085,1.65);scene.add(platformRing);
 for(const side of [-1,1]){const label=floorLabel(side===1?'LIKE':'PASS',side===1?'#bcf77b':'#eaaa9e');label.position.set(side*2.6,.012,-.35);scene.add(label);}
 const card=new T.Group();card.position.set(0,1.95,-1.4);scene.add(card);
 const frameMaterial=new T.MeshStandardMaterial({color:0x304b43,metalness:.4,roughness:.35,emissive:0x15291d,emissiveIntensity:.5});
 const frame=new T.Mesh(new T.BoxGeometry(1.94,2.58,.08),frameMaterial);card.add(frame);
 const photoMaterial=new T.MeshBasicMaterial({color:0x89988f});
 const photo=new T.Mesh(new T.PlaneGeometry(1.8,2.4),photoMaterial);photo.position.z=.046;card.add(photo);
 const rails=new T.BufferGeometry().setFromPoints([new T.Vector3(-1.12,.013,3.6),new T.Vector3(-1.12,.013,-3.7),new T.Vector3(1.12,.013,-3.7),new T.Vector3(1.12,.013,3.6)]);scene.add(new T.Line(rails,new T.LineBasicMaterial({color:0x36534a,transparent:true,opacity:.5})));
 const loader=new T.TextureLoader();let state:StageState={image:'',running:false},image='',generation=0,dead=false,decisionAt=0,lastDecision:StageState['decision'];
 view.animate((time,dt)=>{const desired=state.decision==='like'?1:state.decision==='pass'?-1:0;const elapsed=Math.max(0,time-decisionAt-.25),t=view.reduced?1:Math.min(1,elapsed*1.5),ease=t*t*(3-2*t);
  const targetX=desired*2.15*ease;card.position.x=T.MathUtils.damp(card.position.x,targetX,9,dt);card.position.y=1.95+(state.decision?Math.sin(t*Math.PI)*.2:0);card.rotation.z=T.MathUtils.damp(card.rotation.z,-desired*.16,8,dt);card.rotation.y=T.MathUtils.damp(card.rotation.y,-desired*.25,8,dt);
  fly.root.rotation.y=T.MathUtils.damp(fly.root.rotation.y,Math.PI/2-desired*.42,7,dt);fly.animate(view.reduced?0:time,state.running&&!view.reduced);frameMaterial.emissive.setHex(desired===1?0x4f782b:desired===-1?0x742f27:0x15291d);frameMaterial.emissiveIntensity=desired?.75:.4;
 });
 return {update(next){state=next;if(next.decision!==lastDecision){decisionAt=performance.now()/1000;lastDecision=next.decision;}if(next.image!==image){image=next.image;const serial=++generation;loader.load(image,texture=>{if(dead||serial!==generation){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;const img=texture.image as HTMLImageElement;const aspect=img.width/img.height,cardAspect=.75;if(aspect>cardAspect){texture.repeat.x=cardAspect/aspect;texture.offset.x=(1-texture.repeat.x)/2;}else{texture.repeat.y=aspect/cardAspect;texture.offset.y=(1-texture.repeat.y)/2;}photoMaterial.map?.dispose();photoMaterial.map=texture;photoMaterial.color.set(0xffffff);photoMaterial.needsUpdate=true;});}},reset:()=>controls.reset(),dispose(){dead=true;generation++;view.dispose();}};
}
export function createBrainScene(container:HTMLElement):SceneHandle<{meta?:Meta;tick?:Tick}>{
 const view=setup(container,new T.Vector3(0,.05,6.4),new T.Vector3(0,0,0));const {scene,controls}=view;
 controls.autoRotate=!view.reduced;controls.autoRotateSpeed=.45;controls.minPolarAngle=.3;controls.maxPolarAngle=2.8;
 let meta:Meta|undefined,points:T.Points|undefined,intensity=new Float32Array(0),target=new Float32Array(0),activityAttribute:T.BufferAttribute|undefined,lastTick:Tick|undefined;
 view.animate((_time,dt)=>{for(let i=0;i<intensity.length;i++)intensity[i]=T.MathUtils.damp(intensity[i],target[i],13,dt);if(activityAttribute)activityAttribute.needsUpdate=true;});
 return {update(next){if(next.meta&&next.meta!==meta){meta=next.meta;if(points){scene.remove(points);points.geometry.dispose();(points.material as T.Material).dispose();}const positions=new Float32Array(meta.points.length*3);intensity=new Float32Array(meta.points.length);target=new Float32Array(meta.points.length);meta.points.forEach((p,i)=>{positions[i*3]=(p[1]-.5)*4.2;positions[i*3+1]=(.5-p[2])*4.2;positions[i*3+2]=(p[3]-.5)*2.6;});const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));activityAttribute=new T.BufferAttribute(intensity,1);activityAttribute.setUsage(T.DynamicDrawUsage);geometry.setAttribute('activity',activityAttribute);
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelRatio:{value:view.renderer.getPixelRatio()}},vertexShader:`attribute float activity; varying float lit; uniform float pixelRatio; void main(){lit=activity;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=mix(1.3,4.0,activity)*pixelRatio*min(1.8,5.0/-p.z);}`,fragmentShader:`varying float lit; void main(){float d=length(gl_PointCoord-vec2(.5));float a=1.0-smoothstep(.15,.5,d);if(a<.02)discard;gl_FragColor=vec4(mix(vec3(.28,.39,.38),vec3(.74,.97,.48),lit),a*mix(.56,1.0,lit));}`});points=new T.Points(geometry,material);scene.add(points);}
 if(next.tick!==lastTick){lastTick=next.tick;for(let i=0;i<target.length;i++)target[i]=(next.tick?.activity[i]||0)>0?1:0;}
 },reset:()=>controls.reset(),dispose:view.dispose};
}
