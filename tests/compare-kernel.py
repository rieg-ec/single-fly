"""Generate a numerical fixture from the unmodified upstream C++ kernel."""
import ctypes,json,subprocess
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];out=root/'tests/reference-kernel.json'
subprocess.run(['g++','-O2','-shared','-fPIC',str(root/'vendor/doomfly/doom/kernel.cpp'),'-o','/tmp/fly-reference-kernel.so'],check=True)
fn=ctypes.CDLL('/tmp/fly-reference-kernel.so').neural_advance
P=ctypes.c_void_p;fn.argtypes=[ctypes.c_int]+[P]*13+[ctypes.c_int,ctypes.c_float]+[P]*5
# Correct explicit argument ordering, matching kernel.cpp.
fn.argtypes=[ctypes.c_int,P,P,P,P,P,P,P,P,P,P,P,ctypes.c_int,ctypes.c_float,P,P,P,P,P]
n=6;ptr=np.array([0,2,3,4,5,6,6],np.int64);post=np.array([1,2,3,3,4,5],np.int32);weight=np.array([20,-8,14,25,19,18],np.float32)
v=np.full(n,-52,np.float32);g=np.zeros(n,np.float32);r=np.zeros(n,np.int16);drive=np.zeros(n,np.float32);prev=drive.copy();q=np.zeros(19*n,np.int32);qc=np.zeros(19,np.int32);clock=np.array([0],np.int64);counts=np.zeros(n,np.int32);active=np.zeros(n,np.int32);flags=np.zeros(n,np.uint8);na=np.array([0],np.int32);last=np.full(n,-1,np.int64)
records=[]
for lum in [.5,.8,0,0,.2,.2]:
 # Same upstream luminance low-pass as JS, plus tonic lamina on cell 2.
 old=records[-1]['luminance'] if records else 0.;l=float(np.float32(old+(1-np.exp(-2))*(lum-old)))
 drive[0]=30*l/(.02+l);drive[2]=12;counts.fill(0)
 def p(a):return a.ctypes.data_as(P)
 fn(n,p(ptr),p(post),p(weight),p(v),p(g),p(r),p(drive),p(prev),p(q),p(qc),p(clock),200,.1,p(counts),p(active),p(flags),p(na),p(last))
 records.append({'input':lum,'luminance':l,'v':v.tolist(),'g':g.tolist(),'counts':counts.tolist()})
out.write_text(json.dumps({'ptr':ptr.tolist(),'post':post.tolist(),'weight':weight.tolist(),'records':records},indent=2));print('Created C++ reference fixture')
