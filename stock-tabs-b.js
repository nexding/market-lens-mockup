/* Market Lens mockup: stock page tabs Analysis, Holders, Options and Earnings. All data is invented. */
(function () {
  'use strict';
  var M = window.ML; if (!M || !M.stockTab) return;
  var $ = M.$, $$ = M.$$, esc = M.esc;
  var FONT = '500 11px Inter, system-ui, sans-serif', DAY = 864e5;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WORD = { beat: 'Beat', miss: 'Miss', inline: 'In line' };

  /* ---------- small helpers ---------- */
  function rd(v, dp) { var k = Math.pow(10, dp); return Math.round(v * k) / k; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function dstr(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function arrow(up) { return ' <i aria-hidden="true">' + (up ? '▲' : '▼') + '</i>'; }
  /* a signed change with its arrow; zero stays neutral. chip adds the tinted background */
  function chg(v, txt, chip) { return v ? '<span class="chg ' + (v > 0 ? 'up' : 'dn') + (chip ? '' : ' bare') + '">' + txt + arrow(v > 0) + '</span>' : '<span class="dim">' + txt + '</span>'; }
  function result(res) { return res === 'inline' ? '<span class="badge">In line</span>' : '<span class="chg ' + (res === 'beat' ? 'up' : 'dn') + '">' + WORD[res] + arrow(res === 'beat') + '</span>'; }
  function tile(label, value, sub) { return '<div class="tb-tile"><div class="label">' + label + '</div><div class="v">' + value + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>'; }
  /* ML.sortable answers clicks only: make the sortable headers reachable and usable from the keyboard */
  function sortable(table) {
    M.sortable(table);
    $$('th[data-sort]', table).forEach(function (th) { th.tabIndex = 0; th.title = 'Sort by this column'; });
    table.tHead.addEventListener('keydown', function (e) {
      var th = e.target.closest ? e.target.closest('th[data-sort]') : null;
      if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.click(); }
    });
  }
  /* a "Show table" alternative under a chart */
  function altTable(html) { return '<details class="tb-alt"><summary>Show table</summary><div class="dt-wrap">' + html + '</div></details>'; }
  function bindAlt(scope) {
    $$('details.tb-alt', scope).forEach(function (d) { d.addEventListener('toggle', function () { $('summary', d).textContent = d.open ? 'Hide table' : 'Show table'; }); });
  }

  /* ---------- canvas helpers ---------- */
  /* a canvas in a .plot host: redraws on resize and on a theme change, and runs its entrance once (u goes 0 to 1) */
  function plot(host, label, paint) {
    var cv = M.el('canvas'), u = 0, started = false;
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', label); host.appendChild(cv);
    function frame() { var w = host.clientWidth, h = host.clientHeight; if (w && h) paint(M.fitCanvas(cv, w, h), w, h, u); }
    function draw() {
      if (started) { frame(); return; }
      if (!host.clientWidth || !host.clientHeight) return;
      started = true; M.tween(560, function (t) { u = t; frame(); }, M.easeOut);
    }
    new ResizeObserver(draw).observe(host); document.addEventListener('ml:paint', draw); draw();
    return { draw: draw };
  }
  /* quiet grid: four lines, labels on the right */
  function grid(g, lo, hi, iw, Y, f) {
    var C = M.COL;
    g.lineWidth = 1; g.textAlign = 'left';
    for (var k = 0; k < 4; k++) {
      var gv = lo + (hi - lo) * (k + 0.5) / 4, gy = Math.round(Y(gv)) + 0.5;
      g.strokeStyle = M.rgba(C['text-1'], 0.06); g.beginPath(); g.moveTo(0, gy); g.lineTo(iw, gy); g.stroke();
      g.fillStyle = C['text-3']; g.fillText(f(gv), iw + 8, gy);
    }
  }
  function bar(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
  function stagger(u, i, n) { return clamp(u * 1.5 - i / n * 0.5, 0, 1); }

  /* ---------- Black-Scholes with a continuous dividend yield ---------- */
  /* normal CDF: Abramowitz and Stegun 26.2.17, absolute error below 1e-7 */
  function ncdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
    var p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1 - p : p;
  }
  function bs(call, S, K, T, v, r, q) {
    var sd = v * Math.sqrt(T), d1 = (Math.log(S / K) + (r - q + v * v / 2) * T) / sd, d2 = d1 - sd, df = Math.exp(-r * T), dq = Math.exp(-q * T);
    return call ? S * dq * ncdf(d1) - K * df * ncdf(d2) : K * df * ncdf(-d2) - S * dq * ncdf(-d1);
  }

  /* ---------- the sample model behind all four tabs, built once from ctx ---------- */
  var cached = null;
  function model(ctx) {
    if (cached) return cached;
    var id = ctx.id, it = ctx.it, R = ctx.DATA.restated, nz = ctx.nz, NOW = ctx.NOW, i;
    /* ctx.it.p moves with the simulated ticks; the 52-week high was fixed at load, so this is the load-time price */
    var P0 = ctx.HI52 / 1.37, us = it.x !== 'HKEX' && it.x !== 'LSE', dpE = ctx.eps < 1 ? 3 : 2;
    function seeded(seed, lo, hi) { return lo + M.rng(M.hash(seed))() * (hi - lo); }
    function ri(seed, lo, hi) { return lo + M.hash(id + seed) % (hi - lo + 1); }
    /* the one-year sample path without its noise: the price a number of days ago */
    var PATH = [[0, 0.93], [0.45, 1.22], [0.62, 1.37], [0.8, 1.08], [1, 1]];
    function priceAgo(days) {
      var t = clamp(1 - days / 365, 0, 1), j = 0; while (j < PATH.length - 2 && t > PATH[j + 1][0]) j++;
      var a = PATH[j], b = PATH[j + 1]; return P0 * (a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]));
    }

    /* earnings history: reported EPS comes from the sample statements; the consensus is backed out of a surprise pattern.
       The story: two misses since the July peak, the first one (reported 30 Jul 2026) with the large one-day fall */
    var REP = [[2025, 0, 30], [2025, 4, 1], [2025, 6, 31], [2025, 9, 30], [2026, 0, 29], [2026, 3, 30], [2026, 6, 30], [2026, 9, 29]];
    var SURP = [3.4, 2.1, -1.3, 4.6, 5.2, 2.8, -5.6, -1.4], MOVE = [2.9, 1.2, -2.4, 3.8, 4.4, -0.7, -8.6, -3.2];
    var hist = ctx.QTRS.map(function (name, k) {
      var act = rd(R.eps.q[k], dpE), est = rd(R.eps.q[k] / (1 + (SURP[k] + nz(id + 'sp' + k) * 0.8) / 100), dpE);
      return { i: k, q: name, date: new Date(REP[k][0], REP[k][1], REP[k][2]), est: est, act: act, diff: rd(act - est, dpE), surp: est ? (act - est) / Math.abs(est) * 100 : 0,
        res: act > est ? 'beat' : act < est ? 'miss' : 'inline', rev: R.rev.q[k], revYoY: k > 3 ? (R.rev.q[k] / R.rev.q[k - 4] - 1) * 100 : null, move: MOVE[k] + nz(id + 'mv' + k) * 0.9 };
    });
    var nextDate = new Date(2027, 0, 29, 16, 0), next = { date: nextDate, q: 'Q1 FY26', days: Math.round((nextDate - NOW) / DAY) };

    /* consensus estimates. Forward EPS (next year) is trailing EPS / 0.9, the figure behind the forward P/E on Summary */
    var nA = 18 + M.hash(id + 'an') % 20, eq = R.eps.q, rq = R.rev.q;
    var cyE = ctx.eps * (1.052 + nz(id + 'gy') * 0.012), cyR = R.rev.a[4] * (1.045 + nz(id + 'ry') * 0.01);
    var PER = [['Current quarter', 'Current qtr', 'Q1 FY26', 'Dec 2026'], ['Next quarter', 'Next qtr', 'Q2 FY26', 'Mar 2027'], ['Current year', 'Current year', 'FY2026', 'Sep 2027'], ['Next year', 'Next year', 'FY2027', 'Sep 2028']];
    function est(k, n, avg, ago, spread, dpv) {
      var a = rd(avg, dpv), y = rd(ago, dpv);
      return { n: n, avg: a, lo: rd(avg * (1 - spread * (1 + nz(id + k + 'lo') * 0.25)), dpv), hi: rd(avg * (1 + spread * (0.9 + nz(id + k + 'hi') * 0.25)), dpv), ago: y, g: y ? (a - y) / Math.abs(y) * 100 : 0 };
    }
    var eps = [est('ecq', nA - 5, eq[4] * (1.03 + nz(id + 'gq1') * 0.015), eq[4], 0.045, dpE), est('enq', nA - 6, eq[5] * (1.045 + nz(id + 'gq2') * 0.015), eq[5], 0.06, dpE),
      est('ecy', nA, cyE, ctx.eps, 0.07, dpE), est('eny', nA - 3, ctx.eps / 0.9, cyE, 0.12, dpE)];
    var rev = [est('rcq', nA - 6, rq[4] * (1.035 + nz(id + 'rq1') * 0.01), rq[4], 0.02, 0), est('rnq', nA - 7, rq[5] * (1.04 + nz(id + 'rq2') * 0.01), rq[5], 0.025, 0),
      est('rcy', nA - 1, cyR, R.rev.a[4], 0.03, 0), est('rny', nA - 4, cyR * (1.058 + nz(id + 'ry2') * 0.01), cyR, 0.05, 0)];
    [eps, rev].forEach(function (a) { a.forEach(function (p, k) { p.name = PER[k][0]; p.short = PER[k][1]; p.per = PER[k][2]; p.end = PER[k][3]; }); });

    /* revisions since the last report: more cuts than raises */
    var revs = eps.map(function (p, k) {
      var u7 = ri('u7' + k, 0, 1), d7 = ri('d7' + k, 1, 3) + (k === 2 ? 1 : 0), u30 = u7 + ri('u30' + k, 1, 2);
      return { name: p.name, per: p.per, u7: u7, d7: d7, u30: u30, d30: Math.min(p.n - u30 - 1, d7 + ri('d30' + k, 5, 8) + (k === 2 ? 2 : 0)) };
    });

    /* growth: this stock from the estimates above; sector and index figures are seeded by their own names, so they match across stocks */
    var ix = it.x === 'HKEX' ? 'HSI' : it.x === 'LSE' ? 'FTSE' : 'SPX', ea = R.eps.a;
    var growth = [['Current quarter', eps[0].g, 1, 9, 4, 9], ['Next quarter', eps[1].g, 2, 10, 5, 10], ['Current year', eps[2].g, 3, 12, 6, 11], ['Next year', eps[3].g, 5, 13, 8, 13],
      ['Next 5 years (per year)', 6.5 + nz(id + 'g5') * 2, 6, 12, 7, 10], ['Past 4 years (per year)', ea[0] > 0 && ea[4] > 0 ? (Math.pow(ea[4] / ea[0], 0.25) - 1) * 100 : null, 4, 14, 6, 11]
    ].map(function (g, k) { return { name: g[0], stock: g[1], sector: seeded(it.sec + ':g' + k, g[2], g[3]), index: seeded(ix + ':g' + k, g[4], g[5]) }; });

    /* recommendation trend: six month-end snapshots, drifting from buy towards hold after the July peak */
    var tilt = nz(id + 'rec') * 0.05, RA = [0.30 + tilt, 0.42, 0.24 - tilt, 0.04, 0], RB = [0.19 + tilt, 0.36, 0.36 - tilt, 0.07, 0.02];
    var rec = [5, 4, 3, 2, 1, 0].map(function (back, m) {
      var tot = nA - (m < 2 ? 1 : 0), raw = RA.map(function (a, j) { return (a + (RB[j] - a) * m / 5) * tot; }), c = raw.map(Math.floor);
      raw.map(function (v, j) { return [v - c[j], j]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, tot - sum(c)).forEach(function (x) { c[x[1]]++; });
      var d = new Date(NOW.getFullYear(), NOW.getMonth() - back, 1);
      return { label: MON[d.getMonth()], c: c, n: tot, mean: sum(c.map(function (v, j) { return v * (j + 1); })) / tot };
    });

    /* one-year price targets: the average is the figure on Summary */
    var pt = { n: nA - 2, avg: P0 * 1.14, med: P0 * 1.14 * (0.985 + nz(id + 'ptm') * 0.01), lo: P0 * (0.86 + nz(id + 'ptl') * 0.03), hi: P0 * (1.44 + nz(id + 'pth') * 0.05) };

    /* options: one volatility surface, so every expiry, strike, call and put is priced from the same inputs */
    var RATE = 0.04, DY = ctx.div * 4 / P0, VB = 0.2 + 0.13 * (0.8 + (M.hash(id + 'b') % 70) / 100);
    var avgAbs = sum(hist.map(function (x) { return Math.abs(x.move); })) / hist.length;
    /* the one-day move priced for the next report, and the same thing as a standard deviation added to later expiries */
    var EM = clamp(avgAbs * 1.3, 2.5, 9), J = EM / 100 / 0.798, TE = next.days / 365;
    var step = P0 < 20 ? 0.5 : P0 < 60 ? 1 : P0 < 150 ? 2.5 : P0 < 600 ? 5 : 10, k0 = Math.round(P0 / step) * step, strikes = [];
    for (i = -8; i <= 8; i++) strikes.push(rd(k0 + i * step, 2));
    function atmVol(T) { var b = VB * (1 + 0.07 * Math.exp(-T * 9)); return Math.sqrt(b * b + (T > TE ? J * J / T : 0)); }
    /* the smile, in standard deviations from the forward: higher on the put side, a shallow minimum above the money.
       The wings level off smoothly, and the curve is gentle enough that call prices fall and put prices rise with the strike at every expiry */
    function ivAt(K, T) { var a = atmVol(T), z = 4.5 * Math.tanh(Math.log(K / (P0 * Math.exp((RATE - DY) * T))) / (a * Math.sqrt(T)) / 4.5); return a * (1 - 0.1 * z + 0.03 * z * z); }
    var EXP = [[2026, 10, 20, 'M'], [2026, 10, 27, 'W'], [2026, 11, 4, 'W'], [2026, 11, 11, 'W'], [2026, 11, 18, 'M'], [2027, 0, 15, 'M'], [2027, 1, 19, 'M'], [2027, 2, 19, 'M'], [2027, 5, 18, 'M'], [2028, 0, 21, 'M']].map(function (x, e) {
      var d = new Date(x[0], x[1], x[2], 16, 0), days = Math.round((d - NOW) / DAY);
      return { e: e, d: d, days: days, T: days / 365, kind: x[3], earn: days > next.days };
    });
    var VW = [1, 0.45, 0.3, 0.2, 0.7, 0.5, 0.3, 0.25, 0.2, 0.1], OW = [1, 0.2, 0.14, 0.09, 1.3, 1.5, 0.8, 0.9, 1, 0.8], shareVol = 55140000 * ctx.K + 5e6, chains = [];
    function chain(e) {
      if (chains[e]) return chains[e];
      var X = EXP[e], T = X.T, ret = P0 / it.pc - 1, a = atmVol(T), sd = a * Math.sqrt(T);
      var pcV = 0.95 + nz(id + 'pcv' + e) * 0.22, pcO = 0.8 + nz(id + 'pco' + e) * 0.16;
      /* how activity spreads across strikes: centred a little out of the money, with more open interest at round strikes */
      function spread(z0, wd, round) {
        var ws = strikes.map(function (K) { var z = Math.log(K / P0) / sd; return Math.exp(-Math.pow(z - z0, 2) / (2 * wd * wd)) * (round && Math.round(K / step) % 2 === 0 ? 1.3 : 1); }), s = sum(ws);
        return ws.map(function (w) { return w / s; });
      }
      var wCV = spread(0.3, 1), wPV = spread(-0.3, 1), wCO = spread(0.7, 1.6, true), wPO = spread(-0.7, 1.6, true);
      function side(call, K, k) {
        /* the call and the put at a strike share one implied volatility, so they satisfy put-call parity */
        var tag = id + (call ? ':c' : ':p') + e + ':' + k, v = ivAt(K, T);
        var mid = Math.max(call ? P0 - K : K - P0, 0, bs(call, P0, K, T, v, RATE, DY));
        /* yesterday's close: one more day to run, the previous share price, and volatility a little higher if the shares rose today */
        var prev = Math.max(0.01, rd(Math.max(call ? it.pc - K : K - it.pc, 0, bs(call, it.pc, K, T + 1 / 365, v * (1 + 0.8 * ret), RATE, DY)), 2));
        var half = Math.max(0.005, mid * (0.006 + 0.003 * Math.min(4, T * 3)) + 0.008), bid = Math.max(0, rd(mid - half, 2)), ask = Math.max(bid + 0.01, rd(mid + half, 2));
        var vol = Math.round(shareVol * 0.0022 * VW[e] * (call ? 1 : pcV) * (call ? wCV : wPV)[k] * (1 + nz(tag + 'v') * 0.35));
        var oi = Math.round(shareVol * 0.012 * OW[e] * (call ? 1 : pcO) * (call ? wCO : wPO)[k] * (1 + nz(tag + 'o') * 0.3));
        /* no trade today: the last price is yesterday's and the change is zero */
        var last = vol ? Math.max(0.01, rd(clamp(mid + nz(tag + 'l') * half * 0.7, bid, ask), 2)) : prev, ch = rd(last - prev, 2);
        return { iv: v, mid: mid, bid: bid, ask: ask, last: last, chg: ch, pct: ch / prev * 100, vol: vol, oi: oi, itm: call ? K < P0 : K > P0 };
      }
      var rows = strikes.map(function (K, k) { return { K: K, c: side(true, K, k), p: side(false, K, k) }; }), ai = 8;
      var tot = function (s, f) { return sum(rows.map(function (r) { return r[s][f]; })); }, cV = tot('c', 'vol'), pV = tot('p', 'vol'), cO = tot('c', 'oi'), pO = tot('p', 'oi');
      var straddle = rows[ai].c.mid + rows[ai].p.mid;
      return (chains[e] = { X: X, rows: rows, ai: ai, atm: a, straddle: straddle, movePct: straddle / P0 * 100, cV: cV, pV: pV, cO: cO, pO: pO, pcVol: pV / (cV || 1), pcOI: pO / (cO || 1) });
    }

    return (cached = { P0: P0, us: us, dpE: dpE, hist: hist, next: next, nA: nA, eps: eps, rev: rev, revs: revs, growth: growth, index: M.I[ix].n, rec: rec, pt: pt, priceAgo: priceAgo,
      avgAbs: avgAbs, EM: EM, opt: { rate: RATE, dy: DY, step: step, strikes: strikes, EXP: EXP, ivAt: ivAt, chain: chain } });
  }

  /* =====================================================================
     Analysis
     ===================================================================== */
  M.stockTab('analysis', function (host, ctx) {
    var D = model(ctx), id = ctx.id, it = ctx.it, dp = D.dpE, H = D.hist, T = D.pt, newest = H.slice().reverse();
    function fe(v) { return M.fmt(v, dp); }
    function fr(v) { return M.fbig(v * 1e6); }
    function gp(v) { return v == null ? '<span class="dim" title="Not enough history">—</span>' : M.fpct(v, 1); }
    /* periods across, measures down: the layout analysts' tables usually take */
    function estTable(label, P, f) {
      var rows = [['Analysts', function (p) { return p.n; }], ['Average', function (p) { return f(p.avg); }, 1], ['Low', function (p) { return f(p.lo); }], ['High', function (p) { return f(p.hi); }],
        ['Year earlier', function (p) { return f(p.ago); }], ['Implied growth', function (p) { return M.fpct(p.g, 1); }]];
      return '<div class="dt-wrap tb-mid"><table class="dt tb-est"><thead><tr><th scope="col">' + label + '</th>' +
        P.map(function (p) { return '<th scope="col" title="' + p.name + ', period ending ' + p.end + '"><span class="tb-th2">' + p.short + '<small>' + p.per + '</small></span></th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr' + (r[2] ? ' class="tb-strong"' : '') + '><td>' + r[0] + '</td>' + P.map(function (p) { return '<td>' + r[1](p) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    var beats = H.filter(function (x) { return x.res === 'beat'; }).length, misses = H.filter(function (x) { return x.res === 'miss'; }).length;
    var first = D.rec[0], last = D.rec[5], CATS = ['Strong buy', 'Buy', 'Hold', 'Sell', 'Strong sell'];
    var SW = ['var(--gain)', 'color-mix(in srgb, var(--gain) 50%, transparent)', 'color-mix(in srgb, var(--text-3) 40%, transparent)', 'color-mix(in srgb, var(--loss) 50%, transparent)', 'var(--loss)'];
    function rating(m) { return m <= 1.5 ? 'strong buy' : m <= 2.5 ? 'buy' : m <= 3.5 ? 'hold' : m <= 4.5 ? 'sell' : 'strong sell'; }
    var cuts30 = sum(D.revs.map(function (r) { return r.d30; })), raises30 = sum(D.revs.map(function (r) { return r.u30; }));

    host.innerHTML = '<div class="stack">' +
      '<div class="band" role="note">' + M.icon('doc') + '<span>Analyst consensus: third-party data, not a Market Lens forecast</span></div>' +

      '<div class="g2">' +
        '<section class="card reveal"><header class="card-h"><h2>EPS estimates</h2><div class="card-a"><span class="badge">Third-party</span></div></header>' +
          estTable('Diluted EPS, ' + it.c, D.eps, fe) +
          '<p class="tb-note">Year earlier is the reported figure; for next year it is the current-year average. The forward P/E on Summary is the price over the next-year average of ' + fe(D.eps[3].avg) + '.</p></section>' +
        '<section class="card reveal"><header class="card-h"><h2>Revenue estimates</h2><div class="card-a"><span class="badge">Third-party</span></div></header>' +
          estTable('Revenue, USD', D.rev, fr) +
          '<p class="tb-note">Revenue in US dollars, as on Financials. Fewer analysts publish revenue than EPS for the quarters.</p></section>' +
      '</div>' +

      '<div class="split">' +
        '<section class="card reveal"><header class="card-h"><h2>Earnings history</h2><div class="card-a"><div class="lg tb-lg"><span><i class="sq" style="background:color-mix(in srgb, var(--text-3) 45%, transparent)"></i>Estimate</span><span><i class="sq" style="background:var(--gain)"></i>Actual, beat</span><span><i class="sq" style="background:var(--loss)"></i>Actual, miss</span></div></div></header>' +
          '<p class="tb-lead">Reported EPS beat the consensus in ' + beats + ' of the last ' + H.length + ' quarters and missed in ' + misses + '.' + (H[6].res === 'miss' && H[7].res === 'miss' ? ' Both reports since the July peak missed.' : '') + '</p>' +
          '<div class="plot tb-plot-hist" data-plot="hist"></div>' +
          '<div class="dt-wrap tb-top"><table class="dt"><thead><tr><th scope="col">Quarter</th><th scope="col">Reported</th><th scope="col">EPS estimate</th><th scope="col">EPS actual</th><th scope="col">Difference</th><th scope="col">Surprise</th><th scope="col">Result</th></tr></thead><tbody>' +
          newest.map(function (x) {
            return '<tr><td>' + x.q + '</td><td>' + dstr(x.date) + '</td><td>' + fe(x.est) + '</td><td>' + fe(x.act) + '</td><td>' + M.fsign(x.diff, dp) + '</td><td>' + chg(x.diff, M.fpct(x.surp, 1)) + '</td><td>' + result(x.res) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>' +

        '<div class="stack">' +
          '<section class="card reveal"><header class="card-h"><h2>EPS revisions</h2><div class="card-a"><span class="badge">From our own snapshots</span></div></header>' +
            '<div class="dt-wrap tb-mid"><table class="dt tb-rev"><thead><tr class="tb-grp"><th scope="col" rowspan="2">Period</th><th scope="colgroup" colspan="2">Last 7 days</th><th scope="colgroup" colspan="2">Last 30 days</th></tr>' +
            '<tr><th scope="col">Up</th><th scope="col">Down</th><th scope="col">Up</th><th scope="col">Down</th></tr></thead><tbody>' +
            D.revs.map(function (r) {
              function n(v) { return v ? String(v) : '<span class="dim">0</span>'; }
              return '<tr><td>' + r.name + ' <span class="dim tb-sub">' + r.per + '</span></td><td>' + n(r.u7) + '</td><td>' + n(r.d7) + '</td><td>' + n(r.u30) + '</td><td>' + n(r.d30) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<p class="tb-note">Over 30 days: ' + cuts30 + ' estimates cut and ' + raises30 + ' raised across the four periods, most of them after the 29 Oct report.</p>' +
            '<p class="tb-note">Revision history comes from Market Lens’s own daily snapshots of the consensus, so it starts when collection starts. Collection for ' + esc(id) + ' began on 12 Oct 2026; a 90-day window is available from 10 Jan 2027.</p></section>' +

          '<section class="card reveal"><header class="card-h"><h2>Price targets</h2><div class="card-a"><span class="badge">Third-party · ' + T.n + ' analysts</span></div></header>' +
            '<div class="tb-pt-row"><span class="tb-pt-end">Low<b>' + M.fmt(T.lo) + '</b></span>' +
              '<div class="tb-pt" role="img"><span class="tb-pt-span"></span><i class="cur"><b></b></i><i class="avg"><b>Average ' + M.fmt(T.avg) + '</b></i></div>' +
              '<span class="tb-pt-end r">High<b>' + M.fmt(T.hi) + '</b></span></div>' +
            '<dl class="kv"><dt>Current price</dt><dd>' + ctx.cur + M.pxHTML(id) + '</dd><dt>Average target</dt><dd>' + ctx.cur + M.fmt(T.avg) + '</dd><dt>Average against current price</dt><dd class="tb-pt-up"></dd>' +
              '<dt>Median target</dt><dd>' + ctx.cur + M.fmt(T.med) + '</dd><dt>Range</dt><dd>' + ctx.cur + M.fmt(T.lo) + ' to ' + ctx.cur + M.fmt(T.hi) + '</dd></dl>' +
            '<p class="tb-note">One-year targets published by analysts and collected from a third party. Market Lens does not forecast prices.</p></section>' +
        '</div>' +
      '</div>' +

      '<div class="g2">' +
        '<section class="card reveal"><header class="card-h"><h2>Recommendation trend</h2><div class="card-a"><span class="badge">Third-party</span></div></header>' +
          '<div class="plot tb-plot-rec" data-plot="rec"></div>' +
          '<div class="lg tb-lg tb-lg-rec">' + CATS.map(function (c, j) { return '<span><i class="sq" style="background:' + SW[j] + '"></i>' + c + '</span>'; }).join('') + '</div>' +
          '<p class="tb-note">Mean rating ' + last.mean.toFixed(2) + ' (' + rating(last.mean) + ') on a scale from 1, strong buy, to 5, strong sell. Five months earlier it was ' + first.mean.toFixed(2) + '. Bars stack from strong buy at the bottom to strong sell at the top.</p>' +
          altTable('<table class="dt"><thead><tr><th scope="col">Month</th>' + CATS.map(function (c) { return '<th scope="col">' + c + '</th>'; }).join('') + '<th scope="col">Analysts</th><th scope="col">Mean rating</th></tr></thead><tbody>' +
            D.rec.slice().reverse().map(function (m) { return '<tr><td>' + m.label + ' 2026</td>' + m.c.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '<td>' + m.n + '</td><td>' + m.mean.toFixed(2) + '</td></tr>'; }).join('') + '</tbody></table>') +
        '</section>' +
        '<section class="card reveal"><header class="card-h"><h2>Growth estimates</h2><div class="card-a"><span class="badge">Third-party</span></div></header>' +
          '<div class="dt-wrap tb-mid"><table class="dt"><thead><tr><th scope="col">EPS growth</th><th scope="col">' + esc(id) + '</th><th scope="col">' + esc(it.sec) + ' sector</th><th scope="col">' + esc(D.index) + '</th></tr></thead><tbody>' +
          D.growth.map(function (g) { return '<tr><td>' + g.name + '</td><td class="tb-b">' + gp(g.stock) + '</td><td>' + gp(g.sector) + '</td><td>' + gp(g.index) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<p class="tb-note">Growth in EPS on the same period a year earlier. Sector and index figures are consensus aggregates. The past four years are computed from the statements on Financials.</p></section>' +
      '</div>' +
    '</div>';

    /* earnings history: estimate and actual side by side, the result written above each pair */
    plot($('[data-plot="hist"]', host), 'EPS estimate against actual for the last ' + H.length + ' quarters. ' + H.map(function (x) { return x.q + ': estimate ' + fe(x.est) + ', actual ' + fe(x.act) + ', ' + WORD[x.res].toLowerCase(); }).join('; ') + '. The table below has the same figures.', function (g, w, h, u) {
      var C = M.COL, n = H.length, pr = 48, pt = 36, pb = 24, iw = w - pr, ih = h - pt - pb, gw = iw / n, bw = Math.max(5, Math.min(20, gw * 0.26));
      var hi = Math.max.apply(null, H.map(function (x) { return Math.max(x.est, x.act); })) * 1.02, lo = Math.min(0, Math.min.apply(null, H.map(function (x) { return Math.min(x.est, x.act); })));
      function Y(v) { return pt + (1 - (v - lo) / (hi - lo || 1)) * ih; }
      g.clearRect(0, 0, w, h); g.font = FONT; g.textBaseline = 'middle';
      grid(g, lo, hi, iw, Y, fe);
      var y0 = Y(0); g.strokeStyle = M.rgba(C['text-1'], 0.14); g.beginPath(); g.moveTo(0, Math.round(y0) + 0.5); g.lineTo(iw, Math.round(y0) + 0.5); g.stroke();
      g.textAlign = 'center';
      H.forEach(function (x, k) {
        var t = stagger(u, k, n), cx = gw * (k + 0.5), col = x.res === 'beat' ? C.gain : x.res === 'miss' ? C.loss : C['text-2'];
        [[x.est, cx - bw - 1.5, M.rgba(C['text-3'], 0.45)], [x.act, cx + 1.5, col]].forEach(function (b) {
          var y1 = Y(b[0] * t), top = Math.min(y0, y1), bh = Math.max(1, Math.abs(y1 - y0)), r = Math.min(3, bw / 2, bh);
          g.fillStyle = b[2]; bar(g, b[1], top, bw, bh, b[0] >= 0 ? [r, r, 0, 0] : [0, 0, r, r]);
        });
        var top2 = Math.min(y0, Y(Math.max(x.est, x.act)));
        g.globalAlpha = t; g.fillStyle = col; g.fillText(WORD[x.res], cx, top2 - 22); g.fillStyle = C['text-2']; g.fillText(M.fpct(x.surp, 1), cx, top2 - 9); g.globalAlpha = 1;
        g.fillStyle = C['text-3']; g.fillText(gw < 56 ? x.q.slice(0, 2) + ' ' + x.q.slice(-2) : x.q, cx, h - 9);
      });
    });

    /* recommendation trend: stacked counts, each segment labelled when there is room */
    plot($('[data-plot="rec"]', host), 'Analyst recommendations by month. ' + D.rec.map(function (m) { return m.label + ': ' + m.c.map(function (c, j) { return c + ' ' + CATS[j].toLowerCase(); }).join(', '); }).join('; ') + '.', function (g, w, h, u) {
      var C = M.COL, n = D.rec.length, pt = 22, pb = 24, ih = h - pt - pb, slot = w / n, bw = Math.min(64, slot * 0.62), unit = ih / Math.max.apply(null, D.rec.map(function (m) { return m.n; }));
      var fills = [C.gain, M.rgba(C.gain, 0.5), M.rgba(C['text-3'], 0.4), M.rgba(C.loss, 0.5), C.loss], inks = [C['surface-1'], C['text-1'], C['text-1'], C['text-1'], C['surface-1']];
      g.clearRect(0, 0, w, h); g.font = FONT; g.textBaseline = 'middle'; g.textAlign = 'center';
      D.rec.forEach(function (m, k) {
        var t = stagger(u, k, n), x = slot * k + (slot - bw) / 2, y = h - pb;
        m.c.forEach(function (c, j) {
          if (!c) return;
          var bh = c * unit * t; y -= bh;
          g.fillStyle = fills[j]; g.fillRect(x, y + 1, bw, Math.max(0, bh - 1));
          if (t === 1 && bh >= 15) { g.fillStyle = inks[j]; g.fillText(String(c), x + bw / 2, y + bh / 2 + 0.5); }
        });
        g.globalAlpha = t; g.fillStyle = C['text-2']; g.fillText(String(m.n), x + bw / 2, y - 9); g.globalAlpha = 1;
        g.fillStyle = C['text-3']; g.fillText(m.label, x + bw / 2, h - 9);
      });
    });

    /* price targets: the targets are fixed, the current-price marker follows the live price */
    function paintTargets() {
      var p = it.p, up = (T.avg / p - 1) * 100, node = $('.tb-pt', host);
      function f(v) { return clamp((v - T.lo) / (T.hi - T.lo) * 100, 0, 100).toFixed(1) + '%'; }
      node.style.setProperty('--cur', f(p)); node.style.setProperty('--avg', f(T.avg));
      node.setAttribute('aria-label', 'Analyst price targets from ' + M.fmt(T.lo) + ' to ' + M.fmt(T.hi) + ', average ' + M.fmt(T.avg) + '. Current price ' + M.fmt(p) + '.');
      $('.cur b', node).textContent = 'Current ' + M.fmt(p);
      $('.tb-pt-up', host).innerHTML = chg(rd(up, 1), M.fpct(up, 1));
    }
    paintTargets();
    M.onTick(function (x) { if (x.id === id) paintTargets(); });
    bindAlt(host);
    return {};
  });

  /* =====================================================================
     Holders
     ===================================================================== */
  M.stockTab('holders', function (host, ctx) {
    var D = model(ctx), id = ctx.id, it = ctx.it, cur = ctx.cur, nz = ctx.nz, SH = ctx.shares * 1e6;
    function ago(days) { return new Date(ctx.NOW.getTime() - days * DAY); }
    /* insiders hold roughly 0.8 to 4.8 billion US dollars of stock, so the percentage shrinks as the company grows */
    var insPct = clamp((0.8 + (M.hash(id + 'ins') % 400) / 100) * 1e9 / (SH * D.P0 * M.FX[it.c]) * 100, 0.02, 4), instPct = 58 + (M.hash(id + 'inst') % 190) / 10, floatPct = instPct / (1 - insPct / 100);
    var nInst = Math.round(1400 + 3600 * Math.min(1, ctx.K) + M.hash(id + 'ni') % 400), other = 100 - insPct - instPct;
    var Q3 = new Date(2026, 8, 30), Q2 = new Date(2026, 5, 30), JUL = new Date(2026, 6, 31), AUG = new Date(2026, 7, 31);
    function daysTo(d) { return Math.round((ctx.NOW - d) / DAY); }
    function holder(r, k, tag) {
      var pct = r[1] * (1 + nz(id + tag + k) * 0.06), sh = SH * pct / 100;
      return { n: r[0], pct: pct, sh: sh, val: sh * D.priceAgo(daysTo(r[3])), chg: r[2] ? rd(r[2] + nz(id + tag + 'c' + k) * 0.3, 1) : 0, date: r[3] };
    }
    /* 13F filers: two have not yet filed for 30 Sep, the deadline being today */
    var INST = [['Index fund manager A', 8.9, 0.4, Q3], ['Index fund manager B', 7.3, 0.2, Q3], ['Asset manager C', 4.2, -3.1, Q3], ['Custodian bank D', 3.9, 0.6, Q3], ['Asset manager E', 2.4, -6.8, Q3], ['Pension fund F', 1.9, 1.2, Q2],
      ['Sovereign wealth fund G', 1.5, 0, Q3], ['Insurance group H', 1.3, -1.9, Q3], ['Hedge fund I', 1.1, -18.4, Q3], ['Bank trust department J', 0.9, 0.3, Q3], ['Asset manager K', 0.8, 12.6, Q2], ['Quantitative fund L', 0.7, -9.7, Q3]
    ].map(function (r, k) { return holder(r, k, 'ih'); });
    /* funds report on their own fiscal quarters, so report dates differ */
    var FUNDS = [['Total market index fund A', 3.1, 0.3, AUG], ['Large-cap index fund B', 2.4, 0.2, AUG], ['Large-cap index ETF C', 1.2, 0.5, JUL], ['Growth fund D', 1.0, -4.2, Q2], [it.sec + ' sector ETF E', 0.9, 1.1, AUG],
      ['Large-cap growth fund F', 0.7, -7.5, JUL], ['Balanced fund G', 0.5, -0.8, Q2], ['Dividend growth fund H', 0.4, 2.4, AUG], ['Equal-weight index ETF I', 0.4, 6.1, JUL], ['Global equity fund J', 0.3, -11.3, Q2]
    ].map(function (r, k) { return holder(r, k, 'fh'); });
    var late = INST.filter(function (r) { return r.date === Q2; }).length;

    /* insiders, by role only */
    var ROLES = [['Chief Executive', 'Officer and director', 0.42], ['Chief Financial Officer', 'Officer', 0.11], ['Chief Operating Officer', 'Officer', 0.09], ['General Counsel', 'Officer', 0.05],
      ['Senior Vice President, Operations', 'Officer', 0.04], ['Chair of the Board', 'Director', 0.14], ['Independent Director A', 'Director', 0.03], ['Independent Director B', 'Director', 0.02]
    ].map(function (r) { return { n: r[0], rel: r[1], sh: Math.round(SH * insPct / 100 * r[2]) }; });
    var TYPES = { buy: 'Open-market buy', sale: 'Open-market sale', grant: 'Grant', exercise: 'Option exercise', plan: 'Planned sale' };
    var TIPS = { buy: 'Bought in the market at the insider’s own decision', sale: 'Sold in the market at the insider’s own decision', grant: 'Shares awarded as pay', exercise: 'Options converted into shares at their exercise price', plan: 'Sold under a trading plan arranged in advance' };
    /* days ago, insider, type, share of that insider's holding */
    var TXN = [[12, 6, 'buy', 0.06], [46, 0, 'grant', 0.02], [46, 1, 'grant', 0.03], [46, 2, 'grant', 0.03], [75, 5, 'buy', 0.02], [96, 1, 'plan', 0.08], [103, 3, 'exercise', 0.12], [103, 3, 'sale', 0.12], [152, 0, 'plan', 0.03],
      [166, 2, 'plan', 0.06], [187, 4, 'sale', 0.15], [250, 0, 'exercise', 0.04], [250, 0, 'plan', 0.04], [285, 1, 'plan', 0.05], [318, 7, 'grant', 0.06]
    ].map(function (t, k) {
      var who = ROLES[t[1]], sh = Math.max(100, Math.round(who.sh * t[3] / 100) * 100);
      var px = t[2] === 'grant' ? null : t[2] === 'exercise' ? rd(D.P0 * 0.38, 2) : rd(D.priceAgo(t[0]) * (1 + nz(id + 'tx' + k) * 0.006), 2);
      return { date: ago(t[0]), who: who, type: t[2], sh: sh, px: px, val: px == null ? null : sh * px };
    });
    ROLES.forEach(function (r) { r.last = TXN.filter(function (t) { return t.who === r; })[0]; });
    function count(type) { return TXN.filter(function (t) { return t.type === type; }).length; }
    function typeChip(t) { return '<span class="badge tb-ty" data-t="' + t + '" title="' + TIPS[t] + '">' + TYPES[t] + '</span>'; }
    var none = '<span class="dim" title="Awards carry no purchase price">—</span>';

    function holderTable(rows) {
      return '<div class="dt-wrap"><table class="dt" data-sortable><thead><tr><th scope="col" data-sort="text">Holder</th><th scope="col" data-sort="num" aria-sort="descending">Shares</th><th scope="col" data-sort="num">% of shares outstanding</th>' +
        '<th scope="col" data-sort="num">Value</th><th scope="col" data-sort="num">Change on previous quarter</th><th scope="col" data-sort="text">Report date</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + esc(r.n) + '</td><td data-v="' + Math.round(r.sh) + '">' + M.fbig(r.sh) + '</td><td data-v="' + r.pct.toFixed(4) + '">' + r.pct.toFixed(2) + '%</td><td data-v="' + Math.round(r.val) + '">' + cur + M.fbig(r.val) + '</td>' +
            '<td data-v="' + r.chg + '">' + (r.chg ? chg(r.chg, M.fpct(r.chg, 1)) : '<span class="dim">Unchanged</span>') + '</td><td data-v="' + iso(r.date) + '">' + dstr(r.date) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function topShare(rows) { return sum(rows.map(function (r) { return r.pct; })).toFixed(1); }

    host.innerHTML = '<div class="stack">' +
      (D.us ? '' : '<div class="band warn" role="note">' + M.icon('warn') + '<span>' + esc(id) + ' is listed on ' + it.x + '. Holder and insider data for Hong Kong and London listings comes from a vendor feed with thinner coverage than the official US filings; the institutions shown are those that file in the US.</span></div>') +
      '<section class="card reveal"><header class="card-h"><h2>Major holders</h2><div class="card-a"><span class="badge">Report date ' + dstr(Q3) + '</span></div></header>' +
        '<div class="tb-tiles">' +
          tile('Held by insiders', insPct.toFixed(2) + '%', 'Officers and directors') + tile('Held by institutions', instPct.toFixed(1) + '%', 'Of shares outstanding') +
          tile('Float held by institutions', floatPct.toFixed(1) + '%', 'Float excludes insider holdings') + tile('Institutions holding', M.fmt(nInst, 0), 'Filers reporting a position') +
        '</div>' +
        '<div class="tb-own" role="img" aria-label="Ownership split: insiders ' + insPct.toFixed(2) + '%, institutions ' + instPct.toFixed(1) + '%, other holders ' + other.toFixed(1) + '%">' +
          '<i style="--w:' + insPct.toFixed(2) + ';background:var(--data-2)"></i><i style="--w:' + instPct.toFixed(2) + ';background:var(--accent)"></i><i style="--w:' + other.toFixed(2) + ';background:var(--surface-3)"></i></div>' +
        '<div class="lg tb-lg"><span><i class="sq" style="background:var(--data-2)"></i>Insiders ' + insPct.toFixed(2) + '%</span><span><i class="sq" style="background:var(--accent)"></i>Institutions ' + instPct.toFixed(1) + '%</span><span><i class="sq" style="background:var(--surface-3)"></i>Other holders ' + other.toFixed(1) + '%</span></div>' +
        '<p class="tb-note">13F holdings are filed up to 45 days after quarter end, so the positions here can be several weeks old. The deadline for the ' + dstr(Q3) + ' report is today, ' + dstr(ctx.NOW) + '.</p></section>' +

      '<div>' +
        '<div class="tabs tabs-line tb-htabs" role="tablist" aria-label="Holder lists">' +
          [['inst', 'Institutions'], ['funds', 'Funds'], ['roster', 'Insider roster'], ['txn', 'Insider transactions']].map(function (t, k) {
            return '<button class="tab' + (k ? '' : ' is-active') + '" type="button" role="tab" aria-selected="' + (k ? 'false' : 'true') + '" data-v="' + t[0] + '">' + t[1] + '</button>';
          }).join('') + '</div>' +
        '<div class="tb-hpanels">' +
          '<section class="panel is-active" data-v="inst" role="tabpanel" aria-label="Institutions">' +
            '<p class="tb-lead">Top ' + INST.length + ' institutions, holding ' + topShare(INST) + '% of shares outstanding. From 13F filings, which are due up to 45 days after quarter end. ' +
              (late ? late + ' of these holders had not filed for ' + dstr(Q3) + ' when this was collected, so their rows still show ' + dstr(Q2) + '.' : '') + ' Value is at the report date.</p>' +
            holderTable(INST) + '</section>' +
          '<section class="panel" data-v="funds" role="tabpanel" aria-label="Funds">' +
            '<p class="tb-lead">Top ' + FUNDS.length + ' funds, holding ' + topShare(FUNDS) + '% of shares outstanding. From N-PORT filings, which become public 60 days after each fund’s fiscal quarter end, so report dates differ by fund. Value is at the report date.</p>' +
            holderTable(FUNDS) + '</section>' +
          '<section class="panel" data-v="roster" role="tabpanel" aria-label="Insider roster">' +
            '<p class="tb-lead">Officers and directors who report their holdings, shown by role. Together they hold ' + (insPct * 0.9).toFixed(2) + '% of shares outstanding. Value is at the latest close.</p>' +
            '<div class="dt-wrap"><table class="dt" data-sortable><thead><tr><th scope="col" data-sort="text">Insider</th><th scope="col" class="l" data-sort="text">Relationship</th><th scope="col" data-sort="num" aria-sort="descending">Shares held</th><th scope="col" data-sort="num">Value</th>' +
            '<th scope="col" class="l" data-sort="text">Latest transaction</th><th scope="col" data-sort="text">Date</th></tr></thead><tbody>' +
            ROLES.map(function (r) {
              return '<tr><td>' + r.n + '</td><td class="l">' + r.rel + '</td><td data-v="' + r.sh + '">' + M.fmt(r.sh, 0) + '</td><td data-v="' + Math.round(r.sh * D.P0) + '">' + cur + M.fbig(r.sh * D.P0) + '</td>' +
                '<td class="l" data-v="' + TYPES[r.last.type] + '">' + typeChip(r.last.type) + '</td><td data-v="' + iso(r.last.date) + '">' + dstr(r.last.date) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>' +
          '<section class="panel" data-v="txn" role="tabpanel" aria-label="Insider transactions">' +
            '<p class="tb-lead">Last 12 months: ' + count('buy') + ' open-market buys and ' + count('sale') + ' open-market sales, the two types that reflect an insider’s own decision. Also ' + count('plan') + ' planned sales under plans arranged in advance, ' +
              count('grant') + ' grants and ' + count('exercise') + ' option exercises.' + (D.us ? ' Reported on Form 4 within two business days of the trade.' : '') + '</p>' +
            '<div class="dt-wrap"><table class="dt" data-sortable><thead><tr><th scope="col" data-sort="text" aria-sort="descending">Date</th><th scope="col" class="l" data-sort="text">Insider</th><th scope="col" class="l" data-sort="text">Type</th><th scope="col" data-sort="num">Shares</th><th scope="col" data-sort="num">Price</th><th scope="col" data-sort="num">Value</th></tr></thead><tbody>' +
            TXN.map(function (t) {
              return '<tr><td data-v="' + iso(t.date) + '">' + dstr(t.date) + '</td><td class="l">' + t.who.n + '</td><td class="l" data-v="' + TYPES[t.type] + '">' + typeChip(t.type) + '</td><td data-v="' + t.sh + '">' + M.fmt(t.sh, 0) + '</td>' +
                (t.px == null ? '<td class="c" data-v="">' + none + '</td><td class="c" data-v="">' + none + '</td>' : '<td data-v="' + t.px + '">' + M.fmt(t.px) + '</td><td data-v="' + Math.round(t.val) + '">' + cur + M.fbig(t.val) + '</td>') + '</tr>';
            }).join('') + '</tbody></table></div></section>' +
        '</div>' +
      '</div>' +
    '</div>';

    $$('table[data-sortable]', host).forEach(sortable);
    var tabs = M.initTabs($('.tb-htabs', host), function (v, dir) { M.showPanel($('.tb-hpanels', host), v, dir); });
    return { show: function () { tabs.place(false); } };
  });

  /* =====================================================================
     Options (US listings only)
     ===================================================================== */
  M.stockTab('options', function (host, ctx) {
    var D = model(ctx), id = ctx.id, it = ctx.it, cur = ctx.cur;
    if (!D.us) {
      host.innerHTML = '<section class="card"><div class="empty tb-empty">' + M.icon('table') + '<h2 class="t2">Options are not available for this listing</h2>' +
        '<p>' + esc(id) + ' is listed on ' + it.x + '. Market Lens shows option chains for US listings only, so there is no chain, volatility smile or implied move for this stock.</p>' +
        '<button class="btn" type="button" data-goto="earnings">Open earnings</button></div></section>';
      return {};
    }
    var O = D.opt, S = D.P0, dpK = O.step % 1 ? 1 : 0, st = { e: 0, view: 'straddle' };
    function fk(K) { return M.fmt(K, dpK); }
    function chipDate(d) { return d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() === ctx.NOW.getFullYear() ? '' : ' ' + String(d.getFullYear()).slice(2)); }
    function symbol(X, call, K) { var d = X.d; return id.replace(/\W/g, '') + String(d.getFullYear()).slice(2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + (call ? 'C' : 'P') + ('00000000' + Math.round(K * 1000)).slice(-8); }
    var firstEarn = O.EXP.filter(function (x) { return x.earn; })[0];

    host.innerHTML = '<div class="stack">' +
      '<div class="toolbar">' +
        '<div class="chips tb-exp" role="group" aria-label="Expiry">' + O.EXP.map(function (X) {
          return '<button class="chip" type="button" data-e="' + X.e + '" aria-pressed="' + (X.e === st.e) + '" aria-label="' + dstr(X.d) + ', ' + (X.kind === 'M' ? 'monthly' : 'weekly') + ', ' + X.days + ' days away' + (X.earn ? ', after the next earnings report' : '') + '">' +
            chipDate(X.d) + '<small>' + X.kind + (X.earn ? ' · E' : '') + '</small></button>';
        }).join('') + '</div><span class="sp"></span>' +
        '<div class="seg tb-view" role="group" aria-label="Chain view"><button type="button" data-v="list" aria-pressed="false">List</button><button type="button" data-v="straddle" aria-pressed="true">Straddle</button></div>' +
      '</div>' +
      '<div class="tb-ometa"><span class="delay" title="Quotes from this source are delayed by about 15 minutes">' + M.icon('clock', 'ic-sm') + 'Delayed 15 min · as of 16:00</span>' +
        '<span class="badge" title="Option quotes come from an unofficial source until a licensed feed replaces it">Prototype data</span>' +
        '<span>' + esc(id) + ' at ' + cur + M.fmt(S) + '</span><span class="dim">W weekly · M monthly · E expires after the next earnings report on ' + dstr(D.next.date) + '</span></div>' +
      '<div class="split">' +
        '<section class="card reveal"><header class="card-h"><h2 data-t="smile"></h2><div class="card-a"><div class="lg tb-lg"><span><i style="background:var(--accent)"></i>Implied volatility</span><span><i class="dash"></i>Share price</span></div></div></header>' +
          '<div class="plot tb-plot-smile" data-plot="smile"></div>' +
          '<p class="tb-note">Implied volatility at each listed strike. The table below has the figure for every call and put.</p></section>' +
        '<section class="card reveal" aria-live="polite"><header class="card-h"><h2 data-t="stats"></h2></header><div class="tb-tiles tb-ostats" style="--n:2"></div>' +
          '<p class="tb-note">The straddle shows what the market is paying for movement in either direction. It is a market-implied range, not a Market Lens forecast. Ratios cover the strikes shown.</p></section>' +
      '</div>' +
      '<div><div class="tb-chain-h"><h2 class="t3" data-t="chain"></h2><div class="lg tb-lg"><span><i class="sq itm"></i>In the money</span><span><i class="sq atm"></i>Strike nearest the share price</span></div></div>' +
        '<div class="tb-chain-host"></div>' +
        '<p class="tb-note">Sample chain. Prices are computed with Black-Scholes from the smile above (interest rate ' + (O.rate * 100).toFixed(1) + '%, dividend yield ' + (O.dy * 100).toFixed(1) + '%), so calls, puts and volatility agree with one another. ' +
          (firstEarn ? 'Expiries from ' + dstr(firstEarn.d) + ' include the next earnings report, which lifts their implied volatility. ' : '') + 'Change is against the previous close.</p></div>' +
    '</div>';

    /* volatility smile for the chosen expiry: morphs between expiries, nearest strike on hover */
    var smile = (function () {
      var box = $('[data-plot="smile"]', host), cv = M.el('canvas'), tip = M.el('div', 'chart-tip'), N = 49, K0 = O.strikes[0], K1 = O.strikes[O.strikes.length - 1], cur2 = null, anim = null, hov = -1, exp = null;
      cv.setAttribute('role', 'img'); box.appendChild(cv); box.appendChild(tip);
      function sample(T) { var a = []; for (var k = 0; k < N; k++) a.push(O.ivAt(K0 + (K1 - K0) * k / (N - 1), T)); return a; }
      function at(K) { var f = (K - K0) / (K1 - K0) * (N - 1), j = Math.min(N - 2, Math.floor(f)); return cur2[j] + (cur2[j + 1] - cur2[j]) * (f - j); }
      function geo(w) { var iw = w - 46; return { iw: iw, X: function (K) { return 8 + (K - K0) / (K1 - K0) * (iw - 16); } }; }
      function draw() {
        var w = box.clientWidth, h = box.clientHeight; if (!cur2 || !w || !h) return;
        var g = M.fitCanvas(cv, w, h), C = M.COL, G = geo(w), iw = G.iw, X = G.X, pt = 22, pb = 24, ih = h - pt - pb;
        var lo = Math.min.apply(null, cur2), hi = Math.max.apply(null, cur2), pad = (hi - lo) * 0.14 || 0.01; lo -= pad; hi += pad;
        function Y(v) { return pt + (1 - (v - lo) / (hi - lo)) * ih; }
        g.clearRect(0, 0, w, h); g.font = FONT; g.textBaseline = 'middle';
        grid(g, lo, hi, iw, Y, function (v) { return (v * 100).toFixed(hi - lo < 0.08 ? 1 : 0) + '%'; });
        /* strikes along the bottom */
        var every = iw < 300 ? 8 : iw < 520 ? 4 : 2; g.fillStyle = C['text-3']; g.textAlign = 'center';
        O.strikes.forEach(function (K, k) { if (k % every === 0) g.fillText(fk(K), X(K), h - 9); });
        /* share price */
        var sx = Math.round(X(S)) + 0.5;
        g.setLineDash([2, 4]); g.strokeStyle = M.rgba(C['text-2'], 0.6); g.beginPath(); g.moveTo(sx, pt - 6); g.lineTo(sx, pt + ih); g.stroke(); g.setLineDash([]);
        g.fillStyle = C['text-2']; g.fillText(M.fmt(S), sx, 9);
        /* the curve with its fill */
        g.beginPath(); for (var k = 0; k < N; k++) { var x = X(K0 + (K1 - K0) * k / (N - 1)), y = Y(cur2[k]); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
        g.lineWidth = 1.75; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = C.accent; g.stroke();
        g.lineTo(X(K1), pt + ih); g.lineTo(X(K0), pt + ih); g.closePath();
        var fill = g.createLinearGradient(0, pt, 0, pt + ih); fill.addColorStop(0, M.rgba(C.accent, 0.18)); fill.addColorStop(1, M.rgba(C.accent, 0)); g.fillStyle = fill; g.fill();
        /* listed strikes */
        O.strikes.forEach(function (K, k) {
          var on = k === hov;
          g.beginPath(); g.arc(X(K), Y(at(K)), on ? 4.5 : 2.5, 0, 6.3); g.fillStyle = on ? C['surface-1'] : C.accent; g.fill();
          if (on) { g.lineWidth = 2; g.strokeStyle = C.accent; g.stroke(); }
        });
      }
      function label() {
        var ks = O.strikes, n = ks.length - 1;
        cv.setAttribute('aria-label', 'Volatility smile for the ' + dstr(exp.d) + ' expiry. Implied volatility is ' + (at(ks[0]) * 100).toFixed(1) + '% at strike ' + fk(ks[0]) + ', ' + (at(ks[8]) * 100).toFixed(1) + '% at ' + fk(ks[8]) +
          ' nearest the share price, and ' + (at(ks[n]) * 100).toFixed(1) + '% at ' + fk(ks[n]) + '.');
      }
      box.addEventListener('pointermove', function (e) {
        var r = box.getBoundingClientRect(), x = e.clientX - r.left, G = geo(r.width), best = 0;
        O.strikes.forEach(function (K, k) { if (Math.abs(G.X(K) - x) < Math.abs(G.X(O.strikes[best]) - x)) best = k; });
        hov = best; tip.innerHTML = '<span>Strike ' + fk(O.strikes[best]) + '</span><b>' + (at(O.strikes[best]) * 100).toFixed(1) + '%</b>'; tip.classList.add('on');
        var tw = tip.offsetWidth; tip.style.transform = 'translate(' + clamp(G.X(O.strikes[best]) - tw / 2, 0, r.width - tw) + 'px, 0)'; draw();
      });
      box.addEventListener('pointerleave', function () { hov = -1; tip.classList.remove('on'); draw(); });
      new ResizeObserver(draw).observe(box); document.addEventListener('ml:paint', draw);
      return {
        set: function (X, animate) {
          var to = sample(X.T), from = cur2; exp = X; if (anim) anim.cancel();
          if (!from || !animate) { cur2 = to; label(); draw(); return; }
          from = from.slice();
          anim = M.tween(320, function (u) { cur2 = to.map(function (v, k) { return from[k] + (v - from[k]) * u; }); draw(); }, M.easeOut, function () { cur2 = to; label(); draw(); });
        }
      };
    })();

    function cells(o) {
      var c = o.itm ? ' class="itm"' : '';
      return '<td' + c + '>' + M.fmt(o.last) + '</td><td' + c + '>' + chg(o.chg, M.fsign(o.chg)) + '</td><td' + c + '>' + M.fmt(o.bid) + '</td><td' + c + '>' + M.fmt(o.ask) + '</td><td' + c + '>' + M.fmt(o.vol, 0) + '</td><td' + c + '>' + M.fmt(o.oi, 0) + '</td><td' + c + '>' + (o.iv * 100).toFixed(1) + '%</td>';
    }
    var COLS = ['Last', 'Change', 'Bid', 'Ask', 'Volume', 'Open int.', 'Impl. vol.'], FULL = ['Last price', 'Change on the previous close', 'Bid', 'Ask', 'Volume today', 'Open interest', 'Implied volatility'];
    function heads() { return COLS.map(function (c, k) { return '<th scope="col" title="' + FULL[k] + '">' + c + '</th>'; }).join(''); }
    function near(k, ch) { return k === ch.ai ? '<span class="sr"> nearest the share price</span>' : ''; }
    function straddleHTML(ch) {
      return '<div class="dt-wrap tb-chain-wrap" tabindex="0" role="region" aria-label="Option chain for ' + dstr(ch.X.d) + ', scrollable">' +
        '<table class="dt tb-chain"><thead><tr class="tb-grp"><th scope="colgroup" colspan="7">Calls</th><th class="tb-k"></th><th scope="colgroup" colspan="7">Puts</th></tr>' +
        '<tr>' + heads() + '<th scope="col" class="tb-k">Strike</th>' + heads() + '</tr></thead><tbody>' +
        ch.rows.map(function (r, k) { return '<tr' + (k === ch.ai ? ' class="is-atm"' : '') + '>' + cells(r.c) + '<th scope="row" class="tb-k">' + fk(r.K) + near(k, ch) + '</th>' + cells(r.p) + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    function listHTML(ch, call) {
      return '<h3 class="tb-sub-h">' + (call ? 'Calls' : 'Puts') + '</h3><div class="dt-wrap"><table class="dt tb-olist" data-sortable><thead><tr><th scope="col" data-sort="text">Contract</th><th scope="col" data-sort="num" aria-sort="ascending">Strike</th><th scope="col" data-sort="num">Last</th>' +
        '<th scope="col" data-sort="num">Change</th><th scope="col" data-sort="num">% change</th><th scope="col" data-sort="num">Bid</th><th scope="col" data-sort="num">Ask</th><th scope="col" data-sort="num">Volume</th><th scope="col" data-sort="num">Open interest</th><th scope="col" data-sort="num">Implied volatility</th></tr></thead><tbody>' +
        ch.rows.map(function (r, k) {
          var o = call ? r.c : r.p;
          return '<tr class="' + (o.itm ? 'itm' : '') + (k === ch.ai ? ' is-atm' : '') + '"><td class="tb-sym">' + symbol(ch.X, call, r.K) + '</td><td class="tb-k" data-v="' + r.K + '">' + fk(r.K) + near(k, ch) + '</td><td>' + M.fmt(o.last) + '</td><td data-v="' + o.chg + '">' + chg(o.chg, M.fsign(o.chg)) + '</td>' +
            '<td data-v="' + o.pct.toFixed(2) + '">' + chg(o.chg, M.fpct(o.pct, 1)) + '</td><td>' + M.fmt(o.bid) + '</td><td>' + M.fmt(o.ask) + '</td><td data-v="' + o.vol + '">' + M.fmt(o.vol, 0) + '</td><td data-v="' + o.oi + '">' + M.fmt(o.oi, 0) + '</td><td>' + (o.iv * 100).toFixed(1) + '%</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function render(animate) {
      var ch = O.chain(st.e), X = ch.X, K = ch.rows[ch.ai].K, amt = ch.straddle, box = $('.tb-chain-host', host);
      $$('.tb-exp .chip', host).forEach(function (c) { c.setAttribute('aria-pressed', +c.dataset.e === st.e ? 'true' : 'false'); });
      $('[data-t="smile"]', host).textContent = 'Volatility smile · ' + dstr(X.d);
      $('[data-t="stats"]', host).textContent = 'Expiry ' + dstr(X.d) + ' · ' + X.days + ' days';
      $('[data-t="chain"]', host).textContent = (st.view === 'list' ? 'Calls and puts' : 'Option chain') + ' · ' + dstr(X.d);
      $('.tb-ostats', host).innerHTML =
        tile('Move implied by the at-the-money straddle', '±' + ch.movePct.toFixed(1) + '%<small>±' + cur + M.fmt(amt) + '</small>', 'Strike ' + fk(K) + ' call plus put costs ' + M.fmt(amt) + '. Break-even below ' + M.fmt(K - amt) + ' or above ' + M.fmt(K + amt) + ' at expiry.') +
        tile('At-the-money implied volatility', (ch.atm * 100).toFixed(1) + '%', 'Annualised' + (X.earn ? '. Includes the earnings report on ' + dstr(D.next.date) : '')) +
        tile('Put/call open interest', ch.pcOI.toFixed(2), 'Puts ' + M.fmt(ch.pO, 0) + ' · calls ' + M.fmt(ch.cO, 0)) +
        tile('Put/call volume', ch.pcVol.toFixed(2), 'Puts ' + M.fmt(ch.pV, 0) + ' · calls ' + M.fmt(ch.cV, 0));
      box.innerHTML = st.view === 'list' ? listHTML(ch, true) + listHTML(ch, false) : straddleHTML(ch);
      $$('table[data-sortable]', box).forEach(sortable);
      smile.set(X, animate);
    }
    $('.tb-exp', host).addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (!c || +c.dataset.e === st.e) return; st.e = +c.dataset.e; render(true); });
    var seg = M.initSeg($('.tb-view', host), function (v) { st.view = v; render(false); });
    render(false);
    return { show: function () { seg.place(false); } };
  });

  /* =====================================================================
     Earnings
     ===================================================================== */
  M.stockTab('earnings', function (host, ctx) {
    var D = model(ctx), id = ctx.id, it = ctx.it, cur = ctx.cur, dp = D.dpE, H = D.hist, R = ctx.DATA.restated, N = D.next, newest = H.slice().reverse(), cq = D.eps[0];
    function fe(v) { return M.fmt(v, dp); }
    function fr(v) { return M.fbig(v * 1e6); }
    function mins(k) { return 44 + Math.floor(M.rng(M.hash(id + 'dur' + k))() * 22); }

    /* transcript: generic sample wording around the figures already on this page; speakers by role only */
    function transcript(x) {
      var k = x.i, gm = (R.gp.q[k] / R.rev.q[k] * 100).toFixed(1), om = (R.oi.q[k] / R.rev.q[k] * 100).toFixed(1), miss = x.res === 'miss';
      var yoy = x.revYoY == null ? '' : ', ' + (x.revYoY >= 0 ? 'up ' : 'down ') + Math.abs(x.revYoY).toFixed(1) + '% on the same quarter a year earlier';
      return { prep: [
        ['Operator', 'op', ['Sample text. Good afternoon, and welcome to the ' + x.q + ' earnings call for ' + esc(it.n.replace(/\.$/, '')) + '. All lines are in listen-only mode. After the prepared remarks there will be a question-and-answer session. I will now hand over to the Head of Investor Relations.']],
        ['Head of Investor Relations', 'mgmt', ['Sample text. Thank you, operator. With me today are the Chief Executive and the Chief Financial Officer. Some of what is said on this call is forward-looking and subject to the risks set out in the company’s filings. The results release is available on the investor relations website.']],
        ['Chief Executive', 'mgmt', ['Sample text standing in for the Chief Executive’s opening remarks. Revenue for the quarter was ' + fr(x.rev) + yoy + '.',
          'This placeholder paragraph is where management would describe demand across products and regions and what changed during the quarter. It is filler written for the mockup and makes no real claim.',
          miss ? 'A second placeholder paragraph would acknowledge that results came in below what the market expected and set out what management intends to do about it.' : 'A second placeholder paragraph would cover priorities for the coming year: the product roadmap, cost discipline and capital allocation.']],
        ['Chief Financial Officer', 'mgmt', ['Sample text. Diluted earnings per share were ' + fe(x.act) + ', against a consensus estimate of ' + fe(x.est) + '. Gross margin was ' + gm + '% and operating margin was ' + om + '%.',
          'Cash from operations was ' + fr(R.cfo.q[k]) + ' in the quarter. This placeholder sentence is where the balance sheet, buybacks and dividends would be summarised.',
          'This paragraph stands in for the outlook. It is sample text and not guidance. In the real product, any dated and checkable statement made here is recorded as a claim and scored once its deadline passes.']]
      ], qa: [
        ['Operator', 'op', ['Sample text. We will now take questions. The first question comes from an analyst at Firm A.']],
        ['Analyst, Firm A', 'analyst', ['Sample question. Could you say more about how demand developed through the quarter, and whether that trend has continued into the current one?']],
        ['Chief Executive', 'mgmt', ['Sample answer. This placeholder reply would describe order patterns by month and by customer group, without figures that are not in the release.']],
        ['Analyst, Firm B', 'analyst', ['Sample question. Gross margin was ' + gm + '%. How should we think about component and freight costs from here?']],
        ['Chief Financial Officer', 'mgmt', ['Sample answer. A generic reply about input costs, pricing and mix goes here. It is filler, not a statement by the company.']],
        ['Analyst, Firm C', 'analyst', ['Sample question. Can you update us on capital returns, and on how you weigh buybacks against investment?']],
        ['Chief Financial Officer', 'mgmt', ['Sample answer. Placeholder text about the capital allocation framework and the pace of repurchases.']],
        ['Analyst, Firm D', 'analyst', ['Sample question. How concentrated is revenue among your largest customers, and has that changed over the year?']],
        ['Chief Executive', 'mgmt', ['Sample answer. Placeholder text about customer mix. In the real product, a reader could compare this answer with the wording in the latest annual filing.']],
        ['Operator', 'op', ['Sample text. That concludes the question-and-answer session and today’s call. Thank you for joining.']]
      ] };
    }
    var KIND = { op: 'Operator', mgmt: 'Management', analyst: 'Analyst' };
    function turns(list) { return list.map(function (t) { return '<article class="tb-turn" data-k="' + t[1] + '"><header><b>' + t[0] + '</b><span class="micro">' + KIND[t[1]] + '</span></header>' + t[2].map(function (p) { return '<p>' + p + '</p>'; }).join('') + '</article>'; }).join(''); }
    function openCall(x) {
      var t = transcript(x);
      M.sheet(x.q + ' earnings call', '<div class="tb-reader">' +
        '<div class="tb-rd-meta"><span>' + dstr(x.date) + ', after the close</span><span>' + mins(x.i) + ' min</span><span>' + (t.prep.length + t.qa.length) + ' speaker turns</span><span class="badge badge-sample">Sample text</span></div>' +
        '<div class="band" role="note">' + M.icon('doc') + '<span>Sample transcript. The wording is generic placeholder text written for this mockup, not what anyone said. Speakers are shown by role only.</span></div>' +
        '<div class="chips" role="group" aria-label="Jump to a section"><button class="chip" type="button" data-jump="prep">Prepared remarks</button><button class="chip" type="button" data-jump="qa">Questions and answers</button></div>' +
        '<section data-sec="prep"><h3 class="micro">Prepared remarks</h3>' + turns(t.prep) + '</section>' +
        '<section data-sec="qa"><h3 class="micro">Questions and answers</h3>' + turns(t.qa) + '</section>' +
        '</div>', function (sheet) {
        sheet.scrollTop = 0;
        $('.tb-reader', sheet).addEventListener('click', function (e) {
          var b = e.target.closest('[data-jump]'); if (!b) return;
          $('[data-sec="' + b.dataset.jump + '"]', sheet).scrollIntoView({ block: 'start', behavior: M.rm() ? 'auto' : 'smooth' });
        });
      });
    }

    var amt = D.P0 * D.EM / 100;
    var move = D.us
      ? ['Implied move on the report', '±' + D.EM.toFixed(1) + '% <span class="dim">(±' + cur + M.fmt(amt) + ')</span>', 'The implied move is the extra movement priced into options that expire after the report, compared with those that expire before it. It is a market-implied range, not a Market Lens forecast.']
      : ['Average move after a report', '±' + D.avgAbs.toFixed(1) + '% <span class="dim">(±' + cur + M.fmt(D.P0 * D.avgAbs / 100) + ')</span>', 'There are no listed options for this listing, so there is no market-implied move. The figure is the average size of the next-day move after the last ' + H.length + ' reports.'];

    host.innerHTML = '<div class="stack">' +
      '<div class="tb-er-top">' +
        '<section class="card reveal tb-next"><div class="label">Next earnings · ' + N.q + ' results</div>' +
          '<div class="bignum">' + dstr(N.date) + '</div><div class="muted">' + WDAY[N.date.getDay()] + ', after the close</div>' +
          '<div class="tb-days"><b>' + N.days + '</b><span>days away</span></div>' +
          '<dl class="kv"><dt>Consensus EPS <span class="dim">third-party</span></dt><dd>' + fe(cq.avg) + '</dd><dt>Same quarter a year earlier</dt><dd>' + fe(cq.ago) + '</dd><dt>' + move[0] + '</dt><dd>' + move[1] + '</dd></dl>' +
          '<p class="tb-note">' + move[2] + '</p>' +
          '<div class="mod-foot"><button class="linkish" type="button" data-goto="analysis">Estimates</button>' + (D.us ? '<button class="linkish" type="button" data-goto="options">Option chain</button>' : '') + '</div></section>' +
        '<section class="card reveal"><header class="card-h"><h2>EPS: estimate against actual</h2><div class="card-a"><div class="lg tb-lg"><span><i class="ring"></i>Consensus estimate</span><span><i class="dot" style="background:var(--gain)"></i>Actual, beat</span><span><i class="dot" style="background:var(--loss)"></i>Actual, miss</span></div></div></header>' +
          '<div class="plot tb-plot-surp" data-plot="surp"></div>' +
          '<p class="tb-note">Consensus estimates are third-party data. The dashed ring is the estimate for the report on ' + dstr(N.date) + '. The results table below has every figure.</p></section>' +
      '</div>' +

      '<section class="card reveal"><header class="card-h"><h2>Results</h2><div class="card-a"><span class="badge">Last ' + H.length + ' quarters</span></div></header>' +
        '<div class="dt-wrap"><table class="dt" data-sortable><thead><tr><th scope="col" data-sort="num" aria-sort="descending">Quarter</th><th scope="col" data-sort="text">Report date</th><th scope="col" data-sort="num">EPS estimate</th><th scope="col" data-sort="num">EPS actual</th>' +
        '<th scope="col" data-sort="num">Surprise</th><th scope="col" data-sort="num">Revenue</th><th scope="col" data-sort="num">Next-day price move</th></tr></thead><tbody>' +
        newest.map(function (x) {
          return '<tr><td data-v="' + x.i + '">' + x.q + '</td><td data-v="' + iso(x.date) + '">' + dstr(x.date) + '</td><td>' + fe(x.est) + '</td><td>' + fe(x.act) + '</td><td data-v="' + x.surp.toFixed(2) + '">' + chg(x.diff, M.fpct(x.surp, 1)) + '</td>' +
            '<td data-v="' + Math.round(x.rev * 1e6) + '">' + fr(x.rev) + '</td><td data-v="' + x.move.toFixed(2) + '">' + chg(rd(x.move, 1), M.fpct(x.move, 1)) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' +

      '<section class="card reveal"><header class="card-h"><h2>Earnings calls</h2><div class="card-a"><span class="badge">' + H.length + ' transcripts</span></div></header>' +
        '<ul class="tb-calls">' + newest.map(function (x) {
          return '<li><button class="tb-call" type="button" data-i="' + x.i + '" aria-haspopup="dialog">' + M.icon('doc') + '<span class="tb-call-t"><b>' + x.q + ' earnings call</b><span>' + dstr(x.date) + ' · ' + mins(x.i) + ' min · by speaker turn</span></span>' +
            result(x.res) + '<span class="linkish">Read transcript</span>' + M.icon('right', 'ic-sm') + '</button></li>';
        }).join('') + '</ul></section>' +
    '</div>';

    /* surprise chart: the consensus as a ring, the reported figure as a dot in the beat or miss colour */
    var pts = H.concat([{ q: N.q, est: cq.avg, next: true }]);
    plot($('[data-plot="surp"]', host), 'EPS estimate against actual for the last ' + H.length + ' quarters. ' + H.map(function (x) { return x.q + ': estimate ' + fe(x.est) + ', actual ' + fe(x.act) + ', surprise ' + M.fpct(x.surp, 1); }).join('; ') + '. Next report ' + N.q + ': estimate ' + fe(cq.avg) + '.', function (g, w, h, u) {
      var C = M.COL, n = pts.length, pr = 48, pt = 30, pb = 24, iw = w - pr, ih = h - pt - pb, gw = iw / n, r = gw < 44 ? 4 : 5, off = gw < 44 ? 3 : 4, vals = [];
      pts.forEach(function (p) { vals.push(p.est); if (!p.next) vals.push(p.act); });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.2 || 0.1; lo -= pad; hi += pad;
      function Y(v) { return pt + (1 - (v - lo) / (hi - lo)) * ih; }
      g.clearRect(0, 0, w, h); g.font = FONT; g.textBaseline = 'middle';
      grid(g, lo, hi, iw, Y, fe);
      g.textAlign = 'center';
      pts.forEach(function (p, k) {
        var cx = gw * (k + 0.5), ye = Y(p.est);
        g.fillStyle = C['text-3']; g.fillText(gw < 56 ? p.q.slice(0, 2) + ' ' + p.q.slice(-2) : p.q, cx, h - 9);
        if (p.next) {
          g.setLineDash([3, 3]); g.lineWidth = 1.5; g.strokeStyle = C.accent; g.beginPath(); g.arc(cx, ye, r, 0, 6.3); g.stroke(); g.setLineDash([]);
          g.fillStyle = C.accent; g.fillText(gw < 56 ? 'Est.' : 'Estimate', cx, ye - 15); return;
        }
        var t = stagger(u, k, n), ya = ye + (Y(p.act) - ye) * t, col = p.res === 'beat' ? C.gain : p.res === 'miss' ? C.loss : C['text-2'];
        g.lineWidth = 1; g.strokeStyle = M.rgba(C['text-1'], 0.2); g.beginPath(); g.moveTo(cx - off, ye); g.lineTo(cx + off, ya); g.stroke();
        g.beginPath(); g.arc(cx - off, ye, r, 0, 6.3); g.fillStyle = C['surface-1']; g.fill(); g.lineWidth = 1.5; g.strokeStyle = C['text-2']; g.stroke();
        g.beginPath(); g.arc(cx + off, ya, r, 0, 6.3); g.fillStyle = col; g.fill();
        g.globalAlpha = t; g.fillStyle = col; g.fillText((gw < 72 ? '' : WORD[p.res] + ' ') + M.fpct(p.surp, 1), cx, Math.min(ye, ya) - 15); g.globalAlpha = 1;
      });
    });

    $$('table[data-sortable]', host).forEach(sortable);
    $('.tb-calls', host).addEventListener('click', function (e) { var b = e.target.closest('.tb-call'); if (b) openCall(H[+b.dataset.i]); });
    return {};
  });
})();
