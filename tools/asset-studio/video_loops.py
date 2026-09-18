"""Choose a measured loop interval; never declare a stationary window a walk."""
import numpy as np

def fit_range(world,fps,clip,rank=0):
    p=np.asarray(world);pairs=[(11,13),(13,15),(12,14),(14,16),(23,25),(25,27),(24,26),(26,28)]
    directions=np.stack([p[:,b]-p[:,a] for a,b in pairs],axis=1);directions/=np.maximum(np.linalg.norm(directions,axis=2,keepdims=True),1e-8)
    x=directions.reshape(len(p),-1);velocity=np.gradient(x,axis=0);activity=np.linalg.norm(velocity,axis=1);typical=float(np.quantile(activity,.7))
    if typical<.001 and clip!='idle':raise ValueError('The guide does not contain enough motion for this loop.')
    minimum=round(fps*(.6 if clip=='run' else 1. if clip=='walk' else 3.));maximum=min(len(p)-3,round(fps*(2 if clip=='run' else 3.5 if clip=='walk' else 7.)))
    choices=[]
    for start in range(1,len(p)-minimum-1):
        for length in range(minimum,min(maximum,len(p)-start-2)+1):
            end=start+length
            if clip!='idle' and np.mean(activity[start:end])<typical*.6:continue
            position=float(np.sqrt(np.mean((x[start]-x[end])**2)));speed=float(np.sqrt(np.mean((velocity[start]-velocity[end])**2)))
            score=position+2*speed
            choices.append((score,start,end,position,speed))
    selected=[]
    for choice in sorted(choices):
        if all(abs(choice[1]-c[1])>fps*.35 or abs((choice[2]-choice[1])-(c[2]-c[1]))>fps*.3 for c in selected):selected.append(choice)
        if len(selected)>rank:break
    if len(selected)<=rank:raise ValueError('No further distinct active loop interval found.')
    best=selected[rank]
    score,start,end,position,speed=best
    return start,end,{'rank':rank,'startFrame':start,'endFrame':end,'startSeconds':start/fps,'endSeconds':end/fps,'directionRms':position,'velocityRms':speed,'selectionScore':score,'sourceSeamSuitable':position<.16}
