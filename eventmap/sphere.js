/* Event Map: the sphere view. Latitude is time, longitude is category. Nodes are one instanced mesh, arcs are two merged
   fat-line meshes (direct solid, contributing dashed), arrowheads one instanced mesh, the grid one line mesh. Fading of
   the far side happens in the shaders, so a frame allocates nothing and only uploads what changed. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { arcFrame, arcPoint, arcTangent } from './arcs.js';
import { wedgeCenter } from './layout.js';

/* colours are given in sRGB hex and should come out exactly as written */
THREE.ColorManagement.enabled = false;

const S = { NORMAL: 0, DIM: 1, UP: 2, DOWN: 3, SEL: 4, HIDDEN: 5 };
const NODE_R = 0.016;
const ARROW_T_GAP = 0.03;          /* world distance from the arrow tip to the effect node's edge */
const SEGS = [32, 32, 16, 16];      /* arc segments per quality tier */
const IDLE_MS = 8000;
const TWEEN_MS = 900;
const LABEL_POOL = 60;

const FADE_GLSL = `
uniform vec3 uCamDir; uniform float uLimb; uniform float uFar;
float emFade( vec3 p ) {
  float d = dot( normalize( p ), uCamDir );
  return mix( uFar, 1.0, smoothstep( uLimb - 0.22, uLimb + 0.04, d ) );
}
`;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

/* ctx: { graph, lay, colors: {cats[], up, down, grid, divider, body, rim, text}, rm(), onSelect(idx), onHover(idx),
   tip: {show(html, x, y), hide()}, onTier(tier, fps), onLost() } */
