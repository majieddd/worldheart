// Subdivided icosphere. When a cap is given, faces outside it are dropped
// between levels, so a Battlefield can afford a much finer graph than the
// whole globe would: the cost tracks the played area, not the planet.
export function buildIcosphere(detail, capCenter = null, capTheta = 0) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => {
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  });
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? a * 1048576 + b : b * 1048576 + a;
      let m = cache.get(key);
      if (m !== undefined) return m;
      const va = verts[a], vb = verts[b];
      const v = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
      const l = Math.hypot(...v);
      m = verts.length;
      verts.push([v[0] / l, v[1] / l, v[2] / l]);
      cache.set(key, m);
      return m;
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;

    // Margin shrinks with face size: at coarse levels a triangle can straddle
    // the whole cap while none of its corners sit inside it.
    if (capCenter && d >= 2) {
      const cosLimit = Math.cos(Math.min(Math.PI, capTheta + 0.12 + 2.2 / Math.pow(2, d)));
      const inCap = (vi) => {
        const v = verts[vi];
        return v[0] * capCenter.x + v[1] * capCenter.y + v[2] * capCenter.z >= cosLimit;
      };
      faces = faces.filter(([a, b, c]) => inCap(a) || inCap(b) || inCap(c));
    }
  }
  return { verts, faces };
}
