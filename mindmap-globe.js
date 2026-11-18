/* Market Lens mockup: event mind map, globe renderer. globe.gl supplies the sphere, atmosphere, camera and controls;
   everything on top of it is drawn here. This is the one page of the mockup that uses the network: the libraries,
   the night photograph and the border data come from a CDN at pinned versions. If they cannot load, mindmap.js
   falls back to the flat map. All graph data is invented. */
(function () {
  'use strict';
  var M = window.ML, COL = M.COL, G = M.mmGeo;

  var CDN = {
    globe: ['https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js', 'https://unpkg.com/globe.gl@2.46.2/dist/globe.gl.min.js'],
    globeSri: 'sha384-1uolMBZ25k3zJcNwCLEv49+L+m2dZudqAzsoSAJfQTzDCSBxJzrMuZ2dkp/5JKiT',
    /* the same revision (r185) that globe.gl bundles. It must stay a module import: a global THREE breaks globe.gl */
    three: 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js',
    night: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.6/example/img/earth-night.jpg',
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
    '  glow *= (0.42 + 0.16 * hold + 0.2 * vS.w + 0.4 * vS.y) * mix(0.5, 1.0, uAdd);',
    '  /* dark theme: the halo adds light. Light theme: it is laid over like the rest */',
    '  vec4 o = vec4(vCol * glow, glow * (1.0 - uAdd));',
    '  o = o * (1.0 - ring) + vec4(vCol * ring, ring);',
    '  o = o * (1.0 - ca) + vec4(core * ca, ca);',
    '  gl_FragColor = o * vS.x;',
    '}'
  ].join('\n');
  /* ribbons: one strip per line, bent along the globe in the vertex shader. aH = altitude at the start, at the end, extra height
     at the middle. aStyle = width, tier, confidence, kind. aState = alpha, how much of the length is drawn */
  var RIB_VS = GLSL + [
    'attribute vec3 aA; attribute vec3 aB; attribute vec3 aFanA; attribute vec3 aFanB; attribute vec3 aH; attribute vec4 aStyle; attribute vec3 aCol; attribute vec2 aState;',
    'uniform vec2 uRes;',
    'varying float vAcross; varying float vHalf; varying float vT; varying float vA; varying vec4 vStyle; varying vec3 vCol;',
    'vec3 at(vec3 a, vec3 b, float om, float t) {',
    '  vec3 d = om < 0.0002 ? a : (sin((1.0 - t) * om) * a + sin(t * om) * b) / sin(om);',
    '  return d * R * (1.0 + mix(aH.x, aH.y, t) + aH.z * sin(3.14159265 * t));',
    '}',
    'void main() {',
    '  float t = position.x, e = t < 0.5 ? 0.02 : -0.02;',
    '  vec3 a = fanned(aA, aFanA), b = fanned(aB, aFanB); float om = acos(clamp(dot(a, b), -1.0, 1.0));',
    '  vec3 P = at(a, b, om, t);',
    '  vec4 c = projectionMatrix * viewMatrix * vec4(P, 1.0), c2 = projectionMatrix * viewMatrix * vec4(at(a, b, om, t + e), 1.0);',
    '  vec2 dir = (c2.xy / c2.w - c.xy / c.w) * uRes * sign(e);',
    '  dir = length(dir) > 0.0001 ? normalize(dir) : vec2(1.0, 0.0);',
    '  float hw = aStyle.x * 0.5 + 1.0;',
    '  c.xy += vec2(-dir.y, dir.x) * position.y * hw * 2.0 / uRes * c.w;',
    '  gl_Position = aState.x < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : c;',
    '  vAcross = position.y * hw; vHalf = aStyle.x * 0.5; vT = t; vA = aState.x * vis(P); vStyle = aStyle; vCol = aCol;',
    '}'
  ].join('\n');
  var RIB_FS = [
    'varying float vAcross; varying float vHalf; varying float vT; varying float vA; varying vec4 vStyle; varying vec3 vCol;',
    'void main() {',
    '  float a = smoothstep(vHalf + 0.6, vHalf - 0.6, abs(vAcross)) * vA;',
    '  gl_FragColor = vec4(vCol * a, a);',
    '}'
  ].join('\n');
  var SEG = 32, SHAPE = { event: 0, factor: 1, sector: 2, company: 3, holding: 4 }, SIZE = { event: 9, factor: 7, sector: 8, company: 5, holding: 7 };
  /* how far below a node's centre its label starts, in units of its radius plus pixels */
  var DROP = { event: [0.95, 4], factor: [1.3, 4], sector: [0.95, 4], company: [1, 4], holding: [1, 9] }, RANK = { event: 0, holding: 1, factor: 2, sector: 3, company: 4 };

  M.mmGlobe = function (core) {
    var host = core.host, world = null, THREE = null, dead = false, ro = null;
    var glHost = null, loading = null, W = 0, H = 0;
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var tex = null, texCv = null, atlas = null, night = null, paintedDark = null, stars = null;
    var interacting = false, moved = false, resumeAt = 0, lastInput = 0, zoomTw = null;
    var fpsAvg = 60, lastT = 0, lastFps = 0;
    var U = { uRes: { value: [1, 1] }, uFanK: { value: 0.003 }, uScale: { value: 1 }, uAdd: { value: 1 }, uBg: { value: [0, 0, 0] } };
    var nodeMesh = null, ribMesh = null, NI = [], RI = [], over = null, octx = null, DPR = 1, mono = 'monospace';
    var PV = new Float32Array(16), camAlt = 2.4, fanK = 0.003, lastLab = 0;

    /* ---------- the surface texture: night photograph or a land mask in token colours, with borders drawn in ---------- */
    function paintTexture() {
      var c = texCv.getContext('2d'), w = texCv.width, h = texCv.height, dark = COL.dark, i, j;
      function X(lng) { return (lng + 180) / 360 * w; }
      function Y(lat) { return (90 - lat) / 180 * h; }
      var ocean = dark ? mix(COL.canvas, COL['surface-1'], 0.6) : mix(COL['surface-3'], COL.accent, 0.1), ground = dark ? COL['surface-3'] : mix(COL['surface-1'], COL['text-3'], 0.08);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (dark && night) {
        /* the photograph, then itself again as an overlay: land and sea sink towards black and the city lights lift */
        c.drawImage(night, 0, 0, w, h); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.75; c.drawImage(night, 0, 0, w, h);
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
      img.onload = function () { if (dead) return; night = img; if (COL.dark) paintTexture(); };
      img.src = CDN.night;
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
      /* line instances: a stem under each floating node, a tether from each fanned node back to its true place */
      RI = nodes.filter(function (n) { return n.geo.float; }).map(function (n) { return { n: n, kind: 'stem' }; }).concat(nodes.filter(function (n) { return n.geo.fan; }).map(function (n) { return { n: n, kind: 'tether' }; }));
      var sp = new Float32Array((SEG + 1) * 6), si = new Uint16Array(SEG * 6);
      for (i = 0; i <= SEG; i++) { sp.set([i / SEG, -1, 0, i / SEG, 1, 0], i * 6); if (i < SEG) si.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6); }
      g = instanced({ pos: new THREE.BufferAttribute(sp, 3), idx: new THREE.BufferAttribute(si, 1) }, RI.length, { aA: 3, aB: 3, aFanA: 3, aFanB: 3, aH: 3, aStyle: 4, aCol: 3, aState: 2 });
      for (i = 0; i < RI.length; i++) {
        n = RI[i].n; put(g.attributes.aStyle, i, [1, 0, 1, RI[i].kind === 'stem' ? 1 : 2]);
        if (RI[i].kind === 'stem') { put(g.attributes.aA, i, n.geo.v); put(g.attributes.aB, i, n.geo.v); put(g.attributes.aH, i, [0.004, n.geo.alt, 0]); }
        else { put(g.attributes.aA, i, n.geo.home); put(g.attributes.aB, i, n.geo.v); put(g.attributes.aFanB, i, n.geo.fan); put(g.attributes.aH, i, [0.005, 0.005, 0]); }
      }
      ribMesh = layer(g, RIB_VS, RIB_FS, 10);
      octx.font = '500 10.5px ' + mono;
      nodes.forEach(function (n) { n.lab = n.w ? n.label + ' · ' + n.w.toFixed(1) + '%' : n.label; n.labW = octx.measureText(n.lab).width; n.labA = 0; n.labT = 0; n.sv = 0; });
      paintGraph(); lastLab = 0;
    }
    function dropGraph() {
      [nodeMesh, ribMesh].forEach(function (m) { if (m) { world.scene().remove(m); m.geometry.dispose(); m.material.dispose(); } });
      nodeMesh = ribMesh = null;
    }
    /* colours are per instance, so a theme or accent change refills them */
    function paintGraph() {
      if (!nodeMesh) return;
      var a = nodeMesh.geometry.attributes.aCol, b = ribMesh.geometry.attributes.aCol, quiet = rgb(COL['text-2']);
      NI.forEach(function (it, i) { put(a, i, it.dot ? quiet : rgb(COL[core.TYPE[it.n.type].c])); });
      RI.forEach(function (it, i) { put(b, i, it.kind === 'stem' ? rgb(COL[core.TYPE[it.n.type].c]) : quiet); });
      a.needsUpdate = b.needsUpdate = true;
    }
    /* per-frame state from the shared animation: written every frame, uploaded only when something changed */
    function write(attr, i, v) { var arr = attr.array, o = i * attr.itemSize, ch = false; for (var k = 0; k < v.length; k++) if (arr[o + k] !== (arr[o + k] = v[k])) ch = true; return ch; }
    var tmp4 = [0, 0, 0, 0], tmp2 = [0, 1];
    function syncGraph() {
      var a = nodeMesh.geometry.attributes.aState, b = ribMesh.geometry.attributes.aState, i, n, ch = false, hover = core.hover, sel = core.sel;
      for (i = 0; i < NI.length; i++) {
        n = NI[i].n; tmp4[0] = Math.fround(n.al * n.dim * (NI[i].dot ? 0.9 : 1)); tmp4[1] = NI[i].dot ? 1 : Math.fround(n.sc * (0.6 + 0.4 * n.hA) * (n === hover ? 1.07 : 1)); tmp4[2] = n.lit || n === sel ? 1 : 0; tmp4[3] = n === sel ? 1 : 0;
        if (write(a, i, tmp4)) ch = true;
      }
      if (ch) a.needsUpdate = true; ch = false;
      for (i = 0; i < RI.length; i++) { n = RI[i].n; tmp2[0] = Math.fround(n.al * n.dim * Math.min(1, n.sc) * (RI[i].kind === 'stem' ? 0.34 : 0.5)); if (write(b, i, tmp2)) ch = true; }
      if (ch) b.needsUpdate = true;
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
    var LH = 13, bx = [0, 0, 0, 0];
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
      var level = camAlt > 2.6 ? 1 : camAlt > 1.6 ? 3 : 4;   /* far: events and holdings. Middle: plus factors and sectors. Near: everything */
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
      var nodes = core.nodes, i, n, k = 1 - Math.exp(-dt * 12), hover = core.hover, sel = core.sel;
      var cam = world.camera(), p = cam.projectionMatrix.elements, v = cam.matrixWorldInverse.elements, c, r;
      for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) PV[c * 4 + r] = p[r] * v[c * 4] + p[4 + r] * v[c * 4 + 1] + p[8 + r] * v[c * 4 + 2] + p[12 + r] * v[c * 4 + 3];
      for (i = 0; i < nodes.length; i++) project(nodes[i]);
      if (ts - lastLab > 100) { lastLab = ts; chooseLabels(); }
      octx.setTransform(DPR, 0, 0, DPR, 0, 0); octx.clearRect(0, 0, W, H);
      octx.font = '500 10.5px ' + mono; octx.textAlign = 'left'; octx.textBaseline = 'top'; octx.lineJoin = 'round'; octx.lineWidth = 3;
      octx.strokeStyle = M.rgba(COL.canvas, COL.dark ? 0.8 : 0.9);
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i]; n.labA += (n.labT - n.labA) * (M.rm() ? 1 : k);
        var a = n.labA * n.sv * n.al * n.dim; if (a < 0.02) continue;
        var strong = n.lit || n === hover || n === sel, b = labelBox(n), x = Math.round(b[0]), y = Math.round(b[1]);
        octx.globalAlpha = a * (strong ? 1 : 0.86); octx.strokeText(n.lab, x, y);
        octx.fillStyle = strong ? COL['text-1'] : COL['text-2']; octx.fillText(n.lab, x, y);
      }
      octx.globalAlpha = 1;
    }

    /* ---------- theme: every colour comes from the tokens ---------- */
    function applyTheme() {
      if (!world) return;
      world.backgroundColor(COL.canvas).atmosphereColor(COL.accent).showAtmosphere(COL.dark);
      stars.visible = COL.dark; stars.material.uniforms.uCol.value = rgb(COL['text-1']);
      U.uAdd.value = COL.dark ? 1 : 0; U.uBg.value = rgb(COL.canvas); paintGraph();
      if (paintedDark !== COL.dark) paintTexture();
    }

    /* ---------- auto-rotate: slow, pauses for any interaction, stops by itself after a minute without input ---------- */
    function wantRotate(t) { return !M.rm() && !interacting && t > resumeAt && t - lastInput < 60000 && !core.sel && !core.hover && !core.hasFocus; }
    function input() { lastInput = performance.now(); }

    /* ---------- frame hooks: globe.gl owns the loop; these run inside its render call ---------- */
    function before() {
      var ts = performance.now(), dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016), c = world.controls();
      c.autoRotate = wantRotate(ts); c.enableDamping = !M.rm();
      stars.material.uniforms.uPx.value = world.renderer().getPixelRatio();
      /* what the shaders need to know about the camera: how far out it is, and how much arc one pixel covers at the surface */
      var cam = world.camera(), d = cam.position.length();
      camAlt = d / 100 - 1; fanK = 2 * Math.tan(cam.fov * Math.PI / 360) * (d - 100) / (H * 100);
      U.uScale.value = Math.max(0.75, Math.min(1.6, Math.pow(2 / camAlt, 0.35)));
      fanK *= U.uScale.value;   /* fan rings grow with the nodes */
      U.uRes.value = [W, H]; U.uFanK.value = fanK;
      core.targets(); core.animate(core.now(), dt);
      if (nodeMesh) syncGraph();
    }
    function after() {
      var ts = performance.now(), dt = ts - lastT; lastT = ts;
      if (nodeMesh) drawOverlay(ts, Math.min(0.05, dt / 1000));
      if (dt > 0 && dt < 500) fpsAvg += (1000 / dt - fpsAvg) * 0.08;
      if (ts - lastFps > 500) { lastFps = ts; core.report(fpsAvg); }
    }

    /* the default view: the whole globe with a margin, which on a narrow screen means standing further back */
    function home() {
      var t = Math.tan(world.camera().fov * Math.PI / 360) * Math.min(1, W / H) * 0.8;
      return { lat: HOME.lat, lng: HOME.lng, altitude: Math.max(HOME.altitude, Math.min(ALT_MAX, 1 / Math.sin(Math.atan(t)) - 1)) };
    }
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      if (!world || !W || !H) return;
      world.width(W).height(H);
      DPR = Math.min(2, window.devicePixelRatio || 1); over.width = Math.round(W * DPR); over.height = Math.round(H * DPR);
      if (!moved) world.pointOfView({ altitude: home().altitude }, 0);
    }

    function init(three) {
      if (dead) return;
      THREE = three;
      world = new window.Globe(glHost, { waitForGlobeReady: false, animateIn: false, rendererConfig: { antialias: true, powerPreference: 'high-performance' } });
      world.enablePointerInteraction(false).showPointerCursor(false).atmosphereAltitude(0.18);
      over = M.el('canvas', 'mm-over'); host.insertBefore(over, loading); octx = over.getContext('2d');
      mono = getComputedStyle(core.stage).getPropertyValue('--mm-mono').trim() || 'monospace';
      resize();
      var gl = world.renderer().getContext(), cap = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), coarse ? 2048 : 4096);
      texCv = document.createElement('canvas'); texCv.width = cap; texCv.height = cap / 2;
      tex = new THREE.CanvasTexture(texCv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, world.renderer().capabilities.getMaxAnisotropy());
      world.globeMaterial(new THREE.MeshBasicMaterial({ map: tex }));
      makeStars(); buildGraph(); paintTexture(); applyTheme(); loadSurface();

      var c = world.controls();
      c.minDistance = 100 * (1 + ALT_MIN); c.maxDistance = 100 * (1 + ALT_MAX); c.zoomToCursor = false; c.autoRotateSpeed = 0.35;
      c.addEventListener('start', function () { interacting = moved = true; input(); if (zoomTw) zoomTw.cancel(); glHost.classList.add('grabbing'); });
      c.addEventListener('end', function () { interacting = false; resumeAt = performance.now() + 4000; input(); glHost.classList.remove('grabbing'); });
      world.pointOfView(home(), 0);
      lastInput = lastT = performance.now();
      world.scene().onBeforeRender = before; world.scene().onAfterRender = after;
      if (/[?&]debug=1\b/.test(location.search)) window.__mm = { world: world, core: core };   /* a handle for checks from the console */
    }

    function zoomBy(f) {
      if (!world) return;
      input(); moved = true; if (zoomTw) zoomTw.cancel();
      var a0 = world.pointOfView().altitude, a1 = Math.max(ALT_MIN, Math.min(ALT_MAX, a0 / f));
      zoomTw = M.tween(250, function (u) { world.pointOfView({ altitude: a0 + (a1 - a0) * u }, 0); }, M.easeOut);
    }

    return {
      name: 'globe',
      start: function () {
        glHost = M.el('div', 'mm-gl'); loading = M.el('div', 'mm-loading', 'Loading the globe…'); host.appendChild(glHost); host.appendChild(loading);
        ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach(function (ev) { host.addEventListener(ev, input, { passive: true }); });
        ro = new ResizeObserver(resize); ro.observe(host);
        var probe = document.createElement('canvas').getContext('webgl2');
        (probe ? loadLibs() : Promise.reject(new Error('this browser has no WebGL 2'))).then(init).catch(function (e) { if (!dead) core.fail(e && e.message || 'unknown error'); });
      },
      kick: function () {},
      zoomBy: zoomBy,
      fit: function () { if (world) { input(); moved = false; world.pointOfView(home(), M.rm() ? 0 : 700); } },
      intro: function () {}, flyTo: function () {}, reveal: function () {}, setParallax: function () {},
      rebuild: function () { if (world) { dropGraph(); buildGraph(); } },
      exportBlob: function (cb) { if (!world) return; world.renderer().render(world.scene(), world.camera()); world.renderer().domElement.toBlob(cb); },
      repaint: applyTheme,
      destroy: function () {
        dead = true; if (ro) ro.disconnect(); if (zoomTw) zoomTw.cancel();
        ['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach(function (ev) { host.removeEventListener(ev, input); });
        if (world) { world.pauseAnimation(); if (world._destructor) world._destructor(); world = null; }
      }
    };
  };
})();
