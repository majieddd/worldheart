"""Run a check with durable full evidence and bounded terminal output."""
import argparse,json,subprocess,sys,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--log',required=True);p.add_argument('command',nargs=argparse.REMAINDER);a=p.parse_args()
command=a.command[1:] if a.command[:1]==['--'] else a.command
if not command:p.error('A command is required after --')
log=Path(a.log).resolve();log.parent.mkdir(parents=True,exist_ok=True);start=time.time()
with log.open('wb') as f:result=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT)
report={'exitCode':result.returncode,'seconds':round(time.time()-start,2),'fullLog':str(log)}
if result.returncode:
    with log.open('rb') as f:
        f.seek(max(0,log.stat().st_size-4096));tail=f.read().decode('utf-8',errors='replace')
    report['failureTail']=tail[-1200:]
print(json.dumps(report));sys.exit(result.returncode)
