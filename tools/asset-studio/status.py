"""Compact read-only production status. Full logs stay in the runtime directory."""
import json,sys,time
from pathlib import Path
import requests
runtime=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[3]/'local-asset-runtime'
report={'projects':[],'downloads':[]}
for path in (runtime/'studio-data/projects').glob('*/project.json'):
    p=json.loads(path.read_text('utf-8'));report['projects'].append({k:p.get(k) for k in ['name','stage','status','art','mesh','animation']})
for folder in ['ComfyUI/models','models/Hunyuan3D-2mini']:
    for path in (runtime/folder).rglob('*.incomplete'):
        # On Windows the directory's cached length can remain zero while an
        # open writer is progressing. Query the open file, not directory metadata.
        with path.open('rb') as handle:size=handle.seek(0,2)
        report['downloads'].append({'folder':path.parent.name,'file':path.name[:20],'MiB':round(size/1048576)})
try:
    q=requests.get('http://127.0.0.1:8188/queue',timeout=2).json();report['imageQueue']={'running':len(q['queue_running']),'pending':len(q['queue_pending'])}
except requests.RequestException:report['imageQueue']='offline'
print(json.dumps(report,indent=2))
