/* Market Lens mockup: Screener. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc;
  M.shell('Screener');

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

  var ROWS = M.LIST.map(function (it) { return sample(it.id); }), TOTAL = ROWS.length;

  /* ---------- formatting ---------- */
  var MINUS = '−';
  function big(v, trim) {
    var a = Math.abs(v), u = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''], x = v / u[0];
    var s = x.toFixed(Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
    return (trim ? String(+s) : s) + u[1];
  }
  function plain(v, dp) { return String(+v.toFixed(dp == null ? 2 : dp)).replace('-', MINUS); }
  function fx(dp, suffix) { return function (v) { return M.fmt(v, dp) + (suffix || ''); }; }
  function signed(v) { return M.fpct(v, 1); }

  /* ---------- measures: one catalogue feeds the filters and the columns ----------
     need: 'f' comes from fundamentals, 'p' from daily price history. Neither exists at $0 for Hong Kong and London listings */
  var KINDS = ['Size', 'Valuation', 'Growth', 'Profitability', 'Debt', 'Performance', 'Volume', 'Dividend', 'Sector', 'Country'];
  var MEAS = [
    { k: 'mcap', n: 'Market cap', th: 'Mkt cap', kind: 'Size', tip: 'Market capitalisation, converted to US dollars', log: 1, dom: [1e9, 1e13], unit: 1e9, ul: 'US$ billions', words: 'capitalisation large small value',
      get: function (r) { return r.capUSD; }, cell: function (v) { return '$' + big(v); }, bound: function (v) { return '$' + big(v, true); } },
    { k: 'pe', n: 'P/E', kind: 'Valuation', tip: 'Price divided by trailing earnings per share', need: 'f', dom: [0, 60], step: 1, cell: fx(1), words: 'price earnings multiple ratio' },
    { k: 'pb', n: 'P/B', kind: 'Valuation', tip: 'Price divided by book value per share', need: 'f', dom: [0, 60], step: 0.5, cell: fx(1), words: 'price book ratio' },
    { k: 'revg', n: 'Revenue growth', th: 'Rev growth', kind: 'Growth', tip: 'Revenue in the latest fiscal year against the year before', need: 'f', dom: [-20, 60], step: 1, pct: 1, cell: signed, words: 'sales' },
    { k: 'epsg', n: 'Earnings growth', th: 'Earn growth', kind: 'Growth', tip: 'Net income in the latest fiscal year against the year before', need: 'f', dom: [-30, 60], step: 1, pct: 1, cell: signed, words: 'profit net income eps' },
    { k: 'opm', n: 'Operating margin', th: 'Op margin', kind: 'Profitability', tip: 'Operating income as a share of revenue in the latest fiscal year', need: 'f', dom: [0, 70], step: 1, pct: 1, cell: fx(1, '%'), words: 'profit quality' },
    { k: 'de', n: 'Debt to equity', th: 'Debt/equity', kind: 'Debt', tip: 'Term debt divided by shareholders’ equity', need: 'f', dom: [0, 4], step: 0.1, cell: fx(2), words: 'leverage borrowing' },
    { k: 'p1m', n: '1-month performance', th: '1 month', kind: 'Performance', tip: 'Price change over the last month', need: 'p', dom: [-20, 20], step: 1, pct: 1, chg: 1, words: 'return change momentum' },
    { k: 'p1y', n: '1-year performance', th: '1 year', kind: 'Performance', tip: 'Price change over the last year', need: 'p', dom: [-50, 60], step: 1, pct: 1, chg: 1, words: 'return change momentum' },
    { k: 'r52', n: '52-week range position', th: '52-week range', kind: 'Performance', tip: 'Where the price sits between its 52-week low (0%) and its 52-week high (100%)', need: 'p', dom: [0, 100], step: 1, pct: 1, bar: 1, words: 'high low' },
    { k: 'vol', n: 'Volume', kind: 'Volume', tip: 'Shares traded today', need: 'p', log: 1, dom: [1e5, 1e9], unit: 1e6, ul: 'millions of shares', words: 'liquidity shares traded',
      cell: function (v) { return big(v); }, bound: function (v) { return big(v, true); } },
    { k: 'rvol', n: 'Relative volume', th: 'Rel volume', kind: 'Volume', tip: 'Today’s volume divided by the 3-month average', need: 'p', dom: [0, 4], step: 0.1, cell: fx(2, '×'), words: 'unusual activity',
      bound: function (v) { return plain(v) + '×'; } },
    { k: 'yld', n: 'Dividend yield', th: 'Div yield', kind: 'Dividend', tip: 'Annual dividend as a share of the price', need: 'f', dom: [0, 6], step: 0.1, pct: 1, cell: fx(2, '%'), words: 'income payout' },
    { k: 'sec', n: 'Sector', kind: 'Sector', cat: 1, get: function (r) { return r.it.sec; }, words: 'industry' },
    { k: 'cty', n: 'Country', kind: 'Country', cat: 1, get: function (r) { return r.it.cty; }, words: 'region market domicile' }
  ], BY = {};
  MEAS.forEach(function (m) { BY[m.k] = m; if (!m.get) m.get = function (r) { return r[m.k]; }; });
  function val(r, m) { return m.need && !r.full ? null : m.get(r); }
  function bnd(m, v) { return m.bound ? m.bound(v) : plain(v) + (m.pct ? '%' : ''); }
  function why(r, m) {
    var where = r.it.x === 'HKEX' ? 'Hong Kong' : 'London';
    return 'Not in the screener for ' + where + ' listings at $0: ' + (m.need === 'f' ? 'fundamentals come from US company filings only.' : 'whole-market daily bars cover US exchanges only.');
  }

  /* ---------- state ---------- */
  var filters = [{ k: 'mcap', min: 10e9, max: null }, { k: 'sec', sel: [] }, { k: 'pe', min: null, max: 40 }];
  var SAVED = [
    { n: 'Large-cap quality', f: [{ k: 'mcap', min: 200e9, max: null }, { k: 'opm', min: 20, max: null }, { k: 'de', min: null, max: 1 }, { k: 'revg', min: 5, max: null }] },
    { n: 'High yield', f: [{ k: 'yld', min: 2.5, max: null }, { k: 'mcap', min: 10e9, max: null }] },
    { n: '52-week lows', f: [{ k: 'r52', min: null, max: 20 }, { k: 'mcap', min: 10e9, max: null }] }
  ];
  var COLS = ['price', 'chg', 'mcap', 'pe', 'pb', 'yld', 'revg', 'epsg', 'opm', 'de', 'p1m', 'p1y', 'r52', 'vol', 'rvol', 'sec', 'cty'], COLN = { tk: 'Ticker', price: 'Price', chg: 'Change' };
  var HIDDEN = /^(epsg|de|rvol|cty)$/, vis = {}, sort = { k: 'mcap', dir: 'descending' }, sel = {}, view = [], hideUnk = false, lastPick = null;
  COLS.forEach(function (k) { vis[k] = !HIDDEN.test(k); });
  function colName(k, short) { var m = BY[k]; return m ? (short && m.th) || m.n : COLN[k]; }
  function find(k) { return filters.filter(function (f) { return f.k === k; })[0]; }
  function isAny(f) { return BY[f.k].cat ? !f.sel.length : f.min == null && f.max == null; }
  function cond(f) {
    var m = BY[f.k];
    if (m.cat) return !f.sel.length ? 'is any' : f.sel.length === 1 ? 'is ' + f.sel[0] : f.sel.length === 2 ? 'is ' + f.sel[0] + ' or ' + f.sel[1] : 'is any of ' + f.sel.length;
    return isAny(f) ? 'is any' : f.max == null ? 'above ' + bnd(m, f.min) : f.min == null ? 'below ' + bnd(m, f.max) : bnd(m, f.min) + ' to ' + bnd(m, f.max);
  }
  /* 1 passes every filter, 0 fails one, -1 fails none but lacks a measure that a filter needs */
  function test(r) {
    var unknown = false;
    for (var i = 0; i < filters.length; i++) {
      var f = filters[i], m = BY[f.k], v;
      if (isAny(f)) continue;
      if (m.cat) { if (f.sel.indexOf(m.get(r)) < 0) return 0; continue; }
      v = val(r, m);
      if (v == null) { unknown = true; continue; }
      if ((f.min != null && v < f.min) || (f.max != null && v > f.max)) return 0;
    }
    return unknown ? -1 : 1;
  }

  /* ---------- popovers (one open at a time; Escape and an outside press close it) ---------- */
  var openPop = null, edPop = $('#scr-edit'), catPop = $('#scr-cat'), colsPop = $('#scr-cols-pop'), savePop = $('#scr-save-pop'), ed = null;
  function anchor(pop, trigger, right) {
    var box = pop.offsetParent.getBoundingClientRect(), a = trigger.getBoundingClientRect(), w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    var left = Math.max(8, Math.min(right ? a.right - w : a.left, vw - w - 8));
    pop.style.left = (left - box.left) + 'px'; pop.style.right = 'auto'; pop.style.top = (a.bottom - box.top + 6) + 'px';
  }
  function showPop(pop, trigger, right) {
    hidePop(); M.closePops();
    openPop = { pop: pop, trigger: trigger, right: right };
    anchor(pop, trigger, right); pop.classList.add('open'); trigger.setAttribute('aria-expanded', 'true');
    var f = $('[data-focus]', pop) || $('input, button', pop); if (f) f.focus({ preventScroll: true });
  }
  function hidePop(refocus) {
    if (!openPop) return;
    var o = openPop; openPop = null; ed = null;
    o.pop.classList.remove('open'); o.trigger.setAttribute('aria-expanded', 'false');
    $$('.fchip.is-open').forEach(function (c) { c.classList.remove('is-open'); });
    if (refocus && o.trigger.isConnected) o.trigger.focus({ preventScroll: true });
  }
  function togglePop(pop, trigger, right, before) {
    if (openPop && openPop.pop === pop && openPop.trigger === trigger) { hidePop(true); return; }
    if (before) before(); showPop(pop, trigger, right);
  }
  document.addEventListener('pointerdown', function (e) { if (openPop && !openPop.pop.contains(e.target) && !openPop.trigger.contains(e.target)) hidePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openPop) hidePop(true); });
  /* tabbing out of a popover closes it, so none is left open behind the focus */
  document.addEventListener('focusin', function (e) { if (openPop && !openPop.pop.contains(e.target) && !openPop.trigger.contains(e.target)) hidePop(); });
  window.addEventListener('resize', function () { if (openPop) anchor(openPop.pop, openPop.trigger, openPop.right); });

  /* ---------- filter chips ---------- */
  var chips = $('#scr-chips'), addBtn = $('#scr-add'), clearBtn = $('#scr-clear');
  addBtn.innerHTML = M.icon('plus', 'ic-sm') + 'Add filter';
  function chipHTML(f, fresh) {
    var m = BY[f.k];
    return '<span class="fchip' + (isAny(f) ? ' is-any' : '') + (fresh ? ' is-new' : '') + '" data-k="' + f.k + '">' +
      '<button type="button" class="fchip-b" aria-haspopup="dialog" aria-expanded="false" title="Edit this filter"><span class="fchip-n">' + esc(m.n) + '</span><b class="fchip-v">' + esc(cond(f)) + '</b></button>' +
      '<button type="button" class="fchip-x" aria-label="Remove filter: ' + esc(m.n) + '">' + M.icon('x') + '</button></span>';
  }
  function renderChips(freshKey) {
    chips.innerHTML = filters.map(function (f) { return chipHTML(f, f.k === freshKey); }).join('');
    clearBtn.hidden = !filters.length;
  }
  function chipOf(k) { return $('.fchip[data-k="' + k + '"]', chips); }
  function updateChip(f) {
    var c = chipOf(f.k); if (!c) return;
    c.classList.toggle('is-any', isAny(f)); $('.fchip-v', c).textContent = cond(f);
  }
  function addFilter(k) {
    if (!find(k)) { filters.push(BY[k].cat ? { k: k, sel: [] } : { k: k, min: null, max: null }); if (k in vis && !vis[k]) { vis[k] = true; renderHead(); } renderChips(k); changed(); }
    openEditor(k);
  }
  function removeFilter(k) {
    var i = filters.indexOf(find(k)); if (i < 0) return;
    hidePop(); filters.splice(i, 1); renderChips(); changed();
    var next = $$('.fchip-b', chips)[Math.min(i, filters.length - 1)] || addBtn; next.focus();
  }
  function setFilters(list) {
    hidePop(); filters = list.map(function (f) { return f.sel ? { k: f.k, sel: f.sel.slice() } : { k: f.k, min: f.min, max: f.max }; });
    var shown = false; filters.forEach(function (f) { if (f.k in vis && !vis[f.k]) { vis[f.k] = shown = true; } });
    if (shown) renderHead();
    renderChips(); changed();
  }
  chips.addEventListener('click', function (e) {
    var c = e.target.closest('.fchip'); if (!c) return;
    if (e.target.closest('.fchip-x')) { removeFilter(c.dataset.k); return; }
    if (openPop && openPop.pop === edPop && openPop.trigger === $('.fchip-b', c)) hidePop(true); else openEditor(c.dataset.k);
  });
  clearBtn.addEventListener('click', function () { setFilters([]); addBtn.focus(); M.toast('All filters cleared. Every stock in the universe is listed.'); });
  $('#scr-empty-clear').addEventListener('click', function () { setFilters([]); addBtn.focus(); });

  /* ---------- filter editor: two typed bounds, a dual slider and a histogram, or tick boxes ---------- */
  var NB = 20;
  function scale(m) {
    if (m.log) return { min: Math.round(Math.log10(m.dom[0]) * 50), max: Math.round(Math.log10(m.dom[1]) * 50), step: 1, pos: function (v) { return Math.round(Math.log10(v) * 50); }, val: function (p) { return +Math.pow(10, p / 50).toPrecision(3); } };
    return { min: m.dom[0], max: m.dom[1], step: m.step, pos: function (v) { return v; }, val: function (p) { return +p.toFixed(4); } };
  }
  function frac(m, v) {
    var a = m.log ? Math.log10(m.dom[0]) : m.dom[0], b = m.log ? Math.log10(m.dom[1]) : m.dom[1], x = m.log ? Math.log10(Math.max(v, 1e-9)) : v;
    return Math.max(0, Math.min(1, (x - a) / (b - a)));
  }
  function known(m) { return ROWS.map(function (r) { return val(r, m); }).filter(function (v) { return v != null; }); }
  function rangeHTML(m) {
    var S = scale(m), vals = known(m), bins = [], i, top;
    for (i = 0; i < NB; i++) bins.push(0);
    vals.forEach(function (v) { bins[Math.min(NB - 1, Math.floor(frac(m, v) * NB))]++; });
    top = Math.max.apply(null, bins) || 1;
    function slider(b, word) { return '<input type="range" class="dual-in" data-b="' + b + '" min="' + S.min + '" max="' + S.max + '" step="' + S.step + '" aria-label="' + word + ' ' + esc(m.n) + '">'; }
    return '<div class="fe-h"><h3 class="t3">' + esc(m.n) + '</h3><span class="label">' + (m.ul || (m.pct ? 'Percent' : 'Ratio')) + '</span></div>' +
      '<p class="fe-tip">' + esc(m.tip) + '.</p>' +
      '<div class="hist" role="img" aria-label="How the ' + vals.length + ' stocks with data are spread, from ' + bnd(m, m.dom[0]) + ' to ' + bnd(m, m.dom[1]) + '">' +
        bins.map(function (n) { return '<i' + (n ? '' : ' class="z"') + ' style="--h:' + Math.round(n / top * 100) + '"></i>'; }).join('') + '</div>' +
      '<div class="dual"><div class="dual-track"><i class="dual-fill"></i></div>' + slider('min', 'Lowest') + slider('max', 'Highest') + '</div>' +
      '<div class="dual-l" aria-hidden="true"><span>' + bnd(m, m.dom[0]) + '</span><span>' + bnd(m, m.dom[1]) + '</span></div>' +
      '<div class="fe-row"><label class="fld">At least<input class="field" data-b="min" data-focus inputmode="decimal" autocomplete="off" placeholder="No minimum"></label>' +
        '<label class="fld">At most<input class="field" data-b="max" inputmode="decimal" autocomplete="off" placeholder="No maximum"></label></div>' +
      '<div class="fe-f"><span class="label" id="fe-n"></span><span class="sp"></span><button type="button" class="linkish" data-reset>Reset</button><button type="button" class="btn btn-sm btn-primary" data-done>Done</button></div>';
  }
  function catHTML(m) {
    var count = {}, names;
    ROWS.forEach(function (r) { var v = m.get(r); count[v] = (count[v] || 0) + 1; });
    names = Object.keys(count).sort();
    return '<div class="fe-h"><h3 class="t3">' + esc(m.n) + '</h3><span class="label">None ticked means any</span></div>' +
      '<div class="fe-cats" role="group" aria-label="' + esc(m.n) + '">' + names.map(function (n, i) {
        return '<label class="fe-cat"><input type="checkbox" value="' + esc(n) + '"' + (i ? '' : ' data-focus') + (ed.f.sel.indexOf(n) >= 0 ? ' checked' : '') + '><span>' + esc(n) + '</span><span class="n">' + count[n] + '</span></label>';
      }).join('') + '</div>' +
      '<div class="fe-f"><span class="sp"></span><button type="button" class="linkish" data-reset>Clear</button><button type="button" class="btn btn-sm btn-primary" data-done>Done</button></div>';
  }
  function openEditor(k) {
    var f = find(k), m = BY[k], chip = chipOf(k); if (!f || !chip) return;
    hidePop();
    ed = { f: f, m: m };
    edPop.setAttribute('aria-label', 'Edit filter: ' + m.n);
    edPop.innerHTML = m.cat ? catHTML(m) : rangeHTML(m);
    if (!m.cat) { ed.S = scale(m); ed.minIn = $('.dual-in[data-b="min"]', edPop); ed.maxIn = $('.dual-in[data-b="max"]', edPop); paintRange(); }
    showPop(edPop, $('.fchip-b', chip)); chip.classList.add('is-open');
  }
  function shown(m, v) { return String(+(v / (m.unit || 1)).toPrecision(4)); }
  function parse(m, text) {
    var s = text.trim().toUpperCase(); if (!s) return null;
    var v = M.parseNum(s); if (isNaN(v) || (m.log && v <= 0)) return NaN;
    return /[KMBT]$/.test(s.replace(/[%\s]/g, '')) ? v : v * (m.unit || 1);
  }
  /* repaint the editor from the filter; skip names the text field being typed in, so its text is left alone */
  function paintRange(skip) {
    var f = ed.f, m = ed.m, S = ed.S, lo = f.min == null ? S.min : Math.max(S.min, Math.min(S.max, S.pos(f.min))), hi = f.max == null ? S.max : Math.max(S.min, Math.min(S.max, S.pos(f.max)));
    ed.minIn.value = lo; ed.maxIn.value = hi;
    var a = f.min == null ? 0 : frac(m, f.min), b = f.max == null ? 1 : frac(m, f.max), dual = $('.dual', edPop), vals = known(m), inside = 0;
    dual.style.setProperty('--a', (a * 100).toFixed(2) + '%'); dual.style.setProperty('--b', (b * 100).toFixed(2) + '%');
    ed.minIn.style.zIndex = a > 0.5 ? 3 : 1;
    ed.minIn.setAttribute('aria-valuetext', f.min == null ? 'No minimum' : bnd(m, f.min)); ed.maxIn.setAttribute('aria-valuetext', f.max == null ? 'No maximum' : bnd(m, f.max));
    $$('.hist i', edPop).forEach(function (bar, i) { var c = (i + 0.5) / NB; bar.classList.toggle('on', c >= a && c <= b); });
    $$('.field', edPop).forEach(function (inp) { if (inp.dataset.b !== skip) inp.value = f[inp.dataset.b] == null ? '' : shown(m, f[inp.dataset.b]); });
    vals.forEach(function (v) { if ((f.min == null || v >= f.min) && (f.max == null || v <= f.max)) inside++; });
    $('#fe-n').textContent = inside + ' of ' + vals.length + ' with data in range';
  }
  edPop.addEventListener('input', function (e) {
    if (!ed) return;
    var t = e.target, f = ed.f, m = ed.m, b = t.dataset.b, v;
    if (t.type === 'checkbox') { f.sel = $$('input:checked', edPop).map(function (c) { return c.value; }); updateChip(f); changed(); return; }
    if (t.classList.contains('dual-in')) {
      /* the thumbs cannot cross; a thumb at either end means no bound */
      if (b === 'min' && +t.value > +ed.maxIn.value) t.value = ed.maxIn.value;
      if (b === 'max' && +t.value < +ed.minIn.value) t.value = ed.minIn.value;
      f[b] = (b === 'min' ? +t.value <= ed.S.min : +t.value >= ed.S.max) ? null : ed.S.val(+t.value);
      paintRange();
    } else if (t.classList.contains('field')) {
      v = parse(m, t.value); if (v !== null && isNaN(v)) return;
      f[b] = bound(b, v); paintRange(b);
    } else return;
    updateChip(f); changed();
  });
  /* a typed bound is kept inside the scale and on its own side of the other bound */
  function bound(b, v) {
    var f = ed.f, m = ed.m;
    if (v == null) return null;
    if (b === 'min') { if (f.max != null) v = Math.min(v, f.max); return v <= m.dom[0] ? null : v; }
    if (f.min != null) v = Math.max(v, f.min); return v >= m.dom[1] ? null : v;
  }
  edPop.addEventListener('change', function (e) { if (ed && e.target.classList.contains('field')) paintRange(); });
  edPop.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.classList.contains('field')) { e.preventDefault(); paintRange(); hidePop(true); } });
  edPop.addEventListener('click', function (e) {
    if (!ed) return;
    if (e.target.closest('[data-done]')) { hidePop(true); return; }
    if (!e.target.closest('[data-reset]')) return;
    var f = ed.f;
    if (ed.m.cat) { f.sel = []; $$('input', edPop).forEach(function (c) { c.checked = false; }); } else { f.min = f.max = null; paintRange(); }
    updateChip(f); changed();
  });

  /* ---------- catalogue of filters ---------- */
  var catQ = $('#scr-cat-q'), catList = $('#scr-cat-list');
  function renderCat() {
    var s = catQ.value.trim().toLowerCase(), html = '';
    KINDS.forEach(function (kind) {
      var items = MEAS.filter(function (m) { return m.kind === kind && (!s || (m.n + ' ' + kind + ' ' + m.words).toLowerCase().indexOf(s) >= 0); });
      if (!items.length) return;
      html += '<div class="pop-h micro">' + kind + '</div>' + items.map(function (m) {
        var on = !!find(m.k);
        return '<button type="button" class="mi' + (on ? ' is-on' : '') + '" data-k="' + m.k + '"><span>' + esc(m.n) + '</span><span>' + (on ? 'In use · edit' : m.cat ? 'Tick boxes' : 'Range') + '</span></button>';
      }).join('');
    });
    catList.innerHTML = html || '<p class="cat-none">No filter matches “' + esc(catQ.value) + '”. Try size, valuation, growth, margin, debt, performance, volume, yield, sector or country.</p>';
  }
  addBtn.addEventListener('click', function () { togglePop(catPop, addBtn, false, function () { catQ.value = ''; renderCat(); }); });
  catQ.addEventListener('input', renderCat);
  catPop.addEventListener('click', function (e) { var b = e.target.closest('.mi'); if (b) addFilter(b.dataset.k); });
  catPop.addEventListener('keydown', function (e) {
    var items = $$('.mi', catList), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { (items[i + 1] || items[0] || catQ).focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { (i > 0 ? items[i - 1] : catQ).focus(); e.preventDefault(); }
    else if (e.key === 'Enter' && e.target === catQ && items[0]) { e.preventDefault(); addFilter(items[0].dataset.k); }
    else if (e.key.length === 1 && e.key !== ' ' && e.target !== catQ && !e.ctrlKey && !e.metaKey && !e.altKey) catQ.focus();
  });

  /* ---------- saved screens (kept in memory) ---------- */
  var savedSel = $('#scr-saved'), saveBtn = $('#scr-save'), nameIn = $('#scr-name');
  function sig(list) { return JSON.stringify(list.map(function (f) { return [f.k, f.min == null ? null : f.min, f.max == null ? null : f.max, (f.sel || []).slice().sort()]; }).sort()); }
  function renderSaved() { savedSel.innerHTML = '<option value="">Unsaved screen</option>' + SAVED.map(function (s, i) { return '<option value="' + i + '">' + esc(s.n) + '</option>'; }).join(''); syncSaved(); }
  function syncSaved() { var now = sig(filters), hit = ''; SAVED.forEach(function (s, i) { if (hit === '' && sig(s.f) === now) hit = String(i); }); savedSel.value = hit; }
  savedSel.addEventListener('change', function () { var s = SAVED[+savedSel.value]; if (savedSel.value !== '' && s) setFilters(s.f); else syncSaved(); });
  saveBtn.addEventListener('click', function () {
    togglePop(savePop, saveBtn, true, function () {
      var cur = SAVED[+savedSel.value], n = filters.filter(function (f) { return !isAny(f); }).length;
      nameIn.value = savedSel.value !== '' && cur ? cur.n : '';
      $('#scr-save-sum').textContent = (n === 1 ? '1 active filter' : n + ' active filters') + ' will be saved. Saved screens last until this page is reloaded.';
    });
  });
  $('#scr-save-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameIn.value.trim() || 'My screen', copy = filters.map(function (f) { return f.sel ? { k: f.k, sel: f.sel.slice() } : { k: f.k, min: f.min, max: f.max }; });
    var old = SAVED.filter(function (s) { return s.n.toLowerCase() === name.toLowerCase(); })[0];
    if (old) old.f = copy; else SAVED.push({ n: name, f: copy });
    hidePop(true); renderSaved();
    M.toast((old ? 'Updated “' : 'Saved “') + name + '”. It is in the saved screens list until this page is reloaded.');
  });
  savePop.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) hidePop(true); });

  /* ---------- results table ---------- */
  var table = $('#scr-t'), thead = table.tHead, tbody = table.tBodies[0], tbodyUnk = table.tBodies[1], wrap = $('#scr-wrap');
  function lower(n) { return n.replace(/^[A-Z](?=[a-z])/, function (c) { return c.toLowerCase(); }); }
  function orList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  function th(k, type, cls, tip) {
    return '<th scope="col" class="' + cls + '" data-sort="' + type + '" data-k="' + k + '"' + (sort.k === k ? ' aria-sort="' + sort.dir + '"' : '') + (tip ? ' title="' + esc(tip) + '"' : '') + '><button type="button" class="th-b">' + esc(colName(k, true)) + '</button></th>';
  }
  function renderHead() {
    thead.rows[0].innerHTML = '<th scope="col" class="sx sx-0"><input type="checkbox" id="scr-all" aria-label="Select every row shown"></th>' + th('tk', 'text', 'sx sx-1 l') +
      COLS.filter(function (k) { return vis[k]; }).map(function (k) { var m = BY[k]; return th(k, m && m.cat ? 'text' : 'num', m && m.cat ? 'l' : '', m && m.tip); }).join('');
    colsBtn.innerHTML = M.icon('table', 'ic-sm') + 'Columns <span class="dim">' + (COLS.filter(function (k) { return vis[k]; }).length + 1) + ' of ' + (COLS.length + 1) + '</span>';
  }
  function cell(r, k) {
    var m = BY[k], v, up;
    if (k === 'price') return '<td data-v="' + r.it.p + '"><span class="scr-ccy">' + r.cur + '</span>' + M.pxHTML(r.id) + '</td>';
    if (k === 'chg') return '<td data-v="' + M.pctOf(r.it).toFixed(4) + '">' + M.chgHTML(r.id, { bare: true }) + '</td>';
    if (m.cat) return '<td class="l">' + esc(m.get(r)) + '</td>';
    v = val(r, m);
    if (v == null) return '<td class="c" data-v=""><span class="scr-na" role="img" title="' + esc(why(r, m)) + '" aria-label="No data. ' + esc(why(r, m)) + '">—</span></td>';
    if (m.chg) { up = v >= 0; return '<td data-v="' + v.toFixed(4) + '"><span class="chg bare ' + (up ? 'up' : 'dn') + '">' + M.fpct(v, 1) + ' <i aria-hidden="true">' + (up ? '▲' : '▼') + '</i></span></td>'; }
    if (m.bar) return '<td data-v="' + v.toFixed(4) + '"><span class="rbc" title="52-week low ' + r.cur + M.fmt(r.lo52) + ', high ' + r.cur + M.fmt(r.hi52) + '"><span class="rangebar" style="--p:' + v.toFixed(1) + '%" aria-hidden="true"><i></i></span><span>' + v.toFixed(0) + '%</span></span></td>';
    return '<td data-v="' + v.toFixed(4) + '">' + m.cell(v) + '</td>';
  }
  function sortValue(r, k) { var m = BY[k]; return k === 'tk' ? r.id : k === 'price' ? r.it.p : k === 'chg' ? M.pctOf(r.it) : m.cat ? m.get(r) : val(r, m); }
  /* same order as ML.sortable gives, except that rows with no value always go last */
  function ordered(rows) {
    var k = sort.k, text = k === 'tk' || (BY[k] && BY[k].cat), s = sort.dir === 'ascending' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var x = sortValue(a, k), y = sortValue(b, k);
      if (x == null || y == null) return (x == null) - (y == null) || a.id.localeCompare(b.id);
      return (text ? x.localeCompare(y) : x - y) * s || a.id.localeCompare(b.id);
    });
  }
  var nRoll = null, liveTimer;
  function rowHTML(r, keys) {
    return '<tr data-id="' + r.id + '"' + (sel[r.id] ? ' class="is-sel"' : '') + '><td class="sx sx-0"><input type="checkbox" class="scr-ck" aria-label="Select ' + r.id + '"' + (sel[r.id] ? ' checked' : '') + '></td>' +
      '<td class="sx sx-1 l" data-v="' + r.id + '">' + M.tk(r.id) + '</td>' + keys.map(function (k) { return cell(r, k); }).join('') + '</tr>';
  }
  /* rows that pass go in the first table body (the one ML.sortable sorts); rows that cannot be checked follow under a heading in the second */
  function renderBody() {
    var ok = [], unk = [], keys = COLS.filter(function (k) { return vis[k]; });
    ROWS.forEach(function (r) { var t = test(r); if (t === 1) ok.push(r); else if (t < 0) unk.push(r); });
    var rest = hideUnk ? [] : ordered(unk), lacking = filters.filter(function (f) { return !isAny(f) && BY[f.k].need; }).map(function (f) { return lower(BY[f.k].n); });
    view = ordered(ok).concat(rest);
    var seen = {}; view.forEach(function (r) { seen[r.id] = 1; }); Object.keys(sel).forEach(function (id) { if (!seen[id]) delete sel[id]; });
    tbody.innerHTML = view.slice(0, ok.length).map(function (r) { return rowHTML(r, keys); }).join('');
    tbodyUnk.innerHTML = !rest.length ? '' : '<tr class="scr-sep"><th scope="rowgroup" colspan="' + (keys.length + 2) + '"><span>' + rest.length + (rest.length === 1 ? ' listing' : ' listings') +
      ' cannot be checked: no ' + orList(lacking) + ' data for Hong Kong and London at $0</span></th></tr>' + rest.map(function (r) { return rowHTML(r, keys); }).join('');
    wrap.hidden = !view.length; $('#scr-empty').hidden = !!view.length;
    /* live count */
    var prev = nRoll ? +nRoll.txt : ok.length, note = !unk.length ? '' : unk.length + (hideUnk ? ' hidden' : ' more shown') + ': no data to check';
    if (!nRoll) nRoll = new M.Roll($('#scr-n'), String(ok.length)); else nRoll.set(String(ok.length), ok.length > prev ? 1 : -1);
    $('#scr-of').textContent = 'of ' + TOTAL + (ok.length === 1 ? ' matches' : ' match');
    $('#scr-unk').textContent = note;
    clearTimeout(liveTimer); liveTimer = setTimeout(function () { $('#scr-live').textContent = ok.length + ' of ' + TOTAL + ' stocks match' + (note ? ', ' + note : '') + '.'; }, 500);
    var text = sort.k === 'tk' || (BY[sort.k] && BY[sort.k].cat), up = sort.dir === 'ascending';
    $('#scr-sorted').textContent = 'Sorted by ' + lower(colName(sort.k)) + ', ' + (text ? (up ? 'A to Z' : 'Z to A') : up ? 'lowest first' : 'highest first');
    $('#scr-hide').hidden = !unk.length && !hideUnk;
    paintSel();
  }
  function changed() { renderBody(); syncSaved(); }
  M.sortable(table);
  thead.addEventListener('click', function (e) {
    var h = e.target.closest('th[data-sort]'); if (!h) return;
    sort = { k: h.dataset.k, dir: h.getAttribute('aria-sort') || 'descending' }; renderBody();
  });
  wrap.addEventListener('scroll', function () { table.classList.toggle('scrolled-x', wrap.scrollLeft > 2); }, { passive: true });
  $('#scr-hide').addEventListener('click', function () {
    hideUnk = !hideUnk; this.setAttribute('aria-pressed', hideUnk); this.classList.toggle('is-on', hideUnk);
    this.textContent = hideUnk ? 'Showing only rows that can be checked' : 'Hide rows that cannot be checked'; renderBody();
  });

  /* ---------- column chooser ---------- */
  var colsBtn = $('#scr-cols');
  function renderCols() {
    colsPop.innerHTML = '<div class="fe-h"><h3 class="t3">Columns</h3><span class="label" id="scr-cols-n"></span></div>' +
      '<div class="fe-cats" role="group" aria-label="Columns shown">' +
        '<label class="fe-cat"><input type="checkbox" checked disabled><span>Ticker</span><span class="n">Always shown</span></label>' +
        COLS.map(function (k) { return '<label class="fe-cat"><input type="checkbox" value="' + k + '"' + (vis[k] ? ' checked' : '') + '><span>' + esc(colName(k)) + '</span><span class="n">' + (BY[k] ? BY[k].kind : 'Price') + '</span></label>'; }).join('') + '</div>' +
      '<div class="fe-f"><button type="button" class="linkish" data-all>Show all</button><button type="button" class="linkish" data-def>Reset</button><span class="sp"></span><button type="button" class="btn btn-sm btn-primary" data-done>Done</button></div>';
    countCols();
  }
  function countCols() { var n = COLS.filter(function (k) { return vis[k]; }).length; $('#scr-cols-n').textContent = (n + 1) + ' of ' + (COLS.length + 1) + ' shown'; }
  function applyCols() {
    if (sort.k !== 'tk' && !vis[sort.k]) sort = vis.mcap ? { k: 'mcap', dir: 'descending' } : { k: 'tk', dir: 'ascending' };
    renderHead(); renderBody(); countCols();
  }
  colsBtn.addEventListener('click', function () { togglePop(colsPop, colsBtn, true, renderCols); });
  colsPop.addEventListener('change', function (e) { if (e.target.value in vis) { vis[e.target.value] = e.target.checked; applyCols(); } });
  colsPop.addEventListener('click', function (e) {
    if (e.target.closest('[data-done]')) { hidePop(true); return; }
    var all = e.target.closest('[data-all]'), def = e.target.closest('[data-def]'); if (!all && !def) return;
    COLS.forEach(function (k) { vis[k] = all ? true : !HIDDEN.test(k); });
    $$('input[value]', colsPop).forEach(function (c) { c.checked = vis[c.value]; }); applyCols();
  });

  /* ---------- row selection and the bulk action bar ---------- */
  var bulk = $('#scr-bulk'), bulkCmp = $('#scr-bulk-cmp');
  $('#scr-bulk-watch').innerHTML = M.icon('star', 'ic-sm') + 'Add to watchlist';
  function picked() { return view.filter(function (r) { return sel[r.id]; }).map(function (r) { return r.id; }); }
  function paintSel() {
    var ids = picked(), n = ids.length, all = $('#scr-all'), many = n > 6;
    $$('tr[data-id]', table).forEach(function (tr) { var on = !!sel[tr.dataset.id]; tr.classList.toggle('is-sel', on); $('.scr-ck', tr).checked = on; });
    if (all) { all.checked = n > 0 && n === view.length; all.indeterminate = n > 0 && n < view.length; }
    bulk.classList.toggle('on', n > 0);
    $('#scr-bulk-n').innerHTML = n ? '<b>' + n + '</b> selected' : '';
    bulkCmp.innerHTML = M.icon('compare', 'ic-sm') + (many ? 'Compare takes up to 6' : 'Compare selected');
    bulkCmp.setAttribute('aria-disabled', many ? 'true' : 'false');
    bulkCmp.href = 'compare.html?s=' + ids.slice(0, 6).map(encodeURIComponent).join(',');
  }
  table.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]'), ck = e.target.closest('.scr-ck'); if (!tr) return;
    var id = tr.dataset.id, on = ck ? ck.checked : !sel[id];
    if (!ck && (!(e.ctrlKey || e.metaKey) || e.target.closest('a, button, input'))) return;
    var order = view.map(function (r) { return r.id; }), i = order.indexOf(id), j = e.shiftKey && lastPick ? order.indexOf(lastPick) : -1;
    /* shift extends from the row picked last */
    (j < 0 ? [id] : order.slice(Math.min(i, j), Math.max(i, j) + 1)).forEach(function (x) { if (on) sel[x] = 1; else delete sel[x]; });
    lastPick = id; paintSel();
  });
  thead.addEventListener('change', function (e) {
    if (e.target.id !== 'scr-all') return;
    var on = e.target.checked; view.forEach(function (r) { if (on) sel[r.id] = 1; else delete sel[r.id]; }); paintSel();
  });
  $('#scr-bulk-clear').addEventListener('click', function () { sel = {}; paintSel(); wrap.focus({ preventScroll: true }); });
  $('#scr-bulk-watch').addEventListener('click', function () {
    var ids = picked(); ids.forEach(function (id) { document.dispatchEvent(new CustomEvent('ml:watch', { detail: id })); });
    M.toast(ids.length === 1 ? ids[0] + ' added to Watchlist.' : ids.length + ' stocks added to Watchlist: ' + ids.join(', ') + '.');
  });
  bulkCmp.addEventListener('click', function (e) { if (bulkCmp.getAttribute('aria-disabled') === 'true') { e.preventDefault(); M.toast('Compare takes up to 6 stocks. Untick ' + (picked().length - 6) + ' to continue.'); } });

  /* ---------- first paint ---------- */
  $('#scr-band').insertBefore(M.el('span', '', M.icon('globe')).firstChild, $('#scr-band-t'));
  renderHead(); renderChips(); renderSaved(); renderBody();
})();
