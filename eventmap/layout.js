/* Event Map: where each event sits on the unit sphere. Latitude is time (earliest near the north pole), longitude is
   category (six equal wedges). Pure and deterministic, so node can test it.
   Axes follow three.js: y is up (north), and a direction is [sin(pol)·sin(az), cos(pol), sin(pol)·cos(az)]. */

const DEG = Math.PI / 180;

/* the same seeded generator and string hash as ML.rng and ML.hash in mock.js */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function dir(pol, az, out = [0, 0, 0]) {
  const s = Math.sin(pol);
  out[0] = s * Math.sin(az); out[1] = Math.cos(pol); out[2] = s * Math.cos(az);
  return out;
}

export function wedgeCenter(k, n = 6) { return (k + 0.5) * 2 * Math.PI / n; }

export const DEFAULTS = { seed: 'event-map', marginDeg: 12, driftDeg: 1.5, iterations: 80, minSepDeg: 7, padDeg: 3, ncat: 6 };

/* nodes need id, t (a time value, see data.js timeValue) and cat (0 to ncat-1).
   Returns { pos: [{pol, az, v}] in node order, t0, t1, polarOf(t), minSepDeg (the closest pair after the pass) } */
export function layout(nodes, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const margin = o.marginDeg * DEG, drift = o.driftDeg * DEG, minSep = o.minSepDeg * DEG, pad = o.padDeg * DEG;
  const half = Math.PI / o.ncat;
  let t0 = Infinity, t1 = -Infinity;
  nodes.forEach((n) => { if (n.t < t0) t0 = n.t; if (n.t > t1) t1 = n.t; });
  if (!isFinite(t0)) { t0 = 0; t1 = 1; }
  if (t1 - t0 < 1e-9) { t0 -= 1; t1 += 1; }
  const polarOf = (t) => margin + (Math.min(t1, Math.max(t0, t)) - t0) / (t1 - t0) * (Math.PI - 2 * margin);

  const N = nodes.length;
  const pol = new Float64Array(N), az = new Float64Array(N), pol0 = new Float64Array(N);
  const lo = new Float64Array(N), hi = new Float64Array(N);
  const v = new Float64Array(N * 3);
  const tmp = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const n = nodes[i];
    /* the jitter depends only on the event's own id, so adding an event does not reshuffle the others */
    const r = rng(hash(o.seed + ':' + n.id));
    const c = wedgeCenter(n.cat, o.ncat);
    lo[i] = c - half + pad; hi[i] = c + half - pad;
    pol0[i] = pol[i] = polarOf(n.t);
    az[i] = c + (r() * 2 - 1) * (half - pad) * 0.8;
    dir(pol[i], az[i], tmp); v[i * 3] = tmp[0]; v[i * 3 + 1] = tmp[1]; v[i * 3 + 2] = tmp[2];
  }

  /* repulsion on the surface: pairs closer than minSep push apart along the surface; latitude may drift a little,
     longitude stays inside the category's wedge */
  const cosMin = Math.cos(minSep);
  const dE = new Float64Array(N), dS = new Float64Array(N);
  for (let it = 0; it < o.iterations; it++) {
    const step = 0.6 * (1 - it / o.iterations) + 0.15;
    dE.fill(0); dS.fill(0);
    for (let i = 0; i < N; i++) {
      const xi = v[i * 3], yi = v[i * 3 + 1], zi = v[i * 3 + 2];
      for (let j = i + 1; j < N; j++) {
        const xj = v[j * 3], yj = v[j * 3 + 1], zj = v[j * 3 + 2];
        const dot = xi * xj + yi * yj + zi * zj;
        if (dot < cosMin) continue;
        const ang = Math.acos(Math.min(1, dot));
        const push = (minSep - ang) * 0.5 * step;
        let dx = xi - xj, dy = yi - yj, dz = zi - zj;
        if (dx * dx + dy * dy + dz * dz < 1e-18) { dx = Math.cos(az[i]); dy = 0; dz = -Math.sin(az[i]); }
        addPush(i, dx, dy, dz, push);
        addPush(j, -dx, -dy, -dz, push);
      }
    }
    for (let i = 0; i < N; i++) {
      const s = Math.max(Math.sin(pol[i]), 0.2);
      pol[i] = Math.min(pol0[i] + drift, Math.max(pol0[i] - drift, pol[i] + dS[i]));
      az[i] = Math.min(hi[i], Math.max(lo[i], az[i] + dE[i] / s));
      dir(pol[i], az[i], tmp); v[i * 3] = tmp[0]; v[i * 3 + 1] = tmp[1]; v[i * 3 + 2] = tmp[2];
    }
  }
  function addPush(i, dx, dy, dz, push) {
    const sp = Math.sin(pol[i]), cp = Math.cos(pol[i]), sa = Math.sin(az[i]), ca = Math.cos(az[i]);
    const e = dx * ca - dz * sa;                       /* east:  [cos az, 0, -sin az] */
    const s = dx * cp * sa - dy * sp + dz * cp * ca;    /* south: [cos pol sin az, -sin pol, cos pol cos az] */
    const m = Math.hypot(e, s);
    if (m < 1e-12) { dE[i] += push; return; }
    dE[i] += push * e / m; dS[i] += push * s / m;
  }

  let closest = Infinity;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const d = Math.acos(Math.max(-1, Math.min(1, v[i * 3] * v[j * 3] + v[i * 3 + 1] * v[j * 3 + 1] + v[i * 3 + 2] * v[j * 3 + 2])));
    if (d < closest) closest = d;
  }
  const pos = [];
  for (let i = 0; i < N; i++) pos.push({ pol: pol[i], az: az[i], v: [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]] });
  return { pos, t0, t1, polarOf, minSepDeg: closest / DEG };
}
