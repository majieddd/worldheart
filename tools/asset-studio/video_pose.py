"""Local, source-bound single-person video tracking. Never manufactures missing motion."""
import argparse, hashlib, json, time
from pathlib import Path
import cv2
import numpy as np
from scipy.ndimage import gaussian_filter1d

JOINTS = [11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32]
EDGES = [(11,12),(11,13),(13,15),(12,14),(14,16),(11,23),(12,24),(23,24),(23,25),(25,27),(24,26),(26,28),(27,29),(29,31),(28,30),(30,32)]

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def extract(task):
    import mediapipe as mp
    started=time.perf_counter();source=Path(task['video']);dest=Path(task['output']);dest.parent.mkdir(parents=True,exist_ok=True)
    model=Path(task['model']);cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps>120: raise ValueError('Invalid video frame rate.')
    count=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));first=round(float(task.get('start',0))*fps);last=min(count,round(float(task.get('end',count/fps))*fps))
    if not 0<=first<last<=count or last-first<fps:raise ValueError('Select at least one second inside the video.')
    opt=mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),running_mode=mp.tasks.vision.RunningMode.VIDEO,num_poses=1,min_pose_detection_confidence=.5,min_pose_presence_confidence=.5,min_tracking_confidence=.5)
    width,height=960,540;writer=cv2.VideoWriter(str(dest.with_suffix('.mp4')),cv2.VideoWriter_fourcc(*'mp4v'),fps,(width,height))
    positions=[];screens=[];visibility=[];valid=[];cap.set(cv2.CAP_PROP_POS_FRAMES,first)
    with mp.tasks.vision.PoseLandmarker.create_from_options(opt) as tracker:
        for frameid in range(first,last):
            ok,frame=cap.read()
            if not ok:raise ValueError('Unreadable video frame.')
            small=cv2.resize(frame,(width,height));rgb=cv2.cvtColor(small,cv2.COLOR_BGR2RGB)
            result=tracker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),round(frameid*1000/fps))
            found=bool(result.pose_world_landmarks)
            xyz=np.array([[p.x,p.y,p.z] for p in result.pose_world_landmarks[0]]) if found else np.full((33,3),np.nan)
            uv=np.array([[p.x,p.y,p.z] for p in result.pose_landmarks[0]]) if found else np.full((33,3),np.nan)
            conf=np.array([min(p.visibility,p.presence) for p in result.pose_landmarks[0]]) if found else np.zeros(33)
            positions.append(xyz);screens.append(uv);visibility.append(conf);valid.append(found)
            if found:
                for a,b in EDGES:
                    color=(100,230,100) if min(conf[a],conf[b])>=.5 else (0,80,255)
                    cv2.line(small,tuple((uv[a,:2]*[width,height]).astype(int)),tuple((uv[b,:2]*[width,height]).astype(int)),color,2)
            cv2.putText(small,f'{frameid/fps:.2f}s  tracking {"yes" if found else "MISSING"}',(15,26),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,255,255),2);writer.write(small)
    cap.release();writer.release();xyz=np.asarray(positions);uv=np.asarray(screens);conf=np.asarray(visibility);valid=np.asarray(valid)
    runs=[];gap=0
    for ok in valid:
        gap=0 if ok else gap+1;runs.append(gap)
    checks=[{'name':'Pose coverage','pass':float(valid.mean())>=.95,'value':float(valid.mean())},
        {'name':'Maximum missing interval','pass':max(runs)/fps<=.2,'value':max(runs)/fps},
        {'name':'Visible key joints','pass':float((conf[:,JOINTS]>=.5).mean())>=.85,'value':float((conf[:,JOINTS]>=.5).mean())}]
    passed=all(c['pass'] for c in checks)
    report={'engine':'MediaPipe Pose Landmarker heavy','version':mp.__version__,'sourceSha256':sha(source),'modelSha256':sha(model),'start':first/fps,'end':last/fps,'fps':fps,'frames':len(valid),'seconds':round(time.perf_counter()-started,3),'passed':passed,'checks':checks,'limitations':['Monocular depth is estimated. Fingers and axial twist are not captured by this body tracker.','Visual review of the overlay and exported motion is required.']}
    dest.with_suffix('.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    if not passed:raise ValueError('Video tracking failed: '+', '.join(c['name'] for c in checks if not c['pass'])+'. Overlay and diagnostics retained.')
    for array in [xyz,uv]:
        for joint in range(33):
            for axis in range(3):array[:,joint,axis]=np.interp(np.arange(len(valid)),np.where(valid)[0],array[valid,joint,axis])
    smooth=gaussian_filter1d(xyz,max(.5,fps*.045),axis=0,mode='nearest')
    np.savez_compressed(dest,world=smooth,raw=xyz,screen=uv,visibility=conf,fps=fps,sourceSha256=report['sourceSha256'])
    print(json.dumps(report))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('task');args=parser.parse_args();extract(json.loads(Path(args.task).read_text('utf-8-sig')))
