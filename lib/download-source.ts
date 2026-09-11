import {assetPath} from './asset-path';
// Store-only ZIP writer. The large brain files are already gzip-compressed.
// Browser-side packaging keeps every asset below Cloudflare's per-file limit.
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export async function downloadSource(progress:(n:number)=>void){
 const response=await fetch(assetPath('/source/app-files.json'));if(!response.ok)throw Error('Source bundle unavailable');
 const entries: {path:string;base64:string}[]=await response.json();
 const files:{name:string;bytes:Uint8Array}[]=entries.map(f=>({name:'fly-swipe/'+f.path,bytes:Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))}));
 const m=await fetch(assetPath('/brain/manifest.json'));if(!m.ok)throw Error('Brain manifest unavailable');const meta=await m.json() as {pointers:{file:string};chunks:{file:string}[]};
 const parts=[meta.pointers,...meta.chunks];let done=0;const queue=[...parts];
 await Promise.all(Array.from({length:3},async()=>{while(queue.length){const p=queue.shift()!;const r=await fetch(assetPath('/brain/'+p.file));if(!r.ok)throw Error('Brain download failed. Please retry.');files.push({name:'fly-swipe/public/brain/'+p.file,bytes:new Uint8Array(await r.arrayBuffer())});progress(Math.round(++done/parts.length*90));}}));
 const segments:BlobPart[]=[],central:BlobPart[]=[];let offset=0,centralSize=0;
 for(const f of files){const name=new TextEncoder().encode(f.name),crc=crc32(f.bytes);const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,f.bytes.length,true);v.setUint32(22,f.bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);segments.push(h.buffer,f.bytes.buffer as ArrayBuffer);
  const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,f.bytes.length,true);d.setUint32(24,f.bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c.buffer);centralSize+=c.length;offset+=h.length+f.bytes.length;
 }
 const end=new Uint8Array(22),d=new DataView(end.buffer);d.setUint32(0,0x06054b50,true);d.setUint16(8,files.length,true);d.setUint16(10,files.length,true);d.setUint32(12,centralSize,true);d.setUint32(16,offset,true);
 const blob=new Blob([...segments,...central,end.buffer],{type:'application/zip'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fly-swipe-source.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);progress(100);
}
