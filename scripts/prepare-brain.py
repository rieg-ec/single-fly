"""Rebuild all browser graph assets from the hash-locked public MaleCNS release."""
from pathlib import Path
import json,hashlib,urllib.request,sys,shutil,subprocess
root=Path(__file__).resolve().parents[1];up=root/'vendor/doomfly';data=up/'connectome_data/malecns_v1';data.mkdir(parents=True,exist_ok=True)
locked=json.loads((up/'data-provenance/malecns_v1/source.lock.json').read_text())
registry=json.loads((up/'doom/datasets.json').read_text())['datasets']['malecns_v1']['files']
for name,url in registry.items():
 target=data/name
 if not target.exists():
  print('Downloading',name,flush=True);partial=target.with_suffix('.partial');urllib.request.urlretrieve(url,partial);partial.replace(target)
 with target.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
 if digest!=locked[name]['sha256']:raise ValueError('Source digest mismatch: '+name)
(data/'source.lock.json').write_text(json.dumps(locked))
sys.path.insert(0,str(up))
from doom.connectome import import_graph
from doom.prepare import prepare
import_graph();prepare()
subprocess.run([sys.executable,str(root/'scripts/export-connectome.py'),str(up)],check=True)
