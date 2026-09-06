// Select a stationary source on the already certified ground route. Both
// movement layers must reach the heart from it, including flyer clearance.
// The caller supplies its scratch vector so this also runs headlessly.
export function nestSite(nav, original, centre, theta, used, scratch) {
  let node=original,chosen=-1,fallback=-1,score=Infinity,fallbackScore=Infinity;
  for(let guard=0;guard<nav.n&&node>=0;guard++) {
    if(nav.walk[node]&&!nav.block[node]&&nav.airWalk[node]&&Number.isFinite(nav.dist[node])&&Number.isFinite(nav.airDist[node])&&!used.has(node)&&node!==nav.heartNode) {
      nav.nodeDir(node,scratch);
      const angle=Math.acos(Math.max(-1,Math.min(1,scratch.dot(centre)))),distance=Math.abs(angle-theta*1.12);
      if(angle>=theta*1.12&&distance<score){chosen=node;score=distance;}
      if(distance<fallbackScore){fallback=node;fallbackScore=distance;}
    }
    node=nav.next[node];
  }
  // An expanded frontier can encompass the original route. Its nearest
  // still legal node remains visible and reachable inside that territory.
  return chosen>=0?chosen:fallback;
}
