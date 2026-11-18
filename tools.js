/* Market Lens mockup: Tools (event study, stress test, track record). All data is invented, apart from the
   market-regime backtest skill (−4.5%, 90% interval −22.1% to +9.9%), which is the real result. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc, COL = M.COL;
  M.shell('Tools');

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], NOW = new Date(2026, 10, 16);
  var FONT = '500 11px Inter, system-ui, sans-serif';
  function fdate(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function pc(v, dp) { if (dp == null) dp = 1; var r = +v.toFixed(dp); return M.fpct(r === 0 ? 0 : r, dp); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function sum(a, b) { return a + b; }
  function niceMax(v) { if (!(v > 0)) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  function stepDp(st) { return st % 1 === 0 ? 0 : (st * 10) % 1 === 0 ? 1 : 2; }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function tradingDays(a, b) { var n = 0, d = addDays(a, 1); while (d <= b && n < 30) { if (d.getDay() % 6) n++; d = addDays(d, 1); } return n; }
  function addTrading(d, n) { while (n > 0) { d = addDays(d, 1); if (d.getDay() % 6) n--; } return d; }

  /* ---------- canvas helpers ---------- */
  function surface(host) { var w = host.clientWidth, h = host.clientHeight; return w && h ? { ctx: M.fitCanvas($('canvas', host), w, h), w: w, h: h } : null; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function clip(ctx, s, w) { if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; }
  /* horizontal bars around zero. rows: [{label, v, lo, hi, own, ownA, sig}]; o: {max, sel, hover, tick(v), text(row, narrow), lw, rw} */
  function hbars(host, rows, o) {
    var c = surface(host); if (!c) return null;
    var ctx = c.ctx, w = c.w, h = c.h, narrow = w < 520, lw = narrow ? 92 : (o.lw || 150), rw = narrow ? 54 : (o.rw || 156), ax = 22, n = rows.length, rh = Math.min(44, (h - ax) / n), x0 = lw, x1 = w - rw, max = o.max, bot = rh * n;
    function X(v) { return x0 + (v + max) / (2 * max) * (x1 - x0); }
    ctx.clearRect(0, 0, w, h); ctx.font = FONT; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (var g = -2; g <= 2; g++) {
      var gx = Math.round(X(g * max / 2)) + 0.5;
      ctx.strokeStyle = M.rgba(COL['text-1'], g === 0 ? 0.24 : 0.06); ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, bot); ctx.stroke();
      ctx.fillStyle = COL['text-3']; ctx.textAlign = 'center'; ctx.fillText(o.tick(g * max / 2), gx, bot + ax / 2 + 2);
    }
    rows.forEach(function (r, i) {
      var y = i * rh, cy = y + rh / 2, bh = Math.min(16, rh * 0.52), a = X(0), b = X(r.v), col = r.sig === false ? COL['text-3'] : (r.v >= 0 ? COL.gain : COL.loss);
      if (i === o.sel || i === o.hover) { ctx.fillStyle = M.rgba(COL['text-1'], i === o.sel ? 0.07 : 0.035); rr(ctx, 0, y + 1, w, rh - 2, 6); ctx.fill(); }
      ctx.fillStyle = i === o.sel ? COL['text-1'] : COL['text-2']; ctx.textAlign = 'left'; ctx.fillText(clip(ctx, r.label, lw - 16), 8, cy);
      ctx.globalAlpha = r.sig === false ? 0.5 : 1; ctx.fillStyle = col; rr(ctx, Math.min(a, b), cy - bh / 2, Math.max(1, Math.abs(b - a)), bh, 3); ctx.fill(); ctx.globalAlpha = 1;
      if (r.lo != null) {
        var l = X(r.lo), u = X(r.hi); ctx.strokeStyle = COL['text-1']; ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.moveTo(l, cy); ctx.lineTo(u, cy); ctx.moveTo(l, cy - 4); ctx.lineTo(l, cy + 4); ctx.moveTo(u, cy - 4); ctx.lineTo(u, cy + 4); ctx.stroke(); ctx.lineWidth = 1;
      }
      if (r.own != null && r.ownA > 0) {
        var ox = Math.max(x0, Math.min(x1, X(r.own))); ctx.globalAlpha = r.ownA;
        ctx.beginPath(); ctx.moveTo(ox, cy - 5.5); ctx.lineTo(ox + 5.5, cy); ctx.lineTo(ox, cy + 5.5); ctx.lineTo(ox - 5.5, cy); ctx.closePath();
        ctx.fillStyle = COL['text-1']; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = COL['surface-1']; ctx.stroke(); ctx.lineWidth = 1; ctx.globalAlpha = 1;
      }
      ctx.fillStyle = COL['text-1']; ctx.textAlign = 'right'; ctx.fillText(o.text(r, narrow), w - 8, cy);
    });
    return { rh: rh, n: n };
  }
  /* a point estimate, its interval and zero, as plain HTML */
  function ivl(v, lo, hi, max) {
    function P(x) { return Math.max(0, Math.min(100, (x + max) / (2 * max) * 100)).toFixed(1) + '%'; }
    return '<div class="ivl" aria-hidden="true" style="--p:' + P(v) + ';--lo:' + P(lo) + ';--hi:' + P(hi) + '"><i class="z"></i><i class="b"></i><i class="d"></i></div>' +
      '<div class="ivl-l" aria-hidden="true"><span>' + pc(-max, 0) + '</span><span>0</span><span>' + pc(max, 0) + '</span></div>';
  }

  /* =====================================================================
     Event study
     ===================================================================== */
  /* sectors: key, name, daily volatility of the abnormal return in % */
  var SECT = [['oil', 'Oil and gas', 1.5], ['def', 'Defense', 0.5], ['gold', 'Precious metals', 0.75], ['ship', 'Shipping', 0.7], ['air', 'Airlines', 1.4], ['ret', 'Retail', 0.5],
    ['chip', 'Chips', 0.8], ['soft', 'Software', 0.6], ['bank', 'Banks', 0.55], ['ins', 'Insurance', 0.5], ['util', 'Utilities', 0.4], ['auto', 'Autos', 0.7]];
  /* event types: comparable events in the library, and the typical 5-day abnormal return per sector (the curated matrix), in %.
     The salts are chosen so the sample agrees with the mind map: oil and gas up in 11 of 14 energy shocks, shipping in 8 of 14 */
  var TYPES = {
    energy: { name: 'Energy supply shock', n: 14, salt: 177, m: [3.4, 1.2, 1.5, 1.1, -3.1, -0.8, -0.4, -0.3, -0.5, -0.6, 0.4, -1.2] },
    rate: { name: 'Rate decision, hawkish surprise', n: 17, salt: 132, m: [-0.2, 0.1, -1.3, -0.3, -0.5, -0.6, -1.4, -1.2, 1.0, 0.5, -1.1, -0.8] },
    exportc: { name: 'Regulatory action, export controls', n: 6, m: [0.1, 0.3, 0.2, -0.2, 0, -0.1, -2.6, -0.5, 0, 0, 0.1, -0.3] },
    conflict: { name: 'Armed conflict', n: 13, m: [1.9, 2.8, 2.1, 0.6, -2.4, -0.4, -0.6, -0.3, -0.7, -0.9, 0.3, -0.9] },
    tariff: { name: 'Tariff', n: 11, m: [-0.3, 0.2, 0.6, -1.4, -0.6, -1.6, -1.2, -0.2, -0.4, -0.2, 0.5, -3.0] },
    cyber: { name: 'Cyber incident', n: 7, m: [0, 0.2, 0.1, -0.2, -0.4, -0.5, -0.2, 0.9, -1.3, -0.8, -0.1, 0] },
    disaster: { name: 'Natural disaster', n: 12, m: [0.3, 0, 0.2, -0.9, -0.5, -0.3, -1.0, 0, -0.4, -2.2, -0.6, -0.8] }
  };
  /* the three events on the mind map (their windows are still open), then five from the library */
  var EVENTS = [
    { id: 'e1', type: 'energy', name: 'Strait of Hormuz shipping disruption', date: [2026, 10, 3], k: 1.25, seed: 7, live: 1 },
    { id: 'e2', type: 'rate', name: 'Fed signals slower cuts', date: [2026, 10, 9], k: 0.9, seed: 8, live: 1 },
    { id: 'e3', type: 'exportc', name: 'Chip export-control review', date: [2026, 10, 12], k: 0.7, seed: 0, live: 1 },
    { id: 'l1', type: 'energy', name: 'Refinery fire removes Gulf export capacity', date: [2023, 8, 14] },
    { id: 'l2', type: 'conflict', name: 'Naval blockade of a Red Sea port', date: [2024, 0, 11] },
    { id: 'l3', type: 'tariff', name: 'Tariffs announced on imported vehicles', date: [2025, 2, 6] },
    { id: 'l4', type: 'cyber', name: 'Payment network outage after a cyber attack', date: [2024, 5, 18] },
    { id: 'l5', type: 'disaster', name: 'Typhoon shuts East Asian ports for a week', date: [2023, 8, 5] }
  ];
  function evDate(e) { return new Date(e.date[0], e.date[1], e.date[2]); }
  /* el = trading days elapsed, for events that are not themselves in the library */
  EVENTS.forEach(function (e) { if (e.live) e.el = tradingDays(evDate(e), NOW); });

  function gauss(r) { return (r() + r() + r() + r() - 2) * 1.732; }
  function drift(d) { return d <= 1 ? 0.45 * d : d <= 5 ? 0.45 + 0.55 * (d - 1) / 4 : 1 + 0.5 * (d - 5) / 25; }
  /* one event, one sector: cumulative abnormal return for days 0 to 30 */
  function mkPath(seed, m5, vol, scale) { var r = M.rng(M.hash(seed)), out = [0], noise = 0; for (var d = 1; d <= 30; d++) { noise += gauss(r) * vol; out.push(m5 * scale * drift(d) + noise); } return out; }
  function compDates(tk) {
    var n = TYPES[tk].n, r = M.rng(M.hash('dates|' + tk)), t0 = Date.UTC(2006, 0, 2), span = Date.UTC(2025, 9, 1) - t0, out = [], sel = -1;
    for (var i = 0; i < n; i++) { var d = new Date(t0 + (i + 0.15 + 0.7 * r()) / n * span), wd = d.getUTCDay(); out.push(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (wd === 6 ? 2 : wd === 0 ? 1 : 0))); }
    var lib = EVENTS.filter(function (e) { return e.type === tk && e.el == null; })[0];
    if (lib) { var ld = evDate(lib); sel = 0; out.forEach(function (d, j) { if (Math.abs(d - ld) < Math.abs(out[sel] - ld)) sel = j; }); out[sel] = ld; }
    return { dates: out, sel: sel };
  }
  var cache = {};
  function typeData(tk) {
    if (cache[tk]) return cache[tk];
    var T = TYPES[tk], cd = compDates(tk), paths = SECT.map(function (s, si) {
      var a = []; for (var i = 0; i < T.n; i++) a.push(mkPath(tk + '|' + s[0] + '|' + i + '|' + (T.salt || 0), T.m[si], s[2], 0.3 + 1.4 * M.rng(M.hash(tk + '|k|' + i))())); return a;
    });
    return (cache[tk] = { paths: paths, dates: cd.dates, sel: cd.sel, stats: {} });
  }
  /* mean across the comparable events and a 90% interval from 400 bootstrap resamples of those events */
  function stats(tk, h) {
    var D = typeData(tk); if (D.stats[h]) return D.stats[h];
    var r = M.rng(M.hash(tk + '|boot|' + h)), n = TYPES[tk].n, B = 400;
    return (D.stats[h] = D.paths.map(function (ps) {
      var v = ps.map(function (p) { return p[h]; }), bs = [], b, j, s;
      for (b = 0; b < B; b++) { s = 0; for (j = 0; j < n; j++) s += v[Math.floor(r() * n)]; bs.push(s / n); }
      bs.sort(function (x, y) { return x - y; });
      return { v: v.reduce(sum, 0) / n, lo: bs[Math.floor(B * 0.05)], hi: bs[Math.ceil(B * 0.95) - 1], pos: v.filter(function (x) { return x > 0; }).length };
    }));
  }
  function ownPaths(ev) {
    if (ev.own) return ev.own;
    var D = typeData(ev.type), T = TYPES[ev.type];
    ev.own = ev.el == null ? D.paths.map(function (ps) { return ps[D.sel]; }) : SECT.map(function (s, si) { return mkPath('own|' + ev.id + '|' + (ev.seed || 0) + '|' + s[0], T.m[si], s[2], ev.k || 1); });
    return ev.own;
  }

  var es = { ev: null, h: 5, si: 0, order: [], rows: null, disp: null, max: 1, anim: null, hover: -1, geo: null, sm: null };
  var esPlot = $('#es-plot');
  function esRows() {
    var st = stats(es.ev.type, es.h), own = ownPaths(es.ev), el = es.ev.el == null ? 30 : es.ev.el;
    return es.order.map(function (si) { var s = st[si], o = es.h <= el ? own[si][es.h] : null; return { si: si, label: SECT[si][1], v: s.v, lo: s.lo, hi: s.hi, pos: s.pos, sig: s.lo > 0 || s.hi < 0, own: o, ownA: o == null ? 0 : 1 }; });
  }
  function esDraw() {
    if (!es.disp) return;
    var st = es.max / 2;
    es.geo = hbars(esPlot, es.disp, { max: es.max, sel: es.order.indexOf(es.si), hover: es.hover,
      tick: function (v) { return pc(v, stepDp(st)); },
      text: function (r, narrow) { return pc(r.v) + (narrow ? '' : '  (' + pc(r.lo) + ' to ' + pc(r.hi) + ')'); } });
  }
  function esUpdate(animate) {
    var rows = esRows(), from = es.disp, m0 = es.max, max = 0;
    rows.forEach(function (r) { max = Math.max(max, Math.abs(r.lo), Math.abs(r.hi), r.own == null ? 0 : Math.abs(r.own)); });
    max = niceMax(max * 1.04);
    if (es.anim) es.anim.cancel();
    es.rows = rows;
    if (animate && from && from.length === rows.length) {
      es.anim = M.springTo('smooth', function (u) {
        es.disp = rows.map(function (r, i) {
          var f = from[i];
          return { label: r.label, sig: u > 0.5 ? r.sig : f.sig, v: lerp(f.v, r.v, u), lo: lerp(f.lo, r.lo, u), hi: lerp(f.hi, r.hi, u),
            own: r.own == null ? f.own : f.own == null ? r.own : lerp(f.own, r.own, u), ownA: Math.max(0, Math.min(1, lerp(f.ownA, r.ownA, u))) };
        });
        es.max = lerp(m0, max, u); esDraw();
      }, function () { es.disp = rows; es.max = max; esDraw(); });
    } else { es.disp = rows; es.max = max; esDraw(); }
    esText(); smBuild();
  }
  function kpi(l, v, s) { return '<div class="kpi"><div class="label">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }
  function esText() {
    var ev = es.ev, T = TYPES[ev.type], D = typeData(ev.type), n = T.n, rows = es.rows, d = evDate(ev), days = es.h === 1 ? '1 trading day' : es.h + ' trading days', notes = [];
    var top = rows[0], low = rows[0];
    rows.forEach(function (r) { if (r.v > top.v) top = r; if (r.v < low.v) low = r; });
    $('#es-title').textContent = T.name + ': abnormal return by sector';
    $('#es-sub').textContent = 'Mean cumulative abnormal return ' + days + ' after the event, across the ' + n + ' comparable events in the library. Abnormal return is the sector’s return minus what the market model predicts, with the model estimated over days −250 to −30. Whiskers are 90% intervals from 400 bootstrap resamples of those events.';
    $('#es-kpis').innerHTML = kpi('Comparable events', n, D.dates[0].getFullYear() + ' to ' + D.dates[n - 1].getFullYear()) +
      kpi('Weight on the data', Math.round(n / (n + 8) * 100) + '%', 'n ÷ (n + 8); the curated matrix has the rest') +
      (ev.el == null ? kpi('This event', fdate(d), 'One of the ' + n + ' comparable events') :
        ev.el < 30 ? kpi('This event', 'Day ' + ev.el + ' of 30', 'Since ' + fdate(d) + '. Window closes ' + fdate(addTrading(d, 30))) : kpi('This event', fdate(d), 'Not in the library; all three windows are complete'));
    if (n < 8) notes.push('Only ' + n + ' comparable events. The intervals are wide and the curated matrix carries more weight than the data.');
    if (ev.el != null && ev.el < es.h) notes.push('This event’s ' + es.h + '-day window is still open, so it has no marker at this horizon.');
    $('#es-warn').hidden = !notes.length; $('#es-warn').innerHTML = M.icon('warn') + '<span>' + notes.join(' ') + '</span>';
    $('#es-cv').setAttribute('aria-label', 'Bar chart of mean cumulative abnormal return by sector, ' + days + ' after an event of type ' + T.name + ', across ' + n + ' comparable events. Highest: ' + top.label + ' ' + pc(top.v) + '. Lowest: ' + low.label + ' ' + pc(low.v) + '. The table below the chart has every figure.');
    $('#es-table').innerHTML = '<thead><tr><th scope="col">Sector</th><th scope="col">Mean</th><th scope="col">90% interval</th><th scope="col">Positive in</th><th scope="col">This event</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr data-si="' + r.si + '"' + (r.si === es.si ? ' class="is-sel"' : '') + '><td>' + r.label + '</td><td>' + pc(r.v) + '</td><td>' + pc(r.lo) + ' to ' + pc(r.hi) + (r.sig ? '' : ' <span class="dim">spans zero</span>') + '</td><td>' + r.pos + ' of ' + n + '</td><td>' + (r.own == null ? '<span class="dim">window open</span>' : pc(r.own)) + '</td></tr>';
      }).join('') + '</tbody>';
    $('#es-sector').innerHTML = es.order.map(function (si) { return '<option value="' + si + '"' + (si === es.si ? ' selected' : '') + '>' + SECT[si][1] + '</option>'; }).join('');
  }

  /* small multiples: the chosen sector's path in every comparable event, on one shared scale */
  function smBuild() {
    var ev = es.ev, D = typeData(ev.type), h = es.h, items = [], lo = 0, hi = 0, n = TYPES[ev.type].n;
    if (ev.el != null) items.push({ own: true, t: 'This event', path: ownPaths(ev)[es.si].slice(0, Math.min(h, ev.el) + 1), open: ev.el < h });
    D.paths[es.si].forEach(function (p, i) { items.push({ t: fdate(D.dates[i]), path: p.slice(0, h + 1), sel: ev.el == null && i === D.sel }); });
    items.forEach(function (it) { it.path.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
    es.sm = { items: items, lo: lo, hi: hi };
    $('#es-sm').innerHTML = items.map(function (it) {
      var end = it.path[it.path.length - 1];
      return '<figure class="sm' + (it.own ? ' is-own' : it.sel ? ' is-sel' : '') + '" role="listitem"><canvas aria-hidden="true"></canvas>' +
        '<figcaption><span>' + it.t + (it.sel ? ' · selected' : '') + '</span><b class="' + (end >= 0 ? 'up' : 'dn') + '">' + (it.path.length > 1 ? pc(end) : '—') + '</b></figcaption>' +
        (it.open ? '<span class="label">day ' + ev.el + ' of ' + h + '</span>' : '') + '</figure>';
    }).join('');
    $('#es-sm-sub').textContent = SECT[es.si][1] + ': cumulative abnormal return from the event day to day ' + h + ', one panel per comparable event (' + n + '), all on the same vertical scale from ' + pc(lo) + ' to ' + pc(hi) + '. The dashed line is zero.';
    smDraw();
  }
  function smDraw() {
    var S = es.sm; if (!S) return;
    $$('#es-sm canvas').forEach(function (cv, i) {
      var it = S.items[i], w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      var ctx = M.fitCanvas(cv, w, h), pad = 4, span = S.hi - S.lo || 1, e = it.path.length - 1, col = it.own ? COL.accent : (it.path[e] >= 0 ? COL.gain : COL.loss), zy = Math.round(Y(0)) + 0.5;
      function X(d) { return pad + d / es.h * (w - pad * 2); }
      function Y(v) { return pad + (1 - (v - S.lo) / span) * (h - pad * 2); }
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = M.rgba(COL['text-1'], 0.22); ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, zy); ctx.lineTo(w, zy); ctx.stroke(); ctx.setLineDash([]);
      if (e < 1) return;
      ctx.beginPath(); it.path.forEach(function (v, d) { if (d) ctx.lineTo(X(d), Y(v)); else ctx.moveTo(X(d), Y(v)); });
      ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath(); ctx.arc(X(e), Y(it.path[e]), 2.5, 0, 6.3); ctx.fillStyle = col; ctx.fill();
    });
  }

  function esList() {
    function item(e) {
      return '<button class="es-ev" type="button" data-ev="' + e.id + '" aria-pressed="' + (e === es.ev) + '"><span class="es-ev-t">' + TYPES[e.type].name + '</span><span class="es-ev-n">' + esc(e.name) + '</span>' +
        '<span class="es-ev-d">' + fdate(evDate(e)) + (e.el != null && e.el < 30 ? ' · day ' + e.el + ' of 30' : '') + '</span></button>';
    }
    function group(t, f) { var l = EVENTS.filter(f); return l.length ? '<div class="micro es-g">' + t + '</div>' + l.map(item).join('') : ''; }
    $('#es-list').innerHTML = group('On the mind map now', function (e) { return e.live; }) + group('From the event library', function (e) { return e.el == null; }) + group('Your dates', function (e) { return e.custom; });
  }
  function esPick(ev, animate) {
    var sameType = es.ev && es.ev.type === ev.type, st5 = stats(ev.type, 5);
    es.ev = ev;
    es.order = SECT.map(function (s, i) { return i; }).sort(function (a, b) { return st5[b].v - st5[a].v; });
    if (!sameType) es.si = Math.abs(st5[es.order[0]].v) >= Math.abs(st5[es.order[11]].v) ? es.order[0] : es.order[11];
    esList(); esUpdate(animate);
  }
  function esSector(si) {
    es.si = si; $('#es-sector').value = si; esDraw(); smBuild();
    $$('#es-table tbody tr').forEach(function (tr) { tr.classList.toggle('is-sel', +tr.dataset.si === si); });
  }
  function rowAt(e) { var g = es.geo; if (!g) return -1; var i = Math.floor((e.clientY - esPlot.getBoundingClientRect().top) / g.rh); return i >= 0 && i < g.n ? i : -1; }
  esPlot.addEventListener('pointermove', function (e) { var i = rowAt(e); if (i !== es.hover) { es.hover = i; esPlot.style.cursor = i < 0 ? '' : 'pointer'; esDraw(); } });
  esPlot.addEventListener('pointerleave', function () { if (es.hover !== -1) { es.hover = -1; esDraw(); } });
  esPlot.addEventListener('click', function (e) { var i = rowAt(e); if (i >= 0) esSector(es.order[i]); });
  $('#es-sector').addEventListener('change', function () { esSector(+this.value); });
  $('#es-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ev]'); if (!b) return;
    var ev = EVENTS.filter(function (x) { return x.id === b.dataset.ev; })[0]; if (ev === es.ev) return;
    esPick(ev, true); var again = $('#es-list [data-ev="' + ev.id + '"]'); if (again) again.focus();
  });
  var segH = M.initSeg($('#es-h'), function (v) { es.h = +v; esUpdate(true); });
  $('#es-type').innerHTML = Object.keys(TYPES).map(function (k) { return '<option value="' + k + '">' + TYPES[k].name + '</option>'; }).join('');
  $('#es-custom').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec($('#es-date').value); if (!m) { M.toast('Choose a date first.'); return; }
    var d = new Date(+m[1], +m[2] - 1, +m[3]), moved = false;
    if (d > NOW || d < new Date(2005, 0, 3)) { M.toast('Choose a date from 3 Jan 2005 to 16 Nov 2026. The library starts in 2005.'); return; }
    while (d.getDay() % 6 === 0) { d = addDays(d, 1); moved = true; }
    var type = $('#es-type').value, id = 'c' + d.getTime() + type, ev = EVENTS.filter(function (x) { return x.id === id; })[0];
    if (!ev) { ev = { id: id, type: type, name: 'Custom date', date: [d.getFullYear(), d.getMonth(), d.getDate()], el: tradingDays(d, NOW), custom: true, k: 0.4 + 1.2 * M.rng(M.hash(id))() }; EVENTS.push(ev); }
    esPick(ev, true);
    if (moved) M.toast('That date is a weekend, so the study starts on ' + fdate(d) + '.');
  });

  /* =====================================================================
     Stress test
     ===================================================================== */
  /* factors: key, name, slider min, max, step, unit */
  var FACT = [['oil', 'Oil price', -50, 60, 5, '%'], ['rate', 'Interest rates', -200, 200, 25, ' bp'], ['usd', 'US dollar', -10, 10, 1, '%'], ['eq', 'Equities', -40, 20, 5, '%']];
  var PRESETS = [['Oil +40%', [40, 0, 0, 0]], ['Rates +100 bp', [0, 100, 0, 0]], ['Dollar +5%', [0, 0, 5, 0]], ['Equities −20%', [0, 0, 0, -20]], ['All four together', [40, 100, 5, -20]]];
  /* sensitivities: % move per 1% in oil, per 100 bp in rates, per 1% in the dollar, per 1% in equities */
  var SB = { 'Technology': [-0.02, -4.2, -0.25, 1.25], 'Consumer Staples': [-0.03, -1.4, -0.10, 0.70], 'Communication': [-0.02, -3.0, -0.55, 1.05], 'Financials': [0.01, 2.0, -0.30, 1.10],
    'Energy': [0.30, 0.6, -0.30, 0.85], 'Consumer Discretionary': [-0.05, -3.4, -0.20, 1.20], 'Health Care': [0, -1.0, -0.15, 0.65], 'Industrials': [-0.06, -1.6, -0.15, 0.95] };
  var OWN = { 'SHEL.L': [0.33, 0.5, -0.35, 0.80], 'XOM': [0.31, 0.7, -0.20, 0.85], 'DAL': [-0.27, -1.8, -0.10, 1.35], 'IAG.L': [-0.29, -1.5, -0.35, 1.30], 'LMT': [0.03, -0.8, -0.05, 0.55], '1299.HK': [0, -1.2, -0.60, 1.05] };
  var SE = [0.04, 1.1, 0.12, 0.09], RESID = 5;   /* standard errors of the four sensitivities; stock-specific risk over the window, in % */
  var sx = { s: [0, 0, 0, 0], target: 'pf', list: [], res: null, anim: null };
  function sens(id) { var o = OWN[id], b = o || SB[I[id].sec] || SB.Industrials, r = M.rng(M.hash('beta|' + id)); return b.map(function (v) { return o ? v : v * (0.85 + 0.3 * r()); }); }
  function fshock(k, v) { v = Math.round(v / FACT[k][4]) * FACT[k][4]; return v === 0 ? 'No change' : (v > 0 ? '+' : '−') + Math.abs(v) + FACT[k][5]; }
  function sxTarget() {
    if (sx.target === 'pf') { var ids = Object.keys(M.HOLD), tot = M.portfolio().total; return { ids: ids, w: ids.map(function (id) { return M.valueUSD(id) / tot; }), total: tot }; }
    var l = sx.target === 'watch' ? M.WATCH : sx.list; return { ids: l, w: l.map(function () { return 1 / l.length; }) };
  }
  function sxCalc() {
    var s = [sx.s[0], sx.s[1] / 100, sx.s[2], sx.s[3]], T = sxTarget(), fac = [0, 0, 0, 0], sec = {}, tot = 0, w2 = 0;
    var items = T.ids.map(function (id, i) {
      var w = T.w[i], parts = sens(id).map(function (b, k) { return b * s[k]; }), eff = parts.reduce(sum, 0), top = 0;
      parts.forEach(function (p, k) { fac[k] += w * p; if (Math.abs(p) > Math.abs(parts[top])) top = k; });
      sec[I[id].sec] = (sec[I[id].sec] || 0) + w * eff; tot += w * eff; w2 += w * w;
      return { id: id, w: w, eff: eff, c: w * eff, top: FACT[top][1] };
    }).sort(function (a, b) { return a.c - b.c; });
    var any = sx.s.some(function (x) { return Math.abs(x) > 1e-9; }), v = w2 * RESID * RESID;
    s.forEach(function (x, k) { v += Math.pow(SE[k] * x, 2); });
    var half = any && items.length ? 1.645 * Math.sqrt(v) : 0;
    return { T: T, items: items, tot: tot, lo: tot - half, hi: tot + half, fac: fac, any: any,
      sec: Object.keys(sec).map(function (k) { return { label: k, v: sec[k] }; }).sort(function (a, b) { return a.v - b.v; }) };
  }
  function drawWF() {
    var c = surface($('#sx-wf')), R = sx.res; if (!c || !R) return;
    var ctx = c.ctx, w = c.w, h = c.h, items = R.items, n = items.length + 1, pl = 48, pt = 22, pb = 28, iw = w - pl, ih = h - pt - pb, run = 0, lo = Math.min(0, R.lo), hi = Math.max(0, R.hi), steps = [];
    ctx.clearRect(0, 0, w, h); ctx.font = FONT; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    if (!R.any || !items.length) { ctx.fillStyle = COL['text-3']; ctx.textAlign = 'center'; ctx.fillText(items.length ? 'Move a slider or choose a preset to apply a shock' : 'Add at least one ticker from the sample set', w / 2, h / 2); return; }
    items.forEach(function (it) { var a = run; run += it.c; steps.push([a, run]); lo = Math.min(lo, run); hi = Math.max(hi, run); });
    var span = hi - lo || 1; lo -= span * 0.1; hi += span * 0.1;
    function Y(v) { return pt + (1 - (v - lo) / (hi - lo)) * ih; }
    var st = niceMax((hi - lo) / 4), dp = stepDp(st), gap = n > 10 ? 6 : 10, bw = Math.min(76, (iw - gap * (n - 1)) / n), small = bw < 46;
    for (var gv = Math.ceil(lo / st) * st; gv <= hi; gv += st) {
      var gy = Math.round(Y(gv)) + 0.5, zero = Math.abs(gv) < st / 2;
      ctx.strokeStyle = M.rgba(COL['text-1'], zero ? 0.24 : 0.06); ctx.beginPath(); ctx.moveTo(pl, gy); ctx.lineTo(w, gy); ctx.stroke();
      ctx.fillStyle = COL['text-3']; ctx.textAlign = 'right'; ctx.fillText(pc(zero ? 0 : gv, dp), pl - 8, gy);
    }
    if (small) ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    items.forEach(function (it, i) {
      var x = pl + i * (bw + gap), a = Y(steps[i][0]), b = Y(steps[i][1]), top = Math.min(a, b), bh = Math.max(2, Math.abs(a - b));
      ctx.fillStyle = it.c >= 0 ? COL.gain : COL.loss; rr(ctx, x, top, bw, bh, 3); ctx.fill();
      ctx.strokeStyle = M.rgba(COL['text-1'], 0.3); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x + bw, Math.round(b) + 0.5); ctx.lineTo(x + bw + gap, Math.round(b) + 0.5); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COL['text-2']; ctx.fillText(M.fsign(it.c, 1), x + bw / 2, it.c >= 0 ? top - 9 : top + bh + 9);
      ctx.fillStyle = COL['text-3']; ctx.fillText(clip(ctx, it.id, bw + gap - 2), x + bw / 2, h - 10);
    });
    /* the total, with its interval */
    var tx = pl + items.length * (bw + gap), ta = Y(0), tb = Y(R.tot), cx = tx + bw / 2;
    ctx.fillStyle = COL.accent; rr(ctx, tx, Math.min(ta, tb), bw, Math.max(2, Math.abs(ta - tb)), 3); ctx.fill();
    ctx.strokeStyle = COL['text-1']; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(cx, Y(R.lo)); ctx.lineTo(cx, Y(R.hi)); ctx.moveTo(cx - 5, Y(R.lo)); ctx.lineTo(cx + 5, Y(R.lo)); ctx.moveTo(cx - 5, Y(R.hi)); ctx.lineTo(cx + 5, Y(R.hi)); ctx.stroke();
    ctx.fillStyle = COL['text-1']; ctx.fillText(pc(R.tot), cx, Y(R.hi) - 10); ctx.fillText('Total', cx, h - 10);
  }
  function drawSec() {
    var R = sx.res; if (!R) return; var max = 0; R.sec.forEach(function (r) { max = Math.max(max, Math.abs(r.v)); });
    max = niceMax(max * 1.05 || 1); var st = max / 2;
    hbars($('#sx-sec'), R.sec, { max: max, lw: 148, rw: 58, tick: function (v) { return pc(v, stepDp(st)); }, text: function (r) { return pc(r.v); } });
  }
  function sxRender() {
    var R = sx.res = sxCalc(), T = R.T, n = R.items.length, max = niceMax(Math.max(10, Math.abs(R.lo), Math.abs(R.hi)));
    $('#sx-num').textContent = pc(R.tot);
    $('#sx-money').textContent = !R.any ? 'No shock applied yet.' : T.total ? 'About ' + (R.tot >= 0 ? '+' : '−') + '$' + M.fmt(Math.abs(R.tot / 100 * T.total), 0) + ' on a portfolio of $' + M.fmt(T.total, 0) : 'On an equal-weighted list of ' + n + (n === 1 ? ' stock' : ' stocks');
    $('#sx-ivl-t').textContent = R.any && n ? '90% interval: ' + pc(R.lo) + ' to ' + pc(R.hi) : 'The interval appears once a shock is applied';
    $('#sx-ivl').innerHTML = ivl(R.tot, R.lo, R.hi, max);
    $('#sx-fact').innerHTML = FACT.map(function (f, k) { return '<div><div class="label">' + f[1] + (Math.abs(sx.s[k]) >= f[4] / 2 ? ' ' + fshock(k, sx.s[k]) : '') + '</div><div class="v">' + pc(R.fac[k]) + '</div></div>'; }).join('');
    FACT.forEach(function (f, k) { var t = fshock(k, sx.s[k]); $('#sx-' + f[0] + '-o').textContent = t; $('#sx-' + f[0]).setAttribute('aria-valuetext', t); });
    $$('#sx-presets .chip').forEach(function (c, i) { c.setAttribute('aria-pressed', PRESETS[i][1].every(function (v, k) { return v === sx.s[k]; }) ? 'true' : 'false'); });
    $('#sx-table').innerHTML = '<thead><tr><th scope="col">Holding</th><th scope="col">Weight</th><th scope="col">Effect on the position</th><th scope="col">Contribution to the total</th><th scope="col" class="l">Largest driver</th></tr></thead><tbody>' +
      R.items.map(function (it) { return '<tr><td>' + M.tk(it.id) + '</td><td>' + (it.w * 100).toFixed(1) + '%</td><td>' + pc(it.eff) + '</td><td>' + pc(it.c, 2) + '</td><td class="l">' + (R.any ? it.top : '—') + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>Total</td><td>100.0%</td><td></td><td>' + pc(R.tot, 2) + '</td><td class="l">' + (R.any && n ? '90% interval ' + pc(R.lo) + ' to ' + pc(R.hi) : '') + '</td></tr></tfoot>';
    $('#sx-wf-cv').setAttribute('aria-label', 'Waterfall chart of each holding’s contribution to the total effect of ' + pc(R.tot) + '. ' + (R.any && n ? 'Largest drag: ' + R.items[0].id + ' ' + pc(R.items[0].c, 2) + '. ' : '') + 'The table below has every figure.');
    $('#sx-sec-cv').setAttribute('aria-label', 'Bar chart of the contribution by sector: ' + R.sec.map(function (r) { return r.label + ' ' + pc(r.v, 2); }).join(', ') + '.');
    drawWF(); drawSec();
    /* announce the result once the sliders have come to rest, not on every step */
    clearTimeout(sx.sayT); sx.sayT = setTimeout(function () { $('#sx-live').textContent = 'Estimated effect on the total: ' + pc(R.tot) + (R.any && n ? ', 90% interval ' + pc(R.lo) + ' to ' + pc(R.hi) : '') + '.'; }, 500);
  }
  function sxSync() { FACT.forEach(function (f, k) { $('#sx-' + f[0]).value = sx.s[k]; }); }
  /* a preset glides the sliders to their new positions and the result follows */
  function sxGo(to) {
    var from = sx.s.slice(); if (sx.anim) sx.anim.cancel();
    sx.anim = M.springTo('smooth', function (u) { sx.s = from.map(function (a, k) { return lerp(a, to[k], u); }); sxSync(); sxRender(); }, function () { sx.anim = null; sx.s = to.slice(); sxSync(); sxRender(); });
  }
  function sxParse() {
    var seen = {}, bad = [], ok = [];
    $('#sx-list').value.toUpperCase().split(/[\s,;]+/).forEach(function (t) { if (!t || seen[t]) return; seen[t] = 1; if (I[t] && I[t].kind === 'stock') ok.push(t); else bad.push(t); });
    sx.list = ok.slice(0, 12);
    $('#sx-paste-note').textContent = (ok.length > 12 ? 'Only the first 12 are used. ' : '') + (bad.length ? 'Not in the sample set: ' + bad.join(', ') + '.' : ok.length ? 'All ' + ok.length + ' recognised. You can also drag a ticker here.' : 'No ticker recognised. Try TSM, AMZN or XOM.');
  }
  function sxNote() {
    $('#sx-paste').hidden = sx.target !== 'paste';
    $('#sx-target-note').textContent = sx.target === 'pf' ? 'Your eight holdings at today’s weights. The calculation receives a plain list of securities and weights, nothing else about the portfolio.' : sx.target === 'watch' ? 'The six stocks on your watchlist, equal weights.' : 'Equal weights. Tickers outside the sample set are ignored.';
  }
  $('#sx-head').insertAdjacentHTML('afterbegin', M.icon('warn'));
  $('#sx-presets').innerHTML = PRESETS.map(function (p, i) { return '<button class="chip" type="button" data-p="' + i + '" aria-pressed="false">' + p[0] + '</button>'; }).join('');
  $('#sx-sliders').innerHTML = FACT.map(function (f, k) {
    return '<div class="sx-row"><label for="sx-' + f[0] + '">' + f[1] + '</label><output id="sx-' + f[0] + '-o" for="sx-' + f[0] + '"></output>' +
      '<input class="rng" type="range" id="sx-' + f[0] + '" data-k="' + k + '" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="0">' +
      '<div class="sx-ticks" aria-hidden="true"><span>' + fshock(k, f[2]) + '</span><span>' + fshock(k, f[3]) + '</span></div></div>';
  }).join('');
  $('#sx-presets').addEventListener('click', function (e) { var c = e.target.closest('[data-p]'); if (c) sxGo(PRESETS[+c.dataset.p][1]); });
  $('#sx-reset').addEventListener('click', function () { sxGo([0, 0, 0, 0]); });
  $('#sx-sliders').addEventListener('input', function (e) {
    var k = e.target.dataset.k; if (k == null) return;
    if (sx.anim) { sx.anim.cancel(); sx.anim = null; FACT.forEach(function (f, j) { sx.s[j] = +$('#sx-' + f[0]).value; }); }
    sx.s[+k] = +e.target.value; sxRender();
  });
  var segT = M.initSeg($('#sx-target'), function (v) { sx.target = v; if (v === 'paste') sxParse(); sxNote(); sxRender(); });
  $('#sx-paste').addEventListener('submit', function (e) { e.preventDefault(); sxParse(); sxRender(); });
  document.addEventListener('ml:drop', function (e) {
    if (e.detail.zone !== 'stress') return;
    var f = $('#sx-list'); f.value = (f.value.trim() ? f.value.trim().replace(/[,;\s]+$/, '') + ', ' : '') + e.detail.sym; sxParse(); sxRender(); M.toast(e.detail.sym + ' added to the list.');
  });

  /* =====================================================================
     Track record
     ===================================================================== */
  /* cal bins are [mean forecast, forecasts, events that happened]. Backtest and live are kept apart everywhere. */
  var MODS = [
    { id: 'regime', name: 'Market regime', verdict: 'nb', windows: 27,
      q: 'Probability that the S&P 500 falls 20% or more from its peak within 12 months, issued monthly. Baseline: the base rate so far.',
      why: 'The skill is below zero and its interval spans zero, so the model does not beat the base rate. It stays on the Markets page, greyed and carrying this badge.',
      bt: { issued: 324, resolved: 324, hit: 87.3, hitBase: 88.3, skill: -4.5, lo: -22.1, hi: 9.9, note: 'Walk-forward, January 1999 to December 2025.' },
      live: { issued: 1, resolved: 0, note: 'First live forecast issued 2 Nov 2026. It resolves in November 2027.' },
      cal: { bt: [[0.04, 96, 5], [0.08, 88, 9], [0.13, 64, 7], [0.19, 41, 9], [0.27, 23, 5], [0.38, 12, 3]] } },
    { id: 'cred', name: 'Management credibility', verdict: 'nym', windows: 3,
      q: 'Probability that a dated, checkable claim by management is met by its deadline. Baseline: the sector’s rate of claims met.',
      why: 'Six claims have resolved, in three independent windows. A verdict needs ten.',
      bt: { none: 1, note: 'No backtest is counted. Claims are extracted by a language model that may have read how they turned out, so past periods are marked contaminated.' },
      live: { issued: 38, resolved: 6, hit: 66.7, hitBase: 50.0, skill: 5.1, lo: -44.0, hi: 38.2 },
      cal: { live: [[0.55, 2, 1], [0.74, 4, 3]] } },
    { id: 'news', name: 'News direction', verdict: 'nym', windows: 4,
      q: 'Sign of a sector’s abnormal return 1, 5 and 30 trading days after an event. Baselines: 50%, the sector’s usual up-rate, and the curated matrix alone.',
      why: 'The live record covers four independent event windows. A verdict needs ten. The backtest is shown for reference only.',
      bt: { issued: 1140, resolved: 1140, hit: 54.6, hitBase: 52.1, skill: 1.8, lo: -2.9, hi: 6.3, note: 'Event library, 2006 to 2025. Contaminated: events were classified by a model that may have read about them. Not counted toward the verdict.' },
      live: { issued: 96, resolved: 41, hit: 56.1, hitBase: 51.2, skill: 2.1, lo: -19.4, hi: 21.0 },
      cal: { bt: [[0.34, 148, 59], [0.44, 262, 118], [0.50, 301, 152], [0.56, 251, 139], [0.65, 178, 109]], live: [[0.38, 9, 4], [0.49, 14, 6], [0.58, 12, 8], [0.67, 6, 4]] } },
    { id: 'dd', name: 'Drawdown', verdict: 'nym', windows: 7,
      q: 'Probability that a stock down 20% or more regains its prior high within 6, 12, 24 and 60 months. Baseline: the base rate for that depth of fall.',
      why: 'The horizons overlap, so 2,480 backtest forecasts amount to seven independent windows. A verdict needs ten.',
      bt: { issued: 2480, resolved: 2480, hit: 61.9, hitBase: 60.2, skill: 3.8, lo: -1.1, hi: 8.4, note: 'Point-in-time data, 2000 to 2023.' },
      live: { issued: 14, resolved: 0, note: 'The shortest horizon, six months, first resolves in May 2027.' },
      cal: { bt: [[0.22, 310, 61], [0.34, 520, 172], [0.45, 610, 281], [0.55, 540, 300], [0.66, 340, 232], [0.78, 160, 127]] } },
    { id: 'map', name: 'Mind-map links', verdict: 'nym', windows: 2,
      q: 'Sign of the abnormal return each link implies for its target, 5 and 30 trading days after the event. Baselines: 50% and the target’s usual up-rate.',
      why: 'Links from two independent events have resolved. A verdict needs ten. Curated-matrix links held in 31 of 52 cases, model-only links in 2 of 6.',
      bt: { none: 1, note: 'No backtest. Links are only issued live, once per event, target and horizon.' },
      live: { issued: 212, resolved: 58, hit: 56.9, hitBase: 51.7, skill: 3.0, lo: -24.6, hi: 27.3 },
      cal: { live: [[0.36, 11, 4], [0.48, 19, 9], [0.57, 18, 11], [0.68, 10, 7]] } }
  ];
  var VERDICT = { nb: 'Not beating the baseline', nym: 'Not yet meaningful' };
  var CHECK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>';
  var cal = { mod: 'regime', origin: 'bt' };
  function modById(id) { return MODS.filter(function (m) { return m.id === id; })[0]; }
  function wilson(k, n) { var z = 1.645, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, hw = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - hw), Math.min(1, c + hw)]; }
  function colHTML(title, o) {
    var h = '<div class="tr-col"><div class="micro">' + title + '</div>';
    if (o.none) return h + '<p class="tr-na">' + o.note + '</p></div>';
    h += '<dl class="kv"><dt>Forecasts issued</dt><dd>' + M.fmt(o.issued, 0) + '</dd><dt>Resolved</dt><dd>' + M.fmt(o.resolved, 0) + '</dd>' +
      '<dt>Hit rate</dt><dd>' + (o.hit == null ? '—' : o.hit.toFixed(1) + '%') + '</dd><dt>Baseline hit rate</dt><dd>' + (o.hit == null ? '—' : o.hitBase.toFixed(1) + '%') + '</dd>' +
      '<dt>Brier skill</dt><dd>' + (o.skill == null ? '—' : pc(o.skill)) + '</dd><dt>90% interval</dt><dd>' + (o.skill == null ? '—' : pc(o.lo) + ' to ' + pc(o.hi)) + '</dd></dl>';
    if (o.skill != null) h += '<div>' + ivl(o.skill, o.lo, o.hi, 50) + '</div>';
    return h + (o.note ? '<p class="tr-na">' + o.note + '</p>' : '') + '</div>';
  }
  $('#tr-cards').innerHTML = MODS.map(function (m) {
    return '<section class="card tr-card' + (m.verdict === 'nb' ? ' is-grey' : '') + '" aria-labelledby="tr-h-' + m.id + '">' +
      '<div class="tr-top"><h2 id="tr-h-' + m.id + '">' + m.name + '</h2><span class="badge' + (m.verdict === 'nb' ? ' v-nb' : '') + '">' + VERDICT[m.verdict] + '</span></div>' +
      '<p class="tr-q">' + m.q + '</p><div class="tr-cols">' + colHTML('Backtest', m.bt) + colHTML('Live', m.live) + '</div>' +
      '<div class="tr-win"><span>Independent windows</span><div class="meter" aria-hidden="true"><i style="--v:' + Math.min(100, m.windows * 10) + '%"></i></div><b>' + m.windows + ' of the 10 needed</b></div>' +
      '<p class="tr-why">' + m.why + '</p><button class="linkish" type="button" data-cal="' + m.id + '">Show calibration</button></section>';
  }).join('');
  $('#tr-note').innerHTML = M.icon('doc') + '<span>Backtest and live results are never mixed. A verdict needs at least ten independent windows; until then a module reads “Not yet meaningful”. A signal that fails to beat its baseline keeps the badge “Not beating the baseline” wherever it appears and is shown greyed, not hidden. Skill is the Brier skill against the baseline stored beside each forecast, with a 90% block-bootstrap interval.</span>';

  function calBins() { var b = modById(cal.mod).cal[cal.origin]; return b ? b.map(function (x) { var wi = wilson(x[2], x[1]); return { p: x[0], n: x[1], k: x[2], o: x[2] / x[1], lo: wi[0], hi: wi[1] }; }) : null; }
  function calText() {
    var m = modById(cal.mod), bins = calBins(), o = m[cal.origin], word = cal.origin === 'bt' ? 'backtest' : 'live';
    $('#tr-cal-sub').textContent = m.name + ', ' + word + '. Each point groups forecasts with similar probabilities and shows how often the event then happened. Points on the diagonal are perfectly calibrated. Whiskers are 90% Wilson intervals; hollow points rest on fewer than ten forecasts.';
    $('#tr-cal-empty').hidden = !!bins;
    $('#tr-cal-empty').textContent = o.none ? 'There is no ' + word + ' record for ' + m.name + '. ' + o.note : 'No ' + word + ' forecast for ' + m.name + ' has resolved yet. ' + (o.note || '');
    $('#tr-cal-cv').setAttribute('aria-label', bins ? 'Calibration plot for ' + m.name + ', ' + word + ': ' + bins.map(function (b) { return 'forecast ' + Math.round(b.p * 100) + '%, observed ' + Math.round(b.o * 100) + '%'; }).join('; ') + '. The table beside the plot has every figure.' : 'Calibration plot: no data.');
    $('#tr-cal-table').innerHTML = '<thead><tr><th scope="col">Mean forecast</th><th scope="col">Observed</th><th scope="col">90% interval</th><th scope="col">Forecasts</th></tr></thead><tbody>' +
      (bins ? bins.map(function (b) { return '<tr><td>' + (b.p * 100).toFixed(0) + '%</td><td>' + (b.o * 100).toFixed(0) + '%</td><td>' + (b.lo * 100).toFixed(0) + '% to ' + (b.hi * 100).toFixed(0) + '%</td><td>' + M.fmt(b.n, 0) + '</td></tr>'; }).join('') : '<tr><td class="l dim" colspan="4">Nothing resolved yet</td></tr>') + '</tbody>';
    drawCal();
  }
  function drawCal() {
    var c = surface($('#tr-cal')); if (!c) return;
    var ctx = c.ctx, w = c.w, h = c.h, bins = calBins(), pl = 46, pb = 40, pt = 10, pr = 12, iw = w - pl - pr, ih = h - pt - pb, dm = 0.5, nmax = 1;
    ctx.clearRect(0, 0, w, h); if (!bins) return;
    bins.forEach(function (b) { if (b.p > 0.5 || b.hi > 0.5) dm = 1; nmax = Math.max(nmax, b.n); });
    function X(v) { return pl + v / dm * iw; }
    function Y(v) { return pt + (1 - v / dm) * ih; }
    ctx.font = FONT; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
    for (var k = 0; k <= 4; k++) {
      var v = dm * k / 4, gx = Math.round(X(v)) + 0.5, gy = Math.round(Y(v)) + 0.5, t = Math.round(v * 1000) / 10 + '%';
      ctx.strokeStyle = M.rgba(COL['text-1'], 0.06); ctx.beginPath(); ctx.moveTo(pl, gy); ctx.lineTo(pl + iw, gy); ctx.moveTo(gx, pt); ctx.lineTo(gx, pt + ih); ctx.stroke();
      ctx.fillStyle = COL['text-3']; ctx.textAlign = 'right'; ctx.fillText(t, pl - 8, gy); ctx.textAlign = 'center'; ctx.fillText(t, gx, pt + ih + 12);
    }
    ctx.fillStyle = COL['text-3']; ctx.textAlign = 'center'; ctx.fillText('Forecast probability', pl + iw / 2, h - 8);
    ctx.save(); ctx.translate(10, pt + ih / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('How often it happened', 0, 0); ctx.restore();
    ctx.strokeStyle = M.rgba(COL['text-2'], 0.6); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(dm), Y(dm)); ctx.stroke(); ctx.setLineDash([]);
    bins.forEach(function (b) {
      var x = X(b.p), y = Y(b.o), r = 3 + 4 * Math.sqrt(b.n / nmax);
      ctx.strokeStyle = COL['text-1']; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(x, Y(b.lo)); ctx.lineTo(x, Y(b.hi)); ctx.moveTo(x - 4, Y(b.lo)); ctx.lineTo(x + 4, Y(b.lo)); ctx.moveTo(x - 4, Y(b.hi)); ctx.lineTo(x + 4, Y(b.hi)); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fillStyle = b.n < 10 ? COL['surface-1'] : COL.accent; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.accent; ctx.stroke(); ctx.lineWidth = 1;
    });
  }
  $('#tr-mod').innerHTML = MODS.map(function (m) { return '<option value="' + m.id + '">' + m.name + '</option>'; }).join('');
  $('#tr-mod').addEventListener('change', function () { calPick(this.value); });
  var segO = M.initSeg($('#tr-origin'), function (v) { cal.origin = v; calText(); });
  /* open a module on the origin that has something to show */
  function calPick(id) { var m = modById(id); cal.mod = id; $('#tr-mod').value = id; if (!m.cal[cal.origin]) { cal.origin = m.cal.bt ? 'bt' : 'live'; segO.select(cal.origin, true, true); } calText(); }
  $('#tr-cards').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cal]'); if (!b) return;
    calPick(b.dataset.cal); $('#tr-cal-h').scrollIntoView({ block: 'center', behavior: M.rm() ? 'auto' : 'smooth' }); $('#tr-mod').focus({ preventScroll: true });
  });

  /* ledger */
  var ROWS = 0, OUT = 0, LIVE = 0;
  MODS.forEach(function (m) { [m.bt, m.live].forEach(function (o, i) { if (o.none) return; ROWS += o.issued; OUT += o.resolved; if (i) LIVE += o.issued; }); });
  function ledgerLine(whenText) { $('#tr-ledger').className = 'ledger-line'; $('#tr-ledger').innerHTML = CHECK + '<span><b>Hash chain verified ' + whenText + '.</b> ' + M.fmt(ROWS, 0) + ' forecast rows and ' + M.fmt(OUT, 0) + ' outcomes, every link intact.</span>'; }
  ledgerLine('today at 07:30');
  $('#tr-led-kv').innerHTML = '<dt>Forecast rows</dt><dd>' + M.fmt(ROWS, 0) + '</dd><dt>Of which live</dt><dd>' + M.fmt(LIVE, 0) + '</dd><dt>Of which backtest</dt><dd>' + M.fmt(ROWS - LIVE, 0) + '</dd><dt>Outcome rows</dt><dd>' + M.fmt(OUT, 0) + '</dd><dt>Head of chain</dt><dd><span class="code">9f3c71e0…a1d2</span></dd><dt>Updates and deletes</dt><dd>Blocked by triggers</dd>';
  $('#tr-verify').addEventListener('click', function () {
    var b = this; b.disabled = true;
    $('#tr-ledger').className = 'ledger-line busy'; $('#tr-ledger').innerHTML = M.icon('clock') + '<span>Checking ' + M.fmt(ROWS, 0) + ' rows against their hashes…</span>';
    setTimeout(function () { ledgerLine('just now'); b.disabled = false; }, M.rm() ? 300 : 900);
  });

  /* =====================================================================
     Tabs, deep links, redraws
     ===================================================================== */
  var DRAW = { event: function () { esDraw(); smDraw(); }, stress: function () { drawWF(); drawSec(); }, track: drawCal };
  var SEGS = { event: [segH], stress: [segT], track: [segO] };
  function active() { return $('#ttabs .tab.is-active').dataset.v; }
  function shown(v) { SEGS[v].forEach(function (s) { s.place(false); }); DRAW[v](); }
  var tabs = M.initTabs($('#ttabs'), function (v, dir) {
    M.showPanel($('#tpanels'), v, dir);
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* file:// */ }
    shown(v);
  });
  function fromHash() { var h = location.hash.slice(1).toLowerCase(), v = /^stress/.test(h) ? 'stress' : /^track/.test(h) ? 'track' : /^event/.test(h) ? 'event' : ''; if (v) tabs.select(v, false); }
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('resize', function () { DRAW[active()](); });
  document.addEventListener('ml:paint', function () { DRAW[active()](); });

  esPick(EVENTS[0], false); sxNote(); sxRender(); calText();
  fromHash(); shown(active());
})();
