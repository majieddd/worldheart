// Append-only numeric set for mesh edges. Native Set boxes large numeric keys
// and its copied iteration array retains another full graph during boot.
// Indices into a packed insertion-order buffer preserve adjacency/tie ordering.
export class OrderedEdgeSet {
  constructor(expected=16){
    const capacity=Math.max(16,2**Math.ceil(Math.log2(expected)));
    this.keys=new Float64Array(capacity);this.table=new Uint32Array(capacity*2);this.size=0;
  }
  _slot(key){
    const mask=this.table.length-1;
    let slot=(Math.imul(key|0,73856093)^Math.imul(Math.floor(key/4294967296),19349663))&mask;
    while(this.table[slot]&&this.keys[this.table[slot]-1]!==key)slot=(slot+1)&mask;
    return slot;
  }
  add(key){
    let slot=this._slot(key);if(this.table[slot])return false;
    if(this.size===this.keys.length){
      const old=this.keys;this.keys=new Float64Array(old.length*2);this.keys.set(old);this.table=new Uint32Array(this.keys.length*2);
      for(let i=0;i<this.size;i++)this.table[this._slot(this.keys[i])]=i+1;
      slot=this._slot(key);
    }
    this.keys[this.size]=key;this.table[slot]=++this.size;return true;
  }
  *[Symbol.iterator](){for(let i=0;i<this.size;i++)yield this.keys[i];}
}

// Match accepted cap vertices against the final globe without allocating a
// comma-separated string for every coordinate. Exact doubles are still checked.
export class ExactPointIndex {
  constructor(expected){
    const capacity=2**Math.ceil(Math.log2(Math.max(16,expected*2)));
    this.coords=new Float64Array(capacity*3);this.ids=new Int32Array(capacity).fill(-1);this.mask=capacity-1;
  }
  _slot(x,y,z){
    let slot=(Math.imul((x*1048576)|0,73856093)^Math.imul((y*1048576)|0,19349663)^Math.imul((z*1048576)|0,83492791))&this.mask;
    while(this.ids[slot]>=0){const p=slot*3;if(this.coords[p]===x&&this.coords[p+1]===y&&this.coords[p+2]===z)break;slot=(slot+1)&this.mask;}
    return slot;
  }
  set(x,y,z,id){const slot=this._slot(x,y,z),p=slot*3;this.coords[p]=x;this.coords[p+1]=y;this.coords[p+2]=z;this.ids[slot]=id;}
  get(x,y,z){const id=this.ids[this._slot(x,y,z)];return id<0?undefined:id;}
}
