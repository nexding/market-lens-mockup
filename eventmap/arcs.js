/* Event Map: arcs between two points on the unit sphere. Each arc follows the great circle (a slerp between the two
   unit vectors), lifted just off the surface and bulging outwards in proportion to the angle it spans. Plain arrays, no
   three.js, so node can test it. */

export const LIFT = 1.02;
export const BULGE = 0.24;

/* the plane of the arc: start a, unit vector p at right angles to a towards b, and the angle w between them.
   Near-antipodal pairs have a tiny cross product; the atan2 angle and the normalised cross product stay accurate down
   to about 1e-6, and below that (the exact antipode) any great circle is a shortest path, so one through the poles'
   reference axis is taken. */
export function arcFrame(a, b, f = {}) {
  const cx = a[1] * b[2] - a[2] * b[1], cy = a[2] * b[0] - a[0] * b[2], cz = a[0] * b[1] - a[1] * b[0];
  const sinw = Math.hypot(cx, cy, cz), cosw = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let nx, ny, nz;
  if (sinw > 1e-6) { nx = cx / sinw; ny = cy / sinw; nz = cz / sinw; }
  else {
    const r = Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    nx = a[1] * r[2] - a[2] * r[1]; ny = a[2] * r[0] - a[0] * r[2]; nz = a[0] * r[1] - a[1] * r[0];
    const m = Math.hypot(nx, ny, nz); nx /= m; ny /= m; nz /= m;
  }
  f.ax = a[0]; f.ay = a[1]; f.az = a[2];
  f.px = ny * a[2] - nz * a[1]; f.py = nz * a[0] - nx * a[2]; f.pz = nx * a[1] - ny * a[0];
  f.w = Math.atan2(sinw, cosw);
  return f;
}

export function radiusAt(f, t, lift = LIFT, bulge = BULGE) { return lift + bulge * (f.w / Math.PI) * Math.sin(Math.PI * t); }

/* the point at t (0 at a, 1 at b), written into out at offset o */
export function arcPoint(f, t, out, o = 0, lift = LIFT, bulge = BULGE) {
  const c = Math.cos(t * f.w), s = Math.sin(t * f.w), r = radiusAt(f, t, lift, bulge);
  out[o] = r * (f.ax * c + f.px * s); out[o + 1] = r * (f.ay * c + f.py * s); out[o + 2] = r * (f.az * c + f.pz * s);
  return out;
}

/* the unit direction of travel at t */
export function arcTangent(f, t, out, lift = LIFT, bulge = BULGE) {
  const c = Math.cos(t * f.w), s = Math.sin(t * f.w), r = radiusAt(f, t, lift, bulge);
  const dr = bulge * f.w * Math.cos(Math.PI * t);
  const vx = f.ax * c + f.px * s, vy = f.ay * c + f.py * s, vz = f.az * c + f.pz * s;
  const dx = f.w * (-f.ax * s + f.px * c), dy = f.w * (-f.ay * s + f.py * c), dz = f.w * (-f.az * s + f.pz * c);
  let x = dr * vx + r * dx, y = dr * vy + r * dy, z = dr * vz + r * dz;
  const m = Math.hypot(x, y, z) || 1;
  out[0] = x / m; out[1] = y / m; out[2] = z / m;
  return out;
}

/* segs + 1 points from a to b into out (length at least (segs + 1) * 3 after offset); returns the arc length */
export function arcPoints(a, b, segs, out, offset = 0, lift = LIFT, bulge = BULGE) {
  const f = arcFrame(a, b);
  let len = 0;
  for (let i = 0; i <= segs; i++) {
    const o = offset + i * 3;
    arcPoint(f, i / segs, out, o, lift, bulge);
    if (i) len += Math.hypot(out[o] - out[o - 3], out[o + 1] - out[o - 2], out[o + 2] - out[o - 1]);
  }
  return len;
}
