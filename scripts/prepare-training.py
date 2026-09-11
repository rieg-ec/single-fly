"""Prepare SCUT ratings + canonical sensory pixels. Non-commercial research only.
Usage: python scripts/prepare-training.py /path/to/SCUT-FBP5500_v2 /path/to/output
"""
from pathlib import Path
import sys,json,hashlib,shutil
import numpy as np
from PIL import Image
from openpyxl import load_workbook
root=Path(__file__).resolve().parents[1]; source=Path(sys.argv[1]); out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
ratings=dict((line.split()[0],float(line.split()[1])) for line in (source/'train_test_files/All_labels.txt').read_text().splitlines() if line.strip())
ws=load_workbook(source/'Images_Sources.xlsx',read_only=True)['Caucasian_facial_images']
eligible={r[0].replace(',jpg','.jpg') for r in ws.values if isinstance(r[0],str) and r[0].startswith('CF') and r[1]=='√'}
rows=sorted([(name,ratings[name]) for name in eligible],key=lambda x:(x[1],x[0]))
n=len(rows)//3; groups=[rows[:n],rows[-n:]];rng=np.random.default_rng(20260911);data=[];seen=set()
for label,group in enumerate(groups):
 order=rng.permutation(len(group));nt=int(len(group)*.6);nv=int(len(group)*.2)
 for j,k in enumerate(order):
  name,rating=group[k];image_path=source/'Images'/name;digest=hashlib.sha256(image_path.read_bytes()).hexdigest()
  if digest in seen:raise ValueError('Duplicate photograph; group before splitting')
  seen.add(digest);im=Image.open(image_path).convert('RGB');w,h=im.size;cw=min(w,h*.75);ch=cw/.75
  small=np.asarray(im.resize((32,32),Image.Resampling.LANCZOS,box=((w-cw)/2,(h-ch)/2,(w+cw)/2,(h+ch)/2)),dtype=float)
  pixels=np.rint(small@np.array([.2126,.7152,.0722])).clip(0,255).astype(np.uint8)
  split='train' if j<nt else 'validation' if j<nt+nv else 'test'
  data.append(dict(id=name[:-4],file=name,rating=rating,label=label,split=split,sha256=digest,pixels=(pixels.flatten()/255).tolist()))
  if split=='test':
   shutil.copyfile(image_path,root/'public/profiles'/name)
   (root/'public/profiles'/name.replace('.jpg','.retina.bin')).write_bytes(pixels.tobytes())
data.sort(key=lambda r:r['id']);(out/'dataset.json').write_text(json.dumps(data,separators=(',',':')))
(root/'research').mkdir(exist_ok=True)
manifest=dict(dataset='SCUT-FBP5500 v2.1',source='https://github.com/HCIILAB/SCUT-FBP5500-Database-Release',restriction='Non-commercial research only',subset='CF portraits marked as sourced from the 10k US Adults Face Database',eligible=len(rows),seed=20260911,selection='Lowest and highest rating thirds; middle third excluded',ranges=[[min(r[1] for r in g),max(r[1] for r in g)] for g in groups],records=[{k:v for k,v in r.items() if k!='pixels'} for r in data])
manifest['sourceSHA256']={p:hashlib.sha256((source/p).read_bytes()).hexdigest() for p in ['train_test_files/All_labels.txt','Images_Sources.xlsx']}
(root/'research/dataset.json').write_text(json.dumps(manifest,indent=2))
# The live order is shuffled independently, never sorted by label or prediction.
test=[r for r in data if r['split']=='test'];rng.shuffle(test)
(root/'lib/evaluation-profiles.json').write_text(json.dumps([dict(id=r['id'],image='/profiles/'+r['file']) for r in test]))
print(json.dumps({k:v for k,v in manifest.items() if k!='records'},indent=2));print('splits', {s:sum(r['split']==s for r in data) for s in ['train','validation','test']})
