"""Lossless packaging of DOOMFLY's complete retained graph for browsers.
Run after the pinned upstream importer/prepare; no topology pruning.
"""
import sys,json,gzip,hashlib
from pathlib import Path
import numpy as np
import pyarrow.feather as feather
root=Path(sys.argv[1]); out=Path(__file__).resolve().parents[1]/'public/brain';out.mkdir(exist_ok=True,parents=True)
a=np.load(root/'outputs/doom/malecns_v1/graph.npz'); manifest=json.loads((root/'outputs/doom/malecns_v1/manifest.json').read_text())
manifest['chunks']=[]
def write(name,arr):
 data=arr.tobytes(); packed=gzip.compress(data,compresslevel=6,mtime=0); (out/name).write_bytes(packed)
 info={'file':name,'bytes':len(packed),'rawBytes':len(data),'sha256':hashlib.sha256(data).hexdigest()};print(name,len(packed),flush=True);return info
manifest['pointers']=write('pointers.bin.gz',a['ptr'].astype('<u4'))
# Each record preserves uint32 post index and original float32 weight.
for start in range(0,len(a['post']),2000000):
 end=min(start+2000000,len(a['post']));rec=np.empty(end-start,dtype=[('post','<u4'),('weight','<f4')]);rec['post']=a['post'][start:end];rec['weight']=a['weight'][start:end]
 manifest['chunks'].append(dict(write(f'edges-{start//2000000:02d}.bin.gz',rec),start=start,count=end-start))
for name in ['retina','uv','lamina']: manifest[name]=a[name].tolist()
# Real soma positions, no invented brain geometry. Sample for rendering only.
ann=feather.read_table(root/'connectome_data/malecns_v1/annotations.feather').to_pandas().set_index('bodyId').loc[a['ids']]
pts=[]
for i,loc in enumerate(ann.somaLocation):
 if loc is not None:
  try:
   v=np.asarray(loc,dtype=float)
   if v.shape==(3,) and np.isfinite(v).all():pts.append([i,*v.tolist()])
  except (ValueError,TypeError):pass
pts=np.array(pts);pts=pts[::max(1,len(pts)//8000)];xyz=pts[:,1:];low=np.percentile(xyz,1,axis=0);high=np.percentile(xyz,99,axis=0);xyz=(xyz-low)/(high-low);pts[:,1:]=xyz
manifest['displayPoints']=pts.tolist();manifest['displayNote']='Subsample of measured soma locations. Every retained neuron and edge is simulated; the drawing is sampled.'
manifest['dataLicense']='CC BY 4.0; MaleCNS Consortium / HHMI Janelia, 2026'
manifest['source']='https://male-cns.janelia.org/download/'
manifest['simulator']='https://github.com/nftechie/doomfly'
manifest['totalDownloadBytes']=sum(x['bytes'] for x in manifest['chunks'])+manifest['pointers']['bytes']
(out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
print({k:manifest[k] for k in ['neurons','edges','synaptic_contacts','totalDownloadBytes']})
