// Pointer ownership shared by the battlefield, courtyard and exhibition.
// A multi-touch gesture can never become a tap when its final finger lifts.
export const hasTouch = () => navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches;
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Commit buttons on a stationary touch release. Some browser gesture streams
// omit the compatibility click following a canvas pinch/drag. Native mouse
// and keyboard clicks remain unchanged, and a scrolling finger never commits.
export function bindTouchActivation(root,enabled=()=>true) {
  const down=new Map();let committed=null;
  root.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||!enabled())return;
    committed=null;
    const button=e.target.closest?.('button,summary,a[href]');
    if(button&&!button.disabled&&!button.dataset.touchHold)down.set(e.pointerId,{button,x:e.clientX,y:e.clientY,moved:false});
  },true);
  root.addEventListener('pointermove',e=>{const p=down.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>10)p.moved=true;},true);
  root.addEventListener('pointercancel',e=>down.delete(e.pointerId),true);
  root.addEventListener('pointerup',e=>{
    const p=down.get(e.pointerId);down.delete(e.pointerId);
    if(!p||p.moved||!enabled()||p.button.disabled||!p.button.isConnected)return;
    const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('button,summary,a[href]');
    if(hit!==p.button)return;
    e.preventDefault();committed={at:performance.now(),x:e.clientX,y:e.clientY,id:e.pointerId};p.button.click();
  },true);
  root.addEventListener('click',e=>{
    if(!e.isTrusted||e.pointerType!=='touch'&&!e.sourceCapabilities?.firesTouchEvents)return;
    // Closing a sheet may retarget the compatibility click to a link behind
    // it. Suppress the already-committed gesture, not only its former element.
    if(committed&&performance.now()-committed.at<800&&(e.pointerId===committed.id||Math.hypot(e.clientX-committed.x,e.clientY-committed.y)<24)){e.preventDefault();e.stopImmediatePropagation();committed=null;}
  },true);
  for(const name of ['blur','pagehide'])addEventListener(name,()=>down.clear());
}

export class TouchGesture {
  constructor(element, handlers = {}) {
    this.element = element; this.handlers = handlers; this.points = new Map();
    const own = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    element.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || handlers.accept?.() === false) return;
      own(e);
      if (!this.points.size) this.used = false;
      const p = { x:e.clientX, y:e.clientY, startX:e.clientX, startY:e.clientY };
      this.points.set(e.pointerId, p);
      element.setPointerCapture(e.pointerId);
      if (this.points.size === 1) handlers.start?.(p);
      else { this.used = true; handlers.multiStart?.(); }
      this.pair = this.measure();
    }, true);
    element.addEventListener('pointermove', e => {
      const p = this.points.get(e.pointerId); if (!p) return;
      own(e);
      if (handlers.accept?.() === false) { this.cancel(); return; }
      const dx=e.clientX-p.x, dy=e.clientY-p.y;
      p.x=e.clientX; p.y=e.clientY;
      if (Math.hypot(p.x-p.startX,p.y-p.startY)>8) this.used=true;
      if (this.points.size === 1) {
        if (this.used) handlers.drag?.(dx,dy,p);
      } else {
        const next=this.measure(),old=this.pair;
        if (next&&old) handlers.pinch?.(Math.log(old.distance/next.distance),next.x-old.x,next.y-old.y);
        this.pair=next;
      }
    }, true);
    const release = e => {
      const p=this.points.get(e.pointerId); if (!p) return;
      own(e); this.points.delete(e.pointerId);
      if (e.type !== 'pointerup') this.used=true;
      if (!this.points.size) {
        if (!this.used && handlers.accept?.() !== false) handlers.tap?.(p.x,p.y);
        handlers.end?.(this.used,e.type !== 'pointerup');
      } else if (this.points.size === 1) {
        // Rebase the remaining finger. Neither the former pinch centre nor a
        // stale grab point may cause a jump on the next single-finger move.
        const remaining=this.points.values().next().value;
        remaining.startX=remaining.x; remaining.startY=remaining.y;
        handlers.start?.(remaining);
      }
      this.pair=this.measure();
    };
    for (const name of ['pointerup','pointercancel','lostpointercapture']) element.addEventListener(name,release,true);
    for (const name of ['blur','pagehide','resize']) addEventListener(name,()=>this.cancel());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancel();});
  }
  measure() {
    if(this.points.size<2)return null;
    const [a,b]=this.points.values();
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(8,Math.hypot(a.x-b.x,a.y-b.y))};
  }
  cancel() {
    const ids=[...this.points.keys()];this.points.clear();this.used=true;this.pair=null;
    for(const id of ids)if(this.element.hasPointerCapture(id))this.element.releasePointerCapture(id);
    this.handlers.cancel?.();
  }
}

export class TouchStick {
  constructor(element, change, accept = () => true, {floating=false} = {}) {
    this.element=element;this.change=change;this.pointer=null;
    this.thumb=element.querySelector('.touch-stick-thumb');
    this.floating=floating;
    if(floating){
      this.pad=document.createElement('span');this.pad.className='touch-stick-pad';
      this.thumb.before(this.pad);this.pad.append(this.thumb);element.classList.add('touch-stick-floating');
    }
    element.addEventListener('pointerdown',e=>{
      if(!accept()||this.pointer!==null)return;
      e.preventDefault();e.stopPropagation();this.pointer=e.pointerId;
      // Read geometry only when a gesture starts, not after every thumb style
      // write. A floating origin lets the player land anywhere in the zone.
      this.rect=element.getBoundingClientRect();
      this.radius=(this.pad?.offsetWidth||this.rect.width)*.34;
      this.origin={x:floating?e.clientX:this.rect.left+this.rect.width/2,y:floating?e.clientY:this.rect.top+this.rect.height/2};
      element.classList.add('touch-stick-active');
      element.setPointerCapture(e.pointerId);this.move(e);
    });
    element.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer){e.preventDefault();this.move(e);}});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,e=>{if(e.pointerId===this.pointer)this.reset();});
  }
  move(e) {
    const radius=this.radius,origin=this.origin;
    let dx=e.clientX-origin.x,dy=e.clientY-origin.y;
    const travel=Math.hypot(dx,dy),limit=radius*1.4;
    if(this.floating&&travel>limit){origin.x+=dx*(1-limit/travel);origin.y+=dy*(1-limit/travel);dx=e.clientX-origin.x;dy=e.clientY-origin.y;}
    if(this.pad)this.pad.style.transform=`translate(${origin.x-this.rect.left-this.rect.width/2}px,${origin.y-this.rect.top-this.rect.height/2}px)`;
    let x=dx/radius,y=dy/radius;
    const distance=Math.hypot(x,y);if(distance>1){x/=distance;y/=distance;}
    this.thumb.style.transform=`translate(${x*radius}px,${y*radius}px)`;
    const strength=clamp((distance-.12)/.88,0,1),n=Math.hypot(x,y)||1;
    this.change(x/n*strength,-y/n*strength);
  }
  reset() {
    const id=this.pointer;this.pointer=null;this.change(0,0);this.thumb.style.transform='';
    this.element.classList.remove('touch-stick-active');if(this.pad)this.pad.style.transform='';
    if(id!==null&&this.element.hasPointerCapture(id))this.element.releasePointerCapture(id);
  }
}
