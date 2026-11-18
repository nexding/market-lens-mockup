/* Market Lens mockup: event mind map, placement maths for the globe view. No DOM, so it also runs under node
   (see mindmap-geo.test.js). Events, companies and holdings sit on the surface at their own lat/lng; factors and
   sectors float in two shells above it, near the nodes they connect to. */
(function (root) {
  'use strict';
  var RAD = Math.PI / 180;
  /* altitudes in globe radii */
  var SURFACE = 0.008, SHELL = { sector: 0.22, factor: 0.34 };
  var SEP_SAME = 9, SEP_CROSS = 5, DRIFT_MAX = 24, CLUSTER_DEG = 1.2, RING_LAT = 68, FAN_MAX_NODES = 300;

  /* unit vector for a lat/lng, in the axes globe.gl uses: y is north, z points at lat 0, lng 0 */
  function vec(lat, lng) { var c = Math.cos(lat * RAD); return [c * Math.sin(lng * RAD), Math.sin(lat * RAD), c * Math.cos(lng * RAD)]; }
  function latlng(v) { return { lat: Math.asin(Math.max(-1, Math.min(1, v[1]))) / RAD, lng: Math.atan2(v[0], v[2]) / RAD }; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function axpy(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function angle(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / RAD; }
  /* east and north unit vectors of the tangent plane at p (north falls back to a fixed axis at the poles) */
  function frame(p) { var e = cross([0, 1, 0], p); if (len(e) < 1e-6) e = [1, 0, 0]; e = unit(e); return { e: e, n: cross(p, e) }; }
  /* p turned by deg degrees towards the tangent direction t */
  function turn(p, t, deg) { return unit(axpy([p[0] * Math.cos(deg * RAD), p[1] * Math.cos(deg * RAD), p[2] * Math.cos(deg * RAD)], t, Math.sin(deg * RAD))); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  function floats(n) { return n.type === 'factor' || n.type === 'sector'; }

  /* ---------- floating nodes ---------- */
  function placeFloating(nodes) {
    var fl = nodes.filter(floats), i, r, changed = true;
    nodes.forEach(function (n) { n.geo = floats(n) ? { float: true, alt: SHELL[n.type], v: null } : { float: false, alt: SURFACE, v: vec(n.lat, n.lng) }; });
    function nbrs(n) { return n.ins.map(function (l) { return { n: l.s, c: l.conf }; }).concat(n.outs.map(function (l) { return { n: l.t, c: l.conf }; })); }
    /* the weighted centre of a node's placed neighbours; surface nodes are fixed, so they pull twice as hard */
    function centre(n) {
      var s = [0, 0, 0], w = 0, best = null;
      nbrs(n).forEach(function (x) {
        if (!x.n.geo.v) return; var k = x.n.geo.float ? 1 : 2; s = axpy(s, x.n.geo.v, k); w += k;
        if (!best || x.c > best.c) best = x;
      });
      if (!w) return null;
      /* neighbours on opposite sides of the Earth cancel out: follow the most confident link instead */
      return len(s) / w < 0.15 ? best.n.geo.v : unit(s);
    }
    while (changed) { changed = false; fl.forEach(function (n) { if (!n.geo.v) { var c = centre(n); if (c) { n.geo.v = c; changed = true; } } }); }
    var lost = fl.filter(function (n) { return !n.geo.v; });
    for (r = 0; r < 40; r++) { var next = fl.map(function (n) { return n.geo.v ? centre(n) : null; }); fl.forEach(function (n, k) { if (next[k]) n.geo.v = next[k]; }); }
    /* nothing to anchor to: an even ring in the far north of the node's own shell */
    ['factor', 'sector'].forEach(function (type) {
      var ring = lost.filter(function (n) { return n.type === type; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
      ring.forEach(function (n, k) { n.geo.v = vec(RING_LAT, -180 + 360 * (k + 0.5) / ring.length); n.geo.ring = true; });
    });
    /* a node with one neighbour would sit exactly above it: step aside so its stem and label stay clear */
    fl.forEach(function (n) {
      var nb = nbrs(n); if (n.geo.ring || !nb.length) return;
      var near = nb.filter(function (x) { return angle(x.n.geo.v, n.geo.v) < 4; });
      if (near.length) { var f = frame(n.geo.v), b = (hash(n.id) % 360) * RAD; n.geo.v = turn(n.geo.v, axpy([f.n[0] * Math.cos(b), f.n[1] * Math.cos(b), f.n[2] * Math.cos(b)], f.e, Math.sin(b)), 6); }
    });
    /* keep shell nodes apart, without letting any of them wander far from where its links put it */
    fl.forEach(function (n) { n.geo.anchor = n.geo.v; });
    for (r = 0; r < 200; r++) {
      var moved = false;
      for (i = 0; i < fl.length; i++) for (var j = i + 1; j < fl.length; j++) {
        var a = fl[i], b2 = fl[j], want = a.type === b2.type ? SEP_SAME : SEP_CROSS, d = angle(a.geo.v, b2.geo.v);
        if (d >= want) continue;
        var away = axpy(a.geo.v, b2.geo.v, -1);
        if (len(away) < 1e-6) { var fr = frame(a.geo.v), h = (hash(a.id + b2.id) % 360) * RAD; away = axpy([fr.n[0] * Math.cos(h), fr.n[1] * Math.cos(h), fr.n[2] * Math.cos(h)], fr.e, Math.sin(h)); }
        /* tangent directions pointing away from the other node */
        var ta = unit(axpy(away, a.geo.v, -dot(away, a.geo.v))), tb = unit(axpy(away, b2.geo.v, -dot(away, b2.geo.v))), push = (want - d) / 2 + 0.05;
        a.geo.v = turn(a.geo.v, ta, push); b2.geo.v = turn(b2.geo.v, [-tb[0], -tb[1], -tb[2]], push); moved = true;
      }
      fl.forEach(function (n) {
        var off = angle(n.geo.v, n.geo.anchor); if (off <= DRIFT_MAX) return;
        var t = unit(axpy(n.geo.v, n.geo.anchor, -dot(n.geo.v, n.geo.anchor))); n.geo.v = turn(n.geo.anchor, t, DRIFT_MAX);
      });
      if (!moved) break;
    }
    fl.forEach(function (n) { var p = latlng(n.geo.v); n.geo.lat = p.lat; n.geo.lng = p.lng; });
  }

  /* ---------- surface nodes that share a place fan out on a small ring around it ---------- */
  function ringPx(m) { return Math.max(18, 15 / Math.sin(Math.PI / Math.min(m, 8))); }
  function fanOut(nodes) {
    var sf = nodes.filter(function (n) { return !n.geo.float; }), groups = [];
    sf.forEach(function (n) { n.geo.lat = n.lat; n.geo.lng = n.lng; n.geo.home = n.geo.v; n.geo.fan = null; n.geo.cluster = 0; });
    if (sf.length > FAN_MAX_NODES) return;
    /* a node joins the nearest group whose centre is within reach, so groups stay compact: nodes a few degrees apart
       are not chained into one, they simply overlap until the view is zoomed in */
    sf.forEach(function (n) {
      var best = null, bd = CLUSTER_DEG;
      groups.forEach(function (g) { var d = angle(g.c, n.geo.v); if (d < bd) { bd = d; best = g; } });
      if (!best) groups.push(best = { c: n.geo.v, sum: [0, 0, 0], m: [] });
      best.m.push(n); best.sum = axpy(best.sum, n.geo.v, 1); best.c = unit(best.sum);
    });
    groups.forEach(function (grp) {
      var g = grp.m, m = g.length; if (m < 2) return;
      var c = grp.c, f = frame(c);
      g.forEach(function (n) { n.b = Math.atan2(dot(n.geo.v, f.e), dot(n.geo.v, f.n)); });
      g.sort(function (a, b) { return a.b - b.b || (a.id < b.id ? -1 : 1); });
      /* slots are evenly spaced; the whole ring is turned so that members move as little as possible */
      var sx = 0, sy = 0; g.forEach(function (n, k) { var o = n.b - 2 * Math.PI * k / Math.min(m, 8); sx += Math.cos(o); sy += Math.sin(o); });
      var start = Math.atan2(sy, sx);
      g.forEach(function (n, k) {
        var ring = Math.floor(k / 8), slot = k % 8, inRing = Math.min(8, m - ring * 8), th = start + 2 * Math.PI * slot / inRing + ring * 0.39, px = ringPx(inRing) * (ring + 1);
        var t = axpy([f.n[0] * Math.cos(th), f.n[1] * Math.cos(th), f.n[2] * Math.cos(th)], f.e, Math.sin(th));
        n.geo.v = c; n.geo.fan = [t[0] * px, t[1] * px, t[2] * px]; n.geo.cluster = m; delete n.b;
      });
    });
  }

  /* where a node is drawn: its base direction turned along its fan by an angle that depends on the zoom.
     fanK is radians of arc per screen pixel; the shaders in mindmap-globe.js repeat this formula */
  var FAN_LO = 0.0009, FAN_HI = 0.105;
  function shown(g, fanK) {
    if (!g.fan) return g.v;
    var px = len(g.fan), rho = Math.max(FAN_LO, Math.min(FAN_HI, px * fanK));
    return unit(axpy(g.v, g.fan, Math.tan(rho) / px));
  }

  function place(nodes) { placeFloating(nodes); fanOut(nodes); }

  var api = { place: place, shown: shown, vec: vec, latlng: latlng, angle: angle, unit: unit, dot: dot, SURFACE: SURFACE, SHELL: SHELL, SEP_SAME: SEP_SAME, SEP_CROSS: SEP_CROSS, DRIFT_MAX: DRIFT_MAX, CLUSTER_DEG: CLUSTER_DEG, FAN_LO: FAN_LO, FAN_HI: FAN_HI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ML.mmGeo = api;
})(this);
