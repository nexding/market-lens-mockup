/* Market Lens mockup: event mind map, globe renderer. globe.gl supplies the sphere, atmosphere, camera and controls;
   everything on top of it is drawn here. This is the one page of the mockup that uses the network: the libraries,
   the night photograph and the border data come from a CDN at pinned versions. If they cannot load, mindmap.js
   falls back to the flat map. All graph data is invented. */
(function () {
  'use strict';
  var M = window.ML, COL = M.COL;

  var CDN = {
    globe: ['https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js', 'https://unpkg.com/globe.gl@2.46.2/dist/globe.gl.min.js'],
    globeSri: 'sha384-1uolMBZ25k3zJcNwCLEv49+L+m2dZudqAzsoSAJfQTzDCSBxJzrMuZ2dkp/5JKiT',
    /* the same revision (r185) that globe.gl bundles. It must stay a module import: a global THREE breaks globe.gl */
    three: 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js',
    night: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.6/example/img/earth-night.jpg',
    atlas: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json'
  };
  var LOAD_MS = 8000, HOME = { lat: 24, lng: 12, altitude: 2.4 }, ALT_MIN = 0.6, ALT_MAX = 5;

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

  M.mmGlobe = function (core) {
    var host = core.host, world = null, THREE = null, dead = false, ro = null;
    var glHost = null, loading = null, W = 0, H = 0;
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var tex = null, texCv = null, atlas = null, night = null, paintedDark = null, stars = null;
    var interacting = false, moved = false, resumeAt = 0, lastInput = 0, zoomTw = null;
    var fpsAvg = 60, lastT = 0, lastFps = 0;

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

    /* ---------- theme: every colour comes from the tokens ---------- */
    function applyTheme() {
      if (!world) return;
      world.backgroundColor(COL.canvas).atmosphereColor(COL.accent).showAtmosphere(COL.dark);
      stars.visible = COL.dark; stars.material.uniforms.uCol.value = rgb(COL['text-1']);
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
      core.targets(); core.animate(core.now(), dt);
    }
    function after() {
      var ts = performance.now(), dt = ts - lastT; lastT = ts;
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
      if (!moved) world.pointOfView({ altitude: home().altitude }, 0);
    }

    function init(three) {
      if (dead) return;
      THREE = three;
      world = new window.Globe(glHost, { waitForGlobeReady: false, animateIn: false, rendererConfig: { antialias: true, powerPreference: 'high-performance' } });
      world.enablePointerInteraction(false).showPointerCursor(false).atmosphereAltitude(0.18);
      resize();
      var gl = world.renderer().getContext(), cap = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), coarse ? 2048 : 4096);
      texCv = document.createElement('canvas'); texCv.width = cap; texCv.height = cap / 2;
      tex = new THREE.CanvasTexture(texCv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, world.renderer().capabilities.getMaxAnisotropy());
      world.globeMaterial(new THREE.MeshBasicMaterial({ map: tex }));
      makeStars(); paintTexture(); applyTheme(); loadSurface();

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
      intro: function () {}, flyTo: function () {}, reveal: function () {}, setParallax: function () {}, rebuild: function () {},
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
