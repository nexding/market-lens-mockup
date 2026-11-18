/* Market Lens mockup: Home page. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, HOLD = M.HOLD;
  M.shell('Home');

  /* ---------- market strip ---------- */
  var strip = $('#strip'), sparks = {};
  M.STRIP.forEach(function (it) {
    var a = M.el('a', 'mcard'); a.href = '#'; a.setAttribute('role', 'listitem'); a.dataset.stub = it.n;
    a.innerHTML = '<span class="nm">' + M.esc(it.n) + '</span><span class="pr"><span data-roll></span></span><canvas></canvas><span class="ch">' + M.chgHTML(it.id, { bare: true }) + '</span>';
    strip.appendChild(a);
    M.bindRoll(it.id, $('[data-roll]', a), function (x) { return M.fmt(x.p, x.dp); });
    sparks[it.id] = { cv: $('canvas', a), arr: M.bridge(it.id + ':strip', 26, it.pc, it.p, 0.0012), base: it.pc, a: null };
  });
  function drawStrip(id, shift) { var s = sparks[id]; M.spark(s.cv, s.arr, { w: 56, h: 32, fill: true, base: s.base, shift: shift }); }
  M.STRIP.forEach(function (it) { drawStrip(it.id); });
  $('#strip-l').innerHTML = M.icon('left'); $('#strip-r').innerHTML = M.icon('right');
  function stripArrows() { $('#strip-l').disabled = strip.scrollLeft < 4; $('#strip-r').disabled = strip.scrollLeft > strip.scrollWidth - strip.clientWidth - 4; }
  $('#strip-l').addEventListener('click', function () { strip.scrollBy({ left: -strip.clientWidth * 0.8, behavior: M.rm() ? 'auto' : 'smooth' }); });
  $('#strip-r').addEventListener('click', function () { strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: M.rm() ? 'auto' : 'smooth' }); });
  strip.addEventListener('scroll', stripArrows, { passive: true }); window.addEventListener('resize', stripArrows); stripArrows();

  /* ---------- hero: portfolio total and chart ---------- */
  var pf = M.portfolio(), range = '1D', NOW = new Date(2026, 10, 16, 16, 0);
  var total = new M.Roll($('#total'), M.fmt(pf.total * 0.9, 2));
  M.tween(800, function (u) { total.set(M.fmt(pf.total * (0.9 + 0.1 * u), 2), 0); }, M.easeOut);
  function chip(abs, pct, money) {
    var up = abs >= 0;
    return '<span class="chg ' + (up ? 'up' : 'dn') + '">' + (abs > 0 ? '+' : abs < 0 ? '−' : '') + (money ? '$' : '') + M.fmt(Math.abs(abs), money ? 0 : 2) + ' (' + M.fpct(pct) + ') <i aria-hidden="true">' + (up ? '▲' : '▼') + '</i></span>';
  }
  function heroText() {
    $('#day-chg').innerHTML = chip(pf.total - pf.prev, (pf.total / pf.prev - 1) * 100, true);
    $('#tot-gain').innerHTML = chip(pf.total - pf.cost, (pf.total / pf.cost - 1) * 100, true);
    $('#hero-h').textContent = 'My portfolio · ' + Object.keys(HOLD).length + ' holdings · USD';
  }
  heroText();
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function spanTip(days, long) {
    return function (f) { var d = new Date(NOW.getTime() - (1 - f) * days * 864e5); return long ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()]; };
  }
  function labelsFor(tip) { return [0, 0.25, 0.5, 0.75, 1].map(function (f) { return { f: f, t: tip(f) }; }); }
  function rangeData(r) {
    var T = pf.total, tip;
    if (r === '1D') {
      tip = function (f) { var m = 570 + Math.round(f * 390); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); };
      return { d: M.bridge('pf:1d', 79, pf.prev, T, 0.0011), base: pf.prev, tip: tip, labels: labelsFor(tip) };
    }
    var spec = { '1W': [7, 0.983, 0.0022, 130, false], '1M': [30, 0.958, 0.004, 150, false], '1Y': [365, 0.81, 0.011, 252, true], 'All': [1826, 0.42, 0.016, 420, true] }[r];
    tip = spanTip(spec[0], spec[4]);
    return { d: M.bridge('pf:' + r, spec[3], T * spec[1], T, spec[2]), tip: tip, labels: labelsFor(tip) };
  }
  var chart = new M.AreaChart($('#hero-chart'), { label: 'Portfolio value over time', fmt: function (v) { return '$' + M.fmt(v / 1000, 1) + 'k'; } });
  function setRange(r, mode) { range = r; var d = rangeData(r); chart.set(d.d, { base: d.base, labels: d.labels, tip: d.tip, mode: mode }); }
  setRange('1D', 'draw');
  M.initSeg($('#hero-range'), function (v) { setRange(v); });

  /* ---------- holdings, watchlist, movers, trending ---------- */
  function gainText(id) { var it = I[id], h = HOLD[id], g = (it.p - h.cost) * h.q * M.FX[it.c]; return '<span class="' + (g >= 0 ? 'up' : 'dn') + '">' + (g >= 0 ? '+' : '−') + '$' + M.fmt(Math.abs(g), 0) + '</span>'; }
  function rowInner(id, held) {
    return M.tk(id, held ? { sub: '<span data-gain="' + id + '">' + gainText(id) + '</span>' } : null) + '<canvas aria-hidden="true"></canvas><div class="row-r"><span>' + M.pxHTML(id) + '</span><span class="sub">' + M.chgHTML(id, { bare: true }) + '</span></div>';
  }
  function row(id, held) { return '<li class="row" data-row="' + id + '">' + rowInner(id, held) + '</li>'; }
  function drawRowSparks(scope) {
    $$('[data-row]', scope).forEach(function (r) { var id = r.dataset.row, cv = $('canvas', r); if (cv && !cv.dataset.done) { cv.dataset.done = 1; M.spark(cv, M.series(id, 32, 0.005), { w: 56, h: 24, base: I[id].pc }); } });
  }
  $('#holdings').innerHTML = Object.keys(HOLD).map(function (id) { return row(id, true); }).join('');
  $('#watchlist').innerHTML = M.WATCH.map(function (id) { return row(id); }).join('');
  var MOVERS = { gainers: ['PLTR', 'LMT', 'XOM', 'SHEL.L', 'NVDA', 'TSM'], losers: ['DAL', 'IAG.L', 'UNH', 'INTC', '1299.HK', 'COST'], active: ['NVDA', 'TSLA', 'AAPL', 'PLTR', 'F', 'AMZN'] };
  Object.keys(MOVERS).forEach(function (k) { $('#movers [data-v="' + k + '"]').innerHTML = MOVERS[k].map(function (id) { return row(id); }).join(''); });
  $('#trending').innerHTML = ['PLTR', 'LMT', 'DAL', '9988.HK', 'XOM'].map(function (id) { return row(id); }).join('');
  drawRowSparks(document);
  M.initTabs($('#movers-tabs'), function (v, dir) { M.showPanel($('#movers'), v, dir); });

  /* a new row drops into place and the others make room */
  function dropIn(list, id, held) {
    var li = M.el('li', 'row-wrap pre'); li.innerHTML = '<div class="row is-new" data-row="' + id + '">' + rowInner(id, held) + '</div>';
    list.insertBefore(li, list.firstChild); drawRowSparks(li);
    void li.offsetHeight; requestAnimationFrame(function () { li.classList.remove('pre'); });
    setTimeout(function () { var r = $('.row', li); if (r) r.classList.remove('is-new'); }, 1600);
  }
  var queue = [['TSM', { q: 40, cost: 262.40 }], ['AMZN', { q: 60, cost: 188.20 }]];
  $('#add-holding').addEventListener('click', function () {
    var next = queue.shift();
    if (!next) { M.toast('The mockup adds two sample holdings. The real dialog takes shares, price, date, fees and currency.'); return; }
    HOLD[next[0]] = next[1]; dropIn($('#holdings'), next[0], true);
    var before = pf.total; pf = M.portfolio(); total.set(M.fmt(pf.total, 2), pf.total > before ? 1 : -1); heroText();
    drawRing(allocBy); if (range === '1D') setRange('1D');
    M.toast('Added ' + next[1].q + ' shares of ' + next[0] + ' at $' + M.fmt(next[1].cost) + ' (sample).');
  });
  function addWatch(id) {
    if ($('#watchlist [data-row="' + id + '"]')) { M.toast(id + ' is already on the watchlist.'); return; }
    dropIn($('#watchlist'), id, false);
  }
  document.addEventListener('ml:drop', function (e) { if (e.detail.zone === 'watchlist') { addWatch(e.detail.sym); M.toast(e.detail.sym + ' added to Watchlist.'); } });
  document.addEventListener('ml:watch', function (e) { addWatch(e.detail); });

  /* ---------- sector heatmap ---------- */
  var SECT = [['Technology', 0.92, 4, 4], ['Financials', 0.31, 3, 2], ['Health Care', -0.44, 3, 2], ['Consumer Disc.', -0.18, 2, 2], ['Communication', 0.52, 2, 1], ['Industrials', 0.74, 2, 1], ['Staples', -0.61, 2, 1], ['Energy', 2.14, 2, 1], ['Utilities', -0.22, 3, 1], ['Materials', 0.28, 3, 1], ['Real Estate', -0.95, 2, 1]];
  var heat = $('#heat');
  function pcText(p) { return M.fpct(p) + '<i aria-hidden="true">' + (p >= 0 ? '▲' : '▼') + '</i>'; }
  function tint(p) { var a = Math.min(1, Math.abs(p) / 3); return 'color-mix(in srgb, var(' + (p >= 0 ? '--gain' : '--loss') + ') ' + Math.round(14 + a * 56) + '%, var(--surface-3))'; }
  SECT.forEach(function (s, i) {
    var t = M.el('a', 'tile' + (s[3] === 1 ? ' sm' : '')); t.href = '#'; t.dataset.stub = s[0] + ' sector'; t.style.gridColumn = 'span ' + s[2]; t.style.gridRow = 'span ' + s[3]; t.style.setProperty('--i', i);
    t.style.backgroundColor = tint(s[1]);
    t.innerHTML = '<span class="nm">' + s[0] + '</span><span class="pc">' + pcText(s[1]) + '</span>';
    heat.appendChild(t); s.push(t);
  });
  setInterval(function () {
    if (document.hidden) return;
    SECT.forEach(function (s) {
      if (Math.random() < 0.45) return;
      s[1] = Math.max(-3, Math.min(3, s[1] + (Math.random() - 0.5) * 0.24));
      s[4].style.backgroundColor = tint(s[1]); $('.pc', s[4]).innerHTML = pcText(s[1]);
    });
  }, 4200);

  /* ---------- upcoming earnings ---------- */
  var WEEK = [['Mon', '16', []], ['Tue', '17', [['0700.HK', 'After close']]], ['Wed', '18', [['NVDA', 'After close']]], ['Thu', '19', [['9988.HK', 'Before open'], ['AZN.L', '07:00']]], ['Fri', '20', []]];
  $('#week').innerHTML = WEEK.map(function (d, i) {
    return '<div class="day' + (i === 0 ? ' today' : '') + '"><div class="day-h"><b>' + d[0] + ' ' + d[1] + '</b>' + (i === 0 ? '<span class="badge badge-accent badge-x">TODAY</span>' : '') + '</div>' +
      (d[2].length ? d[2].map(function (e) { return '<div class="er">' + M.tk(e[0], { name: false }) + '<span class="when">' + e[1] + '</span></div>'; }).join('') : '<div class="none">No reports</div>') + '</div>';
  }).join('');

  /* ---------- allocation ring ---------- */
  var RC = ['var(--data-1)', 'var(--data-4)', 'var(--data-3)', 'var(--data-2)', 'var(--data-5)', 'var(--data-6)', 'var(--text-3)', 'var(--hairline-strong)'];
  var ring = $('#ring'), CIRC = 2 * Math.PI * 51, allocBy = 'stock', firstRing = true;
  ring.innerHTML = '<circle class="track" cx="62" cy="62" r="51"></circle>';
  function alloc(by) {
    var g = {}, tot = 0;
    Object.keys(HOLD).forEach(function (id) { var k = by === 'stock' ? id : by === 'sector' ? I[id].sec : I[id].cty, v = M.valueUSD(id); g[k] = (g[k] || 0) + v; tot += v; });
    return Object.keys(g).map(function (k) { return { k: k, w: g[k] / tot }; }).sort(function (a, b) { return b.w - a.w; });
  }
  function drawRing(by) {
    allocBy = by;
    var data = alloc(by), segs = data.slice(0, 7), rest = data.slice(7).reduce(function (s, d) { return s + d.w; }, 0);
    if (rest > 0) segs.push({ k: 'Other', w: rest });
    var circles = $$('circle.seg', ring), start = 0;
    while (circles.length < segs.length) { var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', 'seg'); c.setAttribute('cx', 62); c.setAttribute('cy', 62); c.setAttribute('r', 51); c.style.strokeDasharray = '0 ' + CIRC; c.style.strokeDashoffset = -start; ring.appendChild(c); circles.push(c); }
    void ring.getBoundingClientRect();
    circles.forEach(function (c, i) {
      var s = segs[i];
      c.style.transitionDelay = firstRing && !M.rm() ? (i * 70) + 'ms' : '0ms';
      if (!s) { c.style.strokeDasharray = '0 ' + CIRC; return; }
      var len = Math.max(0, s.w * CIRC - 2.5);
      c.style.stroke = RC[i % RC.length]; c.style.strokeDasharray = len + ' ' + (CIRC - len); c.style.strokeDashoffset = -(start * CIRC); start += s.w;
    });
    firstRing = false;
    $('#legend').innerHTML = segs.slice(0, 6).map(function (s, i) { return '<li><i style="background:' + RC[i % RC.length] + '"></i><span>' + M.esc(s.k) + '</span><span class="w">' + (s.w * 100).toFixed(1) + '%</span></li>'; }).join('');
    $('#ring-n').textContent = data.length; $('#ring-l').textContent = by === 'stock' ? 'holdings' : by === 'sector' ? 'sectors' : 'countries';
    var tech = alloc('sector').filter(function (d) { return d.k === 'Technology'; })[0], big = alloc('stock').filter(function (d) { return d.w > 0.10; }).length;
    $('#alloc-warn').innerHTML = M.icon('warn', 'ic-sm') + '<span>Technology is ' + Math.round(tech.w * 100) + '% of the portfolio, above your 25% sector limit. ' + big + ' holdings are above the 10% single-stock limit.</span>';
  }
  var ringSeen = false;
  new IntersectionObserver(function (en, io) { if (en[0].isIntersecting && !ringSeen) { ringSeen = true; drawRing('stock'); io.disconnect(); } }).observe(ring);
  M.initSeg($('#alloc-by'), function (v) { drawRing(v); });

  /* ---------- alerts, lookup, empty-state preview ---------- */
  $('#alerts').innerHTML = M.alertsHTML();
  $('#lookup').addEventListener('submit', function (e) {
    e.preventDefault(); var v = $('#lookup-q').value.trim().toUpperCase();
    if (I[v] && I[v].kind === 'stock') location.href = 'stock.html?s=' + encodeURIComponent(v); else M.toast('“' + v + '” is not in the sample set. Try NVDA, 0700.HK or SHEL.L.');
  });
  var extra = $('#set-extra');
  if (extra) {
    extra.innerHTML = '<button class="btn btn-sm" id="empty-toggle" type="button" aria-pressed="false">Preview empty portfolio</button>';
    $('#empty-toggle').addEventListener('click', function () {
      var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on); this.classList.toggle('is-on', on);
      $('#hero-full').hidden = on; $('#hero-empty').hidden = !on;
    });
  }

  /* ---------- live ticks ---------- */
  M.onTick(function (it) {
    var s = sparks[it.id];
    if (s) {
      if (s.a) { s.a.cancel(); s.arr.shift(); }
      s.arr.push(it.p);
      s.a = M.tween(300, function (u) { drawStrip(it.id, u); }, null, function () { s.arr.shift(); s.a = null; drawStrip(it.id); });
      return;
    }
    if (!HOLD[it.id]) return;
    $$('[data-gain="' + it.id + '"]').forEach(function (n) { n.innerHTML = gainText(it.id); });
    var before = pf.total; pf = M.portfolio();
    total.set(M.fmt(pf.total, 2), pf.total > before ? 1 : -1); heroText();
    if (range === '1D') chart.nudge(pf.total);
  });
  document.addEventListener('ml:paint', function () { M.STRIP.forEach(function (it) { drawStrip(it.id); }); $$('[data-row] canvas').forEach(function (cv) { delete cv.dataset.done; }); drawRowSparks(document); });
})();
