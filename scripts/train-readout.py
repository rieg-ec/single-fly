"""Fit a frozen neural readout. Test labels are used only after model selection.
Usage: python scripts/train-readout.py /path/to/fly-training
"""
import json,sys,hashlib
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score,roc_auc_score,confusion_matrix
from scipy.stats import binomtest
root=Path(__file__).resolve().parents[1];work=Path(sys.argv[1]);rows=json.loads((work/'dataset.json').read_text());meta=json.loads((root/'public/brain/manifest.json').read_text())
y=np.array([r['label'] for r in rows]);tr=np.array([r['split']=='train' for r in rows]);va=np.array([r['split']=='validation' for r in rows]);te=np.array([r['split']=='test' for r in rows]);counts=np.stack([np.fromfile(work/'counts'/f"{r['id']}.bin",dtype='<u2') for r in rows]).astype(float)
# Retinal cells are pooled by inferred location. Downstream cells are selected by
# TRAINING variance alone, excluding every directly stimulated retina/lamina cell.
groups=[[] for _ in range(64)]
for index,(u,v) in zip(meta['retina'],meta['uv']):groups[min(7,int(v*8))*8+min(7,int(u*8))].append(index)
groups=[g for g in groups if g]
variance=counts[tr].var(axis=0);variance[meta['retina']]=0;variance[meta['lamina']]=0
central=np.argsort(variance)[-256:].tolist();central=[[i] for i in central if variance[i]>0]
features=groups+central
X=np.stack([counts[:,g].mean(axis=1) for g in features],axis=1)
pixels=np.array([r['pixels'] for r in rows]).reshape(-1,32,32)
image8=pixels.reshape(-1,8,4,8,4).mean(axis=(2,4)).reshape(-1,64)
heuristic=np.stack([pixels.mean(axis=(1,2)),pixels.std(axis=(1,2)),np.abs(pixels-pixels[:,:,::-1]).mean(axis=(1,2)),np.abs(np.diff(pixels,axis=1)).mean(axis=(1,2))],axis=1)

def fit_family(name,x):
 scaler=StandardScaler().fit(x[tr]);z=scaler.transform(x);candidates=[]
 for C in [.001,.01,.1,1.]:
  model=LogisticRegression(C=C,max_iter=2000,random_state=20260911).fit(z[tr],y[tr]);p=model.predict_proba(z[va])[:,1]
  candidates.append((accuracy_score(y[va],p>=.5),roc_auc_score(y[va],p),-C,model,C))
 best=max(candidates,key=lambda v:v[:3]);model=best[3];p=model.predict_proba(z)[:,1]
 return dict(name=name,scaler=scaler,model=model,p=p,C=best[4],validationAccuracy=best[0])
# This candidate family is fixed before reading held-out test results.
models=[fit_family('neural-pooled-retina-and-downstream',X),fit_family('neural-downstream-only',X[:,len(groups):]),fit_family('pixels-8x8',image8),fit_family('brightness-contrast-symmetry-edges',heuristic)]
chosen=max(models[:2],key=lambda m:m['validationAccuracy']);spec=features if chosen is models[0] else central
weights=chosen['model'].coef_[0]/chosen['scaler'].scale_;bias=float(chosen['model'].intercept_[0]-weights@chosen['scaler'].mean_)

def metric(pred):
 p=np.asarray(pred);correct=int(((p[te]>=.5)==y[te]).sum());interval=binomtest(correct,int(te.sum())).proportion_ci()
 return dict(accuracy=correct/int(te.sum()),correct=correct,total=int(te.sum()),auc=float(roc_auc_score(y[te],p[te])),confusion=confusion_matrix(y[te],p[te]>=.5).tolist(),accuracy95CI=[interval.low,interval.high],likes=int((p[te]>=.5).sum()),passes=int((p[te]<.5).sum()))
raw=np.array([int((r:=json.loads((work/'counts'/f"{row['id']}.json").read_text()))['right']>r['left']) for row in rows])
report=dict(version='scut-neural-v2',dataset='SCUT-FBP5500 v2.1',subset='336 CF adult-source portraits; high and low rating thirds',train=int(tr.sum()),validation=int(va.sum()),test=int(te.sum()),seed=20260911,selection='Choose C and neural feature family using validation accuracy; fixed threshold 0.5; no test-driven tuning.',selected=chosen['name'],neural=metric(chosen['p']),alwaysLike=metric(np.ones(len(y))),rawDNp20=metric(raw),comparisons={m['name']:{**metric(m['p']), 'validationAccuracy':m['validationAccuracy'],'C':m['C']} for m in models},limitations=['Small, demographically narrow adult-source sample; subjective ratings.','Photo-disjoint split; source lacks reliable identity IDs, so identity independence is not guaranteed.','Middle rating third excluded; results do not establish performance on ambiguous or everyday dating photos.','Readout weights learn; connectome weights remain fixed.','Test results are offline; this page runs the frozen model on held-out images.'])
# Permuted-label control: retain the selected architecture/C; randomly reassign
# training labels. No feedback from test is used to modify the deployed model.
rng=np.random.default_rng(431);permuted=[];z=chosen['scaler'].transform(X if chosen is models[0] else X[:,len(groups):])
for i in range(100):
 m=LogisticRegression(C=chosen['C'],max_iter=2000,random_state=20260911).fit(z[tr],rng.permutation(y[tr]));permuted.append(float(accuracy_score(y[te],m.predict(z[te]))))
report['shuffledLabels']={'runs':100,'meanAccuracy':float(np.mean(permuted)),'range95':np.quantile(permuted,[.025,.975]).tolist(),'fractionAtLeastObserved':float((1+sum(a>=report['neural']['accuracy'] for a in permuted))/101)}
model=dict(version=report['version'],family=chosen['name'],exposureMs=200,settleMs=200,sensoryHalfSaturation=.25,bias=bias,features=[dict(indices=g,weight=float(w)) for g,w in zip(spec,weights)],evaluation=report)
(root/'public/brain/readout.json').write_text(json.dumps(model,separators=(',',':')))
(root/'research/results.json').write_text(json.dumps(report,indent=2))
(root/'research/predictions.json').write_text(json.dumps([dict(id=r['id'],split=r['split'],label=r['label'],score=float(p),prediction=int(p>=.5)) for r,p in zip(rows,chosen['p'])],indent=2))
# Small numeric audit bundle, without distributing the external research workbooks.
np.savez_compressed(root/'research/training-features.npz',X=X,y=y,split=np.array([r['split'] for r in rows]),ids=np.array([r['id'] for r in rows]),pixels8=image8,heuristics=heuristic)
print(json.dumps(report,indent=2))
