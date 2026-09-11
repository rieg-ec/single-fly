"""Refit the deployed classifier from the included numeric audit bundle."""
from pathlib import Path
import json,numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
root=Path(__file__).resolve().parents[1];d=np.load(root/'research/training-features.npz');model=json.loads((root/'public/brain/readout.json').read_text());expected=json.loads((root/'research/predictions.json').read_text());X=d['X'];y=d['y'];tr=d['split']=='train';te=d['split']=='test'
assert model['family']=='neural-pooled-retina-and-downstream'
scaler=StandardScaler().fit(X[tr]);C=model['evaluation']['comparisons'][model['family']]['C'];fitted=LogisticRegression(C=C,max_iter=2000,random_state=20260911).fit(scaler.transform(X[tr]),y[tr]);p=fitted.predict_proba(scaler.transform(X))[:,1]
ref={r['id']:r['score'] for r in expected};assert np.max(np.abs(p-np.array([ref[i] for i in d['ids']])))<1e-10
weights=np.array([f['weight'] for f in model['features']]);exported=1/(1+np.exp(-(X@weights+model['bias'])));assert np.max(np.abs(exported-p))<1e-10
print(f'PASS: refit and exported coefficients reproduce every score; test {int(((p[te]>=.5)==y[te]).sum())}/{te.sum()} correct.')

# Verify deployed portraits and canonical retina bytes belong to the held-out set.
import hashlib
from PIL import Image
manifest=json.loads((root/'research/dataset.json').read_text());records={r['id']:r for r in manifest['records']}
for profile in json.loads((root/'lib/evaluation-profiles.json').read_text()):
 row=records[profile['id']];assert row['split']=='test'
 image=root/'public'/profile['image'].lstrip('/');assert hashlib.sha256(image.read_bytes()).hexdigest()==row['sha256']
 im=Image.open(image).convert('RGB');w,h=im.size;cw=min(w,h*.75);ch=cw/.75
 small=np.asarray(im.resize((32,32),Image.Resampling.LANCZOS,box=((w-cw)/2,(h-ch)/2,(w+cw)/2,(h+ch)/2)),dtype=float)
 pixels=np.rint(small@np.array([.2126,.7152,.0722])).clip(0,255).astype(np.uint8)
 assert image.with_suffix('.retina.bin').read_bytes()==pixels.tobytes()
print('PASS: all 70 deployed photographs and retina inputs match the untouched test set.')
