// New versions are proposals. The owner's approval is attached only to v1.
export const VERSIONS=Object.freeze({
  v1:{version:'1.0.0',name:'Hard Cel',status:'Owner-selected candidate',description:'The exact crisp contour, painted color and cel shadows you selected.',bands:[.32,.62,.96],thresholds:[92,165],line:1.45,ink:'#292332',pigment:1,emissive:.6,shadowRadius:1,fog:.009,tint:0,hatch:0,rim:0},
  v2:{version:'1.1.0',name:'Painted light',status:'Unreviewed variation',description:'Colored shadows reveal more paint in dark surfaces while preserving the bold contour.',bands:[.40,.69,.98],thresholds:[92,165],line:1.45,ink:'#292332',pigment:1.10,emissive:1.4,shadowRadius:1.3,fog:.009,tint:.38,hatch:0,rim:0},
  v3:{version:'1.2.0',name:'Etched color',status:'Unreviewed variation',description:'Finer contour, stronger pigment and restrained surface hatching in the shadows.',bands:[.30,.64,.98],thresholds:[88,166],line:1.15,ink:'#252032',pigment:1.65,emissive:.8,shadowRadius:1,fog:.009,tint:.16,hatch:.15,rim:0},
  v4:{version:'1.3.0',name:'Atmospheric ink',status:'Unreviewed variation',description:'Warm edge light and cool distance haze add depth around the same crisp cel shapes.',bands:[.34,.66,.99],thresholds:[92,167],line:1.4,ink:'#293146',pigment:1.1,emissive:1,shadowRadius:1.6,fog:.017,tint:.27,hatch:0,rim:.20}
});