export function mountSphere(host, ctx) {
  const { graph, lay } = ctx;
  const N = graph.nodes.length, E = graph.links.length;
  const C = (hex) => new THREE.Color(hex);
  const col = {
    cats: ctx.colors.cats.map(C), up: C(ctx.colors.up), down: C(ctx.colors.down),
    grid: C(ctx.colors.grid), divider: C(ctx.colors.divider), body: C(ctx.colors.body), rim: C(ctx.colors.rim)
  };
  const listeners = [];
  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); listeners.push([el, type, fn, opt]); };

  /* ---------- renderer, camera, controls ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(baseDpr);
  renderer.domElement.className = 'em-gl';
  host.appendChild(renderer.domElement);
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'em-labels';
  host.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  const world = new THREE.Group();
  scene.add(world);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.55, zoomSpeed: 0.7,
    minDistance: 1.7, maxDistance: 7, minPolarAngle: 0.12, maxPolarAngle: Math.PI - 0.12, autoRotateSpeed: 0.35
  });
  const HOME = { polar: 78 * Math.PI / 180, theta: 0, yaw: -Math.PI };

  const U = { uCamDir: { value: new THREE.Vector3(0, 0, 1) }, uLimb: { value: 0.3 }, uFar: { value: 0.15 } };

  /* ---------- body: a faint shell with a rim, so the sphere reads as a solid ---------- */
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col.body }, uRim: { value: col.rim } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform vec3 uRim; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - max(dot(vN, vV), 0.0); float rim = pow(f, 2.6); gl_FragColor = vec4(uColor + uRim * rim, 0.42 + 0.4 * rim); }',
    transparent: true, depthWrite: false
  }));
  body.renderOrder = -10;
  world.add(body);

  /* ---------- grid: year rings as latitude lines, meridians every 15°, wedge dividers brighter ---------- */
  const grid = (() => {
    const pos = [], alp = [], rgb = [];
    const push = (a, b, alpha, c) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); alp.push(alpha, alpha); rgb.push(c.r, c.g, c.b, c.r, c.g, c.b); };
    const p = (pol, az) => [Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)];
    const y0 = Math.ceil(lay.t0 / 12), y1 = Math.floor(lay.t1 / 12);
    for (let y = y0; y <= y1; y++) {
      const pol = lay.polarOf(y * 12);
      for (let i = 0; i < 128; i++) push(p(pol, i / 128 * Math.PI * 2), p(pol, (i + 1) / 128 * Math.PI * 2), 0.2, col.grid);
    }
    for (let m = 0; m < 24; m++) {
      const az = m / 24 * Math.PI * 2, div = m % 4 === 0;
      for (let i = 0; i < 64; i++) push(p(i / 64 * Math.PI, az), p((i + 1) / 64 * Math.PI, az), div ? 0.5 : 0.12, div ? col.divider : col.grid);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aA', new THREE.Float32BufferAttribute(alp, 1));
    g.setAttribute('aC', new THREE.Float32BufferAttribute(rgb, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: FADE_GLSL + 'attribute float aA; attribute vec3 aC; varying float vA; varying vec3 vC; void main(){ vA = aA * emFade((modelMatrix * vec4(position, 1.0)).xyz); vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 1.001, 1.0); }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, vA); }',
      transparent: true, depthWrite: false
    });
    const ls = new THREE.LineSegments(g, m);
    ls.renderOrder = -5;
    return ls;
  })();
  world.add(grid);

  /* ---------- nodes and arrowheads: instanced, one shader ---------- */
  const instVS = FADE_GLSL + `
    attribute vec3 aColor; attribute vec2 aStyle;
    varying vec3 vColor; varying float vA; varying vec3 vN;
    void main() {
      vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vA = aStyle.x * emFade(c.xyz);
      vColor = aColor;
      vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * aStyle.y, 1.0);
    }`;
  const instFS = `
    varying vec3 vColor; varying float vA; varying vec3 vN;
    void main() {
      if (vA < 0.01) discard;
      float l = 0.6 + 0.4 * max(vN.z, 0.0);
      float rim = pow(1.0 - max(vN.z, 0.0), 2.0) * 0.35;
      gl_FragColor = vec4(vColor * l + vec3(rim), vA);
    }`;
  const nodeMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: instVS, fragmentShader: instFS, transparent: true });
  const nodes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), nodeMat, Math.max(1, N));
  nodes.count = N;
  nodes.frustumCulled = false;
  nodes.renderOrder = 1;
  const nColor = new Float32Array(Math.max(1, N) * 3), nStyle = new Float32Array(Math.max(1, N) * 2);
  nodes.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(nColor, 3).setUsage(THREE.DynamicDrawUsage));
  nodes.geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(nStyle, 2).setUsage(THREE.DynamicDrawUsage));
  const baseR = new Float32Array(N);
  const nodeLocal = lay.pos.map((p) => new THREE.Vector3(p.v[0], p.v[1], p.v[2]));
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      baseR[i] = NODE_R * (1 + 0.12 * Math.sqrt(graph.nodes[i].degree));
      s.setScalar(baseR[i]);
      m.compose(nodeLocal[i].clone().multiplyScalar(1.004), q, s);
      nodes.setMatrixAt(i, m);
    }
    nodes.instanceMatrix.needsUpdate = true;
  }
  world.add(nodes);

  const coneGeo = new THREE.ConeGeometry(0.62, 1.9, 10);
  coneGeo.translate(0, -0.95, 0);   /* tip at the origin, pointing along +y */
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: instVS, fragmentShader: instFS, transparent: true, depthWrite: false }), Math.max(1, E));
  cones.count = E;
  cones.frustumCulled = false;
  cones.renderOrder = 3;
  const cColor = new Float32Array(Math.max(1, E) * 3), cStyle = new Float32Array(Math.max(1, E) * 2);
  cones.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(cColor, 3).setUsage(THREE.DynamicDrawUsage));
  cones.geometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(cStyle, 2).setUsage(THREE.DynamicDrawUsage));
  world.add(cones);

  /* the selected node's halo: one additive sprite */
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  halo.visible = false;
  halo.renderOrder = 4;
  world.add(halo);

  /* ---------- arcs ---------- */
  let lines = null;   /* { solid, dashed, edgeGeo: Uint8Array, edgeStart: Uint32Array, segs, segEdge: [Uint16Array, Uint16Array] } */
  const lineMats = [];
  function patchLine(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uCamDir = U.uCamDir; sh.uniforms.uLimb = U.uLimb; sh.uniforms.uFar = U.uFar;
      sh.vertexShader = sh.vertexShader
        .replace('attribute vec3 instanceStart;', 'attribute vec3 instanceStart;\nattribute vec2 instanceStyle;\nvarying float vEmA;\n' + FADE_GLSL)
        .replace('void main() {', 'void main() {\n\tvec3 emP = ( position.y < 0.5 ) ? instanceStart : instanceEnd;\n\tvEmA = instanceStyle.x * emFade( ( modelMatrix * vec4( emP, 1.0 ) ).xyz );')
        .replace('offset *= linewidth;', 'offset *= linewidth * instanceStyle.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'varying float vEmA;\nvoid main() {\n\tif ( vEmA < 0.004 ) discard;')
        .replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', 'gl_FragColor = vec4( diffuseColor.rgb, alpha * vEmA );');
    };
  }
  function buildLines(segs) {
    if (lines) { [lines.solid, lines.dashed].forEach((o) => { world.remove(o); o.geometry.dispose(); }); }
    const edgeGeo = new Uint8Array(E), edgeStart = new Uint32Array(E), count = [0, 0];
    graph.links.forEach((l, i) => { edgeGeo[i] = l.type === 'contributing' ? 1 : 0; edgeStart[i] = count[edgeGeo[i]]; count[edgeGeo[i]] += segs; });
    const pos = [new Float32Array(Math.max(1, count[0]) * 6), new Float32Array(Math.max(1, count[1]) * 6)];
    const dist = [null, new Float32Array(Math.max(1, count[1]) * 2)];
    const segEdge = [new Uint16Array(Math.max(1, count[0])), new Uint16Array(Math.max(1, count[1]))];
    const pt = new Float64Array((segs + 1) * 3);
    const tmp = [0, 0, 0];
    graph.links.forEach((l, i) => {
      const a = lay.pos[l.s].v, b = lay.pos[l.t].v, f = arcFrame(a, b);
      for (let k = 0; k <= segs; k++) arcPoint(f, k / segs, pt, k * 3);
      const g = edgeGeo[i], P = pos[g];
      let d = 0;
      for (let k = 0; k < segs; k++) {
        const si = edgeStart[i] + k, o = si * 6;
        for (let j = 0; j < 6; j++) P[o + j] = pt[k * 3 + j];
        segEdge[g][si] = i;
        if (g === 1) {
          const len = Math.hypot(pt[k * 3 + 3] - pt[k * 3], pt[k * 3 + 4] - pt[k * 3 + 1], pt[k * 3 + 5] - pt[k * 3 + 2]);
          dist[1][si * 2] = d; d += len; dist[1][si * 2 + 1] = d;
        }
      }
      /* the arrowhead: near the effect, tip just outside the effect node */
      let len = 0;
      for (let k = 0; k < segs; k++) len += Math.hypot(pt[k * 3 + 3] - pt[k * 3], pt[k * 3 + 4] - pt[k * 3 + 1], pt[k * 3 + 5] - pt[k * 3 + 2]);
      const tTip = Math.max(0.5, 1 - (baseR[l.t] + ARROW_T_GAP) / Math.max(len, 1e-6));
      arcPoint(f, tTip, tmp);
      _v1.set(tmp[0], tmp[1], tmp[2]);
      arcTangent(f, tTip, tmp);
      _v2.set(tmp[0], tmp[1], tmp[2]);
      _q.setFromUnitVectors(_up, _v2);
      _s.setScalar(0.011);
      _m.compose(_v1, _q, _s);
      cones.setMatrixAt(i, _m);
    });
    cones.instanceMatrix.needsUpdate = true;
    const make = (g) => {
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos[g]);
      const n = pos[g].length / 6;
      geo.setColors(new Float32Array(n * 6));
      geo.setAttribute('instanceStyle', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
      if (g === 1) {
        const ib = new THREE.InstancedInterleavedBuffer(dist[1], 2, 1);
        geo.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(ib, 1, 0));
        geo.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(ib, 1, 1));
      }
      if (!lineMats[g]) {
        lineMats[g] = new LineMaterial({ linewidth: g ? 1.5 : 1.8, vertexColors: true, dashed: g === 1, dashSize: 0.026, gapSize: 0.018, transparent: true, depthWrite: false, worldUnits: false });
        patchLine(lineMats[g]);
      }
      const o = new LineSegments2(geo, lineMats[g]);
      o.renderOrder = 2;
      o.frustumCulled = false;
      o.userData.count = count[g];
      world.add(o);
      return o;
    };
    lines = { solid: make(0), dashed: make(1), edgeGeo, edgeStart, segs, segEdge };
    sizeLines();
  }
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _ndc = new THREE.Vector2(), _sph = new THREE.Spherical();
  const _white = new THREE.Color(1, 1, 1), _c1 = new THREE.Color(), _c2 = new THREE.Color();

  /* ---------- labels: a pool of CSS2D labels, plus year and category labels ---------- */
  const pool = [];
  for (let i = 0; i < LABEL_POOL; i++) {
    const el = document.createElement('div');
    el.className = 'em-label';
    const o = new CSS2DObject(el);
    o.center.set(0, 0.5);
    pool.push({ o, el, node: -1, prio: 0, w: 0 });
  }
  const years = [];
  for (let y = Math.ceil(lay.t0 / 12); y <= Math.floor(lay.t1 / 12); y++) {
    const el = document.createElement('div');
    el.className = 'em-year';
    el.textContent = String(y);
    const o = new CSS2DObject(el);
    o.center.set(1, 0.5);
    world.add(o);
    years.push({ o, pol: lay.polarOf(y * 12) });
  }
  const catLabels = ctx.colors.cats.map((hex, k) => {
    const el = document.createElement('div');
    el.className = 'em-cat';
    el.dataset.k = String(k);
    el.textContent = ctx.categories[k];
    const o = new CSS2DObject(el);
    const az = wedgeCenter(k);
    o.position.set(Math.sin(az) * 1.02, 0, Math.cos(az) * 1.02);
    world.add(o);
    return o;
  });

  /* ---------- state from the store ---------- */
  let view = { nodeVis: new Uint8Array(N).fill(1), linkVis: new Uint8Array(E).fill(1), sel: -1, hover: -1, hl: null };
  let tier = 0, hoverEdge = -1;
  const nState = new Uint8Array(N), eState = new Uint8Array(E);

  function computeStates() {
    const { nodeVis, linkVis, sel, hl } = view;
    const thin = tier >= 3 && N > 120;
    for (let i = 0; i < N; i++) {
      let s = !nodeVis[i] ? S.HIDDEN : sel < 0 ? S.NORMAL : i === sel ? S.SEL : hl.up.has(i) ? S.UP : hl.down.has(i) ? S.DOWN : S.DIM;
      if (thin && (s === S.NORMAL || s === S.DIM) && graph.nodes[i].degree <= 1 && i !== view.hover) s = S.HIDDEN;
      nState[i] = s;
    }
    for (let i = 0; i < E; i++) {
      const l = graph.links[i];
      eState[i] = !linkVis[i] || nState[l.s] === S.HIDDEN || nState[l.t] === S.HIDDEN ? S.HIDDEN
        : sel < 0 ? S.NORMAL : hl.upLinks.has(i) ? S.UP : hl.downLinks.has(i) ? S.DOWN : S.DIM;
    }
  }

  function paintNodes() {
    for (let i = 0; i < N; i++) {
      const s = nState[i], c = s === S.UP ? col.up : s === S.DOWN ? col.down : col.cats[graph.nodes[i].cat];
      nColor[i * 3] = c.r; nColor[i * 3 + 1] = c.g; nColor[i * 3 + 2] = c.b;
      let a = s === S.HIDDEN ? 0 : s === S.DIM ? 0.22 : 1;
      let k = s === S.HIDDEN ? 0 : s === S.SEL ? 1.6 : s === S.UP || s === S.DOWN ? 1.15 : 1;
      if (i === view.hover && s !== S.HIDDEN) { k *= 1.3; a = Math.max(a, 0.9); }
      nStyle[i * 2] = a; nStyle[i * 2 + 1] = k;
    }
    nodes.geometry.attributes.aColor.needsUpdate = true;
    nodes.geometry.attributes.aStyle.needsUpdate = true;
    const sel = view.sel;
    halo.visible = sel >= 0 && nState[sel] !== S.HIDDEN && tier < 1;
    if (halo.visible) {
      halo.position.copy(nodeLocal[sel]).multiplyScalar(1.006);
      halo.scale.setScalar(baseR[sel] * 9);
      halo.material.color.copy(col.cats[graph.nodes[sel].cat]);
    }
  }

  function paintEdges() {
    if (!lines) return;
    const geos = [lines.solid.geometry, lines.dashed.geometry];
    const colArr = geos.map((g) => g.attributes.instanceColorStart.data.array);
    const styArr = geos.map((g) => g.attributes.instanceStyle.array);
    for (let i = 0; i < E; i++) {
      const l = graph.links[i], s = eState[i], g = lines.edgeGeo[i];
      let a, w;
      if (s === S.UP || s === S.DOWN) { _c1.copy(s === S.UP ? col.up : col.down); _c2.copy(_c1); a = 1; w = 1.7; }
      else {
        _c1.copy(col.cats[graph.nodes[l.s].cat]).multiplyScalar(0.85);
        _c2.copy(col.cats[graph.nodes[l.t].cat]).multiplyScalar(0.85);
        a = s === S.HIDDEN ? 0 : s === S.DIM ? 0.07 : g ? 0.42 : 0.55; w = 1;
      }
      if (i === hoverEdge && s !== S.HIDDEN) { _c1.lerp(_white, 0.35); _c2.lerp(_white, 0.35); a = 1; w = 2.3; }
      const C = colArr[g], Y = styArr[g], segs = lines.segs, st = lines.edgeStart[i];
      for (let k = 0; k < segs; k++) {
        const o = (st + k) * 6, u0 = k / segs, u1 = (k + 1) / segs;
        C[o] = _c1.r + (_c2.r - _c1.r) * u0; C[o + 1] = _c1.g + (_c2.g - _c1.g) * u0; C[o + 2] = _c1.b + (_c2.b - _c1.b) * u0;
        C[o + 3] = _c1.r + (_c2.r - _c1.r) * u1; C[o + 4] = _c1.g + (_c2.g - _c1.g) * u1; C[o + 5] = _c1.b + (_c2.b - _c1.b) * u1;
        Y[(st + k) * 2] = a; Y[(st + k) * 2 + 1] = w;
      }
      /* the arrowhead takes the effect end's colour; contributing links lose theirs at tier 2 */
      cColor[i * 3] = _c2.r; cColor[i * 3 + 1] = _c2.g; cColor[i * 3 + 2] = _c2.b;
      cStyle[i * 2] = tier >= 2 && g === 1 && s !== S.UP && s !== S.DOWN ? 0 : Math.min(1, a * 1.25);
      cStyle[i * 2 + 1] = s === S.HIDDEN ? 0 : (s === S.UP || s === S.DOWN || i === hoverEdge ? 1.25 : 1);
    }
    geos.forEach((g) => { g.attributes.instanceColorStart.data.needsUpdate = true; g.attributes.instanceStyle.needsUpdate = true; });
    cones.geometry.attributes.aColor.needsUpdate = true;
    cones.geometry.attributes.aStyle.needsUpdate = true;
  }

  /* labels: the selected node, its highlighted chain, and the hovered node */
  function assignLabels() {
    const want = [];
    const cap = tier >= 3 ? 10 : LABEL_POOL;
    if (view.hover >= 0 && nState[view.hover] !== S.HIDDEN) want.push([view.hover, 4]);
    if (view.sel >= 0 && nState[view.sel] !== S.HIDDEN) {
      want.push([view.sel, 5]);
      const direct = new Set();
      graph.nodes[view.sel].ins.forEach((li) => direct.add(graph.links[li].s));
      graph.nodes[view.sel].outs.forEach((li) => direct.add(graph.links[li].t));
      for (let i = 0; i < N; i++) if (nState[i] === S.UP || nState[i] === S.DOWN) want.push([i, direct.has(i) ? 3 : 2]);
    }
    const seen = new Set();
    const list = want.filter(([i]) => (seen.has(i) ? false : seen.add(i))).sort((a, b) => b[1] - a[1]).slice(0, cap);
    pool.forEach((p, k) => {
      const w = list[k];
      if (!w) { if (p.o.parent) world.remove(p.o); p.node = -1; return; }
      const [i, prio] = w;
      if (p.node !== i) {
        p.el.textContent = graph.nodes[i].title;
        p.w = 8 + graph.nodes[i].title.length * 6.6;
      }
      p.node = i; p.prio = prio;
      const s = nState[i];
      p.el.dataset.k = s === S.UP ? 'up' : s === S.DOWN ? 'down' : i === view.sel ? 'sel' : 'hover';
      p.o.position.copy(nodeLocal[i]).multiplyScalar(1.012);
      if (!p.o.parent) world.add(p.o);
    });
    labelsDirty = true;
  }

  /* per frame: hide labels on the far side and labels that would overlap a more important one */
  const boxes = new Float32Array(LABEL_POOL * 4);
  function placeLabels() {
    const W = host.clientWidth, H = host.clientHeight;
    let nb = 0;
    for (const p of pool) {
      if (p.node < 0) continue;
      _v1.copy(p.o.position).applyQuaternion(world.quaternion);
      const front = _v1.dot(U.uCamDir.value) / _v1.length() > U.uLimb.value;
      if (!front) { p.o.visible = false; continue; }
      _v1.project(camera);
      const x = (_v1.x + 1) / 2 * W, y = (1 - _v1.y) / 2 * H, x1 = x + p.w + 12, y0 = y - 9, y1 = y + 9;
      let clash = false;
      for (let b = 0; b < nb; b++) {
        const o = b * 4;
        if (x < boxes[o + 2] && x1 > boxes[o] && y0 < boxes[o + 3] && y1 > boxes[o + 1]) { clash = true; break; }
      }
      p.o.visible = !clash || p.prio >= 4;
      if (p.o.visible && nb < LABEL_POOL) { const o = nb * 4; boxes[o] = x; boxes[o + 1] = y0; boxes[o + 2] = x1; boxes[o + 3] = y1; nb++; }
    }
    /* years sit near the sphere's left edge as seen from the camera; categories on the equator, front side only */
    _v1.copy(U.uCamDir.value).applyQuaternion(_q2.copy(world.quaternion).invert());
    const azCam = Math.atan2(_v1.x, _v1.z), cp = Math.acos(Math.max(-1, Math.min(1, _v1.y)));
    const want = U.uLimb.value + 0.06;
    for (const y of years) {
      /* the left-most point of the year's ring that still faces the camera: solve dot(point, camera) = want */
      const sp = Math.sin(y.pol) * Math.sin(cp), c = (want - Math.cos(y.pol) * Math.cos(cp)) / (sp || 1e-9);
      if (c > 1) { y.o.visible = false; continue; }
      const d = c < 0 ? Math.PI / 2 : Math.min(Math.PI / 2, Math.acos(c)), az = azCam - d;
      y.o.position.set(Math.sin(y.pol) * Math.sin(az) * 1.03, Math.cos(y.pol) * 1.03, Math.sin(y.pol) * Math.cos(az) * 1.03);
      y.o.visible = true;
    }
    for (const o of catLabels) {
      _v1.copy(o.position).applyQuaternion(world.quaternion);
      o.visible = _v1.dot(U.uCamDir.value) / _v1.length() > U.uLimb.value + 0.32;
    }
  }

  /* ---------- sizing ---------- */
  function fitDistance() {
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    return Math.min(controls.maxDistance, 1.28 / Math.sin(Math.min(vf, hf) / 2));
  }
  function sizeLines() {
    const W = host.clientWidth, H = host.clientHeight;
    lineMats.forEach((m) => m && m.resolution.set(W, H));
  }
  /* on phones the details sheet covers the bottom of the map; shift the projection so the sphere centres in what is
     left above it (a view offset keeps picking and labels exact) */
  let insetCur = 0, insetTarget = 0;
  function applyInset() {
    const W = Math.max(1, host.clientWidth), H = Math.max(1, host.clientHeight), d = Math.min(insetCur, H * 0.6);
    if (d < 0.5) { camera.clearViewOffset(); camera.zoom = 1; }
    else {
      /* the offset maps the field of view onto a frame of H + d, which magnifies by (H + d) / H: zoom undoes that,
         then shrinks the sphere to fit the height left above the sheet */
      camera.setViewOffset(W, H + d, 0, d, W, H);
      camera.zoom = H / (H + d) * Math.min(1, (H - d) / Math.min(W, H));
    }
    camera.updateProjectionMatrix();
  }
  function resize() {
    const W = Math.max(1, host.clientWidth), H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
    labelRenderer.setSize(W, H);
    camera.aspect = W / H;
    applyInset();
    sizeLines();
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* ---------- motion: auto-rotate, the turn to a node ---------- */
  let lastInput = performance.now(), tween = null, dirty = true, labelsDirty = true;
  const autoAllowed = () => !ctx.rm() && ctx.autoRotate !== false;
  function noteInput() {
    lastInput = performance.now();
    if (controls.autoRotate) { controls.autoRotate = false; }
  }
  on(controls, 'start', () => { noteInput(); tween = null; });
  on(controls, 'change', () => { dirty = true; });

  function yawOf(q) { return 2 * Math.atan2(q.y, q.w); }
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  function setCamera(polar, theta, radius) {
    _sph.set(radius, polar, theta);
    camera.position.setFromSpherical(_sph);
    camera.lookAt(0, 0, 0);
  }

  function focus(idx, animate = true) {
    if (idx < 0 || idx >= N) return;
    noteInput();
    _sph.setFromVector3(camera.position);
    const p = lay.pos[idx];
    const polar1 = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, p.pol));
    const yaw0 = yawOf(world.quaternion), yaw1 = yaw0 + wrap(_sph.theta - p.az - yaw0);
    const from = { q: world.quaternion.clone(), polar: _sph.phi, r: _sph.radius, theta: _sph.theta };
    const to = { q: new THREE.Quaternion().setFromAxisAngle(_up, yaw1), polar: polar1, r: Math.min(_sph.radius, fitDistance()) };
    if (!animate || ctx.rm()) {
      world.quaternion.copy(to.q); setCamera(to.polar, from.theta, to.r); controls.update(); tween = null; dirty = true;
      return;
    }
    tween = { t0: performance.now(), ms: ctx.compact && ctx.compact() ? TWEEN_MS / 2 : TWEEN_MS, from, to };
  }
  function stepTween(now) {
    const u = Math.min(1, (now - tween.t0) / tween.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    world.quaternion.slerpQuaternions(tween.from.q, tween.to.q, e);
    setCamera(tween.from.polar + (tween.to.polar - tween.from.polar) * e, tween.from.theta, tween.from.r + (tween.to.r - tween.from.r) * e);
    if (u >= 1) { tween = null; controls.update(); lastInput = now; }
  }
  function home(animate = true) {
    noteInput();
    const from = { q: world.quaternion.clone(), polar: 0, r: 0, theta: 0 };
    _sph.setFromVector3(camera.position);
    from.polar = _sph.phi; from.r = _sph.radius; from.theta = _sph.theta;
    const to = { q: new THREE.Quaternion().setFromAxisAngle(_up, HOME.yaw + from.theta - HOME.theta), polar: HOME.polar, r: fitDistance() };
    /* keep the camera's azimuth and turn the sphere instead, so the home view is the same from anywhere */
    const yaw0 = yawOf(from.q);
    to.q.setFromAxisAngle(_up, yaw0 + wrap(yawOf(to.q) - yaw0));
    if (!animate || ctx.rm()) { world.quaternion.copy(to.q); setCamera(to.polar, from.theta, to.r); controls.update(); dirty = true; return; }
    tween = { t0: performance.now(), ms: TWEEN_MS, from, to };
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  ray.params.Line2 = { threshold: 6 };
  const hits = [];
  let pointer = null, pointerMoved = false, down = null, dragging = false;
  function setNdc(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    _ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(_ndc, camera);
    return r;
  }
  function pickNode(cx, cy, touch) {
    const rect = setNdc(cx, cy);
    const o = ray.ray.origin, d = ray.ray.direction;
    let best = -1, bestT = Infinity;
    for (let i = 0; i < N; i++) {
      if (nState[i] === S.HIDDEN) continue;
      _v1.copy(nodeLocal[i]).applyQuaternion(world.quaternion);
      if (_v1.dot(U.uCamDir.value) < U.uLimb.value - 0.02) continue;
      const r = baseR[i] * 1.6;
      _v2.subVectors(o, _v1);
      const b = _v2.dot(d), c = _v2.lengthSq() - r * r, h = b * b - c;
      if (h < 0) continue;
      const t = -b - Math.sqrt(h);
      if (t > 0 && t < bestT) { bestT = t; best = i; }
    }
    if (best >= 0) return best;
    /* forgiving fallback: the nearest front node within a few pixels */
    const tol = touch ? 24 : 14;
    let bd = tol * tol;
    for (let i = 0; i < N; i++) {
      if (nState[i] === S.HIDDEN) continue;
      _v1.copy(nodeLocal[i]).applyQuaternion(world.quaternion);
      if (_v1.dot(U.uCamDir.value) < U.uLimb.value - 0.02) continue;
      _v1.project(camera);
      const x = (_v1.x + 1) / 2 * rect.width + rect.left, y = (1 - _v1.y) / 2 * rect.height + rect.top;
      const dd = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }
  function pickEdge(cx, cy) {
    if (!lines) return -1;
    setNdc(cx, cy);
    hits.length = 0;
    lines.solid.raycast(ray, hits);
    lines.dashed.raycast(ray, hits);
    hits.sort((a, b) => a.distance - b.distance);
    for (const h of hits) {
      const g = h.object === lines.dashed ? 1 : 0, e = lines.segEdge[g][h.faceIndex];
      if (e == null || eState[e] === S.HIDDEN || (eState[e] === S.DIM && view.sel >= 0)) continue;
      _v1.copy(h.point);
      if (_v1.dot(U.uCamDir.value) / _v1.length() < U.uLimb.value - 0.05) continue;
      return e;
    }
    return -1;
  }
  function missesSphere(cx, cy) {
    setNdc(cx, cy);
    return ray.ray.distanceToPoint(_v3.set(0, 0, 0)) > 1.08;
  }

  const el = renderer.domElement;
  on(el, 'pointermove', (e) => {
    pointer = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    pointerMoved = true;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragging = true;
    noteInput();
  });
  on(el, 'pointerleave', () => { pointer = null; setHover(-1, -1); });
  on(el, 'pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; dragging = false; el.classList.add('grabbing'); noteInput(); });
  on(window, 'pointerup', (e) => {
    el.classList.remove('grabbing');
    if (!down) return;
    const click = !dragging && performance.now() - down.t < 600 && e.target === el;
    down = null;
    if (!click) return;
    const i = pickNode(e.clientX, e.clientY, e.pointerType !== 'mouse');
    if (i >= 0) ctx.onSelect(i);
    else if (missesSphere(e.clientX, e.clientY)) ctx.onSelect(-1);
  });
  on(el, 'wheel', noteInput, { passive: true });
  on(el, 'webglcontextlost', (e) => { e.preventDefault(); if (ctx.onLost) ctx.onLost(); });

  function setHover(node, edge) {
    if (node !== view.hover) ctx.onHover(node);
    if (edge !== hoverEdge) {
      hoverEdge = edge;
      paintEdges();
      if (edge >= 0 && pointer) {
        const l = graph.links[edge];
        ctx.tip.show(l, pointer.x, pointer.y);
      } else ctx.tip.hide();
      dirty = true;
    } else if (edge >= 0 && pointer) ctx.tip.move(pointer.x, pointer.y);
    el.classList.toggle('pointing', node >= 0 || edge >= 0);
  }

  /* ---------- the loop ---------- */
  let raf = 0, last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, tierAt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    const gap = now - last;
    last = now;
    if (!controls.autoRotate && !tween && autoAllowed() && now - lastInput > IDLE_MS && !down) controls.autoRotate = true;
    if (!autoAllowed()) controls.autoRotate = false;
    let moved = false;
    if (insetCur !== insetTarget) {
      insetCur = ctx.rm() || Math.abs(insetTarget - insetCur) < 0.5 ? insetTarget : insetCur + (insetTarget - insetCur) * Math.min(1, dt * 10);
      applyInset(); moved = true;
    }
    if (tween) { stepTween(now); moved = true; }
    else moved = controls.update(dt);
    if (pointerMoved && pointer && !dragging && !tween) {
      pointerMoved = false;
      const n = pickNode(pointer.x, pointer.y, pointer.touch);
      setHover(n, n >= 0 ? -1 : pickEdge(pointer.x, pointer.y));
    }
    if (!(moved || dirty || labelsDirty || controls.autoRotate)) { fpsN = 0; fpsAcc = 0; return; }
    dirty = false; labelsDirty = false;
    U.uCamDir.value.copy(camera.position).normalize();
    U.uLimb.value = 1 / camera.position.length();
    placeLabels();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    /* frame rate over rolling 2 s windows of continuous rendering; one quality tier down when under 30 fps */
    if (gap < 250) { fpsAcc += gap; fpsN++; } else { fpsAcc = 0; fpsN = 0; }
    if (fpsAcc >= 2000) {
      fps = fpsN * 1000 / fpsAcc; fpsAcc = 0; fpsN = 0;
      if (ctx.onFps) ctx.onFps(fps);
      if (fps < 30 && tier < 3 && now - tierAt > 3000) { tierAt = now; setTier(tier + 1); }
    }
  }

  function setTier(t) {
    const prevSegs = SEGS[tier];
    tier = Math.max(0, Math.min(3, t));
    renderer.setPixelRatio(tier >= 1 ? 1 : baseDpr);
    resize();
    if (SEGS[tier] !== prevSegs) buildLines(SEGS[tier]);
    computeStates(); paintNodes(); paintEdges(); assignLabels();
    if (ctx.onTier) ctx.onTier(tier, fps);
  }

  /* ---------- start ---------- */
  resize();
  world.quaternion.setFromAxisAngle(_up, HOME.yaw);
  setCamera(HOME.polar, HOME.theta, fitDistance());
  controls.update();
  buildLines(SEGS[0]);
  computeStates(); paintNodes(); paintEdges(); assignLabels();
  raf = requestAnimationFrame(frame);

  return {
    update(next) {
      view = { ...view, ...next };
      computeStates(); paintNodes(); paintEdges(); assignLabels();
      dirty = true;
    },
    focus,
    home,
    resize,
    setInset(px) { insetTarget = Math.max(0, px || 0); dirty = true; },
    setTier,
    stats() {
      const info = renderer.info;
      return { fps, tier, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, labels: pool.filter((p) => p.node >= 0 && p.o.visible).length, autoRotate: controls.autoRotate };
    },
    debug: { THREE, renderer, scene, camera, controls, world, nState, eState, nodeLocal, U, pickNode, project(i) { _v1.copy(nodeLocal[i]).applyQuaternion(world.quaternion); const facing = _v1.dot(U.uCamDir.value); _v1.project(camera); const r = el.getBoundingClientRect(); return { x: (_v1.x + 1) / 2 * r.width + r.left, y: (1 - _v1.y) / 2 * r.height + r.top, facing }; } },
    unmount() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      listeners.forEach(([t, type, fn, opt]) => t.removeEventListener(type, fn, opt));
      controls.dispose();
      ctx.tip.hide();
      const geos = new Set(), mats = new Set();
      scene.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) [].concat(o.material).forEach((m) => mats.add(m));
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      lineMats.forEach((m) => m && m.dispose());
      haloTex.dispose();
      const memory = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
      return memory;
    }
  };
}
