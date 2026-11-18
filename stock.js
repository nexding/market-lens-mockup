/* Market Lens mockup: stock page (Summary and Financials). All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc;
  M.shell('');

  var id = new URLSearchParams(location.search).get('s') || 'AAPL';
  if (!I[id] || I[id].kind !== 'stock') id = 'AAPL';
  var it = I[id], held = M.HOLD[id], cur = M.CCY[it.c];
  document.title = id + ' · ' + it.n + ' · Market Lens (mockup)';
  function nz(seed) { return (M.rng(M.hash(seed))() - 0.5) * 2; }
  var HI52 = it.p * 1.37, LO52 = it.p * 0.9, PE = 14 + M.hash(id + 'pe') % 22;

  /* ---------- header ---------- */
  $('#sh-id').innerHTML = '<span class="mono mono-lg" style="--h:' + it.h + '" aria-hidden="true">' + it.mono + '</span><div><h1 class="sh-name">' + esc(it.n) + '</h1>' +
    '<div class="sh-meta"><b>' + esc(id) + '</b><span class="badge badge-x">' + it.x + '</span><span>' + esc(it.sec) + ' · ' + esc(it.cty) + '</span>' + (held ? '<span class="badge badge-accent">Held</span>' : '') + '</div></div>';
  M.bindRoll(id, $('#sh-px'), function (x) { return M.fmt(x.p, 2); });
  $('#sh-ccy').textContent = it.c;
  $('#sh-chg').innerHTML = M.chgHTML(id, { abs: true });
  $('#sh-delay').innerHTML = M.icon('clock', 'ic-sm') + 'Delayed 15 min · as of 16:00';
  var ah = it.p * 1.0021;
  $('#sh-after').innerHTML = '<span class="dim">After hours</span><b>' + M.fmt(ah) + '</b><span class="chg up bare">' + M.fsign(ah - it.p) + ' (' + M.fpct((ah / it.p - 1) * 100) + ') <i aria-hidden="true">▲</i></span><span class="dim">18:42</span>';
  var ACT = [['Watch', 'star', 'watch'], ['Add holding', 'plus'], ['Set alert', 'bell'], ['Compare', 'compare'], ['Mind map', 'map', 'map']];
  $('#sh-actions').innerHTML = ACT.map(function (a, i) {
    return a[2] === 'map' ? '<a class="btn" href="mindmap.html">' + M.icon(a[1]) + '<span>' + a[0] + '</span></a>'
      : '<button class="btn' + (i === 1 ? ' btn-primary' : '') + '" type="button" data-act="' + a[0] + '"' + (a[2] === 'watch' ? ' aria-pressed="false"' : '') + '>' + M.icon(a[1]) + '<span>' + a[0] + '</span></button>';
  }).join('');
  $('#sh-actions').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'Watch') { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.classList.toggle('is-on', on); $('span', b).textContent = on ? 'Watching' : 'Watch'; M.toast(on ? id + ' added to Watchlist.' : id + ' removed from Watchlist.'); }
    else M.toast(b.dataset.act + ' for ' + id + ' is not part of this mockup.');
  });
  $('#dd-banner').innerHTML = M.icon('down') + '<span><b>Down 27% from its 52-week high</b> of ' + cur + M.fmt(HI52) + '. The drawdown check estimates how likely a recovery is, with its uncertainty.</span><button class="linkish" data-goto="drawdown">Open drawdown check</button>';

  /* ---------- tabs ---------- */
  var TABS = [['summary', 'Summary'], ['chart', 'Chart'], ['financials', 'Financials'], ['statistics', 'Statistics'], ['historical', 'Historical Data'], ['analysis', 'Analysis'], ['holders', 'Holders'], ['options', 'Options'], ['earnings', 'Earnings'], ['profile', 'Profile'], null,
    ['deepdive', 'Deep-dive'], ['drawdown', 'Drawdown check', 1], ['news', 'News & mind map'], ['stress', 'Stress test'], held ? ['position', 'My position'] : 0, ['track', 'Track record']].filter(function (t) { return t !== 0; });
  $('#stabs').innerHTML = TABS.map(function (t) {
    return t ? '<button class="tab' + (t[0] === 'summary' ? ' is-active' : '') + '" role="tab" data-v="' + t[0] + '">' + t[1] + (t[2] ? '<span class="dot" title="This stock is down materially"></span>' : '') + '</button>' : '<span class="tab-div" aria-hidden="true"></span>';
  }).join('') + '<span class="tab-ind"></span>';
  var phTimer;
  function fillOther(v) {
    var label = TABS.filter(function (t) { return t && t[0] === v; })[0][1], ph = $('#ph');
    ph.innerHTML = '<div class="sk" style="width:32%;height:26px"></div><div class="sk" style="width:100%"></div><div class="sk" style="width:92%"></div><div class="sk" style="width:96%"></div><div class="sk" style="width:60%"></div><div class="sk" style="width:100%;height:160px;border-radius:12px"></div>';
    clearTimeout(phTimer);
    phTimer = setTimeout(function () {
      ph.innerHTML = '<div class="empty">' + M.icon('doc') + '<h2 class="t2">' + esc(label) + '</h2><p>This tab is not part of the mockup. Its layout is described in section 14 of the plan (docs/plan.md). Summary and Financials are built out.</p></div>';
      var s = $('.empty svg', ph); if (s) { s.style.width = '40px'; s.style.height = '40px'; }
    }, M.rm() ? 0 : 650);
  }
  /* tabs other than Summary and Financials are registered by the stock-tabs-*.js files with ML.stockTab(name, render) */
  var built = {}, ctx = null;
  function go(v, dir) {
    var key = v, pn = null, fresh = false;
    if (v !== 'summary' && v !== 'financials') {
      if (M.stockTabs[v]) {
        pn = $('#panels > [data-v="' + v + '"]');
        if (!pn) { pn = M.el('section', 'panel'); pn.dataset.v = v; pn.setAttribute('role', 'tabpanel'); $('#panels').appendChild(pn); fresh = true; }
      } else { key = 'other'; fillOther(v); }
    }
    M.showPanel($('#panels'), key, dir);
    if (fresh) { built[v] = M.stockTabs[v](pn, ctx) || {}; M.observeReveal(pn); }
    if (built[v] && built[v].show) built[v].show();
    if (key === 'financials') finShown();
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* file:// */ }
  }
  var tabs = M.initTabs($('#stabs'), go);
  document.addEventListener('click', function (e) { var g = e.target.closest('[data-goto]'); if (g) { tabs.select(g.dataset.goto, true); window.scrollTo({ top: 0, behavior: M.rm() ? 'auto' : 'smooth' }); } });
  document.addEventListener('keydown', function (e) {
    if ((e.key !== '[' && e.key !== ']') || /input|select|textarea/i.test(e.target.tagName)) return;
    var vs = TABS.filter(Boolean).map(function (t) { return t[0]; }), i = vs.indexOf($('#stabs .tab.is-active').dataset.v);
    tabs.select(vs[(i + (e.key === ']' ? 1 : vs.length - 1)) % vs.length], true);
  });

  /* ---------- summary: chart ---------- */
  var NOW = new Date(2026, 10, 16, 16, 0), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* a random path through control points [[t, multiple of price]] */
  function path(seed, n, pts, vol) {
    var noise = M.bridge(seed, n, 1, 1, vol), out = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), j = 0; while (j < pts.length - 2 && t > pts[j + 1][0]) j++;
      var a = pts[j], b = pts[j + 1], u = (t - a[0]) / (b[0] - a[0]);
      out.push(it.p * (a[1] + (b[1] - a[1]) * u) * noise[i]);
    }
    out[n - 1] = it.p; return out;
  }
  function spanTip(days, mode) {
    return function (f) { var d = new Date(NOW.getTime() - (1 - f) * days * 864e5); return mode === 'y' ? String(d.getFullYear()) : mode === 'm' ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()]; };
  }
  function labels(tip) { return [0, 0.25, 0.5, 0.75, 1].map(function (f) { return { f: f, t: tip(f) }; }); }
  var R = {
    '1D': function () { var tip = function (f) { var m = 570 + Math.round(f * 390); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }; return { d: M.bridge(id + ':1d', 79, it.pc, it.p, 0.0016), base: it.pc, tip: tip }; },
    '5D': function () { return { d: path(id + ':5d', 130, [[0, 0.985], [1, 1]], 0.003), tip: spanTip(7) }; },
    '1M': function () { return { d: path(id + ':1m', 150, [[0, 0.96], [0.5, 1.03], [1, 1]], 0.005), tip: spanTip(30) }; },
    '6M': function () { return { d: path(id + ':6m', 180, [[0, 1.2], [0.24, 1.37], [0.6, 1.1], [1, 1]], 0.008), tip: spanTip(182) }; },
    'YTD': function () { return { d: path(id + ':ytd', 220, [[0, 0.97], [0.38, 1.2], [0.57, 1.37], [0.78, 1.08], [1, 1]], 0.009), tip: spanTip(320) }; },
    '1Y': function () { return { d: path(id + ':1y', 252, [[0, 0.93], [0.45, 1.22], [0.62, 1.37], [0.8, 1.08], [1, 1]], 0.009), tip: spanTip(365, 'm') }; },
    '5Y': function () { return { d: path(id + ':5y', 300, [[0, 0.45], [0.5, 0.8], [0.88, 1.37], [1, 1]], 0.014), tip: spanTip(1826, 'm') }; },
    'Max': function () { return { d: path(id + ':max', 360, [[0, 0.03], [0.5, 0.2], [0.8, 0.62], [0.96, 1.37], [1, 1]], 0.02), tip: spanTip(9500, 'y') }; }
  };
  var range = '1D', chart = new M.AreaChart($('#s-chart'), { label: id + ' price', fmt: function (v) { return M.fmt(v, v < 10 ? 2 : v < 1000 ? 1 : 0); } });
  function setRange(r, mode) { range = r; var d = R[r](); chart.set(d.d, { base: d.base, labels: labels(d.tip), tip: d.tip, mode: mode }); }
  setRange('1D', 'draw');
  M.initSeg($('#s-range'), function (v) { setRange(v); });
  M.onTick(function (x) { if (x.id === id && range === '1D') chart.nudge(x.p); });

  /* ---------- financial data ---------- */
  var K = id === 'AAPL' ? 1 : 0.12 + (M.hash(id + 'k') % 90) / 100, SEAS = [0.30, 0.235, 0.22, 0.245];
  function buildData(first) {
    var L = {};
    function annual(key, base, g, nv) { var a = []; for (var y = 0; y < 5; y++) { var v = base * Math.pow(1 + g, y - 4) * (1 + nz(id + key + y) * nv); if (first && y < 3 && /prod|sga|rec|ol|wc/.test(key)) v *= 1 + nz(id + key + 'fr' + y) * 0.012; a.push(v); } return a; }
    function quarters(key, a, flow) {
      var q = [], y, s;
      for (y = 3; y < 5; y++) for (s = 0; s < 4; s++) q.push(flow ? a[y] * SEAS[s] * (1 + nz(id + key + 'q' + y + s) * 0.03) : a[y - 1] + (a[y] - a[y - 1]) * (s + 1) / 4 * (s === 3 ? 1 : 1 + nz(id + key + 'b' + y + s) * 0.08));
      if (flow) for (y = 0; y < 2; y++) { var sum = q[y * 4] + q[y * 4 + 1] + q[y * 4 + 2] + q[y * 4 + 3], f = a[3 + y] / sum; for (s = 0; s < 4; s++) q[y * 4 + s] *= f; }
      return q;
    }
    function leaf(key, base, g, nv, flow, abs) { var a = annual(key, base * (abs ? 1 : K), g, nv == null ? 0.015 : nv); L[key] = { a: a, q: quarters(key, a, flow), flow: flow }; }
    function calc(key, fn, flow) {
      L[key] = { flow: flow !== false, a: [0, 1, 2, 3, 4].map(function (i) { return fn(function (x) { return L[x].a[i]; }); }), q: [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return fn(function (x) { return L[x].q[i]; }); }) };
    }
    /* income statement */
    leaf('prod', 298000, 0.055, 0.02, true); leaf('serv', 104000, 0.13, 0.015, true); calc('rev', function (g) { return g('prod') + g('serv'); });
    leaf('cprod', 188000, 0.05, 0.02, true); leaf('cserv', 28500, 0.11, 0.02, true); calc('cor', function (g) { return g('cprod') + g('cserv'); });
    calc('gp', function (g) { return g('rev') - g('cor'); });
    leaf('rnd', 33500, 0.09, 0.01, true); leaf('sga', 27200, 0.045, 0.01, true); calc('opex', function (g) { return g('rnd') + g('sga'); });
    calc('oi', function (g) { return g('gp') - g('opex'); });
    leaf('oth', 420, 0, 0.6, true); calc('pti', function (g) { return g('oi') + g('oth'); });
    calc('tax', function (g) { return g('pti') * 0.162; }); calc('ni', function (g) { return g('pti') - g('tax'); });
    leaf('sh', L.ni.a[4] / (it.p / PE), -0.028, 0.002, false, true);
    calc('eps', function (g) { return g('ni') / g('sh'); });
    /* balance sheet */
    leaf('cash', 31200, 0.02, 0.05, false); leaf('sec', 128400, -0.03, 0.03, false); leaf('rec', 62100, 0.06, 0.03, false); leaf('inv', 7400, 0.04, 0.05, false); leaf('ppe', 46800, 0.035, 0.01, false); leaf('oa', 88600, 0.05, 0.02, false);
    calc('ta', function (g) { return g('cash') + g('sec') + g('rec') + g('inv') + g('ppe') + g('oa'); }, false);
    leaf('ap', 68900, 0.05, 0.03, false); leaf('dr', 13100, 0.04, 0.03, false); leaf('debt', 96700, -0.04, 0.02, false); leaf('ol', 129300, 0.03, 0.02, false);
    calc('tl', function (g) { return g('ap') + g('dr') + g('debt') + g('ol'); }, false);
    calc('eq', function (g) { return g('ta') - g('tl'); }, false);
    /* cash flow */
    calc('cf_ni', function (g) { return g('ni'); }); leaf('da', 11800, 0.03, 0.01, true); leaf('sbc', 12400, 0.1, 0.01, true); leaf('wc', 3200, 0, 0.9, true);
    calc('cfo', function (g) { return g('cf_ni') + g('da') + g('sbc') + g('wc'); });
    leaf('capex', -11900, 0.07, 0.03, true); leaf('secn', 9800, 0, 0.5, true); leaf('cfio', -1400, 0, 0.4, true);
    calc('cfi', function (g) { return g('capex') + g('secn') + g('cfio'); });
    leaf('div', -15400, 0.03, 0.005, true); leaf('bb', -91000, 0.04, 0.04, true); leaf('debtn', -5600, 0, 0.5, true);
    calc('cff', function (g) { return g('div') + g('bb') + g('debtn'); });
    calc('fcf', function (g) { return g('cfo') + g('capex'); });
    return L;
  }
  var DATA = { restated: buildData(false), first: buildData(true) };
  var STMT = {
    income: { title: 'Income statement', rows: [
      { id: 'rev', n: 'Total revenue', kids: [['prod', 'Products'], ['serv', 'Services']] },
      { id: 'cor', n: 'Cost of revenue', kids: [['cprod', 'Products'], ['cserv', 'Services']] },
      { id: 'gp', n: 'Gross profit', total: 1 },
      { id: 'opex', n: 'Operating expenses', kids: [['rnd', 'Research and development'], ['sga', 'Selling, general and administrative']] },
      { id: 'oi', n: 'Operating income', total: 1 }, { id: 'oth', n: 'Other income (expense), net' },
      { id: 'pti', n: 'Income before taxes', total: 1 }, { id: 'tax', n: 'Income taxes' }, { id: 'ni', n: 'Net income', total: 1 },
      { id: 'eps', n: 'Diluted EPS', dp: 2 }, { id: 'sh', n: 'Diluted shares (millions)' }] },
    balance: { title: 'Balance sheet', rows: [
      { id: 'ta', n: 'Total assets', total: 1, kids: [['cash', 'Cash and equivalents'], ['sec', 'Marketable securities'], ['rec', 'Receivables'], ['inv', 'Inventories'], ['ppe', 'Property, plant and equipment, net'], ['oa', 'Other assets']] },
      { id: 'tl', n: 'Total liabilities', total: 1, kids: [['ap', 'Accounts payable'], ['dr', 'Deferred revenue'], ['debt', 'Term debt'], ['ol', 'Other liabilities']] },
      { id: 'eq', n: 'Shareholders’ equity', total: 1 }] },
    cash: { title: 'Cash flow', rows: [
      { id: 'cfo', n: 'Cash from operations', total: 1, kids: [['cf_ni', 'Net income'], ['da', 'Depreciation and amortisation'], ['sbc', 'Share-based compensation'], ['wc', 'Changes in working capital']] },
      { id: 'cfi', n: 'Cash from investing', total: 1, kids: [['capex', 'Capital expenditure'], ['secn', 'Securities, net'], ['cfio', 'Other investing']] },
      { id: 'cff', n: 'Cash from financing', total: 1, kids: [['div', 'Dividends paid'], ['bb', 'Share repurchases'], ['debtn', 'Debt, net']] },
      { id: 'fcf', n: 'Free cash flow', total: 1 }] }
  };
  var YEARS = ['FY2021', 'FY2022', 'FY2023', 'FY2024', 'FY2025'], QTRS = ['Q1 FY24', 'Q2 FY24', 'Q3 FY24', 'Q4 FY24', 'Q1 FY25', 'Q2 FY25', 'Q3 FY25', 'Q4 FY25'];
  var st = { stmt: 'income', per: 'annual', basis: 'restated', growth: false, open: { rev: 1 }, sel: 'rev' };
  function L() { return DATA[st.basis]; }
  function ttm(r, e) { return r.flow ? r.q[e] + r.q[e - 1] + r.q[e - 2] + r.q[e - 3] : r.q[e]; }
  /* columns, newest first: each has a label, a value getter and a getter for the comparison period */
  function cols() {
    if (st.per === 'annual') return [4, 3, 2, 1, 0].map(function (y) { return { label: YEARS[y], v: function (k) { return L()[k].a[y]; }, p: y > 0 ? function (k) { return L()[k].a[y - 1]; } : null }; });
    if (st.per === 'quarterly') return [7, 6, 5, 4, 3, 2, 1, 0].map(function (q) { return { label: QTRS[q], v: function (k) { return L()[k].q[q]; }, p: q > 3 ? function (k) { return L()[k].q[q - 4]; } : null }; });
    return [7, 6, 5, 4, 3].map(function (e) { return { label: 'TTM to ' + QTRS[e], v: function (k) { return ttm(L()[k], e); }, p: e === 7 ? function (k) { return ttm(L()[k], 3); } : null }; });
  }
  function num(v, dp) { var s = M.fmt(Math.abs(v), dp || 0); return v < 0 ? '<span class="val neg">(' + s + ')</span>' : '<span class="val">' + s + '</span>'; }
  function growth(c, k) {
    if (!c.p) return '<span class="yoy dim">—</span>';
    var a = c.v(k), b = c.p(k); if (!b) return '<span class="yoy dim">—</span>';
    var g = (a - b) / Math.abs(b) * 100; return '<span class="yoy ' + (g >= 0 ? 'up' : 'dn') + '">' + M.fpct(g, 1) + '</span>';
  }
  var thead = $('#fin thead'), tbody = $('#fin tbody');
  function rowHTML(k, name, o) {
    var C = cols(), cls = (o.sub ? 'sub' + (st.open[o.parent] ? ' open' : '') : '') + (o.total ? ' total' : '') + (o.kids && st.open[k] ? ' exp' : '') + (st.sel === k ? ' is-sel' : '');
    return '<tr class="' + cls.trim() + '" data-id="' + k + '"' + (o.sub ? ' data-parent="' + o.parent + '"' : '') + ' tabindex="0">' +
      '<td><div class="cw">' + (o.kids ? '<button class="chev" type="button" aria-expanded="' + (st.open[k] ? 'true' : 'false') + '" aria-label="Show or hide the parts of ' + esc(name) + '">' + M.icon('right', 'ic-sm') + '</button>' : (o.sub ? '' : '<span class="nochev"></span>')) + '<span class="val">' + esc(name) + '</span></div></td>' +
      C.map(function (c) { return '<td><div class="cw">' + num(c.v(k), o.dp) + (st.growth ? growth(c, k) : '') + '</div></td>'; }).join('') + '</tr>';
  }
  function render() {
    var S = STMT[st.stmt], C = cols();
    thead.innerHTML = '<tr><th scope="col"><span>' + S.title + '</span></th>' + C.map(function (c) { return '<th scope="col"><span>' + c.label + '</span></th>'; }).join('') + '</tr>';
    tbody.innerHTML = S.rows.map(function (r) {
      return rowHTML(r.id, r.n, { total: r.total, kids: r.kids, dp: r.dp }) + (r.kids || []).map(function (c) { return rowHTML(c[0], c[1], { sub: 1, parent: r.id }); }).join('');
    }).join('');
    $('#fin-note').textContent = 'USD millions except per-share data. Fiscal year ends in September. ' + (st.basis === 'first' ? 'Showing values as first reported: FY2021 to FY2023 differ from the restated view in a few lines. ' : '') + 'Sample data.';
    drawMini(true);
  }
  function swap(fn) {
    if (M.rm()) { fn(); return; }
    thead.classList.add('swap'); tbody.classList.add('swap');
    setTimeout(function () { fn(); requestAnimationFrame(function () { requestAnimationFrame(function () { thead.classList.remove('swap'); tbody.classList.remove('swap'); }); }); }, 130);
  }
  function nameOf(k) { var n = ''; Object.keys(STMT).forEach(function (s) { STMT[s].rows.forEach(function (r) { if (r.id === k) n = r.n; (r.kids || []).forEach(function (c) { if (c[0] === k) n = c[1] + ' (' + r.n.toLowerCase() + ')'; }); }); }); return n; }
  function toggle(k, on) {
    st.open[k] = on == null ? !st.open[k] : on;
    var tr = $('tr[data-id="' + k + '"]', tbody); if (!tr) return;
    tr.classList.toggle('exp', !!st.open[k]); var b = $('.chev', tr); if (b) b.setAttribute('aria-expanded', st.open[k] ? 'true' : 'false');
    $$('tr[data-parent="' + k + '"]', tbody).forEach(function (s) { s.classList.toggle('open', !!st.open[k]); });
  }
  function select(k) { st.sel = k; $$('tr', tbody).forEach(function (tr) { tr.classList.toggle('is-sel', tr.dataset.id === k); }); drawMini(true); }
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.closest('.chev')) { toggle(tr.dataset.id); return; }
    select(tr.dataset.id);
  });
  tbody.addEventListener('keydown', function (e) {
    var tr = e.target.closest('tr'); if (!tr || e.target.closest('.chev')) return;
    var vis = $$('tr', tbody).filter(function (r) { return !r.classList.contains('sub') || r.classList.contains('open'); }), i = vis.indexOf(tr);
    if (e.key === 'ArrowDown' && vis[i + 1]) { vis[i + 1].focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && vis[i - 1]) { vis[i - 1].focus(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { select(tr.dataset.id); e.preventDefault(); }
    else if (e.key === 'ArrowRight' && $('.chev', tr)) { toggle(tr.dataset.id, true); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { if ($('.chev', tr)) toggle(tr.dataset.id, false); else if (tr.dataset.parent) { toggle(tr.dataset.parent, false); $('tr[data-id="' + tr.dataset.parent + '"]', tbody).focus(); } e.preventDefault(); }
  });
  var segs = [
    M.initSeg($('#fin-stmt'), function (v) { swap(function () { st.stmt = v; st.sel = STMT[v].rows[0].id; st.open = {}; st.open[st.sel] = 1; $('#fin-expand').setAttribute('aria-pressed', 'false'); $('#fin-expand').classList.remove('is-on'); render(); }); }),
    M.initSeg($('#fin-per'), function (v) { swap(function () { st.per = v; render(); }); }),
    M.initSeg($('#fin-basis'), function (v) { swap(function () { st.basis = v; render(); }); })
  ];
  $('#fin-growth').addEventListener('click', function () { st.growth = !st.growth; this.setAttribute('aria-pressed', st.growth); this.classList.toggle('is-on', st.growth); swap(render); });
  $('#fin-expand').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on); this.classList.toggle('is-on', on); this.textContent = on ? 'Collapse all' : 'Expand all';
    STMT[st.stmt].rows.forEach(function (r) { if (r.kids) toggle(r.id, on); });
  });
  $('#fin-csv').innerHTML = M.icon('download', 'ic-sm') + 'CSV';
  $('#fin-csv').addEventListener('click', function () {
    var C = cols(), S = STMT[st.stmt], lines = [[S.title + ' (USD millions)'].concat(C.map(function (c) { return c.label; }))];
    S.rows.forEach(function (r) { lines.push([r.n].concat(C.map(function (c) { return c.v(r.id).toFixed(r.dp || 0); }))); (r.kids || []).forEach(function (k) { lines.push(['  ' + k[1]].concat(C.map(function (c) { return c.v(k[0]).toFixed(0); }))); }); });
    var csv = lines.map(function (l) { return l.map(function (x) { return /[",\n]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x; }).join(','); }).join('\r\n');
    var a = M.el('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = id.replace(/\W/g, '_') + '-' + st.stmt + '-' + st.per + '-sample.csv';
    document.body.appendChild(a); a.click(); a.remove(); M.toast('Downloaded ' + a.download + ' (sample data).');
  });
  $('#fin-wrap').addEventListener('scroll', function () { $('#fin').classList.toggle('scrolled-x', this.scrollLeft > 2); }, { passive: true });

  /* mini chart for the selected line item */
  var miniA;
  function drawMini(animate) {
    var C = cols().slice().reverse(), k = st.sel, vals = C.map(function (c) { return c.v(k); }), row = L()[k]; if (!row) return;
    var dp = k === 'eps' ? 2 : 0;
    $('#mini-t').textContent = nameOf(k); $('#mini-k').textContent = STMT[st.stmt].title + ' · ' + (st.per === 'annual' ? 'annual' : st.per === 'quarterly' ? 'quarterly' : 'trailing twelve months');
    var last = vals[vals.length - 1], c0 = cols()[0], cagr = st.per === 'annual' && vals[0] > 0 && last > 0 ? (Math.pow(last / vals[0], 1 / 4) - 1) * 100 : null;
    var rev = st.stmt === 'income' && k !== 'eps' && k !== 'sh' ? last / c0.v('rev') * 100 : null;
    $('#mini-kv').innerHTML = '<dt>' + c0.label + '</dt><dd>' + (last < 0 ? '(' + M.fmt(-last, dp) + ')' : M.fmt(last, dp)) + '</dd>' +
      '<dt>Change on a year earlier</dt><dd>' + (c0.p ? growth(c0, k).replace('class="yoy ', 'class="') : '—') + '</dd>' +
      (cagr != null ? '<dt>Four-year compound growth</dt><dd>' + M.fpct(cagr, 1) + '</dd>' : '') + (rev != null ? '<dt>Share of revenue</dt><dd>' + rev.toFixed(1) + '%</dd>' : '');
    var host = $('#mini-plot'), w = host.clientWidth, h = host.clientHeight; if (!w) return;
    var cv = $('#mini-cv'); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    if (miniA) miniA.cancel();
    function paint(u) {
      var ctx = M.fitCanvas(cv, w, h), n = vals.length, pt = 10, pb = 22, lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals)), ih = h - pt - pb, gap = n > 6 ? 6 : 10, bw = (w - gap * (n - 1)) / n;
      function Y(v) { return pt + (1 - (v - lo) / (hi - lo || 1)) * ih; }
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = M.rgba(M.COL['text-1'], 0.12); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Math.round(Y(0)) + 0.5); ctx.lineTo(w, Math.round(Y(0)) + 0.5); ctx.stroke();
      ctx.font = '500 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      vals.forEach(function (v, i) {
        var t = Math.max(0, Math.min(1, u * 1.6 - i / n * 0.6)), e = 1 - Math.pow(1 - t, 3), x = i * (bw + gap), y0 = Y(0), y1 = Y(v * e), top = Math.min(y0, y1), bh = Math.max(1, Math.abs(y1 - y0)), r = Math.min(4, bw / 2, bh);
        ctx.fillStyle = i === n - 1 ? M.COL.accent : M.rgba(M.COL.accent, 0.42);
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, top, bw, bh, v >= 0 ? [r, r, 0, 0] : [0, 0, r, r]); else ctx.rect(x, top, bw, bh); ctx.fill();
        ctx.fillStyle = M.COL['text-3']; ctx.fillText(C[i].label.replace('TTM to ', '').replace('FY20', 'FY'), x + bw / 2, h - 9);
      });
    }
    if (animate) miniA = M.tween(520, paint); else paint(1);
  }
  function finShown() { segs.forEach(function (s) { s.place(false); }); drawMini(true); }
  render();
  window.addEventListener('resize', function () { drawMini(false); });
  document.addEventListener('ml:paint', function () { drawMini(false); });

  /* ---------- summary: statistics (derived from the same sample statements) ---------- */
  var eps = DATA.restated.eps.a[4], shares = DATA.restated.sh.a[4], dlo = Math.min(it.p, it.pc) * 0.994, dhi = Math.max(it.p, it.pc) * 1.005, div = +(it.p * 0.0045).toFixed(2);
  function rb(lo, hi, v, dp) { return '<div class="rangebar" style="--p:' + Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1) + '%"><i></i></div><div class="rangebar-l"><span>' + M.fmt(lo, dp) + '</span><span>' + M.fmt(hi, dp) + '</span></div>'; }
  var STATS = [
    ['Previous close', M.fmt(it.pc)], ['Open', M.fmt(it.pc * 1.0018)], ['Day’s range', null, rb(dlo, dhi, it.p, 2)], ['52-week range', null, rb(LO52, HI52, it.p, 2)],
    ['Volume', M.fbig(48210000 * K + 4e6)], ['Average volume (3 months)', M.fbig(55140000 * K + 5e6)], ['Market cap', cur + M.fbig(shares * 1e6 * it.p)], ['Beta (5 years, monthly)', (0.8 + (M.hash(id + 'b') % 70) / 100).toFixed(2)],
    ['P/E (trailing)', (it.p / eps).toFixed(1)], ['P/E (forward)', (it.p / eps * 0.9).toFixed(1) + '<small>third-party</small>'], ['EPS (trailing)', M.fmt(eps)], ['Next earnings', '29 Jan 2027'],
    ['Dividend and yield', M.fmt(div * 4) + ' (' + (div * 4 / it.p * 100).toFixed(2) + '%)'], ['Ex-dividend date', '9 Feb 2027'], ['1-year analyst target', M.fmt(it.p * 1.14) + '<small>third-party</small>'], ['Shares outstanding', M.fbig(shares * 1e6)]
  ];
  $('#stats').innerHTML = STATS.map(function (s) { return '<div class="stat"><div class="label">' + s[0] + '</div>' + (s[2] || '<div class="v">' + s[1] + '</div>') + '</div>'; }).join('');

  /* ---------- summary: module cards ---------- */
  function pbar(p, lo, hi, base) { return '<div class="pbar" style="--p:' + p + ';--lo:' + lo + '%;--hi:' + hi + '%;--b:' + base + '%"><div class="fill"></div><div class="band"></div><div class="base" title="Baseline"></div></div>'; }
  var mods =
    '<a class="card mod lift reveal" href="#drawdown" data-goto="drawdown"><div class="mod-h"><span class="label">Drawdown check</span><span class="badge">Industry-level base rate</span></div>' +
      '<div class="mod-v">58%<small>80% interval 41 to 72%</small></div>' + pbar(0.58, 41, 72, 49) +
      '<div class="pbar-l"><span>P(regains prior high within 24 months)</span><span>Baseline 49%</span></div>' +
      '<p>Down 27% from the July high. About two thirds of the fall is specific to the company; the rest came with the sector.</p>' +
      '<div class="mod-foot"><span>A probability, not a price forecast</span><span class="linkish">Open</span></div></a>' +
    '<a class="card mod lift reveal" href="#deepdive" data-goto="deepdive"><div class="mod-h"><span class="label">Key filing changes</span><span class="badge">10-K FY2025 against FY2024</span></div>' +
      '<div class="mod-v">3<small>material changes in risk factors and MD&amp;A</small></div>' +
      '<ul class="flags"><li><i></i><span>New sentence on dependence on two customers for 23% of revenue</span></li><li><i></i><span>Capital-return guidance paragraph removed from MD&amp;A</span></li><li><i class="lo"></i><span>Supplier wording expanded: single-source components</span></li></ul>' +
      '<div class="mod-foot"><span>Rule flags and verified quotes</span><span class="linkish">Open</span></div></a>' +
    '<a class="card mod lift reveal" href="#deepdive" data-goto="deepdive"><div class="mod-h"><span class="label">Management credibility</span><span class="badge">24 resolved claims</span></div>' +
      '<div class="mod-v">71%<small>80% interval 58 to 82%</small></div>' + pbar(0.71, 58, 82, 64) +
      '<div class="pbar-l"><span>Dated, checkable claims later met</span><span>Sector 64%</span></div>' +
      '<div class="mod-foot"><span>Guidance bias: slightly cautious</span><span class="linkish">Open</span></div></a>' +
    '<a class="card mod lift reveal" href="mindmap.html"><div class="mod-h"><span class="label">Top news exposure</span><span class="badge">Model inference</span></div>' +
      '<p style="color:var(--text-1);font-size:15px;line-height:22px;font-weight:500">Shipping disruption raises freight and component costs</p>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chg dn">Likely bad <i aria-hidden="true">▼</i></span><span class="badge">Confidence: medium</span><span class="badge">Indirect, via suppliers</span></div>' +
      '<p>Reported by 14 outlets. Comparable past events: 9, with the sector down over 5 days in 6 of them.</p>' +
      '<div class="mod-foot"><span>Links are hypotheses, not facts</span><span class="linkish">Open mind map</span></div></a>';
  if (held) {
    var g = (it.p - held.cost) * held.q, dg = (it.p - it.pc) * held.q;
    mods = '<section class="card mod reveal"><div class="mod-h"><span class="label">My position</span><span class="badge badge-accent">Held</span></div>' +
      '<div class="mod-v">' + cur + M.fmt(held.q * it.p, 0) + '<small>' + held.q + ' shares · average cost ' + M.fmt(held.cost) + '</small></div>' +
      '<dl class="mini-kv" style="margin-top:0"><dt>Since purchase</dt><dd class="' + (g >= 0 ? 'up' : 'dn') + '">' + M.fsign(g, 0) + ' (' + M.fpct((it.p / held.cost - 1) * 100, 1) + ')</dd><dt>Today</dt><dd class="' + (dg >= 0 ? 'up' : 'dn') + '">' + M.fsign(dg, 0) + '</dd><dt>Share of portfolio</dt><dd>' + (M.valueUSD(id) / M.portfolio().total * 100).toFixed(1) + '%</dd></dl>' +
      '<div class="mod-foot"><span>2 lots · FIFO</span><button class="linkish" data-goto="position">Lots and dividends</button></div></section>' + mods;
  }
  $('#mods').innerHTML = mods;
  $$('#mods a[data-goto]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
  M.observeReveal($('#mods'));
  setTimeout(function () { $$('.pbar').forEach(function (p) { p.classList.add('in'); }); }, M.rm() ? 0 : 450);

  /* what a registered tab receives */
  ctx = { id: id, it: it, held: held, cur: cur, HI52: HI52, LO52: LO52, PE: PE, K: K, DATA: DATA, STMT: STMT, YEARS: YEARS, QTRS: QTRS, eps: eps, shares: shares, div: div,
    NOW: NOW, MON: MON, nz: nz, path: path, spanTip: spanTip, labels: labels, ranges: R, go: function (v) { tabs.select(v, true); } };

  /* deep link to a tab */
  var h = location.hash.slice(1);
  if (h && TABS.some(function (t) { return t && t[0] === h; })) tabs.select(h, false);
})();
