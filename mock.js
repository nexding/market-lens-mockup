/* Market Lens mockup: shared data, shell and behaviours. Plain script, no build step, no network. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  /* ---------- preferences ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem('ml-' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('ml-' + k, v); } catch (e) { /* storage unavailable */ } }
  };
  ['theme', 'density', 'accent', 'updown', 'motion'].forEach(function (k) {
    var v = store.get(k);
    if (v) root.dataset[k] = v;
  });
  if (!root.dataset.theme) root.dataset.theme = 'dark';
  if (!root.dataset.density) root.dataset.density = 'comfortable';

  var mqRM = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncRM() { root.dataset.rm = (root.dataset.motion === 'reduced' || mqRM.matches) ? '1' : '0'; }
  syncRM();
  if (mqRM.addEventListener) mqRM.addEventListener('change', syncRM);
  function rm() { return root.dataset.rm === '1'; }
  function compact() { return root.dataset.density === 'compact'; }
  function setPref(k, v) {
    root.dataset[k] = v; store.set(k, v); syncRM();
    document.dispatchEvent(new CustomEvent('ml:pref', { detail: { key: k, value: v } }));
  }

  /* ---------- springs: the motion tokens, turned into CSS easing curves ---------- */
  function springCurve(k, c) {
    var x = 0, v = 0, t = 0, dt = 1 / 600, xs = [0];
    while (t < 2.5) {
      v += (-k * (x - 1) - c * v) * dt; x += v * dt; t += dt; xs.push(x);
      if (t > 0.06 && Math.abs(x - 1) < 0.004 && Math.abs(v) < 0.08) break;
    }
    var S = 32, out = [];
    for (var i = 0; i <= S; i++) out.push(+xs[Math.round(i / S * (xs.length - 1))].toFixed(3));
    out[S] = 1;
    return {
      css: 'linear(' + out.join(', ') + ')', ms: Math.round(t * 1000),
      fn: function (u) { var f = u * (xs.length - 1), j = Math.floor(f); return j >= xs.length - 1 ? 1 : xs[j] + (xs[j + 1] - xs[j]) * (f - j); }
    };
  }
  var SPRING = { snappy: springCurve(520, 38), smooth: springCurve(260, 30), gentle: springCurve(140, 22), elastic: springCurve(180, 14) };
  (function () {
    var css = ':root{', half = ':root[data-density="compact"]{';
    ['snappy', 'smooth', 'gentle'].forEach(function (n) {
      css += '--spring-' + n + ':' + SPRING[n].css + ';--spring-' + n + '-d:' + SPRING[n].ms + 'ms;';
      half += '--spring-' + n + '-d:' + Math.round(SPRING[n].ms / 2) + 'ms;';
    });
    var st = document.createElement('style');
    st.textContent = css + '}' + half + '}';
    document.head.appendChild(st);
  })();

  /* ---------- animation helpers ---------- */
  function tween(ms, fn, ease, done) {
    if (rm() || ms <= 0) { fn(1); if (done) done(); return { cancel: function () {} }; }
    if (compact()) ms = ms / 2;
    var t0 = performance.now(), id, dead = false;
    function step(now) {
      if (dead) return;
      var u = Math.min(1, (now - t0) / ms);
      fn(ease ? ease(u) : u);
      if (u < 1) id = requestAnimationFrame(step); else if (done) done();
    }
    id = requestAnimationFrame(step);
    return { cancel: function () { dead = true; cancelAnimationFrame(id); } };
  }
  function springTo(name, fn, done) { var s = SPRING[name]; return tween(s.ms, fn, s.fn, done); }
  var easeOut = function (u) { return 1 - Math.pow(1 - u, 4); };

  /* ---------- utilities ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /* a random path of n points from a to b; vol is the relative step size */
  function bridge(seed, n, a, b, vol) {
    var r = rng(hash(seed)), w = [0], out = [], i;
    for (i = 1; i < n; i++) w.push(w[i - 1] + (r() - 0.5) * 2 * vol);
    for (i = 0; i < n; i++) { var t = i / (n - 1); out.push(a + (b - a) * t + (w[i] - w[n - 1] * t) * a); }
    return out;
  }
  function resample(arr, n) {
    var out = new Array(n), m = arr.length - 1;
    for (var i = 0; i < n; i++) { var f = i / (n - 1) * m, j = Math.floor(f), k = Math.min(m, j + 1); out[i] = arr[j] + (arr[k] - arr[j]) * (f - j); }
    return out;
  }
  var MINUS = '−';
  function fmt(n, dp) { if (dp == null) dp = 2; return (n < 0 ? MINUS : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function fsign(n, dp) { if (dp == null) dp = 2; return (n > 0 ? '+' : n < 0 ? MINUS : '') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function fpct(x, dp) { if (dp == null) dp = 2; return (x > 0 ? '+' : x < 0 ? MINUS : '') + Math.abs(x).toFixed(dp) + '%'; }
  function fbig(n) { var a = Math.abs(n); return a >= 1e12 ? fmt(n / 1e12, 2) + 'T' : a >= 1e9 ? fmt(n / 1e9, 2) + 'B' : a >= 1e6 ? fmt(n / 1e6, 1) + 'M' : fmt(n, 0); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- icons: one set, 1.5 px stroke ---------- */
  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    compare: '<rect x="4" y="6" width="9" height="12" rx="2"/><rect x="11" y="6" width="9" height="12" rx="2"/>',
    map: '<circle cx="5" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M7 11.2 16 6.8M7 12.8l9 4.4"/>',
    chart: '<path d="M4 19h16M7 15l3-4 3 2 4-6"/>',
    down: '<path d="m4 7 6 6 3-3 7 7M20 12v5h-5"/>',
    zap: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>',
    warn: '<path d="M12 4 3 19h18z"/><path d="M12 10v4M12 17h.01"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 5v14"/>',
    home: '<path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    case: '<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    more: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
    doc: '<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>',
    mark: '<path d="M4 16l5-6 4 3 7-8"/>'
  };
  function icon(name, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }

  /* ---------- sample data (all numbers are invented) ---------- */
  var CCY = { USD: '$', HKD: 'HK$', GBP: '£' };
  var FX = { USD: 1, HKD: 0.1285, GBP: 1.268 };
  var RAW = [
    ['AAPL', 'Apple Inc.', 'NASDAQ', 'USD', 229.41, 227.02, 'Technology', 'United States'],
    ['MSFT', 'Microsoft Corp.', 'NASDAQ', 'USD', 512.08, 514.60, 'Technology', 'United States'],
    ['NVDA', 'NVIDIA Corp.', 'NASDAQ', 'USD', 188.32, 184.90, 'Technology', 'United States'],
    ['COST', 'Costco Wholesale', 'NASDAQ', 'USD', 941.75, 947.20, 'Consumer Staples', 'United States'],
    ['0700.HK', 'Tencent Holdings', 'HKEX', 'HKD', 612.50, 606.00, 'Communication', 'Hong Kong'],
    ['1299.HK', 'AIA Group', 'HKEX', 'HKD', 78.35, 79.10, 'Financials', 'Hong Kong'],
    ['SHEL.L', 'Shell plc', 'LSE', 'GBP', 27.86, 27.31, 'Energy', 'United Kingdom'],
    ['HSBA.L', 'HSBC Holdings', 'LSE', 'GBP', 9.42, 9.37, 'Financials', 'United Kingdom'],
    ['TSM', 'Taiwan Semiconductor', 'NYSE', 'USD', 301.20, 297.85, 'Technology', 'Taiwan'],
    ['AMZN', 'Amazon.com', 'NASDAQ', 'USD', 241.66, 243.10, 'Consumer Discretionary', 'United States'],
    ['9988.HK', 'Alibaba Group', 'HKEX', 'HKD', 158.40, 155.90, 'Consumer Discretionary', 'Hong Kong'],
    ['AZN.L', 'AstraZeneca', 'LSE', 'GBP', 118.64, 119.02, 'Health Care', 'United Kingdom'],
    ['JPM', 'JPMorgan Chase', 'NYSE', 'USD', 312.45, 310.02, 'Financials', 'United States'],
    ['XOM', 'Exxon Mobil', 'NYSE', 'USD', 121.30, 118.75, 'Energy', 'United States'],
    ['PLTR', 'Palantir Technologies', 'NASDAQ', 'USD', 187.40, 171.20, 'Technology', 'United States'],
    ['LMT', 'Lockheed Martin', 'NYSE', 'USD', 512.30, 486.90, 'Industrials', 'United States'],
    ['DAL', 'Delta Air Lines', 'NYSE', 'USD', 58.12, 61.90, 'Industrials', 'United States'],
    ['IAG.L', 'Intl Airlines Group', 'LSE', 'GBP', 3.64, 3.82, 'Industrials', 'United Kingdom'],
    ['UNH', 'UnitedHealth Group', 'NYSE', 'USD', 331.50, 343.00, 'Health Care', 'United States'],
    ['INTC', 'Intel Corp.', 'NASDAQ', 'USD', 34.10, 35.02, 'Technology', 'United States'],
    ['TSLA', 'Tesla Inc.', 'NASDAQ', 'USD', 412.30, 409.10, 'Consumer Discretionary', 'United States'],
    ['F', 'Ford Motor', 'NYSE', 'USD', 12.84, 12.80, 'Consumer Discretionary', 'United States']
  ];
  var I = {}, LIST = [];
  RAW.forEach(function (r) {
    var it = { id: r[0], n: r[1], x: r[2], c: r[3], p: r[4], pc: r[5], dp: 2, sec: r[6], cty: r[7], h: hash(r[0]) % 360, kind: 'stock' };
    it.mono = it.n.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
    I[it.id] = it; LIST.push(it);
  });
  var STRIP = [
    ['SPX', 'S&P 500', 6842.17, 6811.40, 2], ['IXIC', 'Nasdaq', 23104.60, 22987.30, 2], ['DJI', 'Dow 30', 47210.50, 47302.80, 2],
    ['ES', 'S&P Futures', 6851.25, 6820.00, 2], ['US10Y', 'US 10-Year', 4.184, 4.152, 3], ['VIX', 'VIX', 16.42, 17.05, 2],
    ['GOLD', 'Gold', 4012.60, 3988.10, 2], ['WTI', 'Crude Oil', 71.84, 69.92, 2], ['DXY', 'US Dollar', 99.87, 99.61, 2],
    ['BTC', 'Bitcoin', 104250, 102890, 0], ['HSI', 'Hang Seng', 26480.30, 26215.90, 2], ['FTSE', 'FTSE 100', 9612.40, 9588.00, 2]
  ].map(function (r) { var it = { id: r[0], n: r[1], p: r[2], pc: r[3], dp: r[4], kind: 'index' }; I[it.id] = it; return it; });
  var HOLD = {
    'AAPL': { q: 120, cost: 171.30 }, 'MSFT': { q: 45, cost: 402.10 }, 'NVDA': { q: 160, cost: 96.40 }, 'COST': { q: 18, cost: 812.00 },
    '0700.HK': { q: 400, cost: 468.00 }, '1299.HK': { q: 1200, cost: 71.20 }, 'SHEL.L': { q: 700, cost: 24.10 }, 'HSBA.L': { q: 1500, cost: 7.05 }
  };
  var WATCH = ['TSM', 'AMZN', '9988.HK', 'AZN.L', 'JPM', 'XOM'];
  function pctOf(it) { return (it.p - it.pc) / it.pc * 100; }
  function valueUSD(id) { var h = HOLD[id], it = I[id]; return h ? h.q * it.p * FX[it.c] : 0; }
  function portfolio() {
    var total = 0, prev = 0, cost = 0;
    Object.keys(HOLD).forEach(function (id) { var h = HOLD[id], it = I[id], f = FX[it.c]; total += h.q * it.p * f; prev += h.q * it.pc * f; cost += h.q * h.cost * f; });
    return { total: total, prev: prev, cost: cost };
  }
  function series(id, n, vol) { var it = I[id]; return bridge(id + ':' + n, n, it.pc, it.p, vol || 0.004); }

  /* ---------- colours read from the tokens ---------- */
  var COL = {};
  function readColors() {
    var cs = getComputedStyle(root);
    ['canvas', 'surface-1', 'surface-2', 'surface-3', 'text-1', 'text-2', 'text-3', 'accent', 'gain', 'loss', 'warn', 'data-1', 'data-2', 'data-3', 'data-4', 'data-5', 'data-6'].forEach(function (k) {
      COL[k] = cs.getPropertyValue('--' + k).trim();
    });
    COL.dark = root.dataset.theme !== 'light';
  }
  function rgba(hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  readColors();
  document.addEventListener('ml:pref', function () { readColors(); document.dispatchEvent(new CustomEvent('ml:paint')); });

  /* ---------- canvas helpers ---------- */
  function fitCanvas(cv, w, h) {
    var d = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    var ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); return ctx;
  }
  /* sparkline: fixed pixel size, last-point dot, tinted by direction. shift (0..1) slides in the newest point */
  function spark(cv, arr, opt) {
    opt = opt || {};
    var w = opt.w || cv.clientWidth || 64, h = opt.h || cv.clientHeight || 24, ctx = fitCanvas(cv, w, h);
    ctx.clearRect(0, 0, w, h);
    if (!arr || arr.length < 2) return;
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr), pad = 3, n = arr.length;
    if (hi === lo) hi = lo + 1;
    var col = opt.color || (arr[n - 1] >= (opt.base != null ? opt.base : arr[0]) ? COL.gain : COL.loss);
    /* sliding: arr holds the window plus the newest point; the oldest point leaves on the left as the newest grows in */
    var sliding = opt.shift != null && n > 2, shift = sliding ? opt.shift : 0;
    var step = (w - pad * 2) / (sliding ? n - 2 : n - 1);
    function X(i) { return pad + (i - shift) * step; }
    function Y(v) { return pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2); }
    var lx = X(n - 1), ly = Y(arr[n - 1]);
    if (sliding) { lx = w - pad; ly = Y(arr[n - 2]) + (Y(arr[n - 1]) - Y(arr[n - 2])) * shift; }
    ctx.beginPath();
    for (var i = 0; i < n; i++) { var x = X(i), y = Y(arr[i]); if (i === n - 1) { x = lx; y = ly; } if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.lineWidth = 1.25; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke();
    if (opt.fill) {
      ctx.lineTo(lx, h); ctx.lineTo(X(0), h); ctx.closePath();
      var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba(col, 0.18)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(Math.min(w - 2, lx), ly, 1.8, 0, 6.3); ctx.fillStyle = col; ctx.fill();
  }

  /* ---------- area chart: draws in, morphs between ranges, gliding crosshair ---------- */
  function AreaChart(host, opt) {
    var self = this;
    this.host = host; this.opt = opt || {}; this.N = 160;
    host.classList.add('chart');
    this.cv = el('canvas'); this.cv.setAttribute('role', 'img'); this.cv.setAttribute('aria-label', this.opt.label || 'Price chart');
    this.tip = el('div', 'chart-tip');
    host.appendChild(this.cv); host.appendChild(this.tip);
    this.y = null; this.dom = [0, 1]; this.reveal = 1; this.fillA = 1; this.labels = []; this.prevLabels = null; this.labA = 1;
    this.hover = false; this.hx = 0; this.tx = 0; this.color = 'gain';
    new ResizeObserver(function () { self.draw(); }).observe(host);
    host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); self.tx = e.clientX - r.left; if (!self.hover) { self.hover = true; self.hx = self.tx; self.tip.classList.add('on'); } self.loop(); });
    host.addEventListener('pointerleave', function () { self.hover = false; self.tip.classList.remove('on'); self.draw(); });
    document.addEventListener('ml:paint', function () { self.draw(); });
  }
  AreaChart.prototype.set = function (data, o) {
    o = o || {};
    var self = this, y = resample(data, this.N), lo = Math.min.apply(null, y), hi = Math.max.apply(null, y);
    if (o.base != null) { lo = Math.min(lo, o.base); hi = Math.max(hi, o.base); }
    var pad = (hi - lo) * 0.12 || 1, dom = [lo - pad, hi + pad];
    var color = this.opt.color ? 'fixed' : (data[data.length - 1] >= (o.base != null ? o.base : data[0]) ? 'gain' : 'loss');
    if (this.a) this.a.cancel();
    this.base = o.base; this.tipLabel = o.tip || this.tipLabel;
    if (!this.y || o.mode === 'draw') {
      this.y = y; this.dom = dom; this.color = color; this.labels = o.labels || []; this.prevLabels = null; this.labA = 1;
      if (rm() || compact()) { this.reveal = 1; this.fillA = 1; this.draw(); return; }
      this.reveal = 0; this.fillA = 0;
      this.a = tween(700, function (u) { self.reveal = u; self.fillA = Math.max(0, Math.min(1, (u * 700 - 150) / 500)); self.draw(); }, easeOut);
    } else {
      var y0 = this.y.slice(), d0 = this.dom.slice(), c0 = this.color;
      this.prevLabels = this.labels; this.labels = o.labels || []; this.reveal = 1; this.fillA = 1;
      this.a = springTo('smooth', function (u) {
        for (var i = 0; i < self.N; i++) self.y[i] = y0[i] + (y[i] - y0[i]) * u;
        self.dom = [d0[0] + (dom[0] - d0[0]) * u, d0[1] + (dom[1] - d0[1]) * u];
        self.labA = Math.max(0, Math.min(1, u)); self.color = u > 0.5 ? color : c0; self.draw();
      }, function () { self.y = y; self.dom = dom; self.color = color; self.prevLabels = null; self.labA = 1; self.draw(); });
    }
  };
  AreaChart.prototype.nudge = function (v) { if (!this.y) return; this.y[this.N - 1] = v; if (v > this.dom[1] || v < this.dom[0]) { var p = (this.dom[1] - this.dom[0]) * 0.05; this.dom = [Math.min(this.dom[0], v - p), Math.max(this.dom[1], v + p)]; } this.draw(); };
  AreaChart.prototype.loop = function () {
    var self = this; if (this.raf) return;
    function step() {
      self.raf = 0; if (!self.hover) return;
      var d = self.tx - self.hx; self.hx += rm() ? d : d * 0.35; self.draw();
      if (Math.abs(self.tx - self.hx) > 0.3) self.raf = requestAnimationFrame(step);
    }
    this.raf = requestAnimationFrame(step);
  };
  AreaChart.prototype.draw = function () {
    if (!this.y) return;
    var w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    var ctx = fitCanvas(this.cv, w, h), N = this.N, y = this.y, o = this.opt;
    var pr = o.axis === false ? 4 : 54, pt = 26, pb = o.xlabels === false ? 6 : 24, iw = w - pr, ih = h - pt - pb, d0 = this.dom[0], d1 = this.dom[1];
    function X(i) { return i / (N - 1) * iw; }
    function Y(v) { return pt + (1 - (v - d0) / (d1 - d0)) * ih; }
    var col = this.color === 'fixed' ? COL[o.color] : (this.color === 'gain' ? COL.gain : COL.loss);
    var f = o.fmt || function (v) { return fmt(v, 2); };
    ctx.clearRect(0, 0, w, h);
    ctx.font = '500 11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
    /* quiet grid: four lines, no frame */
    for (var k = 0; k < 4; k++) {
      var gv = d0 + (d1 - d0) * (k + 0.5) / 4, gy = Math.round(Y(gv)) + 0.5;
      ctx.strokeStyle = rgba(COL['text-1'], 0.06); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(iw, gy); ctx.stroke();
      if (o.axis !== false) { ctx.fillStyle = COL['text-3']; ctx.textAlign = 'left'; ctx.fillText(f(gv), iw + 8, gy); }
    }
    /* x labels cross-fade during a morph */
    if (o.xlabels !== false) {
      var sets = [[this.labels, this.labA]]; if (this.prevLabels) sets.push([this.prevLabels, 1 - this.labA]);
      sets.forEach(function (s) {
        ctx.globalAlpha = s[1]; ctx.fillStyle = COL['text-3'];
        (s[0] || []).forEach(function (l) { ctx.textAlign = l.f < 0.04 ? 'left' : l.f > 0.96 ? 'right' : 'center'; ctx.fillText(l.t, l.f * iw, h - 9); });
      });
      ctx.globalAlpha = 1;
    }
    /* previous-close baseline */
    if (this.base != null && this.base > d0 && this.base < d1) {
      ctx.setLineDash([2, 4]); ctx.strokeStyle = rgba(COL['text-2'], 0.55); ctx.beginPath(); ctx.moveTo(0, Math.round(Y(this.base)) + 0.5); ctx.lineTo(iw, Math.round(Y(this.base)) + 0.5); ctx.stroke(); ctx.setLineDash([]);
    }
    /* line and gradient fill, revealed left to right */
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, iw * this.reveal + 1, h); ctx.clip();
    ctx.beginPath(); for (var i = 0; i < N; i++) { if (i === 0) ctx.moveTo(X(i), Y(y[i])); else ctx.lineTo(X(i), Y(y[i])); }
    ctx.lineWidth = o.lw || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke();
    ctx.lineTo(iw, pt + ih + (1 - this.fillA) * 8); ctx.lineTo(0, pt + ih + (1 - this.fillA) * 8); ctx.closePath();
    var g = ctx.createLinearGradient(0, pt, 0, pt + ih); g.addColorStop(0, rgba(col, 0.18 * this.fillA)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    if (this.reveal >= 1) {
      ctx.beginPath(); ctx.arc(X(N - 1), Y(y[N - 1]), 6, 0, 6.3); ctx.fillStyle = rgba(col, 0.18); ctx.fill();
      ctx.beginPath(); ctx.arc(X(N - 1), Y(y[N - 1]), 3, 0, 6.3); ctx.fillStyle = col; ctx.fill();
    }
    /* crosshair */
    if (this.hover) {
      var hx = Math.max(0, Math.min(iw, this.hx)), ix = Math.round(hx / iw * (N - 1)), cx = X(ix), cy = Y(y[ix]);
      ctx.strokeStyle = rgba(COL['text-1'], 0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(hx) + 0.5, pt - 4); ctx.lineTo(Math.round(hx) + 0.5, pt + ih); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, 6.3); ctx.fillStyle = COL['surface-1']; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
      var lab = this.tipLabel ? this.tipLabel(ix / (N - 1)) : '';
      this.tip.innerHTML = (lab ? '<span>' + esc(lab) + '</span>' : '') + '<b>' + f(y[ix]) + '</b>';
      var tw = this.tip.offsetWidth; this.tip.style.transform = 'translate(' + Math.max(0, Math.min(w - tw, hx - tw / 2)) + 'px, 0)';
    }
  };

  /* ---------- rolling digits ---------- */
  function Roll(node, txt) { this.el = node; node.classList.add('roll'); this.cols = []; this.txt = ''; this.sig = null; this.set(txt, 0); }
  Roll.prototype.set = function (txt, dir) {
    if (txt === this.txt) return;
    var old = this.txt, sig = txt.replace(/\d/g, '0'), self = this, n = txt.length, i;
    this.txt = txt; this.el.setAttribute('aria-label', txt);
    if (sig !== this.sig) {
      this.sig = sig; this.el.textContent = ''; this.cols = [];
      for (i = 0; i < n; i++) {
        var ch = txt[i];
        if (/\d/.test(ch)) {
          var rd = el('span', 'rd'), col = el('span', 'rd-col', '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>');
          var oi = old.length - (n - i), od = (oi >= 0 && /\d/.test(old[oi])) ? +old[oi] : (old ? 0 : +ch);
          col.style.transform = 'translateY(' + (-od * 1.15) + 'em)';
          rd.setAttribute('aria-hidden', 'true'); rd.appendChild(col); this.el.appendChild(rd); this.cols.push({ rd: rd, col: col, d: od });
        } else { var s = el('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); this.el.appendChild(s); this.cols.push(null); }
      }
      void this.el.offsetWidth;
      requestAnimationFrame(function () { self.apply(txt, dir); });
    } else this.apply(txt, dir);
  };
  Roll.prototype.apply = function (txt, dir) {
    for (var i = 0; i < txt.length; i++) {
      var c = this.cols[i]; if (!c) continue; var nd = +txt[i];
      if (nd !== c.d) {
        c.d = nd; c.col.style.transform = 'translateY(' + (-nd * 1.15) + 'em)';
        if (dir) { (function (rd, cls) { rd.classList.remove('tu', 'td'); rd.classList.add(cls); setTimeout(function () { rd.classList.remove(cls); }, 500); })(c.rd, dir > 0 ? 'tu' : 'td'); }
      }
    }
  };

  /* ---------- markup helpers ---------- */
  function tk(id, o) {
    o = o || {}; var it = I[id];
    return '<a class="tk" href="stock.html?s=' + encodeURIComponent(id) + '" data-sym="' + esc(id) + '" draggable="true" title="' + esc(it.n) + '">' +
      '<span class="mono' + (o.lg ? ' mono-lg' : '') + '" style="--h:' + it.h + '" aria-hidden="true">' + it.mono + '</span>' +
      '<span class="tk-t"><span class="tk-s">' + esc(id) + '</span>' + (o.sub ? '<span class="tk-n">' + o.sub + '</span>' : o.name === false ? '' : '<span class="tk-n">' + esc(it.n) + '</span>') + '</span></a>';
  }
  function pxHTML(id) { var it = I[id]; return '<span class="px" data-px="' + esc(id) + '"><span>' + fmt(it.p, it.dp) + '</span></span>'; }
  function chgInner(it, o) {
    var pc = pctOf(it), up = pc >= 0;
    return { cls: 'chg ' + (up ? 'up' : 'dn') + (o && o.bare ? ' bare' : ''), html: (o && o.abs ? fsign(it.p - it.pc, it.dp) + ' (' + fpct(pc) + ')' : fpct(pc)) + ' <i aria-hidden="true">' + (up ? '▲' : '▼') + '</i>' };
  }
  function chgHTML(id, o) { var c = chgInner(I[id], o); return '<span class="' + c.cls + '" data-chg="' + esc(id) + '"' + (o && o.bare ? ' data-bare="1"' : '') + (o && o.abs ? ' data-abs="1"' : '') + '>' + c.html + '</span>'; }

  /* ---------- simulated ticks ---------- */
  var tickFns = [], rolls = {};
  function onTick(fn) { tickFns.push(fn); }
  function bindRoll(id, node, f) { var r = new Roll(node, f(I[id])); (rolls[id] = rolls[id] || []).push({ r: r, f: f }); return r; }
  function paint(it, prev) {
    var dir = it.p > prev ? 1 : -1, sel = '"' + it.id.replace(/"/g, '') + '"';
    $$('[data-px=' + sel + ']').forEach(function (n) {
      n.firstChild.textContent = fmt(it.p, it.dp); n.classList.remove('fu', 'fd'); void n.offsetWidth; n.classList.add(dir > 0 ? 'fu' : 'fd');
      setTimeout(function () { n.classList.remove('fu', 'fd'); }, 60);
    });
    $$('[data-chg=' + sel + ']').forEach(function (n) { var c = chgInner(it, { bare: n.dataset.bare, abs: n.dataset.abs }); n.className = c.cls; n.innerHTML = c.html; });
    (rolls[it.id] || []).forEach(function (b) { b.r.set(b.f(it), dir); });
  }
  var pool = LIST.concat(STRIP);
  setInterval(function () {
    if (document.hidden) return;
    var seen = {};
    for (var k = 0; k < 4; k++) {
      var it = pool[Math.floor(Math.random() * pool.length)]; if (seen[it.id]) continue; seen[it.id] = 1;
      var prev = it.p, unit = Math.pow(10, -it.dp), step = (Math.random() - 0.5) * 2 * it.p * 0.0009;
      if (Math.abs(step) < unit) step = step < 0 ? -unit : unit;
      it.p = +(it.p + step).toFixed(it.dp);
      paint(it, prev); tickFns.forEach(function (fn) { fn(it, prev); });
    }
  }, 2000);

  /* ---------- tabs and segmented controls with a gliding indicator ---------- */
  function initTabs(box, onChange) {
    var ind = $('.tab-ind', box) || box.appendChild(el('span', 'tab-ind'));
    function place(animate) {
      var a = $('.tab.is-active', box); if (!a) return;
      if (!animate) box.classList.add('no-anim');
      var cs = getComputedStyle(a), pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
      ind.style.transform = 'translateX(' + (a.offsetLeft + pl) + 'px) scaleX(' + Math.max(0, a.offsetWidth - pl - pr) / 100 + ')';
      if (!animate) { void ind.offsetWidth; box.classList.remove('no-anim'); }
    }
    box.addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t || !box.contains(t) || t.dataset.v == null) return;
      e.preventDefault(); select(t.dataset.v, true);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = $$('.tab[data-v]', box), i = tabs.indexOf(document.activeElement); if (i < 0) return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); select(n.dataset.v, true); e.preventDefault();
    });
    function select(v, animate) {
      var tabs = $$('.tab[data-v]', box), prev = tabs.findIndex(function (t) { return t.classList.contains('is-active'); }), next = tabs.findIndex(function (t) { return t.dataset.v === v; });
      if (next < 0) return;
      tabs.forEach(function (t, i) { t.classList.toggle('is-active', i === next); t.setAttribute('aria-selected', i === next ? 'true' : 'false'); });
      place(animate); tabs[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: rm() ? 'auto' : 'smooth' });
      if (onChange && prev !== next) onChange(v, next > prev ? 1 : -1);
    }
    place(false);
    window.addEventListener('resize', function () { place(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });
    document.addEventListener('ml:pref', function () { requestAnimationFrame(function () { place(false); }); });
    return { select: select, place: place };
  }
  function initSeg(box, onChange) {
    var ind = $('.seg-ind', box); if (!ind) { ind = el('span', 'seg-ind'); box.insertBefore(ind, box.firstChild); }
    function place(animate) {
      var a = $('button[aria-pressed="true"]', box); if (!a) return;
      if (!animate) box.classList.add('no-anim');
      ind.style.width = a.offsetWidth + 'px'; ind.style.transform = 'translateX(' + (a.offsetLeft - 0) + 'px)'; ind.style.left = '0';
      if (!animate) { void ind.offsetWidth; box.classList.remove('no-anim'); }
    }
    function select(v, animate, silent) {
      var hit = false;
      $$('button[data-v]', box).forEach(function (b) { var on = b.dataset.v === v; if (on) hit = true; b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      place(animate); if (hit && onChange && !silent) onChange(v);
    }
    box.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b && b.getAttribute('aria-pressed') !== 'true') select(b.dataset.v, true); });
    place(false);
    window.addEventListener('resize', function () { place(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false); });
    document.addEventListener('ml:pref', function () { requestAnimationFrame(function () { place(false); }); });
    return { select: select, place: place };
  }
  /* slide between sibling panels in the direction of travel */
  function showPanel(box, v, dir) {
    $$(':scope > .panel', box).forEach(function (p) {
      var on = p.dataset.v === v;
      if (!on) { p.classList.remove('is-active', 'enter-l', 'enter-r'); return; }
      p.classList.add(dir < 0 ? 'enter-l' : 'enter-r'); p.classList.add('is-active'); void p.offsetWidth; p.classList.remove('enter-l', 'enter-r');
    });
  }

  /* ---------- toasts ---------- */
  var toasts;
  function toast(msg) {
    if (!toasts) { toasts = el('div', 'toasts'); toasts.setAttribute('role', 'status'); toasts.setAttribute('aria-live', 'polite'); document.body.appendChild(toasts); }
    var t = el('div', 'toast glass'); t.textContent = msg; toasts.appendChild(t);
    while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 260); }, 3600);
  }

  /* ---------- reveal on first view ---------- */
  function observeReveal(scope) {
    var nodes = $$('.reveal:not(.in)', scope || document);
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (ents) {
      var i = 0;
      ents.forEach(function (en) { if (!en.isIntersecting) return; en.target.style.setProperty('--i', Math.min(8, i++)); en.target.classList.add('in'); io.unobserve(en.target); });
    }, { rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* ---------- shell: top bar, nav row, footer, overlays ---------- */
  var NAV = [['Home', 'home.html'], ['Markets', 'markets.html'], ['Screener', 'screener.html'], ['Compare', 'compare.html'], ['Calendars', 'calendars.html'], ['My Portfolio', 'portfolio.html'], ['Watchlists', 'watchlists.html'], ['My News', 'news.html'], ['Event Map', 'eventmap.html'], ['Tools', 'tools.html']];
  var pop = {};
  function closePops(except) { Object.keys(pop).forEach(function (k) { if (k !== except && pop[k]) pop[k].classList.remove('open'); }); var q = $('#q'); if (q && except !== 'search') q.setAttribute('aria-expanded', 'false'); }
  function place(node, x, y) {
    var w = node.offsetWidth, h = node.offsetHeight;
    node.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x)) + 'px';
    node.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y)) + 'px';
  }

  function shell(active) {
    var chrome = el('div', 'chrome glass'); chrome.id = 'chrome';
    chrome.innerHTML =
      '<a class="skip" href="#main">Skip to content</a>' +
      '<header class="topbar">' +
        '<a class="brand" href="home.html"><span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.mark + '</svg></span><span>Market Lens</span></a>' +
        '<div class="search" id="search">' + icon('search') +
          '<input id="q" type="search" placeholder="Search tickers or companies" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="q-pop" aria-label="Search tickers or companies">' +
          '<kbd aria-hidden="true">/</kbd><div class="pop search-pop" id="q-pop" role="listbox"></div></div>' +
        '<div class="top-actions"><span class="badge badge-sample" title="Every number in this mockup is invented">Sample data</span>' +
          '<button class="iconbtn" id="btn-bell" aria-label="Alerts, 3 new" aria-haspopup="dialog">' + icon('bell') + '<span class="count" aria-hidden="true">3</span></button>' +
          '<button class="iconbtn" id="btn-settings" aria-label="Settings" aria-haspopup="dialog">' + icon('sliders') + '</button>' +
          '<button class="iconbtn" id="btn-theme" aria-label="Switch between dark and light theme">' + icon(root.dataset.theme === 'light' ? 'moon' : 'sun') + '</button></div>' +
      '</header>' +
      '<nav class="navrow" aria-label="Primary"><div class="tabs" id="nav">' +
        NAV.map(function (n) { return '<a class="tab' + (n[0] === active ? ' is-active' : '') + '" href="' + (n[1] || '#') + '"' + (n[0] === active ? ' aria-current="page"' : '') + (n[1] ? '' : ' data-stub="' + n[0] + '"') + '>' + n[0] + '</a>'; }).join('') +
        '<span class="tab-ind"></span></div><a class="btn btn-quiet btn-sm ws' + (active === 'Workspace' ? ' is-on' : '') + '" href="workspace.html">Workspace</a></nav>';
    document.body.insertBefore(chrome, document.body.firstChild);
    initTabs($('#nav'));
    window.addEventListener('scroll', function () { chrome.classList.toggle('is-scrolled', window.scrollY > 4); }, { passive: true });

    var foot = el('footer', 'foot', '<span>Personal analysis tool, not financial advice. No trading or order entry.</span><span>Static mockup. Every number, story and forecast shown here is invented sample data.</span>');
    document.body.appendChild(foot);
    var bb = el('nav', 'bottombar glass');
    bb.setAttribute('aria-label', 'Sections');
    bb.innerHTML = [['Home', 'home', 'home.html'], ['Markets', 'globe', 'markets.html'], ['Search', 'search'], ['My Portfolio', 'case', 'portfolio.html'], ['Tools', 'more', 'tools.html']].map(function (b) {
      return '<a href="' + (b[2] || '#') + '"' + (b[0] === active ? ' class="is-active"' : '') + (b[2] ? '' : ' data-stub="' + b[0] + '"') + '>' + icon(b[1]) + '<span>' + b[0] + '</span></a>';
    }).join('');
    document.body.appendChild(bb);

    document.addEventListener('click', function (e) {
      var s = e.target.closest('[data-stub]'); if (!s) return;
      e.preventDefault();
      if (s.dataset.stub === 'Search') { $('#q').focus(); return; }
      toast(s.dataset.stub + ' is not part of this mockup.');
    });

    buildSearch(); buildSettings(); buildAlerts(); buildPalette(); buildTickerMenu(); buildHoverCard(); bindKeys(); bindDrag();

    $('#btn-theme').addEventListener('click', function () { setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'); });
    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.pop, .iconbtn, .search, .palette')) return;
      closePops();
    });
    observeReveal();
  }
  function setTheme(v) {
    function apply() { setPref('theme', v); var b = $('#btn-theme'); if (b) b.innerHTML = icon(v === 'light' ? 'moon' : 'sun'); }
    if (document.startViewTransition && !rm()) document.startViewTransition(apply); else apply();
  }

  /* search as you type: local only */
  function buildSearch() {
    var q = $('#q'), box = $('#q-pop'), act = 0, rows = [];
    pop.search = box;
    function render() {
      var s = q.value.trim().toLowerCase(), groups;
      function match(it) { return it.id.toLowerCase().indexOf(s) === 0 || it.n.toLowerCase().indexOf(s) >= 0; }
      if (!s) groups = [['Holdings', Object.keys(HOLD).slice(0, 4)], ['Watchlist', WATCH.slice(0, 3)]];
      else {
        var hits = LIST.filter(match).sort(function (a, b) { return (b.id.toLowerCase() === s) - (a.id.toLowerCase() === s) || (b.id.toLowerCase().indexOf(s) === 0) - (a.id.toLowerCase().indexOf(s) === 0); }).slice(0, 8).map(function (it) { return it.id; });
        groups = [['Results', hits]];
      }
      rows = []; var html = '';
      groups.forEach(function (g) {
        if (!g[1].length) return;
        html += '<div class="pop-h micro">' + g[0] + '</div>';
        g[1].forEach(function (id) {
          var it = I[id]; rows.push(id);
          html += '<a class="sr-row" role="option" href="stock.html?s=' + encodeURIComponent(id) + '" data-i="' + (rows.length - 1) + '">' +
            '<span class="tk" data-sym="' + id + '"><span class="mono" style="--h:' + it.h + '">' + it.mono + '</span><span class="tk-t"><span class="tk-s">' + id + ' <span class="ex">' + it.x + '</span></span><span class="tk-n">' + esc(it.n) + '</span></span></span>' +
            '<span class="p">' + CCY[it.c] + fmt(it.p) + '</span>' + chgHTML(id) + '</a>';
        });
      });
      if (!rows.length) html = '<div class="pop-h muted" style="padding:14px 10px">No ticker or company matches “' + esc(q.value) + '” in the sample set.</div>';
      box.innerHTML = html; act = 0; mark();
    }
    function mark() { $$('.sr-row', box).forEach(function (r, i) { r.classList.toggle('is-active', i === act); r.setAttribute('aria-selected', i === act ? 'true' : 'false'); }); }
    function open() { closePops('search'); render(); box.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
    q.addEventListener('focus', open);
    q.addEventListener('input', open);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { act = Math.min(rows.length - 1, act + 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); mark(); e.preventDefault(); }
      else if (e.key === 'Enter' && rows[act]) { location.href = 'stock.html?s=' + encodeURIComponent(rows[act]); }
      else if (e.key === 'Escape') { box.classList.remove('open'); q.setAttribute('aria-expanded', 'false'); q.blur(); }
    });
  }

  function buildSettings() {
    var p = el('div', 'pop settings'); p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Mockup settings');
    function seg(key, opts, cur) { return '<div class="seg" data-key="' + key + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
    var acc = [['', '#78A9FF', 'Ice blue'], ['violet', '#A08CF0', 'Violet'], ['teal', '#5CC4C0', 'Teal'], ['sand', '#D9B26A', 'Sand']];
    p.innerHTML =
      '<div class="set-row"><span class="label">Theme</span>' + seg('theme', [['dark', 'Dark'], ['light', 'Light']], root.dataset.theme) + '</div>' +
      '<div class="set-row"><span class="label">Density</span>' + seg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']], root.dataset.density) + '</div>' +
      '<div class="set-row"><span class="label">Accent</span><div class="swatches">' + acc.map(function (a) { return '<button type="button" class="swatch" data-accent="' + a[0] + '" style="background:' + a[1] + '" aria-label="' + a[2] + '" aria-pressed="' + ((root.dataset.accent || '') === a[0]) + '"></button>'; }).join('') + '</div></div>' +
      '<div class="set-row"><span class="label">Up and down colours</span>' + seg('updown', [['us', 'Green is up'], ['hk', 'Red is up']], root.dataset.updown || 'us') + '</div>' +
      '<div class="set-row"><span class="label">Motion</span>' + seg('motion', [['system', 'System'], ['reduced', 'Reduced']], root.dataset.motion === 'reduced' ? 'reduced' : 'system') + '</div>' +
      '<div class="set-row" id="set-extra"></div>';
    document.body.appendChild(p); pop.settings = p;
    var segs = $$('.seg', p).map(function (s) { return initSeg(s, function (v) { if (s.dataset.key === 'theme') setTheme(v); else setPref(s.dataset.key, v); }); });
    document.addEventListener('ml:pref', function (e) { if (e.detail.key === 'theme') segs[0].select(e.detail.value, true, true); });
    p.addEventListener('click', function (e) {
      var s = e.target.closest('.swatch'); if (!s) return;
      setPref('accent', s.dataset.accent);
      $$('.swatch', p).forEach(function (x) { x.setAttribute('aria-pressed', x === s ? 'true' : 'false'); });
    });
    $('#btn-settings').addEventListener('click', function () { var o = p.classList.contains('open'); closePops(); p.classList.toggle('open', !o); segs.forEach(function (s) { s.place(false); }); });
  }
  function buildAlerts() {
    var p = el('div', 'pop alerts-pop'); p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Alerts');
    p.innerHTML = '<div class="card-h"><h2 class="t3">Alerts</h2><span class="badge">3 new</span></div><div class="alerts">' + alertsHTML() + '</div>';
    document.body.appendChild(p); pop.alerts = p;
    $('#btn-bell').addEventListener('click', function () { var o = p.classList.contains('open'); closePops(); p.classList.toggle('open', !o); });
  }
  function alertsHTML() {
    return '<div class="alert"><i class="w"></i><div><b>SHEL.L</b> crossed your level of £27.50<div class="when">Price alert · 14:02</div></div></div>' +
      '<div class="alert"><i></i><div>Major story touches <b>COST</b> and <b>SHEL.L</b>: shipping disruption<div class="when">News alert · 11:40 · about 23% of portfolio exposed</div></div></div>' +
      '<div class="alert"><i class="w"></i><div>Technology is above your 25% sector limit<div class="when">Concentration · Friday</div></div></div>';
  }

  /* command palette */
  function buildPalette() {
    var scrim = el('div', 'scrim'), p = el('div', 'pop palette'); p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Command palette'); p.setAttribute('aria-modal', 'true');
    p.innerHTML = '<div class="pin">' + icon('search') + '<input id="pal-q" placeholder="Type a ticker, page or action" autocomplete="off" spellcheck="false" aria-label="Command"><kbd>Esc</kbd></div><div class="list" id="pal-list" role="listbox"></div>' +
      '<div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> run</span><span><kbd>Ctrl</kbd><kbd>K</kbd> toggle</span></div>';
    document.body.appendChild(scrim); document.body.appendChild(p);
    var q = $('#pal-q', p), list = $('#pal-list', p), items = [], act = 0, last;
    var ACTIONS = [
      ['Switch theme', 'sun', function () { setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'); }],
      ['Toggle density: Comfortable or Compact', 'table', function () { setPref('density', compact() ? 'comfortable' : 'compact'); }],
      ['Toggle reduced motion', 'pause', function () { setPref('motion', root.dataset.motion === 'reduced' ? 'system' : 'reduced'); }],
      ['Open Event Map', 'globe', function () { location.href = 'eventmap.html'; }],
      ['Open event mind map', 'map', function () { location.href = 'mindmap.html'; }],
      ['Go to Home', 'home', function () { location.href = 'home.html'; }]
    ];
    function render() {
      var s = q.value.trim().toLowerCase(); items = []; var html = '';
      var tks = LIST.filter(function (it) { return !s ? HOLD[it.id] : (it.id.toLowerCase().indexOf(s) === 0 || it.n.toLowerCase().indexOf(s) >= 0); }).slice(0, s ? 6 : 4);
      if (tks.length) html += '<div class="grp micro">Tickers</div>';
      tks.forEach(function (it) { items.push(function () { location.href = 'stock.html?s=' + encodeURIComponent(it.id); }); html += '<button class="mi" role="option" data-i="' + (items.length - 1) + '"><span class="mono" style="--h:' + it.h + '">' + it.mono + '</span><span><b>' + it.id + '</b> <span class="dim">' + esc(it.n) + '</span></span><kbd>Enter</kbd></button>'; });
      var acts = ACTIONS.filter(function (a) { return !s || a[0].toLowerCase().indexOf(s) >= 0; });
      if (acts.length) html += '<div class="grp micro">Actions</div>';
      acts.forEach(function (a) { items.push(a[2]); html += '<button class="mi" role="option" data-i="' + (items.length - 1) + '">' + icon(a[1]) + '<span>' + a[0] + '</span></button>'; });
      if (!items.length) html = '<div class="grp muted" style="padding:16px 10px">Nothing matches.</div>';
      list.innerHTML = html; act = 0; mark();
    }
    function mark() { $$('.mi', list).forEach(function (m, i) { m.classList.toggle('is-active', i === act); if (i === act) m.scrollIntoView({ block: 'nearest' }); }); }
    function open() { closePops(); last = document.activeElement; q.value = ''; render(); scrim.classList.add('open'); p.classList.add('open'); setTimeout(function () { q.focus(); }, 20); }
    function close() { scrim.classList.remove('open'); p.classList.remove('open'); if (last && last.focus) last.focus(); }
    function run(i) { var f = items[i]; close(); if (f) f(); }
    q.addEventListener('input', render);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { act = Math.min(items.length - 1, act + 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') { run(act); e.preventDefault(); }
      else if (e.key === 'Tab') e.preventDefault();
    });
    list.addEventListener('click', function (e) { var m = e.target.closest('.mi'); if (m) run(+m.dataset.i); });
    scrim.addEventListener('click', close);
    pop.palette = null;
    ML.palette = { open: open, close: close, isOpen: function () { return p.classList.contains('open'); } };
  }

  /* right-click menu on any ticker */
  function buildTickerMenu() {
    var m = el('div', 'pop menu ctx'); m.setAttribute('role', 'menu');
    var items = [['Open stock page', 'chart', 'Enter'], ['Add to watchlist', 'star', 'W'], ['Add holding', 'plus', ''], ['Compare', 'compare', 'C'], ['Set alert', 'bell', 'A'], null, ['Run drawdown check', 'down', 'D'], ['Open mind map', 'map', 'M'], ['Run stress test', 'zap', 'T']];
    document.body.appendChild(m); pop.ctx = m;
    var sym = null, back = null;
    function open(id, x, y) {
      sym = id; back = document.activeElement; closePops('ctx');
      m.innerHTML = '<div class="pop-h micro">' + esc(id) + ' · ' + esc(I[id].n) + '</div>' + items.map(function (it) { return it ? '<button class="mi" role="menuitem" data-a="' + it[0] + '">' + icon(it[1]) + '<span>' + it[0] + '</span>' + (it[2] ? '<kbd>' + it[2] + '</kbd>' : '') + '</button>' : '<hr>'; }).join('');
      m.classList.add('open'); place(m, x, y); var f = $('.mi', m); if (f) f.focus({ preventScroll: true });
    }
    function close() { m.classList.remove('open'); if (back && back.focus) back.focus({ preventScroll: true }); }
    document.addEventListener('contextmenu', function (e) { var t = e.target.closest('.tk[data-sym]'); if (!t) return; e.preventDefault(); open(t.dataset.sym, e.clientX, e.clientY); });
    document.addEventListener('keydown', function (e) {
      var t = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.tk[data-sym]') : null;
      if (t && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); var r = t.getBoundingClientRect(); open(t.dataset.sym, r.left, r.bottom + 4); }
      if (!m.classList.contains('open')) return;
      var mis = $$('.mi', m), i = mis.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { mis[(i + 1) % mis.length].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { mis[(i + mis.length - 1) % mis.length].focus(); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); e.stopPropagation(); }
    }, true);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('.mi'); if (!b) return; var a = b.dataset.a; m.classList.remove('open');
      if (a === 'Open stock page') location.href = 'stock.html?s=' + encodeURIComponent(sym);
      else if (a === 'Open mind map') location.href = 'mindmap.html';
      else if (a === 'Add to watchlist') { document.dispatchEvent(new CustomEvent('ml:watch', { detail: sym })); toast(sym + ' added to Watchlist.'); }
      else if (a === 'Compare') location.href = 'compare.html?s=' + encodeURIComponent(sym);
      else if (a === 'Add holding') location.href = 'portfolio.html?add=' + encodeURIComponent(sym);
      else if (a === 'Run drawdown check') location.href = 'stock.html?s=' + encodeURIComponent(sym) + '#drawdown';
      else if (a === 'Run stress test') location.href = 'stock.html?s=' + encodeURIComponent(sym) + '#stress';
      else toast(a + ' for ' + sym + ' is not part of this mockup.');
    });
  }

  /* hover card: mini quote and sparkline */
  function buildHoverCard() {
    var c = el('div', 'pop hcard'); c.setAttribute('role', 'tooltip'); document.body.appendChild(c); pop.hover = c;
    var timer, cur;
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch') return;
      var t = e.target.closest('.tk[data-sym]'); if (!t || t === cur || t.closest('.hcard, .search-pop, .palette')) return;
      clearTimeout(timer); cur = t;
      timer = setTimeout(function () {
        var id = t.dataset.sym, it = I[id], h = HOLD[id], lo = Math.min(it.p, it.pc) * 0.994, hi = Math.max(it.p, it.pc) * 1.005;
        c.innerHTML = '<div class="top">' + tk(id) + '<span class="ex badge badge-x">' + it.x + '</span></div>' +
          '<div class="big">' + CCY[it.c] + '<span data-px="' + id + '" class="px"><span>' + fmt(it.p) + '</span></span> ' + chgHTML(id, { abs: true }) + '</div>' +
          '<canvas></canvas><div class="rangebar" style="--p:' + ((it.p - lo) / (hi - lo) * 100).toFixed(1) + '%"><i></i></div>' +
          '<div class="rangebar-l"><span>Day low ' + fmt(lo) + '</span><span>High ' + fmt(hi) + '</span></div>' +
          (h ? '<div class="mod-foot" style="margin-top:10px"><span class="badge badge-accent">Held · ' + h.q + ' shares</span><span class="' + (it.p >= h.cost ? 'up' : 'dn') + '">' + fpct((it.p / h.cost - 1) * 100, 1) + ' since purchase</span></div>' : '');
        var r = t.getBoundingClientRect(); c.classList.add('open');
        /* below the ticker, or above it when there is no room */
        place(c, r.left, r.bottom + 8 + c.offsetHeight > window.innerHeight ? r.top - c.offsetHeight - 8 : r.bottom + 8);
        spark($('canvas', c), series(id, 40, 0.006), { fill: true, w: 256, h: 44, base: it.pc });
      }, 350);
    });
    document.addEventListener('pointerout', function (e) {
      var t = e.target.closest('.tk[data-sym]'); if (!t || t !== cur) return;
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      clearTimeout(timer); cur = null; c.classList.remove('open');
    });
    window.addEventListener('scroll', function () { clearTimeout(timer); cur = null; c.classList.remove('open'); }, { passive: true });
  }

  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (ML.palette.isOpen()) ML.palette.close(); else ML.palette.open(); return; }
      if (e.key === 'Escape') { if (ML.palette.isOpen()) ML.palette.close(); closePops(); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || ML.palette.isOpen()) return;
      if (e.key === '/') { e.preventDefault(); $('#q').focus(); return; }
      /* start typing a ticker anywhere to load it */
      if (e.key.length === 1 && /[a-z0-9]/i.test(e.key) && !e.target.closest('[data-keys]')) $('#q').focus();
    });
  }

  /* shared-element morph: name the clicked ticker so the browser can morph it into the stock header */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('a.tk[data-sym], a.sr-row'); if (!t || rm() || compact()) return;
    var n = t.classList.contains('tk') ? t : $('.tk', t); if (n) n.style.viewTransitionName = 'stock-hero';
  }, true);

  /* drag a ticker onto a drop zone */
  function bindDrag() {
    document.addEventListener('dragstart', function (e) {
      var t = e.target.closest ? e.target.closest('.tk[data-sym]') : null; if (!t) return;
      e.dataTransfer.setData('application/x-ml-ticker', t.dataset.sym); e.dataTransfer.setData('text/plain', t.dataset.sym); e.dataTransfer.effectAllowed = 'copy';
      t.classList.add('dragging'); clearTimeout(0); if (pop.hover) pop.hover.classList.remove('open');
    });
    document.addEventListener('dragend', function (e) { var t = e.target.closest ? e.target.closest('.tk') : null; if (t) t.classList.remove('dragging'); $$('.drop-ok').forEach(function (n) { n.classList.remove('drop-ok'); }); });
    document.addEventListener('dragover', function (e) { var z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; z.classList.add('drop-ok'); });
    document.addEventListener('dragleave', function (e) { var z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('drop-ok'); });
    document.addEventListener('drop', function (e) {
      var z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('drop-ok');
      var sym = e.dataTransfer.getData('application/x-ml-ticker') || e.dataTransfer.getData('text/plain');
      if (I[sym]) document.dispatchEvent(new CustomEvent('ml:drop', { detail: { sym: sym, zone: z.dataset.drop } }));
    });
  }

  /* ---------- helpers for the other screens (documented in CONVENTIONS.md) ---------- */
  var stockTabs = {};
  function stockTab(name, fn) { stockTabs[name] = fn; }

  /* parse "1,234.5", "(12.3)", "−4.2%", "$3.4B" into a number */
  function parseNum(s) {
    s = String(s).replace(/HK\$|[,$£€%\s]/g, '').replace('−', '-').replace(/^\+/, '');
    var neg = /^\(.*\)$/.test(s); s = s.replace(/[()]/g, '');
    var m = /^(-?[\d.]+)([KMBT])?/.exec(s); if (!m) return NaN;
    var v = parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2]] || 1); return neg ? -v : v;
  }
  /* click a th[data-sort="num"|"text"] to sort; a cell may carry data-v as its sort value */
  function sortable(table) {
    var head = table.tHead; if (!head) return;
    head.addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]'); if (!th) return;
      var idx = Array.prototype.indexOf.call(th.parentNode.children, th), dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending', num = th.dataset.sort === 'num';
      $$('th', head).forEach(function (x) { x.removeAttribute('aria-sort'); }); th.setAttribute('aria-sort', dir);
      var body = table.tBodies[0], rows = $$('tr', body);
      rows.sort(function (a, b) {
        var x = a.children[idx], y = b.children[idx], av = x.dataset.v != null ? x.dataset.v : x.textContent.trim(), bv = y.dataset.v != null ? y.dataset.v : y.textContent.trim(), r;
        if (num) { var an = parseNum(av), bn = parseNum(bv); r = (isNaN(an) ? -Infinity : an) - (isNaN(bn) ? -Infinity : bn); } else r = av.localeCompare(bv);
        return dir === 'ascending' ? r : -r;
      });
      rows.forEach(function (r) { body.appendChild(r); });
    });
  }
  function plotCanvas(host) { var cv = $('canvas', host); if (!cv) { cv = el('canvas'); host.appendChild(cv); } return cv; }
  function colorOf(c) { return COL[c] || c; }
  /* multi-series line chart in a .plot host. series: [{data, color: 'data-1', lw, dash, alpha, fill}]; opt: {fmt, labels: [{f, t}], zero, axis} */
  function lines(host, series, opt) {
    opt = opt || {}; var cv = plotCanvas(host);
    function draw() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      var ctx = fitCanvas(cv, w, h), pr = opt.axis === false ? 4 : 54, pt = 10, pb = opt.labels ? 24 : 8, iw = w - pr, ih = h - pt - pb, lo = Infinity, hi = -Infinity;
      series.forEach(function (s) { s.data.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
      if (opt.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
      var f = opt.fmt || function (v) { return fmt(v, 1); };
      function Y(v) { return pt + (1 - (v - lo) / (hi - lo)) * ih; }
      ctx.clearRect(0, 0, w, h); ctx.font = '500 11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
      for (var k = 0; k < 4; k++) {
        var gv = lo + (hi - lo) * (k + 0.5) / 4, gy = Math.round(Y(gv)) + 0.5;
        ctx.strokeStyle = rgba(COL['text-1'], 0.06); ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(iw, gy); ctx.stroke();
        if (opt.axis !== false) { ctx.fillStyle = COL['text-3']; ctx.textAlign = 'left'; ctx.fillText(f(gv), iw + 8, gy); }
      }
      if (opt.zero && lo < 0 && hi > 0) { ctx.strokeStyle = rgba(COL['text-1'], 0.18); ctx.beginPath(); ctx.moveTo(0, Math.round(Y(0)) + 0.5); ctx.lineTo(iw, Math.round(Y(0)) + 0.5); ctx.stroke(); }
      ctx.fillStyle = COL['text-3'];
      (opt.labels || []).forEach(function (l) { ctx.textAlign = l.f < 0.04 ? 'left' : l.f > 0.96 ? 'right' : 'center'; ctx.fillText(l.t, l.f * iw, h - 9); });
      series.forEach(function (s, si) {
        var c = colorOf(s.color || ('data-' + (si % 6 + 1))), n = s.data.length;
        ctx.beginPath(); s.data.forEach(function (v, i) { var x = n > 1 ? i / (n - 1) * iw : iw / 2, y = Y(v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.lineWidth = s.lw || 1.75; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = c; ctx.globalAlpha = s.alpha == null ? 1 : s.alpha; ctx.setLineDash(s.dash || []); ctx.stroke(); ctx.setLineDash([]);
        if (s.fill) { ctx.lineTo(iw, pt + ih); ctx.lineTo(0, pt + ih); ctx.closePath(); var g = ctx.createLinearGradient(0, pt, 0, pt + ih); g.addColorStop(0, rgba(c, 0.18)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fill(); }
        ctx.globalAlpha = 1;
      });
    }
    draw(); new ResizeObserver(draw).observe(host); document.addEventListener('ml:paint', draw);
    return { draw: draw, set: function (s) { series = s; draw(); } };
  }
  /* bar chart in a .plot host. opt: {labels: [], color: 'accent', signed: gain/loss colours by sign, fmt, values: show value labels, colors: fn(v, i) -> token name} */
  function bars(host, values, opt) {
    opt = opt || {}; var cv = plotCanvas(host);
    function draw() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      var ctx = fitCanvas(cv, w, h), n = values.length, pt = opt.values ? 20 : 10, pb = opt.labels ? 22 : 6, ih = h - pt - pb, lo = Math.min(0, Math.min.apply(null, values)), hi = Math.max(0, Math.max.apply(null, values)), gap = n > 12 ? 3 : n > 6 ? 6 : 10, bw = (w - gap * (n - 1)) / n;
      var f = opt.fmt || function (v) { return fmt(v, 1); };
      function Y(v) { return pt + (1 - (v - lo) / (hi - lo || 1)) * ih; }
      ctx.clearRect(0, 0, w, h); ctx.font = '500 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = rgba(COL['text-1'], 0.14); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Math.round(Y(0)) + 0.5); ctx.lineTo(w, Math.round(Y(0)) + 0.5); ctx.stroke();
      values.forEach(function (v, i) {
        var x = i * (bw + gap), y0 = Y(0), y1 = Y(v), top = Math.min(y0, y1), bh = Math.max(1, Math.abs(y1 - y0)), r = Math.min(4, bw / 2, bh);
        ctx.fillStyle = colorOf(opt.colors ? opt.colors(v, i) : opt.signed ? (v >= 0 ? 'gain' : 'loss') : (opt.color || 'accent'));
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, top, bw, bh, v >= 0 ? [r, r, 0, 0] : [0, 0, r, r]); else ctx.rect(x, top, bw, bh); ctx.fill();
        if (opt.values) { ctx.fillStyle = COL['text-2']; ctx.fillText(f(v), x + bw / 2, v >= 0 ? top - 9 : top + bh + 9); }
        if (opt.labels) { ctx.fillStyle = COL['text-3']; ctx.fillText(opt.labels[i] || '', x + bw / 2, h - 9); }
      });
    }
    draw(); new ResizeObserver(draw).observe(host); document.addEventListener('ml:paint', draw);
    return { draw: draw, set: function (v) { values = v; draw(); } };
  }
  /* side sheet: ML.sheet(title, html, onOpen) and ML.closeSheet(). A [data-close] element inside closes it */
  var sheetEl, sheetScrim, sheetBack;
  function closeSheet() { if (!sheetEl) return; sheetEl.classList.remove('open'); sheetScrim.classList.remove('open'); if (sheetBack && sheetBack.focus) sheetBack.focus({ preventScroll: true }); }
  function sheet(title, html, onOpen) {
    if (!sheetEl) {
      sheetScrim = el('div', 'sheet-scrim'); sheetEl = el('aside', 'sheet'); sheetEl.setAttribute('role', 'dialog'); sheetEl.setAttribute('aria-modal', 'true');
      document.body.appendChild(sheetScrim); document.body.appendChild(sheetEl);
      sheetScrim.addEventListener('click', closeSheet);
      sheetEl.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetEl.classList.contains('open')) closeSheet(); });
    }
    sheetBack = document.activeElement; sheetEl.setAttribute('aria-label', title);
    sheetEl.innerHTML = '<div class="sheet-h"><h2 class="t2">' + esc(title) + '</h2><button class="iconbtn" type="button" data-close aria-label="Close">' + icon('x') + '</button></div><div class="sheet-b">' + html + '</div>';
    sheetScrim.classList.add('open'); sheetEl.classList.add('open');
    var f = $('input, select, textarea, button:not([data-close])', sheetEl); if (f) setTimeout(function () { f.focus(); }, 30);
    if (onOpen) onOpen(sheetEl); return sheetEl;
  }

  var ML = window.ML = {
    I: I, LIST: LIST, STRIP: STRIP, HOLD: HOLD, WATCH: WATCH, FX: FX, CCY: CCY, COL: COL, SPRING: SPRING,
    rm: rm, compact: compact, setPref: setPref, tween: tween, springTo: springTo, easeOut: easeOut,
    rng: rng, hash: hash, bridge: bridge, resample: resample, series: series, rgba: rgba,
    fmt: fmt, fsign: fsign, fpct: fpct, fbig: fbig, esc: esc, $: $, $$: $$, el: el, icon: icon,
    pctOf: pctOf, valueUSD: valueUSD, portfolio: portfolio,
    fitCanvas: fitCanvas, spark: spark, AreaChart: AreaChart, Roll: Roll, bindRoll: bindRoll,
    tk: tk, pxHTML: pxHTML, chgHTML: chgHTML, onTick: onTick,
    initTabs: initTabs, initSeg: initSeg, showPanel: showPanel, toast: toast, observeReveal: observeReveal,
    shell: shell, alertsHTML: alertsHTML, closePops: closePops,
    stockTabs: stockTabs, stockTab: stockTab, parseNum: parseNum, sortable: sortable, lines: lines, bars: bars, sheet: sheet, closeSheet: closeSheet
  };
})();
