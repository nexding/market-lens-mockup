/* Market Lens mockup: event mind map, globe renderer. globe.gl supplies the sphere, atmosphere, camera and controls;
   everything on top of it is drawn here. This is the one page of the mockup that uses the network: the libraries,
   the night photograph and the border data come from a CDN at pinned versions, and a sharper photograph from NASA.
   If the libraries cannot load, mindmap.js falls back to the flat map. All graph data is invented. */
(function () {
  'use strict';
  var M = window.ML, COL = M.COL, G = M.mmGeo;

  var CDN = {
    globe: ['https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js', 'https://unpkg.com/globe.gl@2.46.2/dist/globe.gl.min.js'],
    globeSri: 'sha384-1uolMBZ25k3zJcNwCLEv49+L+m2dZudqAzsoSAJfQTzDCSBxJzrMuZ2dkp/5JKiT',
    /* the same revision (r185) that globe.gl bundles. It must stay a module import: a global THREE breaks globe.gl */
    three: 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js',
    night: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.6/example/img/earth-night.jpg',
    /* NASA Black Marble 2016, 13,500 by 6,750 pixels, public domain. Loaded after the smaller one, on desktops only */
    nightHi: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
    atlas: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json'
  };
  var LOAD_MS = 8000, HOME = { lat: 36, lng: 12, altitude: 2.5 }, ALT_MIN = 0.6, ALT_MAX = 5;

  /* ---------- loading ---------- */
  function script(urls, sri) {
    return new Promise(function (ok, no) {
      (function attempt(i) {
        var s = document.createElement('script'); s.src = urls[i]; s.crossOrigin = 'anonymous'; s.integrity = sri;
        s.onload = function () { ok(); };
        s.onerror = function () { s.remove(); if (i + 1 < urls.length) attempt(i + 1); else no(new Error()); };
        document.head.appendChild(s);
      })(0);
    });
  }
  var libs = null;
  function loadLibs() {
    if (!libs) libs = Promise.all([window.Globe ? null : script(CDN.globe, CDN.globeSri), import(CDN.three)]).then(function (r) { return r[1]; }, function () { libs = null; throw new Error('the libraries could not be downloaded'); });
    return Promise.race([libs, new Promise(function (ok, no) { setTimeout(function () { no(new Error('the libraries took too long to load')); }, LOAD_MS); })]);
  }

  /* ---------- colour helpers: tokens come in as hex strings ---------- */
  function rgb(hex) { var h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round((x[i] + (y[i] - x[i]) * t) * 255); }).join(',') + ')'; }

  /* ---------- border data: world-atlas TopoJSON, decoded here so no extra library is needed ---------- */
  function decodeAtlas(topo) {
    var sc = topo.transform.scale, tr = topo.transform.translate;
    var arcs = topo.arcs.map(function (a) { var x = 0, y = 0; return a.map(function (p) { x += p[0]; y += p[1]; return [x * sc[0] + tr[0], y * sc[1] + tr[1]]; }); });
    function polys(g, fn) { if (g.type === 'GeometryCollection') g.geometries.forEach(function (x) { polys(x, fn); }); else if (g.type === 'Polygon') fn(g.arcs); else if (g.type === 'MultiPolygon') g.arcs.forEach(fn); }
    /* an arc used by two countries is a border; an arc used by one is coast */
    var use = new Uint8Array(arcs.length);
    polys(topo.objects.countries, function (rings) { rings.forEach(function (ring) { ring.forEach(function (i) { use[i < 0 ? ~i : i]++; }); }); });
    var land = [];
    polys(topo.objects.land, function (rings) {
      land.push(rings.map(function (ring) {
        var pts = [];
        ring.forEach(function (i) { var a = arcs[i < 0 ? ~i : i], k; if (i < 0) a = a.slice().reverse(); for (k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); });
        return pts;
      }));
    });
    return { arcs: arcs, use: use, land: land };
  }

  /* ---------- shaders. Sizes are in CSS pixels; uRes is the stage size in CSS pixels ---------- */
  var GLSL = [
    'const float R = 100.0;',
    'uniform float uFanK;',
    '/* a node that shares its place with others: turned off the shared centre along its fan (same formula as mmGeo.shown) */',
    'vec3 fanned(vec3 base, vec3 fan) {',
    '  float px = length(fan); if (px < 0.001) return base;',
    '  return normalize(base + fan * (tan(clamp(px * uFanK, ' + G.FAN_LO + ', ' + G.FAN_HI + ')) / px));',
    '}',
    '/* 1 where the Earth does not stand between the camera and P */',
    'float vis(vec3 P) {',
    '  vec3 v = P - cameraPosition; float s = clamp(-dot(cameraPosition, v) / dot(v, v), 0.0, 1.0);',
    '  return smoothstep(R * 0.992, R * 1.004, length(cameraPosition + v * s));',
    '}'
  ].join('\n');
  /* nodes: one billboard per node. aMeta = altitude, shape (0 event, 1 factor, 2 sector, 3 company, 4 holding, 5 anchor dot), radius, hub strength.
     aState = alpha, scale, lit, selected */
  var NODE_VS = GLSL + [
    'attribute vec3 aBase; attribute vec3 aFan; attribute vec3 aCol; attribute vec4 aMeta; attribute vec4 aState;',
    'uniform vec2 uRes; uniform float uScale;',
    'varying vec2 vP; varying vec3 vCol; varying vec4 vS; varying vec2 vK;',
    'void main() {',
    '  vec3 P = fanned(aBase, aFan) * R * (1.0 + aMeta.x);',
    '  float a = aState.x * vis(P), r = aMeta.z * (aMeta.y > 4.5 ? 1.0 : uScale) * aState.y, ext = r * 3.6 + 3.0;',
    '  vec4 c = projectionMatrix * viewMatrix * vec4(P, 1.0);',
    '  c.xy += position.xy * ext * 2.0 / uRes * c.w;',
    '  gl_Position = (a < 0.004 || r < 0.05) ? vec4(2.0, 2.0, 2.0, 1.0) : c;',
    '  vP = position.xy * ext; vCol = aCol; vS = vec4(a, aState.z, aState.w, aMeta.w); vK = vec2(aMeta.y, r);',
    '}'
  ].join('\n');
  var NODE_FS = [
    'uniform vec3 uBg; uniform float uAdd;',
    'varying vec2 vP; varying vec3 vCol; varying vec4 vS; varying vec2 vK;',
    'float shape(vec2 p, float r, float k) {',
    '  if (k < 0.5) { vec2 q = abs(p) - vec2(r * 0.6); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r * 0.32; }',
    '  if (k < 1.5) return (abs(p.x) + abs(p.y) - r * 1.3) * 0.7071;',
    '  if (k < 2.5) { vec2 q = abs(p); return max(q.y, q.x * 0.866025 + q.y * 0.5) - r * 0.95; }',
    '  return length(p) - r;',
    '}',
    'void main() {',
    '  float k = vK.x, r = vK.y, d = shape(vP, r, k), hold = step(3.5, k) * step(k, 4.5), dotk = step(4.5, k);',
    '  float sw = mix(1.5, 2.6, vS.z), inside = smoothstep(0.6, -0.6, d), edge = inside * smoothstep(-sw - 0.6, -sw + 0.6, d);',
    '  float mark = k < 0.5 ? smoothstep(r * 0.24 + 0.6, r * 0.24 - 0.6, length(vP)) : 0.0;',
    '  vec3 core = mix(mix(uBg, vCol, mix(0.2, 0.5, hold)), vCol, max(max(edge, mark), dotk));',
    '  float ca = inside * mix(mix(0.9, 1.0, max(edge, mark)), 0.85, dotk);',
    '  /* a holding carries a second ring; every node has a halo, stronger for holdings, hubs and a lit chain */',
    '  float ring = hold * smoothstep(1.2, 0.3, abs(d - 4.0)) * 0.8;',
    '  float glow = exp(-max(d, 0.0) / (r * 1.15 + 1.0)) * smoothstep(r * 3.6 + 3.0, r * 1.8, length(vP)) * (1.0 - dotk);',
    '  /* with no light to add on a pale page, a busy node shows it by a larger, denser halo */',
    '  glow *= (0.42 + 0.16 * hold + 0.2 * vS.w + 0.4 * vS.y) * mix(0.45 + 0.75 * vS.w, 1.0, uAdd);',
    '  /* dark theme: the halo adds light. Light theme: it is laid over like the rest */',
    '  vec4 o = vec4(vCol * glow, glow * (1.0 - uAdd));',
    '  o = o * (1.0 - ring) + vec4(vCol * ring, ring);',
    '  o = o * (1.0 - ca) + vec4(core * ca, ca);',
    '  gl_FragColor = o * vS.x;',
    '}'
  ].join('\n');
  /* every line is an arc from A to B: a great-circle turn between the two directions while the altitude runs from aH.x to aH.y,
     with aH.z of extra height at the middle. aH.w is its length in globe units. Links, stems, tethers, arrowheads and particles share this */
  var ARC = GLSL + [
    'attribute vec3 aA; attribute vec3 aB; attribute vec3 aFanA; attribute vec3 aFanB; attribute vec4 aH;',
    'vec3 arcA, arcB; float arcOm;',
    'void arcEnds() { arcA = fanned(aA, aFanA); arcB = fanned(aB, aFanB); arcOm = acos(clamp(dot(arcA, arcB), -1.0, 1.0)); }',
    'vec3 arc(float t) {',
    '  vec3 d = arcOm < 0.0002 ? arcA : (sin((1.0 - t) * arcOm) * arcA + sin(t * arcOm) * arcB) / max(sin(arcOm), 0.0005);',
    '  return d * R * (1.0 + mix(aH.x, aH.y, t) + aH.z * sin(3.14159265 * t));',
    '}'
  ].join('\n');
  /* ribbons: one strip per line, widened in screen space. aStyle = width, tier (0 fact, 1 inference, 2 speculative), confidence,
     kind (0 link, 1 stem, 2 tether). aState = alpha, how much of the length is drawn, lit */
  var RIB_VS = ARC + [
    'attribute vec4 aStyle; attribute vec3 aCol; attribute vec3 aState;',
    'uniform vec2 uRes; uniform float uLite;',
    'varying float vAcross; varying float vHalf; varying float vT; varying float vA; varying float vLen; varying vec4 vStyle; varying vec3 vCol; varying vec2 vSt;',
    'void main() {',
    '  float t = position.x, e = t < 0.5 ? 0.02 : -0.02;',
    '  arcEnds(); vec3 P = arc(t);',
    '  vec4 c = projectionMatrix * viewMatrix * vec4(P, 1.0), c2 = projectionMatrix * viewMatrix * vec4(arc(t + e), 1.0);',
    '  vec2 dir = (c2.xy / c2.w - c.xy / c.w) * uRes * sign(e);',
    '  dir = length(dir) > 0.0001 ? normalize(dir) : vec2(1.0, 0.0);',
    '  float hw = aStyle.x * 0.5 + (aStyle.w < 0.5 ? mix(8.0, 1.5, uLite) : 1.0);   /* links carry room for their glow */',
    '  c.xy += vec2(-dir.y, dir.x) * position.y * hw * 2.0 / uRes * c.w;',
    '  gl_Position = aState.x < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : c;',
    '  vAcross = position.y * hw; vHalf = aStyle.x * 0.5; vT = t; vA = aState.x * vis(P); vLen = aH.w; vStyle = aStyle; vCol = aCol; vSt = aState.yz;',
    '}'
  ].join('\n');
  var RIB_FS = [
    'uniform float uAdd; uniform float uLite; uniform vec3 uAccent; uniform vec3 uDash;',
    'varying float vAcross; varying float vHalf; varying float vT; varying float vA; varying float vLen; varying vec4 vStyle; varying vec3 vCol; varying vec2 vSt;',
    '/* how much of a pixel a dash covers: u counts dashes along the line, on is the drawn share of each */',
    'float dash(float u, float on) { float x = fract(u); return clamp((on * 0.5 - abs(x - on * 0.5)) / max(fwidth(u), 0.0001) + 0.5, 0.0, 1.0); }',
    'void main() {',
    '  float link = step(vStyle.w, 0.5), tier = vStyle.y, on = 1.0;',
    '  if (link > 0.5 && tier > 0.5) {',
    '    /* dashes are fixed to the arc, so they do not crawl as the globe turns. Their length follows the zoom in steps of two,',
    '       with a short blend between steps (uDash = shorter period, longer period, blend) */',
    '    float share = tier > 1.5 ? 0.34 : 0.56, k = tier > 1.5 ? 0.66 : 1.0, s = vT * vLen;',
    '    on = mix(dash(s / (uDash.x * k), share), dash(s / (uDash.y * k), share), uDash.z);',
    '  }',
    '  float grown = vSt.x >= 1.0 ? 1.0 : smoothstep(vSt.x, vSt.x - 0.03, vT);',
    '  float along = on * grown * vA * mix(1.0, mix(mix(0.82, 0.6, uAdd), 1.0, vT), link);   /* links brighten towards their target */',
    '  float a = smoothstep(vHalf + 0.6, vHalf - 0.6, abs(vAcross)) * along;',
    '  float glow = link * exp(-max(abs(vAcross) - vHalf, 0.0) / 2.8) * (0.07 + 0.2 * vStyle.z + 0.25 * vSt.y) * along * uAdd * (1.0 - uLite);',
    '  vec3 col = mix(vCol, uAccent, vSt.y);',
    '  /* dark theme: the core mostly adds light and the glow adds the accent, so lines that meet build up. Light theme: plain ink */',
    '  gl_FragColor = vec4(col * a + uAccent * glow, a * (1.0 - 0.6 * uAdd * link));',
    '}'
  ].join('\n');
  /* arrowheads: one triangle per link, just outside the glyph of the node it points at (aEnd = that glyph\'s radius) */
  var ARROW_VS = ARC + [
    'attribute vec4 aStyle; attribute vec3 aCol; attribute vec3 aState; attribute float aEnd;',
    'uniform vec2 uRes; uniform float uScale;',
    'varying float vA; varying vec3 vCol; varying float vLit;',
    'void main() {',
    '  arcEnds(); vec3 P1 = arc(1.0);',
    '  vec4 c1 = projectionMatrix * viewMatrix * vec4(P1, 1.0), c0 = projectionMatrix * viewMatrix * vec4(arc(0.93), 1.0);',
    '  vec2 s1 = c1.xy / c1.w * uRes * 0.5, d = s1 - c0.xy / c0.w * uRes * 0.5;',
    '  d = length(d) > 0.0001 ? normalize(d) : vec2(1.0, 0.0);',
    '  float len = 5.0 + aStyle.x;',
    '  vec2 p = s1 - d * (aEnd * uScale + 1.5) + d * position.x * len + vec2(-d.y, d.x) * position.y * len;',
    '  vA = aState.x * vis(P1); vCol = aCol; vLit = aState.z;',
    '  gl_Position = (aStyle.w > 0.5 || aState.y < 1.0 || vA < 0.004) ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p / (uRes * 0.5) * c1.w, c1.z, c1.w);',
    '}'
  ].join('\n');
  var ARROW_FS = [
    'uniform vec3 uAccent; varying float vA; varying vec3 vCol; varying float vLit;',
    'void main() { gl_FragColor = vec4(mix(vCol, uAccent, vLit) * vA, vA); }'
  ].join('\n');
  /* particles run from cause to effect: position is worked out here from the clock, so nothing is uploaded per frame but
     one on/off value per particle. aP = phase, laps per second, radius, confidence */
  var PART_VS = ARC + [
    'attribute vec4 aP; attribute float aState;',
    'uniform vec2 uRes; uniform float uTime;',
    'varying vec2 vP; varying float vA;',
    'void main() {',
    '  float t = fract(uTime * aP.y + aP.x);',
    '  arcEnds(); vec3 P = arc(t);',
    '  vec4 c = projectionMatrix * viewMatrix * vec4(P, 1.0);',
    '  c.xy += position.xy * aP.z * 2.0 / uRes * c.w;',
    '  /* weak links flicker slowly, as on the flat map */',
    '  float fl = aP.w < 0.3 ? 0.35 + 0.45 * (0.5 + 0.5 * sin(uTime * 12.566 + aP.x * 20.0)) : 1.0;',
    '  vA = aState * sin(3.14159265 * t) * fl * vis(P);',
    '  gl_Position = aState < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : c; vP = position.xy;',
    '}'
  ].join('\n');
  var PART_FS = [
    'uniform float uAdd; uniform vec3 uAccent; varying vec2 vP; varying float vA;',
    'void main() {',
    '  float d = dot(vP, vP), g = (0.7 * exp(-d * 9.0) + 0.25 * exp(-d * 2.6)) * smoothstep(1.0, 0.6, d) * vA;',
    '  gl_FragColor = vec4(uAccent * g * mix(1.5, 1.0, uAdd), g * mix(1.5, 0.0, uAdd));',
    '}'
  ].join('\n');
  var SHAPE = { event: 0, factor: 1, sector: 2, company: 3, holding: 4 }, SIZE = { event: 9, factor: 7, sector: 8, company: 5, holding: 7 };
  /* how far a node's glyph reaches from its centre, in units of its radius plus pixels: arrowheads stop there */
  var REACH = { event: [0.95, 0], factor: [1.2, 0], sector: [1, 0], company: [1, 0], holding: [1, 5] };
  /* how far below a node's centre its label starts, in units of its radius plus pixels */
  var DROP = { event: [0.95, 4], factor: [1.3, 4], sector: [0.95, 4], company: [1, 4], holding: [1, 9] };
  /* which label wins when two would overlap: lower is more important */
  var RANK = { holding: 0, event: 1, company: 2, sector: 3, factor: 4 };
  var LABEL_FONT = '500 13px Inter, system-ui, -apple-system, "Segoe UI", sans-serif', LH = 16;

  M.mmGlobe = function (core) {
    var host = core.host, world = null, THREE = null, dead = false, ro = null;
    var panel = core.stage.querySelector('#mm-panel');
    function stage() { return core.stage; }
    var glHost = null, loading = null, W = 0, H = 0;
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var tex = null, texCv = null, atlas = null, night = null, paintedDark = null, stars = null;
    var interacting = false, moved = false, resumeAt = 0, lastInput = 0, zoomTw = null;
    var fpsAvg = 60, lastT = 0, lastFps = 0;
    var U = { uRes: { value: [1, 1] }, uFanK: { value: 0.003 }, uScale: { value: 1 }, uAdd: { value: 1 }, uBg: { value: [0, 0, 0] }, uAccent: { value: [1, 1, 1] }, uDash: { value: [1, 2, 0] }, uTime: { value: 0 }, uLite: { value: 0 } };
    var nodeMesh = null, ribMesh = null, arrowMesh = null, partMesh = null, NI = [], RI = [], PI = [], flyTw = null, over = null, octx = null, DPR = 1;
    var labLayer = null, labPool = [], hiRes = false;
    var PV = new Float32Array(16), camAlt = 2.4, fanK = 0.003, lastLab = 0;
    var ptr = null, down = null, pick = false, offX = 0, offY = 0, shifted = false, par = { x: 0, y: 0, tx: 0, ty: 0 }, paused = false;
    var asleep = false, lastBusy = 0, changed = false, lastCam = [0, 0, 0, 0, 0], qTier = 0, slow = 0, slowSince = 0, lost = null;

    /* ---------- the surface texture: night photograph or a land mask in token colours, with borders drawn in ---------- */
    function paintTexture() {
      var c = texCv.getContext('2d'), w = texCv.width, h = texCv.height, dark = COL.dark, i, j;
      function X(lng) { return (lng + 180) / 360 * w; }
      function Y(lat) { return (90 - lat) / 180 * h; }
      var ocean = dark ? mix(COL.canvas, COL['surface-1'], 0.6) : mix(COL['surface-3'], COL.accent, 0.1), ground = dark ? COL['surface-3'] : mix(COL['surface-1'], COL['text-3'], 0.08);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (dark && night) {
        /* the photograph, then itself again as an overlay: land and sea sink towards black and the city lights lift.
           The sharper NASA photograph has more contrast of its own, so it gets less */
        c.drawImage(night, 0, 0, w, h); c.globalCompositeOperation = 'overlay'; c.globalAlpha = hiRes ? 0.3 : 0.75; c.drawImage(night, 0, 0, w, h);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      }
      else {
        c.fillStyle = ocean; c.fillRect(0, 0, w, h);
        if (atlas) {
          c.fillStyle = ground; c.beginPath();
          atlas.land.forEach(function (rings) { rings.forEach(function (pts) { pts.forEach(function (p, k) { if (k && Math.abs(p[0] - pts[k - 1][0]) < 180) c.lineTo(X(p[0]), Y(p[1])); else c.moveTo(X(p[0]), Y(p[1])); }); c.closePath(); }); });
          c.fill('evenodd'); c.fillRect(0, Y(-84.6), w, h - Y(-84.6));   /* the data stops short of the south pole */
        }
      }
      if (atlas) {
        c.lineJoin = 'round'; c.lineCap = 'round';
        [[1, dark ? 0.16 : 0.3, 1.1], [2, dark ? 0.2 : 0.22, 0.9]].forEach(function (pass) {
          c.strokeStyle = M.rgba(dark ? COL['text-2'] : COL['text-3'], pass[1]); c.lineWidth = pass[2] * w / 2048; c.beginPath();
          for (i = 0; i < atlas.arcs.length; i++) {
            if (Math.min(2, atlas.use[i]) !== pass[0]) continue;
            var a = atlas.arcs[i], pen = false;
            for (j = 0; j < a.length; j++) {
              /* skip the cut edges that the data has along the antimeridian and around the south pole */
              var edge = Math.abs(a[j][0]) > 179.9 || a[j][1] < -85;
              if (edge) { pen = false; continue; }
              if (pen && Math.abs(a[j][0] - a[j - 1][0]) > 180) pen = false;
              if (pen) c.lineTo(X(a[j][0]), Y(a[j][1])); else { c.moveTo(X(a[j][0]), Y(a[j][1])); pen = true; }
            }
          }
          c.stroke();
        });
      }
      tex.needsUpdate = true; paintedDark = dark;
      if (loading) { loading.classList.add('off'); }
    }
    function loadSurface() {
      fetch(CDN.atlas).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (t) { if (dead) return; atlas = decodeAtlas(t); paintTexture(); }).catch(function () {});
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function () { if (dead || hiRes) return; night = img; if (COL.dark) paintTexture(); };
      img.src = CDN.night;
      /* where the texture is 8k, the sharper photograph replaces the 4K one when it arrives. It is decoded and scaled down
         off the main thread where the browser can; where it cannot, the full image is drawn into the texture instead */
      if (texCv.width <= 4096 || typeof createImageBitmap !== 'function') return;
      fetch(CDN.nightHi).then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function (b) {
        return createImageBitmap(b, { resizeWidth: texCv.width, resizeHeight: texCv.height, resizeQuality: 'high' }).catch(function () { return createImageBitmap(b); });
      }).then(function (bm) { if (dead) { bm.close(); return; } night = bm; hiRes = true; if (COL.dark) paintTexture(); }).catch(function () {});
    }

    /* ---------- stars: one draw call, dark theme only ---------- */
    function makeStars() {
      var N = 1500, rnd = M.rng(11), pos = new Float32Array(N * 3), sz = new Float32Array(N), i;
      for (i = 0; i < N; i++) {
        var u = rnd() * 2 - 1, a = rnd() * 6.2832, r = Math.sqrt(1 - u * u), d = 1600 + rnd() * 900;
        pos[i * 3] = r * Math.cos(a) * d; pos[i * 3 + 1] = u * d; pos[i * 3 + 2] = r * Math.sin(a) * d;
        sz[i] = 0.7 + Math.pow(rnd(), 3) * 2.2;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      stars = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: { uCol: { value: rgb(COL['text-1']) }, uPx: { value: 1 } },
        vertexShader: 'attribute float aSize; uniform float uPx; varying float vA; void main(){ vA = clamp(aSize / 2.4, 0.25, 1.0); gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(uCol * vA * smoothstep(1.0, 0.2, d) * 0.7, 1.0); }',
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
      }));
      stars.frustumCulled = false; stars.renderOrder = -10;
      world.scene().add(stars);
    }

    /* ---------- the graph: one draw call for all nodes, one for all lines ---------- */
    function instanced(base, count, attrs) {
      var g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', base.pos); g.setIndex(base.idx); g.instanceCount = count;
      Object.keys(attrs).forEach(function (k) { var a = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * attrs[k]), attrs[k]); if (k === 'aState') a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); });
      return g;
    }
    function layer(geo, vs, fs, order) {
      var m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: vs, fragmentShader: fs, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.renderOrder = order; world.scene().add(m); return m;
    }
    function put(attr, i, v) { attr.array.set(v, i * attr.itemSize); }
    function buildGraph() {
      var nodes = core.nodes, i, n, g;
      G.place(nodes);
      /* node instances: every node, then a small dot at the true place of each node that has been fanned out */
      NI = nodes.map(function (n) { return { n: n, dot: false }; }).concat(nodes.filter(function (n) { return n.geo.fan; }).map(function (n) { return { n: n, dot: true }; }));
      var quad = { pos: new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3), idx: new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1) };
      g = instanced(quad, NI.length, { aBase: 3, aFan: 3, aCol: 3, aMeta: 4, aState: 4 });
      for (i = 0; i < NI.length; i++) {
        n = NI[i].n;
        if (NI[i].dot) { put(g.attributes.aBase, i, n.geo.home); put(g.attributes.aMeta, i, [G.SURFACE, 5, 1.6, 0]); }
        else { put(g.attributes.aBase, i, n.geo.v); if (n.geo.fan) put(g.attributes.aFan, i, n.geo.fan); put(g.attributes.aMeta, i, [n.geo.alt, SHAPE[n.type], SIZE[n.type], Math.min(1, (n.ins.length + n.outs.length) / 6)]); }
      }
      nodeMesh = layer(g, NODE_VS, NODE_FS, 30);
      /* line instances: every link, a stem under each floating node, a tether from each fanned node back to its true place */
      var links = core.links, zero = [0, 0, 0];
      links.forEach(function (l) {
        var th = G.angle(l.s.geo.v, l.t.geo.v) * Math.PI / 180, hA = l.s.geo.alt, hB = l.t.geo.alt;
        /* the further apart the ends, the higher the arc. Between two surface nodes it stays under the sector shell */
        var hp = l.s.geo.float || l.t.geo.float ? Math.min(0.12, 0.1 * th) : Math.max(0.03, Math.min(0.18, 0.28 * th));
        l.geo = { h: [hA, hB, hp], len: Math.max(4, Math.hypot(th * 100 * (1 + (hA + hB) / 2), (hB - hA) * 100) + hp * 80) };
      });
      RI = links.map(function (l) { return { l: l, kind: 'link' }; })
        .concat(nodes.filter(function (n) { return n.geo.float; }).map(function (n) { return { n: n, kind: 'stem' }; }))
        .concat(nodes.filter(function (n) { return n.geo.fan; }).map(function (n) { return { n: n, kind: 'tether' }; }));
      var SEG = links.length > 1500 ? 16 : 32, sp = new Float32Array((SEG + 1) * 6), si = new Uint16Array(SEG * 6);
      for (i = 0; i <= SEG; i++) { sp.set([i / SEG, -1, 0, i / SEG, 1, 0], i * 6); if (i < SEG) si.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6); }
      g = instanced({ pos: new THREE.BufferAttribute(sp, 3), idx: new THREE.BufferAttribute(si, 1) }, RI.length, { aA: 3, aB: 3, aFanA: 3, aFanB: 3, aH: 4, aStyle: 4, aCol: 3, aState: 3, aEnd: 1 });
      var at = g.attributes;
      for (i = 0; i < RI.length; i++) {
        var it = RI[i]; n = it.n;
        if (it.kind === 'link') {
          var l = it.l, tier = core.tier(l), rch = REACH[l.t.type];
          put(at.aA, i, l.s.geo.v); put(at.aFanA, i, l.s.geo.fan || zero); put(at.aB, i, l.t.geo.v); put(at.aFanB, i, l.t.geo.fan || zero);
          put(at.aH, i, l.geo.h.concat(l.geo.len)); put(at.aStyle, i, [1 + 3 * l.conf, tier === 'fact' ? 0 : tier === 'spec' ? 2 : 1, l.conf, 0]); put(at.aEnd, i, [SIZE[l.t.type] * rch[0] + rch[1]]);
        }
        else if (it.kind === 'stem') { put(at.aA, i, n.geo.v); put(at.aB, i, n.geo.v); put(at.aH, i, [0.004, n.geo.alt, 0, n.geo.alt * 100]); put(at.aStyle, i, [1, 0, 1, 1]); }
        else { put(at.aA, i, n.geo.home); put(at.aB, i, n.geo.v); put(at.aFanB, i, n.geo.fan); put(at.aH, i, [0.005, 0.005, 0, 1]); put(at.aStyle, i, [1, 0, 1, 2]); }
      }
      ribMesh = layer(g, RIB_VS, RIB_FS, 10);
      /* arrowheads reuse the ribbon's per-line data: only the shape differs */
      var ag = new THREE.InstancedBufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -1, 0.55, 0, -1, -0.55, 0]), 3)); ag.instanceCount = RI.length;
      ['aA', 'aB', 'aFanA', 'aFanB', 'aH', 'aStyle', 'aCol', 'aState', 'aEnd'].forEach(function (k) { ag.setAttribute(k, at[k]); });
      arrowMesh = layer(ag, ARROW_VS, ARROW_FS, 25);
      /* particles: more of them, and faster, on confident links; long arcs get proportionally more so the spacing holds.
         If the total passes the cap, the weakest links go without */
      var cap = coarse ? 1200 : 4000, used = 0, bare = 0; PI = [];
      links.slice().sort(function (a, b) { return b.conf - a.conf; }).forEach(function (l) {
        var cnt = Math.min(6, Math.ceil((l.conf >= 0.6 ? 3 : l.conf >= 0.3 ? 2 : 1) * Math.max(1, l.geo.len / 100)));
        if (used + cnt > cap) { bare++; return; } used += cnt;
        for (var j = 0; j < cnt; j++) PI.push({ l: l, j: j, cnt: cnt });
      });
      if (bare) console.info('Mind map: particle cap reached, the ' + bare + ' weakest links carry none');
      g = instanced(quad, PI.length, { aA: 3, aB: 3, aFanA: 3, aFanB: 3, aH: 4, aP: 4, aState: 1 });
      at = g.attributes;
      PI.forEach(function (p, i) {
        var l = p.l;
        put(at.aA, i, l.s.geo.v); put(at.aFanA, i, l.s.geo.fan || zero); put(at.aB, i, l.t.geo.v); put(at.aFanB, i, l.t.geo.fan || zero); put(at.aH, i, l.geo.h.concat(l.geo.len));
        put(at.aP, i, [l.phase + p.j / p.cnt, (14 + 30 * l.conf) / l.geo.len, 5 + 5 * l.conf, l.conf]);
      });
      partMesh = layer(g, PART_VS, PART_FS, 20);
      quality();
      nodes.forEach(function (n) { n.labA = 0; n.labT = 0; n.sv = 0; });
      measureLabels(); paintGraph();
    }
    function dropGraph() {
      [nodeMesh, ribMesh, arrowMesh, partMesh].forEach(function (m) { if (m) { world.scene().remove(m); m.geometry.dispose(); m.material.dispose(); } });
      nodeMesh = ribMesh = arrowMesh = partMesh = null;
    }
    /* colours are per instance, so a theme or accent change refills them */
    function paintGraph() {
      if (!nodeMesh) return;
      /* links are pale on the dark globe and near-black ink on the light one, where a mid grey would not stand out from the land */
      var a = nodeMesh.geometry.attributes.aCol, b = ribMesh.geometry.attributes.aCol, quiet = rgb(COL['text-2']), ink = rgb(COL.dark ? COL['text-2'] : COL['text-1']);
      NI.forEach(function (it, i) { put(a, i, it.dot ? quiet : rgb(COL[core.TYPE[it.n.type].c])); });
      RI.forEach(function (it, i) { put(b, i, it.kind === 'stem' ? rgb(COL[core.TYPE[it.n.type].c]) : it.kind === 'link' ? ink : quiet); });
      U.uAccent.value = rgb(COL.accent);
      a.needsUpdate = b.needsUpdate = true;
    }
    /* per-frame state from the shared animation: written every frame, uploaded only when something changed */
    function write(attr, i, v) { var arr = attr.array, o = i * attr.itemSize, ch = false; for (var k = 0; k < v.length; k++) if (arr[o + k] !== (arr[o + k] = v[k])) ch = true; return ch; }
    var tmp4 = [0, 0, 0, 0], tmp3 = [0, 1, 0], tmp1 = [0];
    function syncGraph() {
      var a = nodeMesh.geometry.attributes.aState, b = ribMesh.geometry.attributes.aState, c = partMesh.geometry.attributes.aState, i, n, l, ch = false, hover = core.hover, sel = core.sel;
      for (i = 0; i < NI.length; i++) {
        n = NI[i].n; tmp4[0] = Math.fround(n.al * n.dim * (NI[i].dot ? 0.9 : 1)); tmp4[1] = NI[i].dot ? 1 : Math.fround(n.sc * (0.6 + 0.4 * n.hA) * (n === hover ? 1.07 : 1)); tmp4[2] = n.lit || n === sel ? 1 : 0; tmp4[3] = n === sel ? 1 : 0;
        if (write(a, i, tmp4)) ch = true;
      }
      if (ch) { a.needsUpdate = true; changed = true; } ch = false;
      /* thousands of links at full strength are a white blur: the more there are, the fainter each is, unless it is lit */
      var base = COL.dark ? 0.42 : 0.5, gain = COL.dark ? 0.5 : 0.45, crowd = Math.min(1, Math.sqrt(300 / Math.max(1, core.links.length)));
      for (i = 0; i < RI.length; i++) {
        if (RI[i].kind === 'link') {
          /* a link is as strong as its confidence, as on the flat map; one in the hovered chain turns accent and brightens */
          l = RI[i].l; tmp3[0] = Math.fround(Math.min(1, ((base + gain * l.conf) * (l.lit ? 1 : crowd) + (l.lit ? 0.3 : 0)) * l.al * l.dim)); tmp3[1] = Math.fround(l.gp); tmp3[2] = l.lit ? 1 : 0;
        }
        else { n = RI[i].n; tmp3[0] = Math.fround(n.al * n.dim * Math.min(1, n.sc) * (RI[i].kind === 'stem' ? 0.34 : 0.5)); tmp3[1] = 1; tmp3[2] = 0; }
        if (write(b, i, tmp3)) ch = true;
      }
      if (ch) { b.needsUpdate = true; changed = true; } ch = false;
      /* particles rest after a minute without input, like the auto-rotate, so an unattended page can stop drawing */
      partMesh.visible = core.particlesOn && !M.rm() && !M.compact() && performance.now() - lastInput < 60000;
      if (partMesh.visible) { for (i = 0; i < PI.length; i++) { l = PI[i].l; tmp1[0] = l.gp >= 1 && l.al * l.dim >= 0.3 ? Math.fround(l.al * l.dim) : 0; if (write(c, i, tmp1)) ch = true; } if (ch) c.needsUpdate = true; }
    }

    /* ---------- labels: a 2D canvas over the globe. Small, quiet, and thinned out by zoom level and importance ---------- */
    var sc3 = [0, 0, 0, 0, 0, 0];
    function toScreen(d, r) {
      var x = d[0] * r, y = d[1] * r, z = d[2] * r, w = PV[3] * x + PV[7] * y + PV[11] * z + PV[15];
      sc3[0] = ((PV[0] * x + PV[4] * y + PV[8] * z + PV[12]) / w * 0.5 + 0.5) * W; sc3[1] = (0.5 - (PV[1] * x + PV[5] * y + PV[9] * z + PV[13]) / w * 0.5) * H;
      sc3[2] = w; sc3[3] = x; sc3[4] = y; sc3[5] = z;
    }
    function project(n) {
      var r = 100 * (1 + n.geo.alt), c = world.camera().position;
      toScreen(G.shown(n.geo, fanK), r); n.sx = sc3[0]; n.sy = sc3[1];
      /* the same test as vis() in the shaders */
      var vx = sc3[3] - c.x, vy = sc3[4] - c.y, vz = sc3[5] - c.z, s = Math.max(0, Math.min(1, -(c.x * vx + c.y * vy + c.z * vz) / (vx * vx + vy * vy + vz * vz)));
      var q = (Math.hypot(c.x + vx * s, c.y + vy * s, c.z + vz * s) - 99.2) / 1.2; q = Math.max(0, Math.min(1, q));
      n.sv = sc3[2] > 0 ? q * q * (3 - 2 * q) : 0; n.sr = SIZE[n.type] * U.uScale.value;
      /* a fanned node carries its label on the side facing away from the shared centre: 0 below, 1 right, 2 above, 3 left */
      n.side = 0;
      if (n.geo.fan) { toScreen(n.geo.v, r); var dx = n.sx - sc3[0], dy = n.sy - sc3[1]; n.side = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 0 : 2); }
    }
    /* label widths for the collision test, in the font the labels are set in. Measured again once that font has loaded */
    function measureLabels() {
      octx.font = LABEL_FONT;
      core.nodes.forEach(function (n) { n.lab = n.w ? n.label + ' · ' + n.w.toFixed(1) + '%' : n.label; n.labW = Math.ceil(octx.measureText(n.lab).width); });
      lastLab = 0;
    }
    var bx = [0, 0, 0, 0];
    function labelBox(n) {
      var dr = DROP[n.type], off = n.sr * dr[0] + dr[1];
      bx[2] = n.labW; bx[3] = LH;
      if (n.side === 1) { bx[0] = n.sx + off + 2; bx[1] = n.sy - LH / 2; }
      else if (n.side === 3) { bx[0] = n.sx - off - 2 - n.labW; bx[1] = n.sy - LH / 2; }
      else { bx[0] = n.sx - n.labW / 2; bx[1] = n.side === 2 ? n.sy - off - LH : n.sy + off; }
      /* a label near the edge of the stage slides in so it is not cut off */
      if (n.sx > 0 && n.sx < W) bx[0] = Math.max(4, Math.min(W - n.labW - 4, bx[0]));
      return bx;
    }
    function chooseLabels() {
      var nodes = core.nodes, hover = core.hover, sel = core.sel, focus = core.hasFocus ? core.focusId : null, cap = coarse ? 28 : 80, boxes = [], n, i, j;
      var level = camAlt > 2.6 ? 1 : camAlt > 1.6 ? 2 : 4;   /* far: holdings and events. Middle: plus companies. Near: sectors and factors too */
      function forced(n) { return n === hover || n === sel || n.id === focus; }
      var cand = nodes.filter(function (n) { n.labT = 0; return n.sv > 0.5 && n.al > 0.5 && n.dim > 0.5 && (RANK[n.type] <= level || n.lit || forced(n)); });
      cand.sort(function (a, b) { return (forced(b) - forced(a)) || ((b.lit ? 1 : 0) - (a.lit ? 1 : 0)) || (RANK[a.type] - RANK[b.type]) || ((b.ins.length + b.outs.length) - (a.ins.length + a.outs.length)) || (a.id < b.id ? -1 : 1); });
      for (i = 0; i < cand.length && boxes.length < cap; i++) {
        n = cand[i]; var b = labelBox(n), box = [b[0] - 4, b[1] - 2, b[2] + 8, b[3] + 4], hit = false;
        if (!forced(n)) for (j = 0; j < boxes.length && !hit; j++) hit = box[0] < boxes[j][0] + boxes[j][2] && boxes[j][0] < box[0] + box[2] && box[1] < boxes[j][1] + boxes[j][3] && boxes[j][1] < box[1] + box[3];
        if (!hit) { boxes.push(box); n.labT = 1; }
      }
    }
    function drawOverlay(ts, dt) {
      var nodes = core.nodes, i, n, k = 1 - Math.exp(-dt * 12);
      var cam = world.camera(), p = cam.projectionMatrix.elements, v = cam.matrixWorldInverse.elements, c, r;
      for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) PV[c * 4 + r] = p[r] * v[c * 4] + p[4 + r] * v[c * 4 + 1] + p[8 + r] * v[c * 4 + 2] + p[12 + r] * v[c * 4 + 3];
      for (i = 0; i < nodes.length; i++) project(nodes[i]);
      if (ts - lastLab > 100) { lastLab = ts; chooseLabels(); }
      octx.setTransform(DPR, 0, 0, DPR, 0, 0); octx.clearRect(0, 0, W, H);
      drawSigns(); drawLabels(k);
      /* keyboard focus ring, and the count of effects folded into a node */
      var focus = core.hasFocus ? core.byId[core.focusId] : null;
      if (focus && focus.sv > 0.5 && focus.al > 0.5) { octx.globalAlpha = 1; octx.beginPath(); octx.arc(focus.sx, focus.sy, reach(focus) + 6, 0, 6.2832); octx.lineWidth = 2; octx.strokeStyle = COL.accent; octx.stroke(); }
      octx.font = '600 10px Inter, system-ui, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle';
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i]; if (!(n.collapsed && n.hidden) || n.sv < 0.5 || n.al < 0.5) continue;
        var fx = n.sx + n.sr * 0.9 + 4, fy = n.sy - n.sr * 0.9 - 4;
        octx.globalAlpha = n.al * n.dim; octx.beginPath(); octx.arc(fx, fy, 9, 0, 6.2832); octx.fillStyle = COL.accent; octx.fill();
        octx.fillStyle = COL.dark ? COL.canvas : COL['surface-1']; octx.fillText('+' + n.hidden, fx, fy + 0.5);
      }
      octx.globalAlpha = 1;
    }
    /* labels are HTML text over the globe, so they stay sharp at any pixel density. A pool of spans is reused from frame to
       frame, and a span is only written to when its text, place, opacity or strength changes */
    function drawLabels(k) {
      var nodes = core.nodes, hover = core.hover, sel = core.sel, used = 0, i, n, s;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i]; if (Math.abs(n.labT - n.labA) > 0.01) changed = true; n.labA += (n.labT - n.labA) * (M.rm() ? 1 : k);
        var a = n.labA * n.sv * n.al * n.dim; if (a < 0.02) continue;
        var strong = n.lit || n === hover || n === sel, b = labelBox(n), x = Math.round(b[0]), y = Math.round(b[1]), op = Math.round(a * (strong ? 1 : 0.88) * 100) / 100;
        s = labPool[used] || (labPool[used] = labLayer.appendChild(M.el('span')));
        if (s.t !== n.lab) s.textContent = s.t = n.lab;
        if (s.x !== x || s.y !== y) { s.style.transform = 'translate(' + x + 'px, ' + y + 'px)'; s.x = x; s.y = y; }
        if (s.o !== op) s.style.opacity = s.o = op;
        if (s.s !== strong) { s.classList.toggle('on', strong); s.s = strong; }
        if (s.hidden) s.hidden = false;
        used++;
      }
      for (i = used; i < labPool.length; i++) if (!labPool[i].hidden) labPool[i].hidden = true;
    }
    /* the point a share t of the way along a link, as arc() in the shaders */
    function arcPoint(l, t) {
      var a = G.shown(l.s.geo, fanK), b = G.shown(l.t.geo, fanK), om = Math.acos(Math.max(-1, Math.min(1, G.dot(a, b)))), h = l.geo.h, d = a;
      if (om > 0.0002) { var ka = Math.sin((1 - t) * om), kb = Math.sin(t * om); d = G.unit([ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]]); }
      toScreen(d, 100 * (1 + h[0] + (h[1] - h[0]) * t + h[2] * Math.sin(Math.PI * t)));
    }
    function hidden() {
      var c = world.camera().position, vx = sc3[3] - c.x, vy = sc3[4] - c.y, vz = sc3[5] - c.z, s = Math.max(0, Math.min(1, -(c.x * vx + c.y * vy + c.z * vz) / (vx * vx + vy * vy + vz * vz)));
      return sc3[2] <= 0 || Math.hypot(c.x + vx * s, c.y + vy * s, c.z + vz * s) < 99.8;
    }
    /* the + or − of each link sits at the top of its arc. With very many links, or from far out, only those in a lit chain keep theirs */
    function drawSigns() {
      var links = core.links, many = links.length > 150, drawn = 0, i, l;
      octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.font = '600 11px Inter, system-ui, sans-serif'; octx.lineWidth = 1;
      for (i = 0; i < links.length; i++) {
        l = links[i]; var a = l.al * l.dim; if (l.gp < 1 || a < 0.05 || ((many || camAlt > 3) && !l.lit)) continue;
        if (drawn >= 150) break;
        arcPoint(l, 0.5); if (hidden()) continue; drawn++;
        var x = sc3[0], y = sc3[1];
        octx.globalAlpha = a; octx.beginPath(); octx.arc(x, y, 6.5, 0, 6.2832); octx.fillStyle = COL['surface-1']; octx.fill();
        octx.strokeStyle = M.rgba(COL['text-1'], 0.2); octx.stroke();
        octx.fillStyle = l.sign > 0 ? COL.gain : COL.loss; octx.fillText(l.sign > 0 ? '+' : '−', x, y + 0.5);
      }
      octx.globalAlpha = 1;
    }

    /* ---------- picking: nodes and links are found on screen, from the positions the overlay already works out.
       A node or link that the Earth hides cannot be picked ---------- */
    function reach(n) { var r = REACH[n.type]; return n.sr * r[0] + r[1]; }
    function nodeAt(x, y, slack) {
      var nodes = core.nodes, best = null, bd = 1e9, i, n, d;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i]; if (n.sv < 0.5 || n.al < 0.5 || n.dim < 0.1 || n.hideTo) continue;
        d = Math.hypot(n.sx - x, n.sy - y); if (d < reach(n) + slack && d < bd) { bd = d; best = n; }
      }
      return best;
    }
    function linkAt(x, y) {
      var links = core.links, best = null, bd = 7, i, k, l;
      if (links.length > 1500) return null;   /* too many to test on every move: nodes still pick */
      for (i = 0; i < links.length; i++) {
        l = links[i]; if (l.gp < 1 || l.al * l.dim < 0.1) continue;
        var px = 0, py = 0, ph = true;
        for (k = 0; k <= 12; k++) {
          arcPoint(l, k / 12); var h = hidden(), cx = sc3[0], cy = sc3[1];
          if (!h && !ph) {
            var ex = cx - px, ey = cy - py, u = Math.max(0, Math.min(1, ((x - px) * ex + (y - py) * ey) / (ex * ex + ey * ey || 1))), d = Math.hypot(x - px - ex * u, y - py - ey * u);
            if (d < bd) { bd = d; best = l; }
          }
          px = cx; py = cy; ph = h;
        }
      }
      return best;
    }
    function xy(e) { var r = glHost.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, touch: e.pointerType === 'touch', t: performance.now() }; }
    /* hover is worked out once a frame, not once per pointer event */
    function hoverPick() {
      pick = false;
      if (!ptr || ptr.touch || interacting || flyTw) return;
      var n = nodeAt(ptr.x, ptr.y, 8), l = n ? null : linkAt(ptr.x, ptr.y);
      if (n) core.overNode(n); else if (l) core.overLink(l, ptr.x, ptr.y); else if (core.hover || core.hoverLink) core.overNode(null);
      glHost.classList.toggle('pointing', !!(n || l));
    }
    function click(p) {
      var n = nodeAt(p.x, p.y, p.touch ? 14 : 8), l = n ? null : linkAt(p.x, p.y);
      if (p.touch) {
        /* no hover on a touch screen: the first tap lights the chain and shows the tooltip, a second tap on the same node opens it */
        if (n) { if (core.tipNode === n) core.choose(n); else core.overNode(n); }
        else if (l) core.overLink(l, p.x, p.y);
        else { core.overNode(null); core.closePanel(); }
      }
      else if (n) core.choose(n);
      else if (!l) core.closePanel();
    }
    function listen() {
      glHost.addEventListener('pointerdown', function (e) { down = xy(e); });
      glHost.addEventListener('pointermove', function (e) { ptr = xy(e); pick = true; });
      glHost.addEventListener('pointerup', function (e) { var p = xy(e); if (down && Math.hypot(p.x - down.x, p.y - down.y) < (p.touch ? 10 : 5) && p.t - down.t < 500) click(p); down = null; });
      glHost.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch') return; ptr = null; glHost.classList.remove('pointing'); if (core.hover || core.hoverLink) core.overNode(null); });
      glHost.addEventListener('dblclick', function (e) { var p = xy(e), n = nodeAt(p.x, p.y, 8); if (n) core.fold(n); });
      /* two-finger gestures belong to the globe, not to the page */
      ['gesturestart', 'gesturechange'].forEach(function (ev) { glHost.addEventListener(ev, function (e) { e.preventDefault(); }); });
    }

    /* ---------- quality: what is drawn steps down when there is a great deal of it, or when frames run slow ---------- */
    function ratio(pr) {
      var r = world.renderer(), c = world.postProcessingComposer();
      if (Math.abs(r.getPixelRatio() - pr) < 0.01) return;
      r.setPixelRatio(pr); r.setSize(W, H); c.setPixelRatio(pr); c.setSize(W, H);
    }
    /* tier 0: everything. 1: no glow on links. 2: half the particles. 3: fewer pixels. A very large graph starts at 1 */
    function quality() {
      var many = core.links.length > 1500, t = Math.max(qTier, many ? 1 : 0), full = Math.min(2, window.devicePixelRatio || 1);
      U.uLite.value = t >= 1 ? 1 : 0;
      if (partMesh) partMesh.geometry.instanceCount = t >= 2 ? Math.ceil(PI.length / 2) : PI.length;
      ratio(t >= 3 ? Math.max(1, full - 0.5) : full);
    }
    /* moving the window to a screen of a different pixel density draws at the new density */
    function watchRatio() {
      if (!window.matchMedia) return;
      var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      function moved() { if (mq.removeEventListener) mq.removeEventListener('change', moved); if (dead || !world) return; quality(); resize(); watchRatio(); }
      if (mq.addEventListener) mq.addEventListener('change', moved);
    }
    /* slow means well under 45 frames a second for two seconds running. A steady 30 is a display or battery cap, not a slow page */
    function govern(ts, dt) {
      if (dt > 250 || document.hidden) { slow = 0; return; }
      var capped = Math.abs(dt - 33.3) < 3;
      if (dt > 22.5 && !capped) { if (!slow) slowSince = ts; slow++; } else slow = 0;
      if (slow > 30 && ts - slowSince > 2000 && qTier < 3) { qTier++; slow = 0; quality(); console.info('Mind map: frames are slow, stepping quality down to tier ' + qTier); }
    }
    /* ---------- idle: when nothing has moved for a while the loop stops, and any input or change starts it again ---------- */
    function wake() { lastBusy = performance.now(); if (asleep && world && !paused) { asleep = false; lastT = lastBusy; world.resumeAnimation(); } }
    function rest(ts) {
      var c = world.camera(), p = c.position, v = c.view && c.view.enabled ? c.view.offsetX + c.view.offsetY : 0;
      var turned = Math.abs(p.x - lastCam[0]) + Math.abs(p.y - lastCam[1]) + Math.abs(p.z - lastCam[2]) + Math.abs(v - lastCam[3]) > 1e-4;
      lastCam[0] = p.x; lastCam[1] = p.y; lastCam[2] = p.z; lastCam[3] = v;
      if (changed || turned || flyTw || pick || core.playing || partMesh.visible || core.now() - core.growStart < 4500) lastBusy = ts;
      changed = false;
      /* this runs inside globe.gl's frame, which books the next frame as it ends: the stop has to wait until it has */
      if (ts - lastBusy > 1500 && !paused && !asleep) { asleep = true; setTimeout(function () { if (asleep && world && !paused) { world.pauseAnimation(); core.report(-2); } }, 0); }
    }
    /* a phone may take the graphics context away when the tab is in the background: wait for it to come back before giving up */
    function contextEvents() {
      var cv = world.renderer().domElement;
      cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = setTimeout(function () { if (!dead) core.fail('the graphics context was lost'); }, 3000); });
      cv.addEventListener('webglcontextrestored', function () { clearTimeout(lost); lost = null; tex.needsUpdate = true; wake(); });
    }

    /* ---------- theme: every colour comes from the tokens ---------- */
    function applyTheme() {
      if (!world) return;
      wake();
      world.backgroundColor(COL.canvas).atmosphereColor(COL.accent).showAtmosphere(COL.dark);
      stars.visible = COL.dark; stars.material.uniforms.uCol.value = rgb(COL['text-1']);
      U.uAdd.value = COL.dark ? 1 : 0; U.uBg.value = rgb(COL.canvas); paintGraph();
      if (paintedDark !== COL.dark) paintTexture();
    }

    /* ---------- auto-rotate: slow, pauses for any interaction, stops by itself after a minute without input ---------- */
    function wantRotate(t) { return core.rotateOn && !M.rm() && !interacting && !flyTw && t > resumeAt && t - lastInput < 60000 && !core.sel && !core.hover && !core.hasFocus; }
    function input() { lastInput = performance.now(); wake(); }

    /* ---------- frame hooks: globe.gl owns the loop; these run inside its render call ---------- */
    function before() {
      var ts = performance.now(), dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016), c = world.controls();
      c.autoRotate = wantRotate(ts); c.enableDamping = !M.rm();
      stars.material.uniforms.uPx.value = world.renderer().getPixelRatio();
      /* what the shaders need to know about the camera: how far out it is, and how much arc one pixel covers at the surface */
      var cam = world.camera(), d = cam.position.length();
      camAlt = d / 100 - 1; fanK = 2 * Math.tan(cam.fov * Math.PI / 360) * (d - 100) / (H * 100);
      U.uScale.value = Math.max(0.75, Math.min(1.6, Math.pow(2 / camAlt, 0.35))) * (M.compact() ? 0.9 : 1);
      /* dash length: 13 px at the middle of the globe, held to powers of two of globe units so zooming does not make dashes swim */
      var f = Math.log(13 * fanK * 100) / Math.LN2, lo = Math.floor(f), fr = f - lo;
      U.uDash.value = [Math.pow(2, lo), Math.pow(2, lo + 1), M.rm() ? Math.round(fr) : Math.max(0, Math.min(1, (fr - 0.35) / 0.3))];
      U.uTime.value = (core.now() / 1000) % 3600;
      fanK *= U.uScale.value;   /* fan rings grow with the nodes */
      U.uRes.value = [W, H]; U.uFanK.value = fanK;
      /* an open panel covers part of the stage: slide the view so the globe sits in what is left. Only the projection
         shifts, the camera does not move, so picking and labels stay exact */
      var sheet = core.sel && W <= 767 ? panel.offsetTop : 0, wantX = core.sel && W > 900 ? 190 : 0, wantY = sheet ? Math.max(0, H / 2 - (56 + sheet) / 2) : 0, k = M.rm() ? 1 : 1 - Math.exp(-dt * 8);
      offX += (wantX - offX) * k; offY += (wantY - offY) * k;
      /* Parallax: the view leans a few pixels against the pointer and the stars lag behind it. Off, or under reduced motion, nothing drifts */
      var lean = core.parallax && !M.rm() && ptr && !ptr.touch, kp = M.rm() ? 1 : 1 - Math.exp(-dt * 6);
      par.tx = lean ? (ptr.x / W - 0.5) * -14 : 0; par.ty = lean ? (ptr.y / H - 0.5) * -14 : 0;
      par.x += (par.tx - par.x) * kp; par.y += (par.ty - par.y) * kp;
      stars.rotation.y = par.x * 0.0022; stars.rotation.x = par.y * 0.0022;
      var ox = offX - par.x, oy = offY - par.y;
      if (Math.abs(ox) + Math.abs(oy) > 0.05) { cam.setViewOffset(W, H, ox, oy, W, H); shifted = true; }
      else if (shifted) { cam.clearViewOffset(); shifted = false; }
      if (pick && nodeMesh) hoverPick();
      core.targets(); core.animate(core.now(), dt);
      if (nodeMesh) syncGraph();
    }
    function after() {
      var ts = performance.now(), dt = ts - lastT; lastT = ts;
      if (nodeMesh) drawOverlay(ts, Math.min(0.05, dt / 1000));
      var tn = core.tipNode; if (tn && nodeMesh) core.tipAt(tn.sx + reach(tn), tn.sy - 8, tn.sv > 0.5 && tn.al > 0.5);
      if (dt > 0 && dt < 500) fpsAvg += (1000 / dt - fpsAvg) * 0.08;
      if (ts - lastFps > 500) { lastFps = ts; core.report(fpsAvg); }
      govern(ts, dt); rest(ts);
    }

    /* the default view: the whole globe with a margin, which on a narrow screen means standing further back */
    function home() {
      var t = Math.tan(world.camera().fov * Math.PI / 360) * Math.min(1, W / H) * 0.8;
      return { lat: HOME.lat, lng: HOME.lng, altitude: Math.max(HOME.altitude, Math.min(ALT_MAX, 1 / Math.sin(Math.atan(t)) - 1)) };
    }
    /* Fit: look straight down on the middle of the nodes that are on show, from just far enough out to take them all in.
       When they are spread over more of the Earth than can be seen at once (the whole portfolio is), it is the default view */
    function fitView() {
      var ns = core.nodes.filter(function (n) { return n.geo && !n.hideTo && n.day <= core.tl && n.dimT > 0.05; }), sum = [0, 0, 0], far = 0;
      ns.forEach(function (n) { sum[0] += n.geo.v[0]; sum[1] += n.geo.v[1]; sum[2] += n.geo.v[2]; });
      if (!ns.length || Math.hypot(sum[0], sum[1], sum[2]) < 1e-6) return home();
      /* the middle is the point that keeps the furthest node as near as possible: start from the average and step towards
         whichever node is furthest, by less each time. Never straight down on a pole, so north stays up */
      var c = G.unit(sum), i, k, a, fn;
      for (i = 1; i <= 40; i++) {
        a = -1; ns.forEach(function (n) { var x = G.angle(c, n.geo.v); if (x > a) { a = x; fn = n.geo.v; } });
        k = 1 / (i + 1); c = G.unit([c[0] + (fn[0] - c[0]) * k, c[1] + (fn[1] - c[1]) * k, c[2] + (fn[2] - c[2]) * k]);
      }
      var p = G.latlng(c); p.lat = Math.max(-58, Math.min(58, p.lat)); c = G.vec(p.lat, p.lng);
      ns.forEach(function (n) { far = Math.max(far, G.angle(c, n.geo.v)); });
      /* a holding's chain is worth a long view from far out; the whole portfolio is not, it reads better from the default view */
      if (far > (core.focusHolding ? 78 : 62)) return home();
      var d = (far + 5) * Math.PI / 180, t = Math.tan(world.camera().fov * Math.PI / 360) * Math.min(1, W / H) * 0.62;
      /* far enough out that the outermost node is inside the frame and this side of the horizon */
      return { lat: p.lat, lng: p.lng, altitude: Math.max(1, Math.min(ALT_MAX, Math.max(Math.sin(d) / t + Math.cos(d) - 1, 1 / Math.cos(Math.min(d + 0.1, 1.4)) - 1))) };
    }
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      if (!world || !W || !H) return;
      world.width(W).height(H);
      DPR = Math.min(2, window.devicePixelRatio || 1); over.width = Math.round(W * DPR); over.height = Math.round(H * DPR);
      wake();
      if (!moved && !flyTw) world.pointOfView({ altitude: fitView().altitude }, 0);
    }

    function init(three) {
      if (dead) return;
      THREE = three;
      world = new window.Globe(glHost, { waitForGlobeReady: false, animateIn: false, rendererConfig: { antialias: true, powerPreference: 'high-performance' } });
      world.enablePointerInteraction(false).showPointerCursor(false).atmosphereAltitude(0.18);
      over = M.el('canvas', 'mm-over'); host.insertBefore(over, loading); octx = over.getContext('2d');
      labLayer = M.el('div', 'mm-labels'); labLayer.setAttribute('aria-hidden', 'true'); host.insertBefore(labLayer, loading);
      resize();
      /* the surface texture is 8k on a desktop whose graphics allow it and 4K on a phone, mipmapped and filtered as sharply as the graphics allow */
      var gl = world.renderer().getContext(), cap = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), coarse ? 4096 : 8192);
      texCv = document.createElement('canvas'); texCv.width = cap; texCv.height = cap / 2;
      tex = new THREE.CanvasTexture(texCv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = world.renderer().capabilities.getMaxAnisotropy();
      tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
      world.globeMaterial(new THREE.MeshBasicMaterial({ map: tex }));
      makeStars(); buildGraph(); paintTexture(); applyTheme(); loadSurface();

      var c = world.controls();
      c.minDistance = 100 * (1 + ALT_MIN); c.maxDistance = 100 * (1 + ALT_MAX); c.zoomToCursor = false; c.autoRotateSpeed = 0.35;
      c.addEventListener('start', function () { interacting = moved = true; input(); stopFly(); if (zoomTw) zoomTw.cancel(); glHost.classList.add('grabbing'); });
      c.addEventListener('end', function () { interacting = false; resumeAt = performance.now() + 4000; input(); glHost.classList.remove('grabbing'); });
      world.pointOfView(home(), 0);
      lastInput = lastT = performance.now();
      /* an error thrown inside globe.gl's render call would stop its loop for good: report it once and keep drawing */
      var warned = false, guard = function (fn) { return function () { try { fn(); } catch (e) { if (!warned) { warned = true; console.error(e); } } }; };
      world.scene().onBeforeRender = guard(before); world.scene().onAfterRender = guard(after);
      listen(); contextEvents(); quality(); watchRatio();
      if (document.fonts && document.fonts.load) document.fonts.load(LABEL_FONT).then(function () { if (!dead && nodeMesh) measureLabels(); });
      core.replay();   /* the map grows in once there is a globe to grow on */
      if (/[?&]debug=1\b/.test(location.search)) window.__mm = { world: world, core: core };   /* a handle for checks from the console */
    }

    /* camera moves follow a great circle and stop the moment the controls are touched */
    function stopFly() { if (flyTw) { flyTw.cancel(); flyTw = null; } }
    function smooth(u) { return u * u * (3 - 2 * u); }
    function fly(to, ms) {
      stopFly(); if (zoomTw) zoomTw.cancel();
      var from = world.pointOfView(), a = G.vec(from.lat, from.lng), b = G.vec(to.lat, to.lng), om = Math.acos(Math.max(-1, Math.min(1, G.dot(a, b))));
      flyTw = M.tween(ms, function (u) {
        var d = b; if (om > 0.0002 && u < 1) { var ka = Math.sin((1 - u) * om), kb = Math.sin(u * om); d = G.unit([ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]]); }
        var p = G.latlng(d); world.pointOfView({ lat: p.lat, lng: p.lng, altitude: from.altitude + (to.altitude - from.altitude) * u }, 0);
      }, smooth, function () { flyTw = null; });
    }
    function zoomBy(f) {
      if (!world) return;
      input(); moved = true; stopFly(); if (zoomTw) zoomTw.cancel();
      var a0 = world.pointOfView().altitude, a1 = Math.max(ALT_MIN, Math.min(ALT_MAX, a0 / f));
      zoomTw = M.tween(250, function (u) { world.pointOfView({ altitude: a0 + (a1 - a0) * u }, 0); }, M.easeOut);
    }

    return {
      name: 'globe',
      start: function () {
        glHost = M.el('div', 'mm-gl'); loading = M.el('div', 'mm-loading', 'Loading the globe…'); host.appendChild(glHost); host.appendChild(loading);
        ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach(function (ev) { host.addEventListener(ev, input, { passive: true }); });
        ro = new ResizeObserver(resize); ro.observe(host);
        /* three.js needs WebGL 2. Nearly every current browser has it, so when it is missing the usual cause is a setting:
           graphics acceleration switched off, or a privacy shield blocking WebGL. Say which case it is and where to look */
        var gl2 = document.createElement('canvas').getContext('webgl2'), why = null, hint = '';
        if (gl2) { var lose = gl2.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
        else {
          why = document.createElement('canvas').getContext('webgl') ? 'this browser is only offering the older WebGL 1' : 'WebGL is switched off or blocked in this browser';
          hint = 'In Brave, Chrome or Edge: open Settings, then System, switch on “Use graphics acceleration when available” and relaunch. In Brave, also try lowering Shields for this site.';
        }
        (why ? Promise.reject(new Error(why)) : loadLibs()).then(init).catch(function (e) { if (!dead) core.fail(e && e.message || 'unknown error', hint); });
      },
      kick: function () { wake(); },
      zoomBy: zoomBy,
      fit: function () { if (world) { input(); moved = false; fly(fitView(), 700); } },
      /* the holding filter changed what is on show */
      refit: function () { if (world) { input(); moved = false; fly(fitView(), 900); } },
      /* Replay and first load: start close over the first event and pull back as the map grows */
      intro: function (animated, r0, ms) {
        if (!world) return;
        moved = false; stopFly();
        if (!animated || !r0 || !isFinite(r0.lat)) { world.pointOfView(fitView(), 0); return; }
        world.pointOfView({ lat: r0.lat, lng: r0.lng, altitude: 1.4 }, 0); fly(fitView(), Math.max(1600, ms));
      },
      /* a chosen node comes to the middle, closer in; floating nodes are viewed from a little further out */
      flyTo: function (n) {
        if (!world) return;
        var p = G.latlng(G.shown(n.geo, fanK)); input(); moved = true;
        fly({ lat: p.lat, lng: p.lng, altitude: Math.min(world.pointOfView().altitude, n.geo.float ? 1.5 : 1.35) }, 900);
      },
      /* keyboard focus on a node that is behind the Earth or off the stage: turn to it, keeping the zoom */
      reveal: function (n) {
        if (!world || (n.sv > 0.5 && n.sx > 60 && n.sx < W - 60 && n.sy > 90 && n.sy < H - 110)) return;
        var p = G.latlng(G.shown(n.geo, fanK)); input(); moved = true; fly({ lat: p.lat, lng: p.lng, altitude: world.pointOfView().altitude }, 600);
      },
      rotateBy: function (dLng, dLat) {
        if (!world) return;
        var p = world.pointOfView(); input(); moved = true; fly({ lat: Math.max(-85, Math.min(85, p.lat + dLat)), lng: p.lng + dLng, altitude: p.altitude }, 250);
      },
      setParallax: function () {},
      /* the Table covers the map: stop drawing while it is open */
      pause: function (on) { if (!world || on === paused) return; paused = on; if (on) { world.pauseAnimation(); core.report(-1); } else { asleep = false; lastBusy = lastT = performance.now(); world.resumeAnimation(); } },
      rebuild: function () { if (world) { dropGraph(); buildGraph(); } },
      /* the picture is put together from the WebGL frame, the label layer and a caption, so it carries "Sample data" wherever it goes */
      exportBlob: function (cb) {
        if (!world) return;
        var gl = world.renderer().domElement, out = document.createElement('canvas'), c = out.getContext('2d'), k = gl.width / W, cap = stage().querySelector('.mm-cap'), credit = stage().querySelector('.mm-credit');
        out.width = gl.width; out.height = gl.height;
        world.renderer().render(world.scene(), world.camera());   /* a WebGL frame can only be read back in the task that drew it */
        c.fillStyle = COL.canvas; c.fillRect(0, 0, out.width, out.height); c.drawImage(gl, 0, 0); c.drawImage(over, 0, 0, out.width, out.height);
        c.scale(k, k);
        /* the labels are HTML, so they are drawn into the picture here, as they stand on screen */
        c.font = LABEL_FONT; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = M.rgba(COL.canvas, 0.85);
        labPool.forEach(function (s) { if (s.hidden) return; c.globalAlpha = s.o; c.strokeText(s.t, s.x, s.y + LH / 2); c.fillStyle = s.s ? COL['text-1'] : COL['text-2']; c.fillText(s.t, s.x, s.y + LH / 2); });
        c.globalAlpha = 1;
        c.textBaseline = 'bottom'; c.font = '500 12px Inter, system-ui, sans-serif';
        c.fillStyle = COL['text-1']; c.fillText('Market Lens · Event mind map · ' + stage().querySelector('#mm-scope').textContent.replace(/^· /, '') + ' · Sample data', 16, H - 34);
        c.fillStyle = COL['text-3']; c.font = '400 11px Inter, system-ui, sans-serif';
        c.fillText(cap.textContent.replace(' Sample data.', ''), 16, H - 16);
        c.textAlign = 'right'; c.fillText(credit.textContent, W - 16, H - 16);
        out.toBlob(cb);
      },
      repaint: applyTheme,
      destroy: function () {
        dead = true; if (ro) ro.disconnect(); if (zoomTw) zoomTw.cancel(); stopFly();
        ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach(function (ev) { host.removeEventListener(ev, input); });
        if (world) { world.pauseAnimation(); if (world._destructor) world._destructor(); world = null; }
      }
    };
  };
})();
