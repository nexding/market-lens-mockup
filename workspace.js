/* Market Lens mockup: docking workspace. Panels sit in a three-by-two CSS grid; link groups, dividers, swap and
   saved layouts are all local state. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, HOLD = M.HOLD, esc = M.esc, root = document.documentElement;

  /* Compact on this page only. Set before the shell is built so Settings shows it, and never saved:
     if the density is changed from Settings while here, the stored preference is put back. */
  var savedDensity = null;
  try { savedDensity = localStorage.getItem('ml-density'); } catch (e) { /* storage unavailable */ }
  root.dataset.density = 'compact';
  M.shell('Workspace');
  document.addEventListener('ml:pref', function (e) {
    if (e.detail.key !== 'density') return;
    try { if (savedDensity == null) localStorage.removeItem('ml-density'); else localStorage.setItem('ml-density', savedDensity); } catch (err) { /* storage unavailable */ }
  });

  var NOW = new Date(2026, 10, 16, 16, 0), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var dock = $('#dock'), live = $('#ws-live'), P0 = {};
  M.LIST.forEach(function (it) { P0[it.id] = it.p; });
  function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }
  function ic(d) { return '<svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  var IC = {
    move: ic('<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>'),
    pop: ic('<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    max: M.icon('fit', 'ic-sm'), close: M.icon('x', 'ic-sm')
  };

  /* ---------- sample data shared with the other pages ---------- */
  function nz(seed) { return (M.rng(M.hash(seed))() - 0.5) * 2; }
  /* the same generator as the Financials tab of the stock page, so the figures agree (annual, restated, USD millions) */
  function finData(id) {
    var K = id === 'AAPL' ? 1 : 0.12 + (M.hash(id + 'k') % 90) / 100, PE = 14 + M.hash(id + 'pe') % 22;
    function leaf(key, base, g, nv, abs) { var a = []; for (var y = 0; y < 5; y++) a.push(base * (abs ? 1 : K) * Math.pow(1 + g, y - 4) * (1 + nz(id + key + y) * nv)); return a; }
    function add(a, b, s) { return a.map(function (v, i) { return v + (s || 1) * b[i]; }); }
    var rev = add(leaf('prod', 298000, 0.055, 0.02), leaf('serv', 104000, 0.13, 0.015)), gp = add(rev, add(leaf('cprod', 188000, 0.05, 0.02), leaf('cserv', 28500, 0.11, 0.02)), -1);
    var oi = add(gp, add(leaf('rnd', 33500, 0.09, 0.01), leaf('sga', 27200, 0.045, 0.01)), -1), ni = add(oi, leaf('oth', 420, 0, 0.6)).map(function (v) { return v * (1 - 0.162); });
    var sh = leaf('sh', ni[4] / (P0[id] / PE), -0.028, 0.002, true);
    return [['Revenue', rev, 0], ['Gross profit', gp, 0], ['Operating income', oi, 0], ['Net income', ni, 0], ['Diluted EPS', ni.map(function (v, i) { return v / sh[i]; }), 2]];
  }
  /* price paths seeded like the stock page's chart */
  function pathFor(id, key, n, pts, vol) {
    var it = I[id], noise = M.bridge(id + ':' + key, n, 1, 1, vol), out = [];
    for (var i = 0; i < n; i++) { var t = i / (n - 1), j = 0; while (j < pts.length - 2 && t > pts[j + 1][0]) j++; var a = pts[j], b = pts[j + 1]; out.push(it.p * (a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])) * noise[i]); }
    out[n - 1] = it.p; return out;
  }
  function spanTip(days, month) { return function (f) { var d = new Date(NOW.getTime() - (1 - f) * days * 864e5); return month ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()]; }; }
  function chartData(id, range) {
    var it = I[id];
    if (range === '1D') return { d: M.bridge(id + ':1d', 79, it.pc, it.p, 0.0016), base: it.pc, tip: function (f) { var m = 570 + Math.round(f * 390); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); } };
    if (range === '1M') return { d: pathFor(id, '1m', 150, [[0, 0.96], [0.5, 1.03], [1, 1]], 0.005), tip: spanTip(30) };
    return { d: pathFor(id, '1y', 252, [[0, 0.93], [0.45, 1.22], [0.62, 1.37], [0.8, 1.08], [1, 1]], 0.009), tip: spanTip(365, true) };
  }
  /* the stories on My News: title, date, outlets, and the direction for each company touched */
  var DIR = { good: ['Likely good', 'up', '▲'], bad: ['Likely bad', 'dn', '▼'], unc: ['Unclear', 'unc', '↔'] };
  var NEWS = [
    ['Carriers add war-risk surcharges as Gulf rerouting drags on', '16 Nov', 12, { 'SHEL.L': 'good', 'COST': 'bad', 'XOM': 'good' }],
    ['NVIDIA to report quarterly results on Wednesday after the close', '16 Nov', 9, { 'NVDA': 'unc' }],
    ['Tencent to report quarterly results on Tuesday after the Hong Kong close', '13 Nov', 6, { '0700.HK': 'unc' }],
    ['Foundry customers asked to document end users', '13 Nov', 4, { 'NVDA': 'bad', 'AAPL': 'unc', 'TSM': 'bad' }],
    ['Commerce Department opens review of advanced-chip export rules', '12 Nov', 11, { 'NVDA': 'bad', 'AAPL': 'bad', 'TSM': 'bad' }],
    ['AIA Group files its monthly return on share movements', '11 Nov', 1, { '1299.HK': 'unc' }],
    ['Futures price out one cut for the first half', '10 Nov', 8, { 'MSFT': 'bad', 'NVDA': 'bad' }],
    ['Fed chair signals a slower pace of rate cuts', '9 Nov', 21, { 'MSFT': 'bad', 'NVDA': 'bad', '1299.HK': 'unc' }],
    ['Retailers warn of higher landed costs if freight stays elevated', '8 Nov', 6, { 'COST': 'bad' }],
    ['Shell says Gulf cargoes rerouted, guidance unchanged', '6 Nov', 7, { 'SHEL.L': 'unc' }],
    ['Insurers suspend war-risk cover for Gulf transits', '5 Nov', 9, { 'COST': 'bad' }],
    ['Brent jumps 8% in two sessions on supply fears', '4 Nov', 17, { 'SHEL.L': 'good', 'XOM': 'good' }],
    ['Tanker traffic through the Strait of Hormuz halts after drone strikes', '3 Nov', 14, { 'SHEL.L': 'good', 'COST': 'bad', 'XOM': 'good' }]
  ];

  /* ---------- panel types ---------- */
  function markRows(p, sym) {
    $$('.ws-row', p.body).forEach(function (r) { var on = r.dataset.sym === sym, t = $('.tk', r); r.classList.toggle('is-sel', on); if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
  }
  function drawSparks(p) { $$('.ws-row canvas', p.body).forEach(function (cv) { var id = cv.parentNode.dataset.sym; M.spark(cv, M.series(id, 32, 0.005), { w: 56, h: 20, base: I[id].pc }); }); }
  var DEFS = {
    watch: { title: 'Watchlist',
      build: function (p) {
        p.body.innerHTML = '<ul class="ws-rows">' + M.WATCH.map(function (id) { return '<li class="ws-row" data-sym="' + id + '">' + M.tk(id) + '<canvas aria-hidden="true"></canvas><span class="r">' + M.pxHTML(id) + M.chgHTML(id, { bare: true }) + '</span></li>'; }).join('') +
          '</ul><p class="ws-hint">Choose a row to load it into every panel with the same link letter. Right-click a ticker for its menu.</p>';
        drawSparks(p);
      },
      update: markRows },
    port: { title: 'Portfolio',
      build: function (p) {
        var pf = M.portfolio();
        p.body.innerHTML = '<ul class="ws-rows">' + Object.keys(HOLD).sort(function (a, b) { return M.valueUSD(b) - M.valueUSD(a); }).map(function (id) {
          return '<li class="ws-row" data-sym="' + id + '">' + M.tk(id) + '<span class="w" title="Share of the portfolio">' + (M.valueUSD(id) / pf.total * 100).toFixed(1) + '%</span><span class="r">' + M.pxHTML(id) + M.chgHTML(id, { bare: true }) + '</span></li>';
        }).join('') + '</ul><div class="ws-foot"><span>8 holdings · $' + M.fmt(pf.total, 0) + ' · today ' + M.fpct((pf.total / pf.prev - 1) * 100) + '</span><a class="linkish" href="portfolio.html">Open My Portfolio</a></div>';
      },
      update: markRows },
    chart: { title: 'Chart',
      build: function (p) {
        p.body.classList.add('flush'); p.range = '1D';
        p.body.innerHTML = '<div class="wc-top"><div class="seg" role="group" aria-label="Chart range"><button type="button" data-v="1D" aria-pressed="true">1D</button><button type="button" data-v="1M" aria-pressed="false">1M</button><button type="button" data-v="1Y" aria-pressed="false">1Y</button></div><span class="label"></span></div><div class="wc-host"></div>';
        p.chart = new M.AreaChart($('.wc-host', p.body), { label: 'Price chart', fmt: function (v) { return M.fmt(v, v < 10 ? 2 : v < 1000 ? 1 : 0); } });
        M.initSeg($('.seg', p.body), function (v) { p.range = v; DEFS.chart.update(p, p.sym); });
      },
      update: function (p, sym) {
        var it = I[sym], d = chartData(sym, p.range), from = d.base != null ? d.base : d.d[0];
        var txt = sym + ', ' + { '1D': 'today', '1M': 'one month', '1Y': 'one year' }[p.range] + ': ' + M.fmt(from) + ' to ' + M.fmt(it.p) + ' (' + M.fpct((it.p / from - 1) * 100) + ')';
        p.chart.set(d.d, { base: d.base, labels: [0, 0.25, 0.5, 0.75, 1].map(function (f) { return { f: f, t: d.tip(f) }; }), tip: d.tip });
        $('.label', p.body).textContent = txt; p.chart.cv.setAttribute('aria-label', 'Price chart. ' + txt);
      } },
    quote: { title: 'Quote',
      update: function (p, sym) {
        var it = I[sym], h = HOLD[sym], cur = M.CCY[it.c], lo = Math.min(it.p, it.pc) * 0.994, hi = Math.max(it.p, it.pc) * 1.005, K = sym === 'AAPL' ? 1 : 0.12 + (M.hash(sym + 'k') % 90) / 100;
        p.body.innerHTML = '<div class="q-top">' + M.tk(sym) + '<span class="badge badge-x">' + it.x + '</span></div>' +
          '<div class="q-px"><span class="ccy">' + cur + '</span>' + M.pxHTML(sym) + M.chgHTML(sym, { abs: true }) + '</div>' +
          '<div class="delay">' + M.icon('clock', 'ic-sm') + 'Delayed 15 min · ' + esc(it.sec) + '</div>' +
          '<dl class="kv q-kv"><dt>Previous close</dt><dd>' + M.fmt(it.pc) + '</dd><dt>Open</dt><dd>' + M.fmt(it.pc * 1.0018) + '</dd><dt>Day’s range</dt><dd>' + M.fmt(lo) + ' to ' + M.fmt(hi) + '</dd>' +
            '<dt>52-week range</dt><dd>' + M.fmt(P0[sym] * 0.9) + ' to ' + M.fmt(P0[sym] * 1.37) + '</dd><dt>Volume</dt><dd>' + M.fbig(48210000 * K + 4e6) + '</dd><dt>P/E (trailing)</dt><dd>' + (14 + M.hash(sym + 'pe') % 22).toFixed(1) + '</dd></dl>' +
          (h ? '<div class="q-held"><span class="badge badge-accent">Held · ' + h.q + ' shares</span><span class="' + (it.p >= h.cost ? 'up' : 'dn') + '">' + M.fpct((it.p / h.cost - 1) * 100, 1) + ' since purchase</span></div>' : '') +
          '<div class="ws-foot"><a class="linkish" href="stock.html?s=' + encodeURIComponent(sym) + '">Open stock page</a></div>';
      } },
    fin: { title: 'Financials',
      update: function (p, sym) {
        p.body.classList.add('wf');
        p.body.innerHTML = '<div class="dt-wrap"><table class="dt"><thead><tr><th scope="col">USD millions</th><th scope="col">FY2023</th><th scope="col">FY2024</th><th scope="col">FY2025</th><th scope="col">Change</th></tr></thead><tbody>' +
          finData(sym).map(function (r) {
            var a = r[1], g = (a[4] - a[3]) / Math.abs(a[3]) * 100;
            return '<tr><td>' + r[0] + '</td><td>' + M.fmt(a[2], r[2]) + '</td><td>' + M.fmt(a[3], r[2]) + '</td><td>' + M.fmt(a[4], r[2]) + '</td><td class="' + (g >= 0 ? 'up' : 'dn') + '">' + M.fpct(g, 1) + '</td></tr>';
          }).join('') + '</tbody></table></div><div class="ws-foot"><span>Annual, restated. EPS in ' + I[sym].c + ' per share. Sample data.</span><a class="linkish" href="stock.html?s=' + encodeURIComponent(sym) + '#financials">Open Financials</a></div>';
      } },
    news: { title: 'News',
      update: function (p, sym) {
        var list = NEWS.filter(function (n) { return n[3][sym]; });
        p.body.innerHTML = (list.length ? '<ul class="wn">' + list.map(function (n) {
          var d = DIR[n[3][sym]];
          return '<li><div class="wn-t">' + esc(n[0]) + '</div><div class="wn-m"><span class="chg ' + d[1] + '">' + d[0] + ' <i aria-hidden="true">' + d[2] + '</i></span><span>' + n[1] + ' · ' + (n[2] === 1 ? 'exchange announcement' : n[2] + ' outlets, shown once') + '</span></div></li>';
        }).join('') + '</ul>' : '<p class="ws-none">No story in the last 14 days touches ' + esc(sym) + ', directly or through a supplier, sector or macro channel.</p>') +
          '<div class="ws-foot"><span>Links are hypotheses, not facts.</span><a class="linkish" href="news.html">Open My News</a><a class="linkish" href="mindmap.html">Open mind map</a></div>';
      } }
  };
  var ORDER = ['watch', 'chart', 'quote', 'fin', 'news', 'port'], GROUPS = ['', 'a', 'b', 'c', 'd'], GCOL = { a: 'amber', b: 'violet', c: 'teal', d: 'pink' };

  /* ---------- saved layouts: six cells (column by column, top then bottom), column and row fractions, link groups ---------- */
  var LAYOUTS = {
    research: { name: 'Research', cells: ['watch', 'port', 'chart', 'fin', 'quote', 'news'], c: [0.22, 0.5], r: 0.6,
      link: { watch: 'a', chart: 'a', quote: 'a', fin: 'a', port: 'b', news: 'b' }, sym: { a: 'TSM', b: 'SHEL.L' }, own: {} },
    review: { name: 'Portfolio review', cells: ['port', null, 'chart', 'news', 'quote', 'fin'], c: [0.3, 0.42], r: 0.56,
      link: { port: 'a', chart: 'a', quote: 'a', fin: 'a', news: 'a', watch: '' }, sym: { a: 'NVDA' }, own: { watch: 'TSM' } },
    desk: { name: 'News desk', cells: ['news', null, 'chart', 'port', 'watch', 'quote'], c: [0.36, 0.38], r: 0.5,
      link: { news: 'a', chart: 'a', quote: 'a', port: 'a', fin: 'a', watch: '' }, sym: { a: 'COST' }, own: { watch: 'XOM' } }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var STATE = {}, cur = 'research', S, P = {}, activeId = 'chart', maxId = null, moving = null, flipA = null;
  Object.keys(LAYOUTS).forEach(function (k) { STATE[k] = clone(LAYOUTS[k]); });
  S = STATE[cur];

  /* ---------- build the dock ---------- */
  function pbtn(act, label, icon, toggle) { return '<button class="ws-pb" type="button" data-act="' + act + '" aria-label="' + label + '" title="' + label + '"' + (toggle ? ' aria-pressed="false"' : '') + '>' + icon + '</button>'; }
  ORDER.forEach(function (id) {
    var d = DEFS[id], el = M.el('section', 'ws-panel'); el.dataset.p = id; el.dataset.drop = 'ws:' + id; el.setAttribute('aria-labelledby', 'wp-' + id);
    el.innerHTML = '<header class="ws-ph"><button class="ws-link" type="button" data-act="link"><span class="ldot"></span><span class="ll"></span></button>' +
      '<h2 class="ws-pt" id="wp-' + id + '">' + d.title + '</h2><span class="ws-ps"></span>' +
      '<div class="ws-pa">' + pbtn('move', 'Move panel: ' + d.title, IC.move, true) + pbtn('pop', 'Open ' + d.title + ' in its own window', IC.pop) + pbtn('max', 'Maximise ' + d.title, IC.max, true) + pbtn('close', 'Close ' + d.title, IC.close) + '</div></header><div class="ws-body"></div>';
    dock.appendChild(el);
    P[id] = { id: id, el: el, body: $('.ws-body', el), sym: null };
    if (d.build) d.build(P[id]);
  });
  var EMPTY = [0, 1, 2].map(function (c) {
    var e = M.el('div', 'ws-empty', '<span>Empty column</span><button class="btn btn-sm" type="button" data-act="add">Add panel</button>');
    e.dataset.col = c; e.style.gridColumn = String(c + 1); e.hidden = true; dock.appendChild(e); return e;
  });
  function gut(cls, label, orient) { var g = M.el('div', 'ws-gut ' + cls); g.setAttribute('role', 'separator'); g.setAttribute('aria-orientation', orient); g.setAttribute('aria-label', label); g.setAttribute('aria-valuemin', '0'); g.setAttribute('aria-valuemax', '100'); g.tabIndex = 0; dock.appendChild(g); return g; }
  var G = {
    v1: gut('v v1', 'Divider between the left and middle columns. Left and right arrows resize, Enter resets.', 'vertical'),
    v2: gut('v v2', 'Divider between the middle and right columns. Left and right arrows resize, Enter resets.', 'vertical'),
    h: gut('h', 'Divider between the top and bottom rows. Up and down arrows resize, Enter resets.', 'horizontal')
  };

  /* ---------- link groups ---------- */
  function symOf(id) { var g = S.link[id]; return (g ? S.sym[g] : S.own[id]) || 'AAPL'; }
  function isOpen(id) { return S.cells.indexOf(id) >= 0; }
  function refresh(id) {
    var p = P[id], sym = symOf(id);
    p.sym = sym; $('.ws-ps', p.el).textContent = sym; $('.ws-ps', p.el).title = I[sym].n;
    DEFS[id].update(p, sym);
  }
  function linkUI(id) {
    var g = S.link[id] || '', b = $('.ws-link', P[id].el), dot = $('.ldot', b);
    if (g) dot.dataset.g = g; else delete dot.dataset.g;
    $('.ll', b).textContent = g.toUpperCase();
    b.title = g ? 'Link group ' + g.toUpperCase() + '. Click to change.' : 'Not linked. Click to link.';
    b.setAttribute('aria-label', DEFS[id].title + (g ? ': link group ' + g.toUpperCase() + ' (' + GCOL[g] + '). Activate to change.' : ': not linked. Activate to link.'));
  }
  function legend() {
    $('#ws-legend').innerHTML = GROUPS.slice(1).map(function (g) {
      var who = ORDER.filter(function (id) { return isOpen(id) && S.link[id] === g; }).map(function (id) { return DEFS[id].title; });
      return '<li' + (who.length ? '' : ' class="is-off"') + ' title="' + (who.length ? 'Group ' + g.toUpperCase() + ' (' + GCOL[g] + '): ' + who.join(', ') + ' follow ' + S.sym[g] : 'Group ' + g.toUpperCase() + ' (' + GCOL[g] + '): no panels') + '"><span class="ldot" data-g="' + g + '"></span><b>' + g.toUpperCase() + '</b><span class="sy">' + (who.length ? S.sym[g] : '—') + '</span></li>';
    }).join('');
    var a = isOpen(activeId) ? activeId : S.cells.filter(Boolean)[0];
    $('#ws-state').textContent = 'Layout: ' + S.name + (a ? ' · active panel: ' + DEFS[a].title + (S.link[a] ? ', group ' + S.link[a].toUpperCase() : ', not linked') + ' · ' + symOf(a) : ' · no panels open') + ' · Compact here only';
  }
  /* choosing a ticker sets the group's symbol; every panel in the group loads it */
  function setSym(id, sym) {
    var g = S.link[id];
    if (g) { S.sym[g] = sym; ORDER.forEach(function (p) { if (S.link[p] === g) refresh(p); }); } else { S.own[id] = sym; refresh(id); }
    legend(); say(sym + ' loaded into ' + (g ? 'link group ' + g.toUpperCase() : DEFS[id].title) + '.');
  }
  function cycleLink(id) {
    var now = symOf(id), g = GROUPS[(GROUPS.indexOf(S.link[id] || '') + 1) % GROUPS.length];
    S.link[id] = g;
    if (!g) S.own[id] = now; else if (!S.sym[g]) S.sym[g] = now;
    refresh(id); linkUI(id); legend();
    say(DEFS[id].title + (g ? ' joined link group ' + g.toUpperCase() + ' and shows ' + symOf(id) + '.' : ' is no longer linked.'));
  }
  function setActive(id) { if (id === activeId) return; activeId = id; ORDER.forEach(function (p) { P[p].el.classList.toggle('is-active', p === id); }); legend(); }

  /* ---------- layout ---------- */
  var MINC = 0.14, MINR = 0.2;
  function setFr() {
    dock.style.setProperty('--c1', S.c[0].toFixed(4)); dock.style.setProperty('--c2', S.c[1].toFixed(4)); dock.style.setProperty('--r1', S.r.toFixed(4));
    G.v1.setAttribute('aria-valuenow', Math.round(S.c[0] * 100)); G.v2.setAttribute('aria-valuenow', Math.round((S.c[0] + S.c[1]) * 100)); G.h.setAttribute('aria-valuenow', Math.round(S.r * 100));
  }
  function nudge(k, d) {
    if (k === 'v1') { var t = S.c[0] + S.c[1], a = Math.max(MINC, Math.min(t - MINC, S.c[0] + d)); S.c[0] = a; S.c[1] = t - a; }
    else if (k === 'v2') S.c[1] = Math.max(MINC, Math.min(1 - S.c[0] - MINC, S.c[1] + d));
    else S.r = Math.max(MINR, Math.min(1 - MINR, S.r + d));
    setFr();
  }
  function rects() { var r = {}; ORDER.forEach(function (id) { if (!P[id].el.hidden) r[id] = P[id].el.getBoundingClientRect(); }); return r; }
  function popIn(el) { el.classList.remove('pop-in'); void el.offsetWidth; el.classList.add('pop-in'); }
  dock.addEventListener('animationend', function (e) { if (e.animationName === 'ws-pop') e.target.classList.remove('pop-in'); });
  /* panels that changed place slide from where they were with a short spring (transform only); new ones fade in */
  function flip(before) {
    var moves = [];
    ORDER.forEach(function (id) {
      var el = P[id].el; if (el.hidden) return;
      var a = before[id], b = el.getBoundingClientRect();
      if (!a) popIn(el); else if (Math.abs(a.left - b.left) > 1 || Math.abs(a.top - b.top) > 1) moves.push({ el: el, dx: a.left - b.left, dy: a.top - b.top });
    });
    if (!moves.length || M.rm()) return;
    flipA = M.springTo('smooth', function (u) { moves.forEach(function (m) { m.el.style.transform = 'translate(' + (m.dx * (1 - u)).toFixed(1) + 'px,' + (m.dy * (1 - u)).toFixed(1) + 'px)'; }); },
      function () { moves.forEach(function (m) { m.el.style.transform = ''; }); flipA = null; });
  }
  function apply(animate) {
    if (flipA) { flipA.cancel(); flipA = null; ORDER.forEach(function (id) { P[id].el.style.transform = ''; }); }
    var before = animate ? rects() : null;
    ORDER.forEach(function (id) {
      var i = S.cells.indexOf(id), el = P[id].el; el.hidden = i < 0; if (i < 0) return;
      el.style.gridColumn = String((i >> 1) + 1); el.style.gridRow = S.cells[i ^ 1] ? String((i & 1) + 1) : '1 / span 2';   /* alone in its column: take both rows */
    });
    EMPTY.forEach(function (e, c) { e.hidden = !!(S.cells[c * 2] || S.cells[c * 2 + 1]); });
    G.h.hidden = ![0, 1, 2].some(function (c) { return S.cells[c * 2] && S.cells[c * 2 + 1]; });
    setFr(); legend();
    if (before) flip(before);
  }
  function setMax(id) {
    if (maxId) { var o = P[maxId].el, ob = $('[data-act="max"]', o); o.classList.remove('is-max'); ob.setAttribute('aria-pressed', 'false'); ob.setAttribute('aria-label', 'Maximise ' + DEFS[maxId].title); ob.title = ob.getAttribute('aria-label'); popIn(o); }
    maxId = id; dock.classList.toggle('has-max', !!id);
    if (id) { var el = P[id].el, b = $('[data-act="max"]', el); el.classList.add('is-max'); b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Restore ' + DEFS[id].title); b.title = b.getAttribute('aria-label'); popIn(el); }
  }
  function use(k, animate) {
    stopMove(); if (maxId) setMax(null);
    cur = k; S = STATE[k]; apply(animate);
    ORDER.forEach(function (id) { linkUI(id); refresh(id); });
    if (!isOpen(activeId)) activeId = S.cells.filter(Boolean)[0];
    ORDER.forEach(function (p) { P[p].el.classList.toggle('is-active', p === activeId); }); legend();
  }
  function swap(i, j) { var t = S.cells[i]; S.cells[i] = S.cells[j]; S.cells[j] = t; apply(true); }
  function closePanel(id) {
    if (maxId === id) setMax(null); if (moving === id) stopMove();
    S.cells[S.cells.indexOf(id)] = null; apply(true);
    say(DEFS[id].title + ' closed. Add panel brings it back.'); $('#ws-add').focus();
  }
  function addPanel(id) {
    if (!isOpen(id)) { S.cells[S.cells.indexOf(null)] = id; if (S.link[id] == null) S.link[id] = 'a'; apply(true); linkUI(id); refresh(id); say(DEFS[id].title + ' added.'); }
    else popIn(P[id].el);
    setActive(id); $('.ws-link', P[id].el).focus();
  }

  /* ---------- dividers: drag or arrow keys ---------- */
  Object.keys(G).forEach(function (k) {
    var g = G[k], start = null;
    function reset() { var L = LAYOUTS[cur]; if (k === 'h') S.r = L.r; else S.c = L.c.slice(); setFr(); }
    function end() { start = null; g.classList.remove('is-drag'); }
    g.addEventListener('pointerdown', function (e) { if (e.button) return; e.preventDefault(); g.focus(); g.setPointerCapture(e.pointerId); g.classList.add('is-drag'); start = { x: e.clientX, y: e.clientY, c: S.c.slice(), r: S.r }; });
    g.addEventListener('pointermove', function (e) {
      if (!start) return;
      S.c = start.c.slice(); S.r = start.r;
      nudge(k, k === 'h' ? (e.clientY - start.y) / (dock.clientHeight - 6) : (e.clientX - start.x) / (dock.clientWidth - 12));
    });
    g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end); g.addEventListener('dblclick', reset);
    g.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.05 : 0.02, d = 0;
      if (e.key === 'Enter') { reset(); e.preventDefault(); return; }
      if (e.key === 'Home') d = -1; else if (e.key === 'End') d = 1;
      else if (k === 'h') d = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      else d = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      if (d) { nudge(k, d); e.preventDefault(); }
    });
  });

  /* ---------- move a panel: drag its header onto another, or use the Move panel button and the arrow keys ---------- */
  var drag = null, ghost = null;
  function endDrag() {
    if (!drag) return;
    if (drag.over) drag.over.classList.remove('is-drop');
    P[drag.id].el.classList.remove('is-dragging'); if (ghost) { ghost.remove(); ghost = null; }
    drag = null;
  }
  dock.addEventListener('pointerdown', function (e) {
    var pn = e.target.closest('.ws-panel'); if (pn) setActive(pn.dataset.p);
    var h = e.target.closest('.ws-ph'); if (!h || e.button || maxId || e.target.closest('button, a, input')) return;
    drag = { id: h.parentNode.dataset.p, x: e.clientX, y: e.clientY, on: false, over: null };
    h.setPointerCapture(e.pointerId);
  });
  dock.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.on = true; stopMove(); P[drag.id].el.classList.add('is-dragging');
      ghost = M.el('div', 'ws-ghost glass'); ghost.textContent = DEFS[drag.id].title + ' · ' + symOf(drag.id); document.body.appendChild(ghost);
    }
    ghost.style.transform = 'translate(' + (e.clientX + 12) + 'px,' + (e.clientY + 14) + 'px)';
    var t = document.elementFromPoint(e.clientX, e.clientY), z = t && t.closest ? t.closest('.ws-panel, .ws-empty') : null;
    if (z === P[drag.id].el) z = null;
    if (z !== drag.over) { if (drag.over) drag.over.classList.remove('is-drop'); if (z) z.classList.add('is-drop'); drag.over = z; }
  });
  dock.addEventListener('pointerup', function () {
    if (!drag) return;
    var z = drag.on ? drag.over : null, id = drag.id; endDrag();
    if (!z) return;
    if (z.dataset.p) { swap(S.cells.indexOf(id), S.cells.indexOf(z.dataset.p)); say(DEFS[id].title + ' swapped with ' + DEFS[z.dataset.p].title + '.'); }
    else { swap(S.cells.indexOf(id), +z.dataset.col * 2); say(DEFS[id].title + ' moved to the empty column.'); }
  });
  dock.addEventListener('pointercancel', endDrag);
  dock.addEventListener('dblclick', function (e) { var h = e.target.closest('.ws-ph'); if (h && !e.target.closest('button')) setMax(maxId ? null : h.parentNode.dataset.p); });

  function stopMove() {
    if (!moving) return;
    var el = P[moving].el; el.classList.remove('is-moving'); $('[data-act="move"]', el).setAttribute('aria-pressed', 'false'); moving = null;
  }
  function startMove(id) {
    stopMove(); if (maxId) setMax(null);
    moving = id; P[id].el.classList.add('is-moving'); $('[data-act="move"]', P[id].el).setAttribute('aria-pressed', 'true');
    say('Moving ' + DEFS[id].title + '. Arrow keys swap it with the panel on that side. Enter or Escape to finish.');
  }
  function moveBy(key) {
    var id = moving, i = S.cells.indexOf(id), c = i >> 1, r = i & 1, j = -1, where;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      var c2 = c + (key === 'ArrowLeft' ? -1 : 1);
      if (c2 >= 0 && c2 <= 2) { j = c2 * 2 + r; if (!S.cells[j] && S.cells[j ^ 1]) j ^= 1; }
    } else if ((key === 'ArrowUp' && r === 1) || (key === 'ArrowDown' && r === 0)) { if (S.cells[i ^ 1]) j = i ^ 1; }
    if (j < 0) { say('Nothing on that side of ' + DEFS[id].title + '.'); return; }
    var other = S.cells[j]; swap(i, j);
    i = S.cells.indexOf(id); where = ['left', 'middle', 'right'][i >> 1] + ' column' + (S.cells[i ^ 1] ? (i & 1 ? ', bottom' : ', top') : '');
    say(DEFS[id].title + (other ? ' swapped with ' + DEFS[other].title : ' moved') + '. Now in the ' + where + '.');
  }

  /* ---------- clicks and keys inside the dock ---------- */
  dock.addEventListener('click', function (e) {
    var row = e.target.closest('.ws-row[data-sym]');
    if (row) {   /* in a list panel a ticker selects; its menu still offers the stock page */
      e.preventDefault(); var t = $('.tk', row); t.style.viewTransitionName = '';
      setSym(row.closest('.ws-panel').dataset.p, row.dataset.sym); return;
    }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var pn = b.closest('.ws-panel'), id = pn ? pn.dataset.p : null, act = b.dataset.act;
    if (act === 'link') cycleLink(id);
    else if (act === 'max') setMax(maxId === id ? null : id);
    else if (act === 'close') closePanel(id);
    else if (act === 'move') { if (moving === id) stopMove(); else startMove(id); }
    else if (act === 'pop') M.toast('Pop-out windows are not part of this mockup. A popped-out ' + DEFS[id].title + ' panel keeps its link group and live prices, and returns to the dock when its window closes.');
    else if (act === 'add') openMenu();
  });
  dock.addEventListener('focusin', function (e) { var pn = e.target.closest('.ws-panel'); if (pn) setActive(pn.dataset.p); });
  dock.addEventListener('focusout', function (e) { if (moving && e.target.closest('[data-act="move"]')) stopMove(); });
  dock.addEventListener('keydown', function (e) {
    var row = e.target.closest('.ws-row'); if (!row || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    var n = e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling; if (n) { $('.tk', n).focus(); e.preventDefault(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (drag) endDrag(); else if (moving) stopMove(); else if (menu.classList.contains('open')) closeMenu(true); else if (maxId) setMax(null); return; }
    if (moving && /^Arrow/.test(e.key)) { moveBy(e.key); e.preventDefault(); return; }
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey || M.palette.isOpen()) return;
    if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) $('#ws-q').focus();   /* start typing a symbol anywhere */
  });
  document.addEventListener('ml:drop', function (e) {
    var z = e.detail.zone; if (z.indexOf('ws:') !== 0) return;
    setSym(z.slice(3), e.detail.sym); M.toast(e.detail.sym + ' loaded into ' + DEFS[z.slice(3)].title + (S.link[z.slice(3)] ? ' and link group ' + S.link[z.slice(3)].toUpperCase() : '') + '.');
  });

  /* ---------- slim bar ---------- */
  M.initSeg($('#ws-layouts'), function (v) { use(v, true); say(STATE[v].name + ' layout.'); });
  $('#ws-reset').innerHTML = M.icon('replay', 'ic-sm');
  $('#ws-reset').addEventListener('click', function () { STATE[cur] = clone(LAYOUTS[cur]); use(cur, true); M.toast(S.name + ' layout reset to how it was saved.'); });
  $('#ws-settings').innerHTML = M.icon('sliders');
  $('#ws-settings').addEventListener('click', function () { $('#btn-settings').click(); });
  $('#ws-syms').innerHTML = M.LIST.map(function (it) { return '<option value="' + it.id + '">' + esc(it.n) + '</option>'; }).join('');
  $('#ws-q').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var v = this.value.trim().toUpperCase(), id = isOpen(activeId) ? activeId : S.cells.filter(Boolean)[0]; if (!v) return;
    if (!id) { M.toast('Add a panel first.'); return; }
    if (I[v] && I[v].kind === 'stock') { setSym(id, v); this.value = ''; M.toast(v + ' loaded into ' + (S.link[id] ? 'link group ' + S.link[id].toUpperCase() : 'the ' + DEFS[id].title + ' panel') + '.'); }
    else M.toast('“' + v + '” is not in the sample set. Try NVDA, 0700.HK or SHEL.L.');
  });
  var menu = $('#ws-add-menu'), addBtn = $('#ws-add');
  function openMenu() {
    menu.innerHTML = ORDER.map(function (id) { return '<button class="mi" type="button" role="menuitem" data-add="' + id + '"><span>' + DEFS[id].title + '</span><small>' + (isOpen(id) ? 'open' : 'closed') + '</small></button>'; }).join('') + '<hr>' +
      ['Screener', 'Statistics', 'Options', 'Mind map', 'Deep-dive', 'Alerts'].map(function (n) { return '<button class="mi" type="button" role="menuitem" data-stub="The ' + n + ' panel"><span>' + n + '</span></button>'; }).join('');
    M.closePops(); menu.classList.add('open'); addBtn.setAttribute('aria-expanded', 'true'); $('.mi', menu).focus();
  }
  function closeMenu(refocus) { menu.classList.remove('open'); addBtn.setAttribute('aria-expanded', 'false'); if (refocus) addBtn.focus(); }
  addBtn.addEventListener('click', function () { if (menu.classList.contains('open')) closeMenu(); else openMenu(); });
  menu.addEventListener('click', function (e) { var m = e.target.closest('.mi'); if (!m) return; closeMenu(); if (m.dataset.add) addPanel(m.dataset.add); });
  menu.addEventListener('keydown', function (e) {
    var mis = $$('.mi', menu), i = mis.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { mis[(i + 1) % mis.length].focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { mis[(i + mis.length - 1) % mis.length].focus(); e.preventDefault(); }
    else if (e.key === 'Tab') closeMenu();
  });
  document.addEventListener('pointerdown', function (e) {
    if (menu.classList.contains('open') && !e.target.closest('.ws-addwrap')) closeMenu();
    if (moving && !e.target.closest('[data-act="move"]')) stopMove();
  });

  /* ---------- live prices and repaints ---------- */
  M.onTick(function (it) { var p = P.chart; if (p.sym === it.id && p.range === '1D') p.chart.nudge(it.p); });
  document.addEventListener('ml:paint', function () { drawSparks(P.watch); });
  window.addEventListener('resize', function () { drawSparks(P.watch); });

  use('research', false);
})();
