"""Read the two selected CMU ASF/AMC takes; preserve capture timing and provenance."""
from pathlib import Path
import json, re
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.signal import find_peaks

ROOT=Path(__file__).resolve().parents[4]; SRC=ROOT/'artifacts/vey-pilot/mocap'; OUT=ROOT/'lib/99-art/vey-pilot-v1'
def read(sub):
    text=(SRC/(sub+'.asf')).read_text();defs={}
    for block in re.findall(r'begin\s+(.*?)\s+end',text.split(':bonedata')[1].split(':hierarchy')[0],re.S):
        rows={x.split()[0]:x.split()[1:] for x in block.splitlines() if x.strip()}
        name=rows['name'][0];defs[name]={'direction':np.array(rows['direction'],float),'length':float(rows['length'][0]),'axis':Rotation.from_euler('xyz',np.array(rows['axis'][:3],float),degrees=True).as_matrix(),'dof':rows.get('dof',[])}
    parents={}
    for line in text.split(':hierarchy')[1].splitlines():
        a=line.split()
        if len(a)>1:
            for child in a[1:]:parents[child]=a[0]
    names=['root',*defs];idx={n:i for i,n in enumerate(names)}
    frames=[];frame=None
    for line in (SRC/(sub+'_01.amc')).read_text().splitlines():
        line=line.strip()
        if not line or line[0] in '#:':continue
        if line.isdigit():
            if frame:frames.append(frame)
            frame={}
        else:
            a=line.split();frame[a[0]]=list(map(float,a[1:]))
    frames.append(frame)
    points=np.zeros((len(frames),len(names),3));rotations=np.zeros((len(frames),len(names),3,3))
    for t,f in enumerate(frames):
        points[t,0]=f['root'][:3];rotations[t,0]=Rotation.from_euler('xyz',f['root'][3:],degrees=True).as_matrix()
        done={'root'}
        while len(done)<len(names):
            for n,d in defs.items():
                if n in done or parents[n] not in done:continue
                i,p=idx[n],idx[parents[n]];angles=np.zeros(3)
                for dof,value in zip(d['dof'],f.get(n,[])):angles['xyz'.index(dof[-1])]=value
                C=d['axis'];M=Rotation.from_euler('xyz',angles,degrees=True).as_matrix();rotations[t,i]=rotations[t,p]@C@M@C.T
                points[t,i]=points[t,p]+rotations[t,i]@d['direction']*d['length'];done.add(n)
    travel=points[-1,0]-points[0,0];travel[1]=0;forward=travel/np.linalg.norm(travel);up=np.array([0,1,0]);right=np.cross(up,forward);basis=np.stack([right,-forward,up])
    points=points@basis.T;rotations=basis@rotations@basis.T
    # Correct side convention from actual shoulder positions, not file naming guesses.
    if np.mean(points[:,idx['lhumerus'],0]-points[:,idx['rhumerus'],0])<0:
        basis=np.diag([-1,-1,1])@basis;points=points@np.diag([-1,-1,1]);rotations=np.diag([-1,-1,1])@rotations@np.diag([-1,-1,1])
    body=points-points[:,0:1];signal=body[:,idx['lfoot'],1]
    extrema,_=find_peaks(signal,distance=45 if sub=='07' else 30,prominence=np.ptp(signal)*.2)
    period=int(round(np.median(np.diff(extrema)))) if len(extrema)>1 else (122 if sub=='07' else 80)
    # Search a complete cycle; score both pose and velocity, excluding static windows.
    flat=body.reshape(len(body),-1);v=np.gradient(flat,axis=0);best=None
    for length in range(max(24,period-8),period+9):
        for start in range(5,len(frames)-length-5):
            stop=start+length
            score=np.mean((flat[start]-flat[stop])**2)+2*np.mean((v[start]-v[stop])**2)
            if best is None or score<best[0]:best=(score,start,length)
    _,start,length=best;clip=points[start:start+length+1].copy();r=rotations[start:start+length+1].copy()
    # Retain pelvis bob/sway but remove path translation, including lateral path drift.
    root=clip[:,0].copy();linear=np.linspace(root[0],root[-1],len(root));root[:,0:2]-=linear[:,0:2];root[:,0:2]-=root[:,0:2].mean(0)
    speed=float(np.linalg.norm((clip[-1,0]-clip[0,0])[:2])/(length/120))
    root[:,2]-=root[:,2].mean()
    relative=clip-clip[:,0:1]
    # Gentle endpoint correction over a full captured cycle; never return a sub-cycle.
    phase=np.linspace(0,1,len(clip));fade=phase**3*(10-15*phase+6*phase**2)
    relative-=fade[:,None,None]*(relative[-1]-relative[0]);root-=fade[:,None]*(root[-1]-root[0])
    np.savez(SRC/(sub+'-processed.npz'),points=relative,root=root,rotations=r,names=names,parents=json.dumps(parents),fps=120,seconds=length/120,speed=speed)
    return {'source':sub+'_01','sourceFps':120,'sourceFrames':len(frames),'periodSamples':period,'start':start,'cycleFrames':length,'seconds':length/120,'sourceSpeed':speed,'footExtrema':extrema.tolist(),'sourcePelvisVertical':float(np.ptp(root[:,2])),'sourcePelvisLateral':float(np.ptp(root[:,0]))}
report={'walk':read('07'),'run':read('09'),'credit':'The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.','source':'http://mocap.cs.cmu.edu/subjects/','note':'Two selected takes only. Data not resold standalone. Source finger channels are not captured and are not used.'}
(OUT/'motion-source.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
