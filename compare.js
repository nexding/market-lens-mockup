/* Market Lens mockup: Compare. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc;
  M.shell('Compare');

  /* ---------- sample universe: this block is the same in screener.js and compare.js ---------- */
  var YEARS = ['FY2021', 'FY2022', 'FY2023', 'FY2024', 'FY2025'], DAYS = 1260;
  function nz(seed) { return (M.rng(M.hash(seed))() - 0.5) * 2; }
  /* per company: market cap in US$ billions, gross margin, operating margin, extra revenue growth, capital intensity, return on equity, debt to equity, dividend yield in percent.
     AAPL has no entry: it uses the stock page's statement template unchanged, so its figures match stock.html */
  var SHAPE = {
    'MSFT': [3810, 0.69, 0.44, 0.06, 3.5, 0.33, 0.25, 0.68], 'NVDA': [4590, 0.72, 0.60, 0.42, 0.6, 0.85, 0.10, 0.02], 'COST': [418, 0.127, 0.037, 0, 2.2, 0.29, 0.28, 0.55],
    '0700.HK': [720, 0.53, 0.32, 0.03, 1.6, 0.21, 0.35, 0.75], '1299.HK': [107, 0.40, 0.20, -0.01, 0.3, 0.15, 0.30, 2.4], 'SHEL.L': [209, 0.24, 0.11, -0.09, 4.2, 0.11, 0.40, 3.9],
    'HSBA.L': [213, 0.62, 0.40, -0.04, 0.4, 0.13, 1.20, 5.4], 'TSM': [1560, 0.58, 0.46, 0.22, 5.5, 0.30, 0.22, 1.2], 'AMZN': [2570, 0.49, 0.11, 0.035, 6.0, 0.22, 0.45, 0],
    '9988.HK': [386, 0.40, 0.14, -0.01, 2.5, 0.12, 0.25, 1.1], 'AZN.L': [233, 0.81, 0.24, 0.05, 1.2, 0.19, 0.70, 2.1], 'JPM': [860, 0.60, 0.41, -0.01, 0.3, 0.17, 1.30, 1.9],
    'XOM': [520, 0.30, 0.135, -0.08, 4.5, 0.13, 0.16, 3.4], 'PLTR': [440, 0.80, 0.24, 0.26, 0.3, 0.20, 0.02, 0], 'LMT': [120, 0.12, 0.105, -0.03, 1.3, 0.62, 2.60, 2.6],
    'DAL': [38, 0.23, 0.095, -0.03, 4.0, 0.28, 1.25, 1.0], 'IAG.L': [22, 0.26, 0.12, -0.01, 4.5, 0.40, 1.90, 2.3], 'UNH': [300, 0.21, 0.068, 0.02, 0.9, 0.19, 0.78, 2.6],
    'INTC': [150, 0.40, 0.11, -0.10, 13, 0.07, 0.46, 0], 'TSLA': [1320, 0.18, 0.075, 0.01, 7.5, 0.10, 0.11, 0], 'F': [51, 0.09, 0.028, -0.03, 5.5, 0.09, 3.20, 4.9]
  };
  /* five fiscal years in millions of the reporting currency, oldest first: the stock page's template (stock.js, buildData) reshaped per company */
  function statements(id) {
    var it = I[id], s = SHAPE[id], pe = 14 + M.hash(id + 'pe') % 22, L = {}, k = 1;
    var c = s ? (1 - s[1]) / 0.5386 : 1, o = s ? (s[1] - s[2]) / 0.151 : 1, q = s ? s[2] / 0.3104 : 1, dg = s ? s[3] : 0, x = s ? s[4] : 1, nq = Math.min(1, q);
    function leaf(key, base, g, nv) { L[key] = [0, 1, 2, 3, 4].map(function (y) { return base * Math.pow(1 + g, y - 4) * (1 + nz(id + key + y) * nv); }); }
    function calc(key, fn) { L[key] = [0, 1, 2, 3, 4].map(function (i) { return fn(function (n) { return L[n][i]; }); }); }
    function gr(base, w) { return s ? 0.074 + dg * (w || 1) + (base - 0.074) * nq : base; }
    function income() {
      leaf('prod', 298000 * k, gr(0.055), 0.02 * nq); leaf('serv', 104000 * k, gr(0.13), 0.015 * nq); calc('rev', function (g) { return g('prod') + g('serv'); });
      leaf('cprod', 188000 * k * c, gr(0.05), 0.02 * nq); leaf('cserv', 28500 * k * c, gr(0.11), 0.02 * nq); calc('cor', function (g) { return g('cprod') + g('cserv'); });
      calc('gp', function (g) { return g('rev') - g('cor'); });
      leaf('rnd', 33500 * k * o, gr(0.09, 0.8), 0.01 * nq); leaf('sga', 27200 * k * o, gr(0.045, 0.8), 0.01 * nq); calc('opex', function (g) { return g('rnd') + g('sga'); });
      calc('oi', function (g) { return g('gp') - g('opex'); });
      leaf('oth', 420 * k * q, 0, 0.6); calc('pti', function (g) { return g('oi') + g('oth'); });
      calc('ni', function (g) { return g('pti') - g('pti') * 0.162; });
    }
    income();
    if (s) { k = s[0] * 1000 / M.FX[it.c] / pe / L.ni[4]; income(); }
    leaf('sh', L.ni[4] / (it.p / pe), -0.028, 0.002); calc('eps', function (g) { return g('ni') / g('sh'); });
    leaf('da', 11800 * k * q, 0.03 + dg, 0.01); leaf('sbc', 12400 * k * q, 0.1 + dg, 0.01); leaf('wc', 3200 * k * q, dg, 0.9); leaf('capex', -11900 * k * q * x, 0.07 + dg, 0.03);
    calc('fcf', function (g) { return g('ni') + g('da') + g('sbc') + g('wc') + g('capex'); });
    if (s) { leaf('eq', L.ni[4] / s[5], 0.06, 0.03); leaf('debt', L.eq[4] * s[6], 0.02, 0.02); }
    else {
      leaf('cash', 31200, 0.02, 0.05); leaf('sec', 128400, -0.03, 0.03); leaf('rec', 62100, 0.06, 0.03); leaf('inv', 7400, 0.04, 0.05); leaf('ppe', 46800, 0.035, 0.01); leaf('oa', 88600, 0.05, 0.02);
      leaf('ap', 68900, 0.05, 0.03); leaf('dr', 13100, 0.04, 0.03); leaf('debt', 96700, -0.04, 0.02); leaf('ol', 129300, 0.03, 0.02);
      calc('eq', function (g) { return g('cash') + g('sec') + g('rec') + g('inv') + g('ppe') + g('oa') - (g('ap') + g('dr') + g('debt') + g('ol')); });
    }
    L.pe = pe; return L;
  }
  /* five years of daily closes ending at the current price. AAPL follows the stock page's story: a July peak, now 27% below it */
  function pricePath(id) {
    var it = I[id], r = M.rng(M.hash(id + ':path')), pts, out = [], noise = M.bridge(id + ':5y', DAYS + 1, 1, 1, 0.008);
    if (id === 'AAPL') pts = [[0, 0.45], [0.5, 0.8], [0.8, 0.93], [0.89, 1.22], [0.924, 1.37], [0.96, 1.08], [0.983, 0.96], [0.992, 1.03], [1, 1]];
    else {
      var d = Math.max(-1, Math.min(1, M.pctOf(it) / 8 + nz(id + 'drift') * 0.75)), y1 = 1 / (1.06 + d * 0.34), y5 = y1 * (0.35 + r() * 0.75), tf = 0.8 + (0.15 + r() * 0.5) * 0.2, mf;
      if (d > 0.2) mf = Math.min(y1, 1) * (0.84 + r() * 0.1); else if (d < -0.2) mf = Math.max(y1, 1) * (1.05 + r() * 0.14); else mf = r() < 0.5 ? Math.max(y1, 1) * (1.1 + r() * 0.2) : Math.min(y1, 1) * (0.76 + r() * 0.12);
      pts = [[0, y5], [0.45, Math.sqrt(y5 * y1) * (0.85 + r() * 0.4)], [0.8, y1], [tf, mf], [0.962, d > 0.2 ? 1 + r() * 0.16 : d < -0.2 ? 1 - r() * 0.13 : 1 + (r() - 0.5) * 0.14], [0.983, 1 - d * 0.05 - (r() - 0.5) * 0.08], [1, 1]];
    }
    for (var i = 0; i <= DAYS; i++) {
      var t = i / DAYS, j = 0; while (j < pts.length - 2 && t > pts[j + 1][0]) j++;
      var a = pts[j], b = pts[j + 1]; out.push(it.p * (a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])) * noise[i]);
    }
    out[DAYS] = it.p; return out;
  }
  var SAMPLE = {};
  function sample(id) {
    if (SAMPLE[id]) return SAMPLE[id];
    var it = I[id], L = statements(id), path = pricePath(id), s = SHAPE[id], r = M.rng(M.hash(id + ':vol')), yr = path.slice(DAYS - 252), hi = Math.max.apply(null, yr), lo = Math.min.apply(null, yr);
    var cap = L.sh[4] * 1e6 * it.p, avg = s ? L.sh[4] * 1e6 * (0.0025 + r() * 0.007) : 60140000, rvol = s ? 0.62 + Math.abs(M.pctOf(it)) * 0.24 + r() * 0.5 : 52210000 / 60140000;
    function back(n) { return (it.p / path[DAYS - n] - 1) * 100; }
    return (SAMPLE[id] = {
      id: id, it: it, cur: M.CCY[it.c], fx: M.FX[it.c], L: L, path: path, full: it.x !== 'HKEX' && it.x !== 'LSE',
      cap: cap, capUSD: cap * M.FX[it.c], pe: it.p / L.eps[4], fpe: it.p / L.eps[4] * 0.9, pb: cap / (L.eq[4] * 1e6), yld: s ? s[7] : +(it.p * 0.0045).toFixed(2) * 4 / it.p * 100,
      revg: (L.rev[4] / L.rev[3] - 1) * 100, epsg: (L.ni[4] / L.ni[3] - 1) * 100, opm: L.oi[4] / L.rev[4] * 100, roe: L.ni[4] / L.eq[4] * 100, de: L.debt[4] / L.eq[4],
      beta: 0.8 + (M.hash(id + 'b') % 70) / 100, p1m: back(21), p6m: back(126), p1y: back(252), p5y: back(DAYS), hi52: hi, lo52: lo, r52: (it.p - lo) / (hi - lo) * 100,
      avgVol: avg, rvol: rvol, vol: avg * rvol
    });
  }

  /* ---------- which stocks: read from ?s=AAPL,MSFT and written back on every change ---------- */
  var MAX = 6, DEFAULT = ['AAPL', 'MSFT', 'NVDA'], NOW = new Date(2026, 10, 16, 16, 0), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fromURL() {
    var q = new URLSearchParams(location.search).get('s'), out = [];
    if (q == null) return DEFAULT.slice();
    q.split(',').forEach(function (t) { t = t.trim().toUpperCase(); if (I[t] && I[t].kind === 'stock' && out.indexOf(t) < 0 && out.length < MAX) out.push(t); });
    return out.length || !q.trim() ? out : DEFAULT.slice();
  }
  var ids = fromURL(), tint = {}, range = '1Y', usd = false, fresh = null;
  /* a stock keeps its colour for as long as it stays in the comparison */
  function assign() {
    Object.keys(tint).forEach(function (id) { if (ids.indexOf(id) < 0) delete tint[id]; });
    ids.forEach(function (id) {
      if (tint[id]) return;
      var used = ids.map(function (x) { return tint[x]; }), n = 1; while (used.indexOf(n) >= 0) n++;
      tint[id] = n;
    });
  }
  function col(id) { return 'var(--data-' + tint[id] + ')'; }
  function big(v) {
    var a = Math.abs(v), u = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : [1e6, 'M'], x = v / u[0];
    return x.toFixed(Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2) + u[1];
  }
  function chg(v, dp) { var up = v >= 0; return '<span class="chg bare ' + (up ? 'up' : 'dn') + '">' + M.fpct(v, dp == null ? 1 : dp) + ' <i aria-hidden="true">' + (up ? '▲' : '▼') + '</i></span>'; }
  function dateAt(f, days, mode) {
    var d = new Date(NOW.getTime() - (1 - f) * days * 864e5);
    return mode === 'm' ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()] + (mode === 'y' ? ' ' + d.getFullYear() : '');
  }

  /* ---------- slots ---------- */
  var slots = $('#cmp-slots'), pop = $('#cmp-pop'), q = $('#cmp-q'), list = $('#cmp-list'), act = 0, hits = [];
  function renderSlots() {
    var free = MAX - ids.length;
    slots.innerHTML = ids.map(function (id) {
      var it = I[id];
      return '<div class="slot' + (id === fresh ? ' is-new' : '') + '" style="--c:' + col(id) + '" data-id="' + esc(id) + '"><div class="slot-t">' + M.tk(id) +
        '<button class="iconbtn slot-x" type="button" data-remove="' + esc(id) + '" aria-label="Remove ' + esc(id) + ' from the comparison" title="Remove">' + M.icon('x', 'ic-sm') + '</button></div>' +
        '<div class="slot-q"><span class="slot-p"><span class="dim">' + M.CCY[it.c] + '</span>' + M.pxHTML(id) + '</span>' + M.chgHTML(id, { bare: true }) + '</div></div>';
    }).join('') + (free ? '<div class="slot slot-add"><button class="slot-add-b" id="cmp-add" type="button" aria-haspopup="dialog" aria-expanded="false"><span>' + M.icon('plus', 'ic-sm') + 'Add a stock</span><small>' + (free === 1 ? '1 slot free' : free + ' slots free') + '</small></button></div>' : '');
    fresh = null;
  }
  function setIds(next, focus) {
    closeAdd(); ids = next; sync();
    var t = focus === 'add' ? $('#cmp-add') || $$('.slot-x', slots).pop() : typeof focus === 'number' ? $$('.slot-x', slots)[Math.min(focus, ids.length - 1)] || $('#cmp-add') : null;
    if (t) t.focus({ preventScroll: true });
  }
  slots.addEventListener('click', function (e) {
    var x = e.target.closest('[data-remove]');
    if (x) { var i = ids.indexOf(x.dataset.remove); setIds(ids.filter(function (id) { return id !== x.dataset.remove; }), i); M.toast(x.dataset.remove + ' removed from the comparison.'); return; }
    if (e.target.closest('#cmp-add')) { if (pop.classList.contains('open')) closeAdd(true); else openAdd(); }
  });

  /* add control: a small local search over the sample stocks */
  function renderList() {
    var s = q.value.trim().toLowerCase();
    hits = M.LIST.filter(function (it) { return ids.indexOf(it.id) < 0 && (!s || it.id.toLowerCase().indexOf(s) === 0 || it.n.toLowerCase().indexOf(s) >= 0 || it.sec.toLowerCase().indexOf(s) === 0); })
      .sort(function (a, b) { return (b.id.toLowerCase().indexOf(s) === 0) - (a.id.toLowerCase().indexOf(s) === 0); }).slice(0, 8);
    act = 0;
    list.innerHTML = hits.length ? hits.map(function (it, i) {
      return '<button type="button" class="mi cmp-opt" role="option" id="cmp-o' + i + '" data-id="' + esc(it.id) + '" tabindex="-1"><span class="mono" style="--h:' + it.h + '" aria-hidden="true">' + it.mono + '</span><span><b>' + esc(it.id) + '</b> <span class="dim">' + esc(it.n) + '</span></span><span class="badge badge-x">' + it.x + '</span></button>';
    }).join('') : '<p class="cmp-none">' + (s ? 'No stock in the sample set matches “' + esc(q.value) + '”.' : 'Every stock in the sample set is already in the comparison.') + '</p>';
    mark();
  }
  function mark() {
    $$('.cmp-opt', list).forEach(function (o, i) { o.classList.toggle('is-active', i === act); o.setAttribute('aria-selected', i === act ? 'true' : 'false'); if (i === act) o.scrollIntoView({ block: 'nearest' }); });
    if (hits.length) q.setAttribute('aria-activedescendant', 'cmp-o' + act); else q.removeAttribute('aria-activedescendant');
  }
  function placeAdd() {
    var b = $('#cmp-add'); if (!b) return;
    var box = pop.offsetParent.getBoundingClientRect(), a = b.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    pop.style.left = (Math.max(8, Math.min(a.left, vw - w - 8)) - box.left) + 'px'; pop.style.top = (a.bottom - box.top + 6) + 'px';
  }
  function openAdd() {
    var b = $('#cmp-add'); if (!b) return;
    M.closePops(); q.value = ''; renderList(); placeAdd();
    pop.classList.add('open'); b.setAttribute('aria-expanded', 'true'); q.focus({ preventScroll: true });
  }
  function closeAdd(refocus) {
    if (!pop.classList.contains('open')) return;
    pop.classList.remove('open'); var b = $('#cmp-add'); if (b) { b.setAttribute('aria-expanded', 'false'); if (refocus) b.focus({ preventScroll: true }); }
  }
  function add(id) {
    if (!id || ids.indexOf(id) >= 0 || ids.length >= MAX) return;
    fresh = id; setIds(ids.concat(id), 'add');
  }
  q.addEventListener('input', renderList);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { act = Math.min(hits.length - 1, act + 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); mark(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[act]) add(hits[act].id); }
  });
  list.addEventListener('click', function (e) { var o = e.target.closest('.cmp-opt'); if (o) add(o.dataset.id); });
  document.addEventListener('pointerdown', function (e) { if (pop.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('#cmp-add')) closeAdd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop.classList.contains('open')) closeAdd(true); });
  document.addEventListener('focusin', function (e) { if (pop.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('#cmp-add')) closeAdd(); });
  window.addEventListener('resize', function () { if (pop.classList.contains('open')) placeAdd(); });
  $('#cmp-empty-add').addEventListener('click', openAdd);
  $('#cmp-empty-def').addEventListener('click', function () { setIds(DEFAULT.slice(), 'add'); });
  $('#cmp-copy').addEventListener('click', function () {
    var done = function () { M.toast('Link copied. It opens this comparison: ' + (ids.join(', ') || 'no stocks yet') + '.'); }, fail = function () { M.toast('Copy the address bar instead: the stocks are in the link (?s=' + ids.join(',') + ').'); };
    try { navigator.clipboard.writeText(location.href.split(/[?#]/)[0] + '?s=' + ids.join(',')).then(done, fail); } catch (err) { fail(); }
  });

  /* ---------- rebased price chart: percent change from the start of the range ---------- */
  var N = 160, RANGES = { '1M': [21, 30, 'd'], '6M': [126, 182, 'd'], '1Y': [252, 365, 'm'], '5Y': [DAYS, 1826, 'm'] };
  var host = $('#cmp-plot'), cv = $('#cmp-cv'), tip = $('#cmp-tip'), ser = {}, dom = null, domTo = [-1, 1], reveal = 1, anim = null, hover = null, geo = null, drawn = false;
  function rebased(id) {
    var seg = sample(id).path.slice(DAYS - RANGES[range][0]), base = seg[0];
    return M.resample(seg.map(function (v) { return (v / base - 1) * 100; }), N);
  }
  function nice(span) { var p = Math.pow(10, Math.floor(Math.log10(span))), f = span / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function ticks(d) {
    var step = nice((d[1] - d[0]) / 4), out = [], t;
    for (;;) { out = []; for (t = Math.ceil(d[0] / step) * step; t <= d[1] + 1e-9; t += step) out.push(Math.abs(t) < 1e-9 ? 0 : t); if (out.length <= 4) return out; step = nice(step * 1.01); }
  }
  function axisText(t) { return (t > 0 ? '+' : t < 0 ? '−' : '') + String(+Math.abs(t).toFixed(1)) + '%'; }
  function chartSet() {
    if (!ids.length) return;
    var lo = 0, hi = 0, target = {};
    ids.forEach(function (id) { var y = target[id] = rebased(id); y.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
    var pad = (hi - lo) * 0.08 || 1, from = dom ? dom.slice() : null;
    domTo = [lo - pad, hi + pad];
    Object.keys(ser).forEach(function (id) { if (!target[id]) delete ser[id]; });
    ids.forEach(function (id) {
      var s = ser[id];
      if (s) { s.from = s.y.slice(); s.to = target[id]; s.a0 = s.a; } else ser[id] = { y: target[id].slice(), from: target[id], to: target[id], a: drawn ? 0 : 1, a0: drawn ? 0 : 1 };
    });
    if (anim) anim.cancel();
    if (!drawn) {
      /* first paint: the lines draw in from the left, once */
      drawn = true; dom = domTo.slice();
      if (M.rm() || M.compact()) { reveal = 1; draw(); } else { reveal = 0; anim = M.tween(700, function (u) { reveal = u; draw(); }, M.easeOut); }
    } else {
      /* later changes morph: lines move to their new shape, a new line fades in, the scale follows */
      reveal = 1;
      anim = M.springTo('smooth', function (u) {
        var w = Math.max(0, Math.min(1, u));
        ids.forEach(function (id) { var s = ser[id]; for (var i = 0; i < N; i++) s.y[i] = s.from[i] + (s.to[i] - s.from[i]) * u; s.a = s.a0 + (1 - s.a0) * w; });
        dom = [from[0] + (domTo[0] - from[0]) * u, from[1] + (domTo[1] - from[1]) * u]; draw();
      }, function () { ids.forEach(function (id) { var s = ser[id]; s.y = s.to.slice(); s.a = 1; }); dom = domTo.slice(); draw(); });
    }
    chartText();
  }
  function draw() {
    var w = host.clientWidth, h = host.clientHeight; if (!w || !h || !dom || !ids.length) return;
    var ctx = M.fitCanvas(cv, w, h), C = M.COL, narrow = w < 560, pl = 44, pr = narrow ? 64 : 112, pt = 16, pb = 26, iw = w - pl - pr, ih = h - pt - pb, d0 = dom[0], d1 = dom[1], days = RANGES[range][1], i;
    function X(k) { return pl + k / (N - 1) * iw; }
    function Y(v) { return pt + (1 - (v - d0) / (d1 - d0)) * ih; }
    geo = { pl: pl, iw: iw, w: w };
    ctx.clearRect(0, 0, w, h); ctx.lineWidth = 1; ctx.font = '500 11px Inter, system-ui, sans-serif';
    /* quiet grid, at most four lines; the 0% line is the shared starting point. The scale sits on the left because the right edge carries the line labels */
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ticks(domTo).forEach(function (t) {
      var gy = Math.round(Y(t)) + 0.5; if (gy < pt - 2 || gy > pt + ih + 2) return;
      ctx.strokeStyle = M.rgba(C['text-1'], t === 0 ? 0.24 : 0.06); ctx.beginPath(); ctx.moveTo(pl, gy); ctx.lineTo(pl + iw, gy); ctx.stroke();
      ctx.fillStyle = C['text-3']; ctx.fillText(axisText(t), pl - 8, gy);
    });
    ctx.fillStyle = C['text-3'];
    (narrow ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).forEach(function (f) { ctx.textAlign = f === 0 ? 'left' : f === 1 ? 'right' : 'center'; ctx.fillText(dateAt(f, days, RANGES[range][2]), pl + f * iw, h - 9); });
    /* one line per stock from the data palette */
    ctx.save(); ctx.beginPath(); ctx.rect(pl - 1, 0, iw * reveal + 2, h); ctx.clip();
    ids.forEach(function (id) {
      var s = ser[id]; if (!s) return;
      ctx.beginPath(); for (i = 0; i < N; i++) { if (i) ctx.lineTo(X(i), Y(s.y[i])); else ctx.moveTo(X(i), Y(s.y[i])); }
      ctx.lineWidth = 1.75; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = s.a; ctx.strokeStyle = C['data-' + tint[id]]; ctx.stroke();
    });
    ctx.restore(); ctx.globalAlpha = 1;
    /* end-of-line labels, nudged apart when lines finish close together */
    if (reveal >= 1) {
      var labs = ids.filter(function (id) { return ser[id]; }).map(function (id) { var v = ser[id].y[N - 1]; return { id: id, v: v, y: Y(v) }; }).sort(function (a, b) { return a.y - b.y; });
      labs.forEach(function (l, k) { l.ly = k ? Math.max(l.y, labs[k - 1].ly + 14) : Math.max(pt + 2, l.y); });
      for (i = labs.length - 1; i >= 0; i--) { var cap = i === labs.length - 1 ? pt + ih - 2 : labs[i + 1].ly - 14; if (labs[i].ly > cap) labs[i].ly = cap; }
      ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
      labs.forEach(function (l) {
        var c = C['data-' + tint[l.id]]; ctx.globalAlpha = ser[l.id].a;
        ctx.beginPath(); ctx.arc(pl + iw, l.y, 3, 0, 6.3); ctx.fillStyle = c; ctx.fill();
        ctx.fillText(narrow ? l.id : l.id + ' ' + M.fpct(l.v, 1), pl + iw + 9, l.ly);
      });
      ctx.globalAlpha = 1;
    }
    /* crosshair */
    if (hover != null && reveal >= 1) {
      var ix = Math.round(hover * (N - 1)), hx = Math.round(X(ix)) + 0.5;
      ctx.strokeStyle = M.rgba(C['text-1'], 0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, pt - 6); ctx.lineTo(hx, pt + ih); ctx.stroke();
      ids.forEach(function (id) { var s = ser[id]; if (!s) return; ctx.beginPath(); ctx.arc(X(ix), Y(s.y[ix]), 3.5, 0, 6.3); ctx.fillStyle = C['surface-1']; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C['data-' + tint[id]]; ctx.stroke(); });
    }
  }
  function showTip() {
    if (hover == null || !geo) return;
    var ix = Math.round(hover * (N - 1)), f = ix / (N - 1), rows = ids.filter(function (id) { return ser[id]; }).map(function (id) { return { id: id, v: ser[id].y[ix] }; }).sort(function (a, b) { return b.v - a.v; });
    tip.innerHTML = '<div class="cmp-tip-d">' + dateAt(f, RANGES[range][1], 'y') + '</div>' + rows.map(function (r) { return '<div class="cmp-tip-r"><i style="background:' + col(r.id) + '"></i><span>' + esc(r.id) + '</span><b>' + M.fpct(r.v, 1) + '</b></div>'; }).join('');
    var x = geo.pl + f * geo.iw, tw = tip.offsetWidth, left = x + 14 + tw > geo.w ? x - 14 - tw : x + 14;
    tip.style.transform = 'translate(' + Math.max(0, left) + 'px, 0)'; tip.classList.add('on');
  }
  host.addEventListener('pointermove', function (e) {
    if (!geo) return; var r = host.getBoundingClientRect();
    hover = Math.max(0, Math.min(1, (e.clientX - r.left - geo.pl) / geo.iw)); draw(); showTip();
  });
  host.addEventListener('pointerleave', function () { hover = null; tip.classList.remove('on'); draw(); });
  new ResizeObserver(function () { draw(); }).observe(host);
  document.addEventListener('ml:paint', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

  /* the chart's words: caption, legend, screen-reader summary and the table alternative */
  function chartText() {
    var days = RANGES[range][1], start = dateAt(0, days, 'y'), order = ids.slice().sort(function (a, b) { return ser[b].to[N - 1] - ser[a].to[N - 1]; });
    var words = order.map(function (id) { return id + ' ' + M.fpct(ser[id].to[N - 1], 1); }).join(', ');
    $('#cmp-chart-sub').textContent = 'Percent change since ' + start + '. Every line starts at 0%.';
    cv.setAttribute('aria-label', 'Price change since ' + start + ': ' + words + '. Show table lists the same figures.');
    $('#cmp-lg').innerHTML = order.map(function (id) { return '<span><i style="background:' + col(id) + '"></i><b>' + esc(id) + '</b>' + chg(ser[id].to[N - 1]) + '</span>'; }).join('');
    $('#cmp-alt-t thead').innerHTML = '<tr><th scope="col">Date</th>' + ids.map(function (id) { return '<th scope="col">' + esc(id) + '</th>'; }).join('') + '</tr>';
    $('#cmp-alt-t tbody').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (k) {
      var f = k / 8, ix = Math.round(f * (N - 1));
      return '<tr><td>' + dateAt(f, days, 'y') + '</td>' + ids.map(function (id) { return '<td>' + M.fpct(ser[id].to[ix], 1) + '</td>'; }).join('') + '</tr>';
    }).join('');
  }
  var rangeSeg = M.initSeg($('#cmp-range'), function (v) { range = v; hover = null; tip.classList.remove('on'); chartSet(); });
  $('#cmp-alt-b').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on); this.classList.toggle('is-on', on);
    this.textContent = on ? 'Hide table' : 'Show table'; $('#cmp-alt').hidden = !on;
  });

  /* ---------- key statistics: one column per stock, best and worst marked per row ----------
     mode: 'high' means higher reads as better, 'low' lower; 'size' and 'level' only name the two ends */
  var WORDS = { high: ['Best', 'Worst'], low: ['Best', 'Worst'], size: ['Largest', 'Smallest'], level: ['Highest', 'Lowest'] };
  var STATS = [
    { n: 'Price', html: function (s) { return '<span class="dim">' + s.cur + '</span>' + M.pxHTML(s.id); } },
    { n: 'Market cap', sub: 'US$', mode: 'size', get: function (s) { return s.capUSD; }, f: function (v) { return '$' + big(v); } },
    { n: 'P/E', sub: 'trailing', mode: 'low', get: function (s) { return s.pe; }, f: function (v) { return v.toFixed(1); } },
    { n: 'Forward P/E', badge: 'Third-party', mode: 'low', get: function (s) { return s.fpe; }, f: function (v) { return v.toFixed(1); } },
    { n: 'P/B', mode: 'low', get: function (s) { return s.pb; }, f: function (v) { return v.toFixed(1); } },
    { n: 'Dividend yield', mode: 'high', get: function (s) { return s.yld; }, f: function (v) { return v.toFixed(2) + '%'; } },
    { n: 'Revenue growth', sub: 'FY2025', mode: 'high', get: function (s) { return s.revg; }, f: function (v) { return M.fpct(v, 1); } },
    { n: 'Operating margin', sub: 'FY2025', mode: 'high', get: function (s) { return s.opm; }, f: function (v) { return M.fmt(v, 1) + '%'; } },
    { n: 'Return on equity', sub: 'FY2025', mode: 'high', get: function (s) { return s.roe; }, f: function (v) { return M.fmt(v, 1) + '%'; } },
    { n: 'Debt to equity', mode: 'low', get: function (s) { return s.de; }, f: function (v) { return v.toFixed(2); } },
    { n: 'Beta', sub: '5 years, monthly', mode: 'level', get: function (s) { return s.beta; }, f: function (v) { return v.toFixed(2); } },
    { n: '1-year return', mode: 'high', get: function (s) { return s.p1y; }, f: function (v) { return chg(v); } }
  ];
  function renderStats() {
    var S = ids.map(sample);
    $('#cmp-stats thead').innerHTML = '<tr><th scope="col">Statistic</th>' + ids.map(function (id) { return '<th scope="col"><span class="cmp-hd"><i class="cmp-key" style="background:' + col(id) + '"></i>' + M.tk(id, { name: false }) + '</span></th>'; }).join('') + '</tr>';
    $('#cmp-stats tbody').innerHTML = STATS.map(function (st) {
      var vals = st.get ? S.map(st.get) : null, hi = vals ? Math.max.apply(null, vals) : 0, lo = vals ? Math.min.apply(null, vals) : 0, marks = st.mode && S.length > 1 && hi - lo > 1e-9, w = WORDS[st.mode];
      var top = st.mode === 'low' ? lo : hi, bottom = st.mode === 'low' ? hi : lo, judged = st.mode === 'high' || st.mode === 'low';
      return '<tr><th scope="row">' + st.n + (st.sub ? '<small>' + st.sub + '</small>' : '') + (st.badge ? '<span class="badge badge-x" title="Analyst consensus from a data vendor, not a Market Lens forecast">' + st.badge + '</span>' : '') + '</th>' +
        S.map(function (s, i) {
          if (!vals) return '<td>' + st.html(s) + '</td>';
          var v = vals[i], best = marks && v === top, worst = marks && v === bottom;
          return '<td' + (judged && best ? ' class="is-best"' : judged && worst ? ' class="is-worst"' : '') + '>' + (best || worst ? '<span class="cmp-mk">' + w[best ? 0 : 1] + '</span>' : '') + st.f(v) + '</td>';
        }).join('') + '</tr>';
    }).join('');
    $('#cmp-stats-note').textContent = S.length > 1
      ? 'Best and worst are marked per row with a word and a tint. Lower reads as better for P/E, P/B and debt; higher for yield, growth, margin, return on equity and the 1-year return. Market cap and beta only name the two ends. It is a reading aid, not a recommendation.'
      : 'Add a second stock to see the best and the worst value marked in each row.';
  }
  $('#cmp-stats-wrap').addEventListener('scroll', function () { $('#cmp-stats').classList.toggle('scrolled-x', this.scrollLeft > 2); }, { passive: true });
  $('#cmp-band-ic').outerHTML = M.icon('doc');

  /* ---------- statements: rows aligned by fiscal year, newest first ---------- */
  var LINES = [['rev', 'Revenue'], ['oi', 'Operating income'], ['ni', 'Net income'], ['fcf', 'Free cash flow']], finHead = $('#cmp-fin thead'), finBody = $('#cmp-fin tbody');
  function money(v) { var s = M.fmt(Math.abs(v), 0); return v < 0 ? '<span class="val neg">(' + s + ')</span>' : '<span class="val">' + s + '</span>'; }
  function renderFin() {
    var S = ids.map(sample), mixed = S.some(function (s) { return s.it.c !== 'USD'; }), vendor = S.filter(function (s) { return !s.full; }).map(function (s) { return s.id; });
    finHead.innerHTML = '<tr><th scope="col"><span>' + (usd || !mixed ? 'US$ millions' : 'Millions, as reported') + '</span></th>' + YEARS.slice().reverse().map(function (y) { return '<th scope="col"><span>' + y + '</span></th>'; }).join('') +
      '<th scope="col" title="Compound annual growth from FY2021 to FY2025"><span>Growth a year since FY2021</span></th></tr>';
    finBody.innerHTML = LINES.map(function (ln) {
      return '<tr class="cmp-g"><th scope="rowgroup"><div class="cw"><span class="val">' + ln[1] + '</span></div></th><td colspan="' + (YEARS.length + 1) + '"></td></tr>' + S.map(function (s) {
        var a = s.L[ln[0]], k = usd ? s.fx : 1, g = a[0] > 0 && a[4] > 0 ? (Math.pow(a[4] / a[0], 0.25) - 1) * 100 : null;
        return '<tr><th scope="row"><div class="cw"><i class="cmp-key" style="background:' + col(s.id) + '"></i>' + M.tk(s.id, { name: false }) + '<span class="badge badge-x"' + (usd && s.it.c !== 'USD' ? ' title="Converted from ' + s.it.c + ' at US$' + s.fx + ' per unit"' : '') + '>' + (usd ? 'USD' : s.it.c) + '</span></div></th>' +
          a.slice().reverse().map(function (v) { return '<td><div class="cw">' + money(v * k) + '</div></td>'; }).join('') +
          '<td><div class="cw cagr">' + (g == null ? '<span class="val na" role="img" title="Not meaningful: the first or the last year is negative" aria-label="Not meaningful: the first or the last year is negative">—</span>' : '<span class="val">' + M.fpct(g, 1) + '</span>') + '</div></td></tr>';
      }).join('');
    }).join('');
    $('#cmp-ccy-note').textContent = !mixed ? 'Every stock here reports in US dollars, so the switch changes nothing.'
      : usd ? 'Converted at one sample rate per currency: HK$1 = US$' + M.FX.HKD + ', £1 = US$' + M.FX.GBP + '.' : 'Each row is in its own reporting currency. Switch to USD to compare sizes.';
    $('#cmp-fin-note').textContent = 'Aligned by fiscal-year label, so companies with different year-ends sit in the nearest fiscal year. Negative values are in parentheses.' +
      (vendor.length ? ' Statements for ' + vendor.join(', ') + ' come from a vendor snapshot, not from official filings.' : '') + ' Sample data.';
  }
  var ccySeg = M.initSeg($('#cmp-ccy'), function (v) {
    usd = v === 'usd';
    if (M.rm()) { renderFin(); return; }
    /* the numbers cross-fade, as on the stock page's Financials tab */
    finHead.classList.add('swap'); finBody.classList.add('swap');
    setTimeout(function () { renderFin(); finBody.classList.add('swap'); requestAnimationFrame(function () { requestAnimationFrame(function () { finHead.classList.remove('swap'); finBody.classList.remove('swap'); }); }); }, 130);
  });
  $('#cmp-fin-wrap').addEventListener('scroll', function () { $('#cmp-fin').classList.toggle('scrolled-x', this.scrollLeft > 2); }, { passive: true });

  /* ---------- everything follows the list of stocks ---------- */
  function sync() {
    assign();
    try { history.replaceState(null, '', '?s=' + ids.map(encodeURIComponent).join(',')); } catch (e) { /* file:// in some browsers */ }
    document.title = (ids.length ? ids.join(' vs ') + ' · ' : '') + 'Compare · Market Lens (mockup)';
    $('#cmp-count').textContent = ids.length + ' of ' + MAX + ' slots used';
    renderSlots();
    $('#cmp-body').hidden = !ids.length; $('#cmp-empty').hidden = !!ids.length;
    if (!ids.length) return;
    chartSet(); renderStats(); renderFin(); rangeSeg.place(false); ccySeg.place(false);
  }
  sync();
})();
