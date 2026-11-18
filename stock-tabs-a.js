/* Market Lens mockup: stock page tabs Chart, Statistics, Historical data and Profile. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc;
  var DAY = 864e5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], FONT = '500 11px Inter, system-ui, sans-serif';
  var NEXT_ER = new Date(2027, 0, 29), NEXT_EX = new Date(2027, 1, 9);
  /* calendar days covered by each range, as set in stock.js (1D is one 390-minute session) */
  var SPAN = { '1D': 390 / 1440, '5D': 7, '1M': 30, '6M': 182, 'YTD': 320, '1Y': 365, '5Y': 1826, 'Max': 9500 };

  /* ---------- dates ---------- */
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function sod(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dayDiff(a, b) { return Math.round((sod(a) - sod(b)) / DAY); }
  function isWk(d) { var g = d.getDay(); return g === 0 || g === 6; }
  function fdate(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function p2(v) { return M.fmt(v, 2); }
  function svg(d) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  function download(name, text, type) {
    var a = M.el('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- the sample history shared by the four tabs: events, comparison drift, daily prices ---------- */
  var DRIFT = { '5D': 0.01, '1M': 0.025, '6M': 0.07, 'YTD': 0.11, '1Y': 0.13, '5Y': 0.75, 'Max': 4.6 };
  /* where a comparison series starts, as a multiple of its latest value: seeded, so the chart and the statistics agree */
  function cmpStart(sym, r) {
    var x = I[sym]; if (r === '1D') return x.pc / x.p;
    var u = M.rng(M.hash(sym + ':cmp:' + r))();
    return Math.pow(1 + DRIFT[r], -(x.kind === 'index' ? 0.6 + u * 0.8 : -0.6 + u * 2.6));
  }
  var W = null;
  function world(ctx) {
    if (W) return W;
    var id = ctx.id, it = ctx.it, NOW = ctx.NOW, k, daily = null;
    W = { P: ctx.HI52 / 1.37, earn: [], divs: [], vavg: 55140000 * ctx.K + 5e6, vday: 48210000 * ctx.K + 4e6, index: it.x === 'HKEX' ? 'HSI' : it.x === 'LSE' ? 'FTSE' : 'SPX' };
    /* results every 13 weeks back from the next date; dividends every 13 weeks, raised once a year */
    for (k = 1; k <= 104; k++) W.earn.push(addDays(NEXT_ER, -91 * k));
    for (k = 0; k <= 48; k++) { var a = ctx.div * Math.pow(1.08, -Math.max(0, Math.ceil(k / 4) - 1)); W.divs.push({ t: addDays(NEXT_EX, -91 * k), a: Math.max(0.001, +a.toFixed(a < 0.1 ? 3 : 2)) }); }
    var sd = addDays(NOW, -(760 + M.hash(id + ':split') % 800)); while (sd.getDay() !== 1) sd = addDays(sd, 1);
    W.split = { t: sd, n: [2, 3, 4, 5, 10][M.hash(id + ':ratio') % 5] };
    var ld = addDays(NOW, -9500); while (isWk(ld)) ld = addDays(ld, 1);
    W.listed = ld;
    W.dps = function (a) { return ctx.cur + M.fmt(a, a < 0.1 ? 3 : 2); };

    /* daily bars since listing. The last year follows the 1Y path of the page and is fitted to the 52-week range on Summary */
    W.daily = function () {
      if (daily) return daily;
      var days = [], d = W.listed, end = sod(NOW), i;
      for (; d <= end; d = addDays(d, 1)) if (!isWk(d)) days.push(d);
      var N = days.length, t5 = addDays(NOW, -1826), t1 = addDays(NOW, -365), i5 = 0, i1;
      while (days[i5] < t5) i5++; i1 = i5; while (days[i1] < t1) i1++;
      /* the 1Y path, with its time axis eased so that the high falls on 8 July: the page says the stock peaked in July */
      var P = it.p, y1 = ctx.ranges['1Y']().d, top = y1.indexOf(Math.max.apply(null, y1)), n3 = N - i1, pk = i1, yr = [], q, u, lo;
      while (days[pk] < new Date(2026, 6, 8)) pk++; pk -= i1;
      for (q = 0; q < n3; q++) { u = q <= pk ? q / pk * top : top + (q - pk) / (n3 - 1 - pk) * (y1.length - 1 - top); lo = Math.min(y1.length - 2, Math.floor(u)); yr.push(y1[lo] + (y1[lo + 1] - y1[lo]) * (u - lo)); }
      var mx = Math.max.apply(null, yr), mn = Math.min.apply(null, yr);
      yr = yr.map(function (v) { return v >= P ? (mx > P ? P + (v - P) * (ctx.HI52 - P) / (mx - P) : v) : (mn < P ? P - (P - v) * (P - ctx.LO52) / (P - mn) : v); });
      yr[yr.length - 2] = it.pc; W.hiDate = days[i1 + pk];
      function seg(seed, n, pts, vol) {
        var nz = M.bridge(seed, n, 1, 1, vol), out = [];
        for (var e = 0; e < n; e++) {
          var t = n > 1 ? e / (n - 1) : 1, j = 0; while (j < pts.length - 2 && t > pts[j + 1][0]) j++;
          var a = pts[j], b = pts[j + 1]; out.push(P * (a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0])) * Math.max(0.45, nz[e]));
        }
        return out;
      }
      var c = seg(id + ':h1', i5, [[0, 0.03], [0.45, 0.11], [0.8, 0.3], [1, 0.45]], 0.011).concat(seg(id + ':h2', i1 - i5, [[0, 0.45], [0.55, 0.76], [1, yr[0] / P]], 0.012), yr);
      var rnd = M.rng(M.hash(id + ':daily')), er = {}; W.earn.forEach(function (e) { er[iso(e)] = 1; });
      daily = [];
      for (i = 0; i < N; i++) {
        var pc = i ? c[i - 1] : c[0] * 0.996, o = pc * (1 + (rnd() - 0.5) * 0.008), wk = c[i] * (0.002 + rnd() * 0.009);
        var capH = i === i1 + pk ? ctx.HI52 : ctx.HI52 * 0.9985;   /* only the peak day touches the 52-week high */
        if (i >= i1) o = Math.max(ctx.LO52, Math.min(capH, o));
        var h = Math.max(o, c[i]) + wk * rnd(), l = Math.min(o, c[i]) - wk * rnd();
        if (i >= i1) { h = Math.max(o, c[i], Math.min(h, capH)); l = Math.max(l, ctx.LO52); }
        daily.push({ t: days[i], o: o, h: h, l: l, c: c[i], v: Math.round(W.vavg * (0.55 + rnd() * 0.7) * (1 + Math.min(2.5, Math.abs(c[i] / pc - 1) * 35)) * (er[iso(days[i])] ? 1.9 : 1)) });
      }
      /* the latest day repeats the quote on Summary */
      var z = daily[N - 1]; z.o = it.pc * 1.0018; z.h = Math.max(it.p, it.pc) * 1.005; z.l = Math.min(it.p, it.pc) * 0.994; z.v = Math.round(W.vday);
      /* adjusted close: every earlier close is scaled down by each later dividend */
      var F = 1, j = 0, dv = W.divs.filter(function (x) { return x.t <= end; });
      for (i = N - 1; i >= 0; i--) { while (j < dv.length && days[i] < dv[j].t) { F *= 1 - dv[j].a / c[i]; j++; } daily[i].adj = c[i] * F; }
      return daily;
    };
    return W;
  }

  /* a button that opens a .pop menu beneath it: arrow keys move, Escape or a press outside closes */
  function popMenu(btn, pop) {
    function open(on) {
      pop.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) { var f = $('.mi', pop); if (f) f.focus({ preventScroll: true }); }
    }
    btn.addEventListener('click', function () { open(!pop.classList.contains('open')); });
    pop.addEventListener('keydown', function (e) {
      var mis = $$('.mi', pop), i = mis.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { mis[(i + 1) % mis.length].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { mis[(i + mis.length - 1) % mis.length].focus(); e.preventDefault(); }
      else if (e.key === 'Escape') { open(false); btn.focus(); e.stopPropagation(); }
    });
    pop.addEventListener('focusout', function (e) { if (e.relatedTarget && !pop.contains(e.relatedTarget) && e.relatedTarget !== btn) open(false); });
    document.addEventListener('pointerdown', function (e) { if (pop.classList.contains('open') && !pop.contains(e.target) && !btn.contains(e.target)) open(false); });
    return { open: open };
  }

  /* ---------- indicators, computed from closes ---------- */
  function sma(a, n) { var out = [], s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; out.push(i >= n - 1 ? s / n : null); } return out; }
  /* exponential average seeded with the simple average of the first n values */
  function ema(a, n) {
    var out = [], k = 2 / (n + 1), e = 0, s = 0;
    for (var i = 0; i < a.length; i++) {
      if (i < n) { s += a[i]; e = s / n; out.push(i === n - 1 ? e : null); }
      else { e = a[i] * k + e * (1 - k); out.push(e); }
    }
    return out;
  }
  function boll(a, n, m) {
    var mid = sma(a, n), up = [], dn = [];
    for (var i = 0; i < a.length; i++) {
      if (mid[i] == null) { up.push(null); dn.push(null); continue; }
      var s = 0; for (var j = i - n + 1; j <= i; j++) s += (a[j] - mid[i]) * (a[j] - mid[i]);
      var sdv = Math.sqrt(s / n); up.push(mid[i] + m * sdv); dn.push(mid[i] - m * sdv);
    }
    return { mid: mid, up: up, dn: dn };
  }
  /* Wilder's RSI: simple averages for the first n changes, smoothed after that */
  function rsi(a, n) {
    var out = [null], g = 0, l = 0;
    for (var i = 1; i < a.length; i++) {
      var ch = a[i] - a[i - 1], u = Math.max(ch, 0), d = Math.max(-ch, 0);
      if (i <= n) { g += u; l += d; if (i < n) { out.push(null); continue; } g /= n; l /= n; }
      else { g = (g * (n - 1) + u) / n; l = (l * (n - 1) + d) / n; }
      out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    }
    return out;
  }
  function macd(a) {
    var f = ema(a, 12), s = ema(a, 26), m = [], i, at = 25;
    for (i = 0; i < a.length; i++) m.push(s[i] == null ? null : f[i] - s[i]);
    var sg = ema(m.slice(at), 9), sig = [], h = [];
    for (i = 0; i < a.length; i++) { var v = i < at ? null : sg[i - at]; sig.push(v); h.push(v == null ? null : m[i] - v); }
    return { m: m, s: sig, h: h };
  }

  /* =====================================================================
     Chart: the technical chart, drawn on one canvas
     ===================================================================== */
  M.stockTab('chart', function (host, ctx) {
    var id = ctx.id, it = ctx.it, C = M.COL, wd = world(ctx);
    var RANGES = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'Max'];
    var EVERY = { '1D': '5 minute', '5D': '30 minute', '1M': '1 hour', '6M': '1 day', 'YTD': '1 day', '1Y': '1 day', '5Y': '1 week', 'Max': '1 month' };
    var VPER = { '1D': 1 / 78, '5D': 1 / 13, '1M': 1 / 6.5, '6M': 1, 'YTD': 1, '1Y': 1, '5Y': 5, 'Max': 21 };
    var CVOL = { '1D': 0.0012, '5D': 0.002, '1M': 0.004, '6M': 0.006, 'YTD': 0.007, '1Y': 0.007, '5Y': 0.011, 'Max': 0.016 };
    /* key, label, colour token, 1 when it needs its own pane */
    var IND = [['sma20', 'SMA 20', 'data-2'], ['sma50', 'SMA 50', 'data-3'], ['ema20', 'EMA 20', 'data-4'], ['bb', 'Bollinger 20/2', 'data-6'], ['rsi', 'RSI 14', 'data-3', 1], ['macd', 'MACD 12/26/9', 'data-1', 1]];
    var TOOLS = [['cursor', 'Crosshair', '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>'], ['trend', 'Trend line', '<path d="m6.2 16.9 11.6-9.8"/><circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="6" r="1.6"/>'], ['hline', 'Horizontal line', '<path d="M3 12h7.4M13.6 12H21"/><circle cx="12" cy="12" r="1.6"/>']];
    var SOON = [['Ray', '<path d="M6.3 16.2 20 8"/><circle cx="5" cy="17" r="1.6"/><path d="m16 6.6 4 1.4-1.8 3.8"/>'], ['Rectangle', '<rect x="5" y="7" width="14" height="10" rx="1.5"/>'], ['Fibonacci retracement', '<path d="M4 6h16M4 10.5h16M4 14h16M4 18h16"/>'], ['Measure', '<path d="M4 16 16 4l4 4L8 20zM8.5 11.5l2 2M11.5 8.5l2 2"/>'], ['Text', '<path d="M6 6h12M12 6v13"/>']];
    var CMP = ['SPX', 'IXIC', 'HSI', 'FTSE'].concat(M.LIST.filter(function (x) { return x.id !== id; }).map(function (x) { return x.id; }));
    var st = { range: '1Y', type: 'area', ind: {}, cmp: [], log: false, tool: 'cursor', full: false };
    var D = null, mo = null, xf = null, anim = null, reveal = 1, fillA = 1, shown = false, view = null, pend = null, raf = 0, tipKey = '';
    var hov = { on: false, kb: false, i: 0, x: 0, y: -1, hx: 0, mark: null };
    var draws = [];
    try { var saved = JSON.parse(localStorage.getItem('ml-draw-' + id) || '[]'); if (Array.isArray(saved)) draws = saved.filter(function (d) { return d && (d.k === 'h' ? d.p > 0 : d.k === 't' && d.a && d.b); }); } catch (e) { /* storage unavailable */ }
    function saveDraws() { try { localStorage.setItem('ml-draw-' + id, JSON.stringify(draws)); } catch (e) { /* storage unavailable */ } }
    function nameOf(s) { return I[s].kind === 'index' ? I[s].n : s; }
    function mi(k, label, sub, sw) {
      return '<button class="mi" type="button" role="menuitemcheckbox" aria-checked="false" data-k="' + esc(k) + '"><span class="cx-ck" aria-hidden="true"></span>' +
        (sw ? '<i class="cx-sw" style="background:var(--' + sw + ')" aria-hidden="true"></i>' : '') + '<span>' + esc(label) + (sub ? ' <span class="dim">' + esc(sub) + '</span>' : '') + '</span></button>';
    }

    host.innerHTML =
      '<section class="card cx" id="cx">' +
        '<div class="toolbar cx-bar">' +
          '<div class="seg" id="cx-range" role="group" aria-label="Chart range">' + RANGES.map(function (r) { return '<button type="button" data-v="' + r + '" aria-pressed="' + (r === st.range) + '">' + r + '</button>'; }).join('') + '</div>' +
          '<div class="seg" id="cx-type" role="group" aria-label="Chart type">' + [['line', 'Line'], ['area', 'Area'], ['candles', 'Candles']].map(function (t) { return '<button type="button" data-v="' + t[0] + '" aria-pressed="' + (t[0] === st.type) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
          '<div class="cx-mw"><button class="btn btn-sm" id="cx-ind-b" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="cx-ind">Indicators<span class="cx-n" id="cx-ind-n"></span></button>' +
            '<div class="pop menu cx-pop" id="cx-ind" role="menu" aria-label="Indicators"><div class="pop-h micro">Overlays on the price</div>' + IND.filter(function (x) { return !x[3]; }).map(function (x) { return mi(x[0], x[1], '', x[2]); }).join('') +
            '<div class="pop-h micro">In their own pane</div>' + IND.filter(function (x) { return x[3]; }).map(function (x) { return mi(x[0], x[1], '', x[2]); }).join('') + '</div></div>' +
          '<div class="cx-mw"><button class="btn btn-sm" id="cx-cmp-b" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="cx-cmp">' + M.icon('compare', 'ic-sm') + 'Compare<span class="cx-n" id="cx-cmp-n"></span></button>' +
            '<div class="pop menu cx-pop cx-pop-tall" id="cx-cmp" role="menu" aria-label="Compare with"><div class="pop-h micro">Indexes</div>' + CMP.slice(0, 4).map(function (s) { return mi(s, I[s].n); }).join('') +
            '<div class="pop-h micro">Stocks</div>' + CMP.slice(4).map(function (s) { return mi(s, s, I[s].n); }).join('') + '</div></div>' +
          '<span class="sp"></span>' +
          '<button class="btn btn-sm" id="cx-log" type="button" aria-pressed="false" title="Logarithmic price scale">Log</button>' +
          '<button class="btn btn-sm" id="cx-tbl" type="button" aria-pressed="false" aria-controls="cx-table" title="Show the bars as a table">' + M.icon('table', 'ic-sm') + 'Table</button>' +
          '<button class="btn btn-sm" id="cx-full" type="button" aria-pressed="false">' + M.icon('fit', 'ic-sm') + '<span>Full screen</span></button>' +
        '</div>' +
        '<div class="lg cx-lg" id="cx-lg"></div>' +
        '<div class="cx-body">' +
          '<div class="cx-rail" role="toolbar" aria-label="Drawing tools" aria-orientation="vertical">' +
            TOOLS.map(function (t) { return '<button class="iconbtn" type="button" data-tool="' + t[0] + '" aria-pressed="' + (t[0] === 'cursor') + '" aria-label="' + t[1] + '" title="' + t[1] + '">' + svg(t[2]) + '</button>'; }).join('') +
            '<span class="cx-rule" aria-hidden="true"></span>' +
            SOON.map(function (t) { return '<button class="iconbtn" type="button" disabled aria-label="' + t[0] + ', not part of this mockup" title="' + t[0] + ': not part of this mockup">' + svg(t[1]) + '</button>'; }).join('') +
            '<span class="cx-rule" aria-hidden="true"></span>' +
            '<button class="iconbtn" type="button" id="cx-clear" aria-label="Clear all drawings" title="Clear all drawings">' + svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>') + '</button>' +
          '</div>' +
          '<div class="cx-plot" id="cx-plot" tabindex="0" data-keys role="group" aria-label="Price chart. Left and right arrow keys move the crosshair one bar, Home and End jump to the ends. With a drawing tool selected, Enter places a point at the close.">' +
            '<canvas role="img"></canvas><div class="chart-tip cx-tip"></div><div class="cx-note" role="tooltip"></div></div>' +
        '</div>' +
        '<p class="label cx-foot">Sample data. Markers on the time axis: E results, D ex-dividend, S split. Drawings are saved on this computer for ' + esc(id) + '.</p>' +
        '<div class="sr" aria-live="polite" id="cx-live"></div>' +
        '<div class="dt-wrap cx-table" id="cx-table" tabindex="0" role="region" aria-label="Chart bars as a table" hidden><table class="dt"><thead><tr><th scope="col">Date</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th><th scope="col">Volume</th></tr></thead><tbody></tbody></table></div>' +
      '</section>';

    var box = $('#cx', host), plot = $('#cx-plot', host), cv = $('canvas', plot), tip = $('.cx-tip', plot), note = $('.cx-note', plot), live = $('#cx-live', host), tbl = $('#cx-table', host);

    /* ---------- data ---------- */
    function build(r) {
      var src = ctx.ranges[r](), d = src.d, n = d.length, g = r === '5D' ? 2 : 1, rnd = M.rng(M.hash(id + ':bars:' + r)), bars = [], i, j, rel = 0, m = Math.min(n, 40);
      /* 60 earlier closes, so the indicators are warmed up at the left edge */
      for (i = 1; i < m; i++) rel += Math.abs(d[i] / d[i - 1] - 1);
      var pre = M.bridge(id + ':pre:' + r, 61, d[0] * (1 + ctx.nz(id + ':pre0:' + r) * 0.05), d[0], rel / (m - 1) * 2 || 0.004).slice(0, 60);
      /* bars: each groups g points of the path, opens at the previous close and gets seeded wicks and volume */
      var em = Math.abs(d[0] - pre[59]) || d[0] * 0.002;
      for (i = 0; i < n; i += g) {
        var o = i ? d[i - 1] : pre[59], hi = o, lo = o, c = o;
        for (j = i; j < Math.min(n, i + g); j++) { c = d[j]; hi = Math.max(hi, c); lo = Math.min(lo, c); }
        em = em * 0.8 + Math.abs(c - o) * 0.2;
        hi += em * (0.15 + rnd() * 0.9); lo -= em * (0.15 + rnd() * 0.9);
        bars.push({ o: o, h: hi, l: Math.max(lo, Math.min(o, c) * 0.9), c: c, f: (j - 1) / (n - 1), v: wd.vavg * VPER[r] * (0.55 + rnd() * 0.7) * (1 + Math.min(2.5, Math.abs(c - o) / em * 0.45)) });
      }
      var B = bars.length, vs = 0;
      bars.forEach(function (b, k) {
        if (r === '1D') { var u = (k + 0.5) / B; b.t = src.tip(b.f); b.v *= 0.7 + 1.5 * (2 * u - 1) * (2 * u - 1); vs += b.v; return; }
        var dt = new Date(ctx.NOW.getTime() - (1 - b.f) * SPAN[r] * DAY); while (isWk(dt)) dt = addDays(dt, -1);
        b.t = r === 'Max' ? MON[dt.getMonth()] + ' ' + dt.getFullYear() : fdate(dt);
      });
      /* agree with the quote on Summary: the session's volume and range on 1D, the latest day's bar on the daily ranges */
      var dlo = Math.min(it.p, it.pc) * 0.994, dhi = Math.max(it.p, it.pc) * 1.005, z = bars[B - 1], y = bars[B - 2];
      if (r === '1D') bars.forEach(function (b) { b.v *= wd.vday / vs; b.h = Math.min(b.h, Math.max(dhi, b.o, b.c)); b.l = Math.max(b.l, Math.min(dlo, b.o, b.c)); });
      if (EVERY[r] === '1 day') { y.c = it.pc; y.h = Math.max(y.h, y.c); y.l = Math.min(y.l, y.c); z.o = it.pc * 1.0018; z.h = dhi; z.l = dlo; z.v = wd.vday; }
      /* results, dividends and splits that fall inside the range */
      var ev = [];
      function add(k, t, txt) { var ago = dayDiff(ctx.NOW, t); if (r !== '1D' && ago >= 0 && ago < SPAN[r]) ev.push({ k: k, f: 1 - ago / SPAN[r], t: t, txt: txt }); }
      wd.earn.forEach(function (t) { add('E', t, 'Quarterly results released'); });
      wd.divs.forEach(function (x) { add('D', x.t, 'Ex-dividend, ' + wd.dps(x.a) + ' a share'); });
      add('S', wd.split.t, wd.split.n + '-for-1 share split');
      ev.sort(function (a, b) { return a.f - b.f; });
      return { r: r, bars: bars, B: B, closes: bars.map(function (b) { return b.c; }), pre: pre, first: d[0], base: src.base, labels: ctx.labels(src.tip), ev: ev };
    }
    function compute() {
      var a = D.pre.concat(D.closes), k = D.pre.length, bb = boll(a, 20, 2), mc = macd(a), mm = 0, vmax = 0;
      function cut(x) { return x.slice(k); }
      D.ind = { sma20: cut(sma(a, 20)), sma50: cut(sma(a, 50)), ema20: cut(ema(a, 20)), bbu: cut(bb.up), bbd: cut(bb.dn), bbm: cut(bb.mid), rsi: cut(rsi(a, 14)), macd: cut(mc.m), sig: cut(mc.s), hist: cut(mc.h) };
      ['macd', 'sig', 'hist'].forEach(function (q) { D.ind[q].forEach(function (v) { if (v != null && Math.abs(v) > mm) mm = Math.abs(v); }); });
      D.bars.forEach(function (b) { if (b.v > vmax) vmax = b.v; });
      D.mm = mm || 1; D.vmax = vmax || 1; D.c0 = D.closes[0];
      D.up = D.closes[D.B - 1] >= (D.base != null ? D.base : D.first);
      D.pct = D.closes.map(function (v) { return (v / D.c0 - 1) * 100; });
      /* comparisons: a seeded path for the other symbol, rebased to percent change from the left edge */
      D.cmp = st.cmp.map(function (s, n) {
        var p = M.bridge(s + ':cmpp:' + D.r, D.B, cmpStart(s, D.r), 1, CVOL[D.r] * (I[s].kind === 'index' ? 0.6 : 1));
        return { sym: s, name: nameOf(s), col: 'data-' + (n + 2), pct: p.map(function (v) { return (v / p[0] - 1) * 100; }) };
      });
      D.dom = domain();
    }
    function series() { return [{ sym: id, name: id, col: 'data-1', pct: D.pct }].concat(D.cmp); }
    function domain() {
      var lo = Infinity, hi = -Infinity;
      function eat(v) { if (v == null) return; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (st.cmp.length) { series().forEach(function (s) { s.pct.forEach(eat); }); eat(0); var pp = (hi - lo) * 0.08 || 1; return [lo - pp, hi + pp]; }
      if (st.type === 'candles') D.bars.forEach(function (b) { eat(b.h); eat(b.l); }); else D.closes.forEach(eat);
      if (D.base != null) eat(D.base);
      ['sma20', 'sma50', 'ema20'].forEach(function (k) { if (st.ind[k]) D.ind[k].forEach(eat); });
      if (st.ind.bb) { D.ind.bbu.forEach(eat); D.ind.bbd.forEach(eat); }
      if (st.log) { if (lo <= 0) lo = hi * 1e-3; var q = Math.pow(hi / lo, 0.07) || 1.01; return [lo / q, hi * q]; }
      var pad = (hi - lo) * 0.07 || 1; return [Math.max(0, lo - pad), hi + pad];
    }

    /* ---------- geometry ---------- */
    function lay(w, h) {
      var cmp = st.cmp.length > 0, pr = cmp ? (w < 560 ? 96 : 150) : 58, pt = 30, pb = 40, avail = h - pt - pb, gap = 14, subs = (st.ind.rsi ? 1 : 0) + (st.ind.macd ? 1 : 0);
      var sh = subs ? Math.round(Math.min(120, avail * 0.17)) : 0, mainH = avail - subs * (sh + gap), vh = Math.round(mainH / 5), L = { w: w, h: h, pr: pr, pt: pt, iw: w - pr, ph: mainH - vh - 10, vt: pt + mainH - vh, vh: vh, ay: h - pb }, y = pt + mainH + gap;
      ['rsi', 'macd'].forEach(function (k) { if (st.ind[k]) { L[k] = [y, sh]; y += sh + gap; } });
      return L;
    }
    function scale(dom, top, hgt, log) {
      var a = log ? Math.log(dom[0]) : dom[0], b = log ? Math.log(dom[1]) : dom[1];
      function f(v) { return top + (1 - ((log ? Math.log(v) : v) - a) / (b - a)) * hgt; }
      f.inv = function (y) { var u = a + (1 - (y - top) / hgt) * (b - a); return log ? Math.exp(u) : u; };
      return f;
    }
    function axf(v) { return M.fmt(v, Math.abs(v) < 1000 ? 2 : Math.abs(v) < 10000 ? 1 : 0); }
    function pcf(v) { return M.fpct(v, Math.abs(v) >= 100 ? 0 : 1); }
    /* what the line shows right now, so a range change can start from the middle of a morph */
    function shownLine() {
      if (!mo) return { y: D.closes, dom: D.dom, inset: 0.5 / D.B, up: D.up };
      return { y: mo.a.map(function (v, i) { return v + (mo.b[i] - v) * mo.u; }), dom: [mo.d0[0] + (mo.d1[0] - mo.d0[0]) * mo.u, mo.d0[1] + (mo.d1[1] - mo.d0[1]) * mo.u], inset: mo.i0 + (mo.i1 - mo.i0) * mo.u, up: mo.u > 0.5 ? D.up : mo.up0 };
    }
    function fade(g, w, h, a) { g.save(); g.globalCompositeOperation = 'destination-in'; g.globalAlpha = a; g.fillStyle = C['text-1']; g.fillRect(0, 0, w, h); g.restore(); }
    function tag(g, x, y, txt, bg, fg) {
      var tw = g.measureText(txt).width + 10;
      g.fillStyle = bg; g.beginPath(); if (g.roundRect) g.roundRect(x, y - 9, tw, 18, 4); else g.rect(x, y - 9, tw, 18); g.fill();
      g.fillStyle = fg; g.textAlign = 'left'; g.fillText(txt, x + 5, y + 0.5);
    }

    /* ---------- drawing ---------- */
    function draw() {
      var w = plot.clientWidth, h = plot.clientHeight; if (!w || !h || !D) return;
      var g = M.fitCanvas(cv, w, h), L = lay(w, h), B = D.B, bars = D.bars, step = L.iw / B, cmp = st.cmp.length > 0, candles = st.type === 'candles' && !cmp, bw = Math.max(1, Math.min(14, Math.floor(step * 0.64))), i, k;
      var now = shownLine(), Y = scale(now.dom, L.pt, L.ph, st.log && !cmp), ci = hov.on ? hov.i : B - 1, bot = L.pt + L.ph;
      function X(n) { return (n + 0.5) * step; }
      function XF(f) { return (f * (B - 1) + 0.5) * step; }
      function tf(v) { return cmp ? (v / D.c0 - 1) * 100 : v; }
      function path(arr, Yf) { var pen = false; g.beginPath(); for (var n = 0; n < arr.length; n++) { if (arr[n] == null) { pen = false; continue; } if (pen) g.lineTo(X(n), Yf(arr[n])); else { g.moveTo(X(n), Yf(arr[n])); pen = true; } } }
      function stroke(col, lw, alpha, dash) { g.lineWidth = lw; g.strokeStyle = col; g.globalAlpha = alpha == null ? 1 : alpha; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
      function hline(y, col, dash) { g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(L.iw, Math.round(y) + 0.5); stroke(col, 1, 1, dash); }
      view = { L: L, Y: Y, X: X, XF: XF, step: step, cmp: cmp };
      g.clearRect(0, 0, w, h); g.font = FONT; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round';

      /* time axis and event markers */
      g.fillStyle = C['text-3'];
      D.labels.forEach(function (l) { g.textAlign = l.f < 0.04 ? 'left' : l.f > 0.96 ? 'right' : 'center'; g.fillText(l.t, l.f * L.iw, h - 9); });
      var dense = 91 / SPAN[D.r] * L.iw < 34, lastX = -99; view.marks = [];
      D.ev.forEach(function (e) {
        if (dense && e.k !== 'S') return;
        var x = Math.max(8, Math.min(L.iw - 8, X(Math.round(e.f * (B - 1))))), on = hov.on && hov.mark === e; if (x - lastX < 16) x = lastX + 16; lastX = x;
        view.marks.push({ x: x, e: e });
        g.beginPath(); g.arc(x, L.ay + 12, 7, 0, 6.3); g.fillStyle = C['surface-2']; g.fill(); stroke(on ? C.accent : M.rgba(C['text-1'], 0.24), 1);
        g.font = '600 9px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = on ? C['text-1'] : C['text-2']; g.fillText(e.k, x, L.ay + 12.5); g.font = FONT;
      });

      g.save(); g.beginPath(); g.rect(0, 0, L.iw * reveal + 1, h); g.clip();
      /* volume: one fifth of the main block, 40% opacity */
      for (i = 0; i < B; i++) {
        var vb = bars[i], vhh = Math.max(1, vb.v / D.vmax * (L.vh - 14));
        g.fillStyle = M.rgba(candles ? (vb.c >= vb.o ? C.gain : C.loss) : C['text-2'], 0.4); g.fillRect(Math.round(X(i) - bw / 2), L.vt + L.vh - vhh, bw, vhh);
      }
      g.fillStyle = C['text-3']; g.textAlign = 'left'; g.fillText('Volume ' + M.fbig(bars[ci].v), 0, L.vt + 5);
      /* overlays on the price */
      if (!cmp) {
        g.save(); g.beginPath(); g.rect(0, L.pt - 6, L.iw, L.ph + 12); g.clip();
        if (st.ind.bb) {
          g.beginPath(); for (i = 0; i < B; i++) g.lineTo(X(i), Y(D.ind.bbu[i])); for (i = B - 1; i >= 0; i--) g.lineTo(X(i), Y(D.ind.bbd[i])); g.closePath(); g.fillStyle = M.rgba(C['data-6'], 0.06); g.fill();
          path(D.ind.bbu, Y); stroke(C['data-6'], 1, 0.8); path(D.ind.bbd, Y); stroke(C['data-6'], 1, 0.8); path(D.ind.bbm, Y); stroke(C['data-6'], 1, 0.45, [3, 3]);
        }
        IND.forEach(function (x) { if (!x[3] && x[0] !== 'bb' && st.ind[x[0]]) { path(D.ind[x[0]], Y); stroke(C[x[2]], 1); } });
        g.restore();
      }
      /* RSI pane with its 70 and 30 guides */
      if (L.rsi) {
        var rt = L.rsi[0] + 12, rh = L.rsi[1] - 12, Yr = function (v) { return rt + (1 - v / 100) * rh; };
        [70, 30].forEach(function (v) { hline(Yr(v), M.rgba(C['text-2'], 0.4), [2, 4]); g.fillStyle = C['text-3']; g.textAlign = 'left'; g.fillText(String(v), L.iw + 8, Yr(v)); });
        path(D.ind.rsi, Yr); stroke(C['data-3'], 1);
        g.fillStyle = C['text-3']; g.textAlign = 'left'; g.fillText('RSI 14  ' + D.ind.rsi[ci].toFixed(1), 0, L.rsi[0] + 5);
      }
      /* MACD pane: histogram, MACD line, signal line */
      if (L.macd) {
        var mt = L.macd[0] + 12, mh = L.macd[1] - 12, Ym = function (v) { return mt + (0.5 - v / (2 * D.mm)) * mh; };
        hline(Ym(0), M.rgba(C['text-2'], 0.4), [2, 4]); g.fillStyle = C['text-3']; g.textAlign = 'left'; g.fillText('0', L.iw + 8, Ym(0));
        for (i = 0; i < B; i++) { var hv = D.ind.hist[i]; g.fillStyle = M.rgba(hv >= 0 ? C.gain : C.loss, 0.4); g.fillRect(Math.round(X(i) - bw / 2), Math.min(Ym(0), Ym(hv)), bw, Math.max(1, Math.abs(Ym(hv) - Ym(0)))); }
        path(D.ind.macd, Ym); stroke(C['data-1'], 1); path(D.ind.sig, Ym); stroke(C['data-2'], 1);
        g.fillStyle = C['text-3']; g.textAlign = 'left'; g.fillText('MACD 12/26/9  ' + M.fmt(D.ind.macd[ci], 2) + '   signal ' + M.fmt(D.ind.sig[ci], 2) + '   histogram ' + M.fmt(D.ind.hist[ci], 2), 0, L.macd[0] + 5);
      }
      g.restore();
      /* during a range morph everything above fades in while the line itself moves */
      if (mo) fade(g, w, h, Math.max(0, Math.min(1, mo.u)));

      /* quiet grid: four lines, labels on the right */
      for (k = 0; k < 4; k++) {
        var gy = Math.round(L.pt + L.ph * (k + 0.5) / 4) + 0.5, gv = Y.inv(gy);
        g.strokeStyle = M.rgba(C['text-1'], 0.06); g.lineWidth = 1; g.beginPath(); g.moveTo(0, gy); g.lineTo(L.iw, gy); g.stroke();
        g.fillStyle = C['text-3'];
        if (!cmp) { g.textAlign = 'left'; g.fillText(axf(gv), L.iw + 8, gy); } else if (w >= 560) { g.textAlign = 'right'; g.fillText(pcf(gv), w - 2, gy); }
      }

      g.save(); g.beginPath(); g.rect(0, 0, L.iw * reveal + 1, h); g.clip();
      if (cmp) {
        /* percent change from the left edge, one line per symbol, labelled at its end */
        hline(Y(0), M.rgba(C['text-2'], 0.55), [2, 4]);
        var ends = series().map(function (s) { path(s.pct, Y); stroke(C[s.col], s.sym === id ? 1.75 : 1.5); return { s: s, y: Y(s.pct[B - 1]) }; }).sort(function (a, b) { return a.y - b.y; });
        g.restore(); g.save();
        ends.forEach(function (e, n) { if (n && e.y - ends[n - 1].y < 15) e.y = ends[n - 1].y + 15; });
        ends.forEach(function (e) {
          var nm = w < 560 && e.s.name.length > 6 ? e.s.sym : e.s.name;
          g.textAlign = 'left'; g.fillStyle = C[e.s.col]; g.fillText(nm, L.iw + 8, e.y); g.fillStyle = C['text-2']; g.fillText(pcf(e.s.pct[B - 1]), L.iw + 12 + g.measureText(nm).width, e.y);
        });
      } else if (candles) {
        /* candles: 1 px wicks, bodies in the gain and loss colours */
        for (i = 0; i < B; i++) {
          var b = bars[i], cc = b.c >= b.o ? C.gain : C.loss, x = Math.round(X(i)), y0 = Y(Math.max(b.o, b.c)), y1 = Y(Math.min(b.o, b.c));
          g.fillStyle = cc; g.fillRect(x, Y(b.h), 1, Math.max(1, Y(b.l) - Y(b.h))); g.fillRect(Math.round(X(i) - bw / 2), y0, bw, Math.max(1, y1 - y0));
        }
      } else {
        /* line or area in the gain or loss colour of the visible range */
        var col = now.up ? C.gain : C.loss, ys = now.y, n = ys.length, ins = now.inset * L.iw, x0 = ins, x1 = L.iw - ins;
        if (D.base != null && !mo) hline(Y(D.base), M.rgba(C['text-2'], 0.55), [2, 4]);
        g.beginPath(); for (i = 0; i < n; i++) g.lineTo(x0 + (x1 - x0) * i / (n - 1), Y(ys[i]));
        stroke(col, 1.5);
        if (st.type === 'area') {
          g.lineTo(x1, bot + (1 - fillA) * 8); g.lineTo(x0, bot + (1 - fillA) * 8); g.closePath();
          var gr = g.createLinearGradient(0, L.pt, 0, bot); gr.addColorStop(0, M.rgba(col, 0.18 * fillA)); gr.addColorStop(1, M.rgba(col, 0)); g.fillStyle = gr; g.fill();
        }
        if (reveal >= 1) { g.beginPath(); g.arc(x1, Y(ys[n - 1]), 6, 0, 6.3); g.fillStyle = M.rgba(col, 0.18); g.fill(); g.beginPath(); g.arc(x1, Y(ys[n - 1]), 3, 0, 6.3); g.fillStyle = col; g.fill(); }
      }
      g.restore();
      /* the last price, tagged on the axis */
      if (!cmp && reveal >= 1 && !mo) tag(g, L.iw + 3, Math.max(L.pt, Math.min(bot, Y(D.closes[B - 1]))), axf(D.closes[B - 1]), candles ? (bars[B - 1].c >= bars[B - 1].o ? C.gain : C.loss) : (D.up ? C.gain : C.loss), C.canvas);

      /* drawings: horizontal lines and trend lines, kept as price and days before today */
      g.save(); g.beginPath(); g.rect(0, L.pt - 6, L.iw, L.ph + 12); g.clip();
      function px(p) { return { x: XF(1 - p.t / SPAN[D.r]), y: Y(tf(p.p)) }; }
      var tags = [];
      draws.forEach(function (dr) {
        if (dr.k === 'h') { var hy = Y(tf(dr.p)); if (hy < L.pt - 6 || hy > bot + 6) return; hline(hy, C.accent); tags.push([hy, dr.p]); return; }
        var a = px(dr.a), z = px(dr.b); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(z.x, z.y); stroke(C.accent, 1.5);
        [a, z].forEach(function (q) { g.beginPath(); g.arc(q.x, q.y, 2.5, 0, 6.3); g.fillStyle = C['surface-1']; g.fill(); stroke(C.accent, 1.5); });
      });
      if (pend) {
        var pa = px(pend); g.beginPath(); g.arc(pa.x, pa.y, 2.5, 0, 6.3); g.fillStyle = C.accent; g.fill();
        if (hov.on) { g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(hov.kb ? X(hov.i) : hov.x, hov.kb ? Y(tf(bars[hov.i].c)) : hov.y); stroke(C.accent, 1.5, 0.7, [4, 4]); }
      }
      g.restore();
      tags.forEach(function (t) { tag(g, L.iw + 3, t[0], cmp ? pcf(tf(t[1])) : axf(t[1]), C['surface-3'], C.accent); });

      /* cross-fade from the previous picture (type, indicator, compare and candle range changes) */
      if (xf) { fade(g, w, h, xf.u); g.globalAlpha = 1 - xf.u; g.drawImage(xf.img, 0, 0, w, h); g.globalAlpha = 1; }

      /* crosshair: a hairline on the bar under the pointer, a level line, dots on the lines, and the readout pill */
      if (hov.on && reveal >= 1) {
        var hx = Math.round(hov.hx) + 0.5; g.strokeStyle = M.rgba(C['text-1'], 0.22); g.lineWidth = 1;
        g.beginPath(); g.moveTo(hx, L.pt - 4); g.lineTo(hx, L.ay); g.stroke();
        if (!hov.kb && hov.y >= L.pt && hov.y <= bot) {
          g.beginPath(); g.moveTo(0, Math.round(hov.y) + 0.5); g.lineTo(L.iw, Math.round(hov.y) + 0.5); g.stroke();
          tag(g, L.iw + 3, hov.y, cmp ? pcf(Y.inv(hov.y)) : axf(Y.inv(hov.y)), C['surface-3'], C['text-1']);
        }
        (cmp ? series().map(function (s) { return [s.pct[hov.i], C[s.col]]; }) : candles || mo ? [] : [[bars[hov.i].c, D.up ? C.gain : C.loss]]).forEach(function (q) {
          g.beginPath(); g.arc(X(hov.i), Y(q[0]), 3, 0, 6.3); g.fillStyle = C['surface-1']; g.fill(); stroke(q[1], 2);
        });
        var key = D.r + hov.i + cmp + st.cmp.join() + bars[hov.i].c; if (key !== tipKey) { tipKey = key; tip.innerHTML = tipHTML(hov.i); }
        var tw = tip.offsetWidth; tip.style.transform = 'translate(' + Math.max(0, Math.min(L.iw - tw, hov.hx - tw / 2)) + 'px, 0)';
        if (hov.mark) {
          note.innerHTML = '<b>' + fdate(hov.mark.t) + '</b>' + esc(hov.mark.txt); note.classList.add('on');
          var mx = 0; view.marks.forEach(function (q) { if (q.e === hov.mark) mx = q.x; });
          var nw = note.offsetWidth; note.style.transform = 'translate(' + Math.max(0, Math.min(L.iw - nw, mx - nw / 2)) + 'px, 0)';
        } else note.classList.remove('on');
      }
    }
    function tipHTML(i) {
      var b = D.bars[i], h = '<span>' + esc(b.t) + '</span>';
      if (st.cmp.length) h += series().map(function (s) { return '<i style="color:var(--' + s.col + ')">' + esc(s.name) + '</i><b>' + pcf(s.pct[i]) + '</b>'; }).join('');
      else {
        var pc = i ? D.closes[i - 1] : b.o, ch = (b.c / pc - 1) * 100;
        h += '<i>O</i><b>' + p2(b.o) + '</b><i>H</i><b>' + p2(b.h) + '</b><i>L</i><b>' + p2(b.l) + '</b><i>C</i><b>' + p2(b.c) + '</b><em class="' + (ch >= 0 ? 'up' : 'dn') + '">' + M.fpct(ch) + ' ' + (ch >= 0 ? '▲' : '▼') + '</em>';
      }
      return h + '<i>Vol</i><b>' + M.fbig(b.v) + '</b>';
    }
    function say(i) {
      var b = D.bars[i], e = D.ev.filter(function (x) { return Math.round(x.f * (D.B - 1)) === i; }).map(function (x) { return x.txt; }).join('. ');
      live.textContent = b.t + '. ' + (st.cmp.length ? series().map(function (s) { return s.name + ' ' + pcf(s.pct[i]); }).join(', ') : 'Open ' + p2(b.o) + ', high ' + p2(b.h) + ', low ' + p2(b.l) + ', close ' + p2(b.c)) + ', volume ' + M.fbig(b.v) + '.' + (e ? ' ' + e + '.' : '');
    }

    /* ---------- transitions ---------- */
    function stop() { if (anim) anim.cancel(); anim = null; mo = null; xf = null; reveal = 1; fillA = 1; }
    function snap() {
      if (!D || !cv.width || !cv.height || M.rm()) return null;
      var c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); return c;
    }
    function fadeFrom(shot) {
      if (!shot) { draw(); return; }
      xf = { img: shot, u: 0 };
      anim = M.tween(220, function (u) { if (xf) { xf.u = u; draw(); } }, null, function () { xf = null; anim = null; draw(); });
    }
    /* any change other than a line morph: redraw and cross-fade from the old picture */
    function change(fn) { var shot = snap(); stop(); fn(); compute(); fadeFrom(shot); sync(); }
    function setRange(r) {
      var morph = st.type !== 'candles' && !st.cmp.length && !M.rm(), from = morph ? shownLine() : null, shot = morph ? null : snap();
      stop(); st.range = r; pend = null; hov.mark = null; D = build(r); compute(); hov.i = Math.min(hov.i, D.B - 1); hov.hx = (hov.i + 0.5) * (view ? view.L.iw / D.B : 1);
      if (morph) {
        /* old and new closes resampled to the same positions; values, scale and colour interpolate */
        var N = Math.max(200, D.B);
        mo = { a: M.resample(from.y, N), b: M.resample(D.closes, N), d0: from.dom, d1: D.dom, i0: from.inset, i1: 0.5 / D.B, up0: from.up, u: 0 };
        anim = M.springTo('smooth', function (u) { if (mo) { mo.u = u; draw(); } }, function () { mo = null; anim = null; draw(); });
      } else fadeFrom(shot);
      sync();
    }

    /* ---------- controls ---------- */
    function sync() {
      var cmp = st.cmp.length > 0, nInd = IND.filter(function (x) { return st.ind[x[0]]; }).length, b = D.bars, lo = Infinity, hi = -Infinity, h = '';
      $$('#cx-ind .mi', host).forEach(function (m) { m.setAttribute('aria-checked', st.ind[m.dataset.k] ? 'true' : 'false'); });
      $$('#cx-cmp .mi', host).forEach(function (m) { m.setAttribute('aria-checked', st.cmp.indexOf(m.dataset.k) >= 0 ? 'true' : 'false'); });
      $('#cx-ind-n', host).textContent = nInd || ''; $('#cx-cmp-n', host).textContent = st.cmp.length || '';
      var lg = $('#cx-log', host); lg.setAttribute('aria-pressed', st.log ? 'true' : 'false'); lg.classList.toggle('is-on', st.log && !cmp); lg.disabled = cmp; lg.title = cmp ? 'Percent change is always on a linear scale' : 'Logarithmic price scale';
      $('#cx-clear', host).disabled = !draws.length;
      /* legend: what each line is; comparisons can be removed here */
      if (cmp) {
        h += '<span><i style="background:var(--data-1)"></i>' + esc(id) + '</span>' + D.cmp.map(function (s) { return '<button type="button" class="chip" data-rm="' + esc(s.sym) + '" aria-label="Remove ' + esc(s.name) + ' from the comparison"><i style="background:var(--' + s.col + ')"></i>' + esc(s.name) + M.icon('x') + '</button>'; }).join('') +
          '<span class="dim">Percent change from the left edge of the range' + (IND.some(function (x) { return !x[3] && st.ind[x[0]]; }) ? '. Price overlays are hidden while comparing' : '') + '</span>';
      } else {
        h += '<span><i style="background:var(--' + (D.up ? 'gain' : 'loss') + ')"></i>' + esc(id) + ' · ' + EVERY[D.r] + ' bars</span>' + IND.filter(function (x) { return !x[3] && st.ind[x[0]]; }).map(function (x) { return '<span><i style="background:var(--' + x[2] + ')"></i>' + x[1] + '</span>'; }).join('') + (st.log ? '<span class="dim">Log scale</span>' : '');
      }
      if (st.ind.rsi) h += '<span><i style="background:var(--data-3)"></i>RSI 14</span>';
      if (st.ind.macd) h += '<span><i style="background:var(--data-1)"></i>MACD</span><span><i style="background:var(--data-2)"></i>Signal</span>';
      $('#cx-lg', host).innerHTML = h;
      /* text alternative */
      b.forEach(function (x) { if (x.h > hi) hi = x.h; if (x.l < lo) lo = x.l; });
      cv.setAttribute('aria-label', id + ' price, ' + D.r + ' range, ' + D.B + ' bars of ' + EVERY[D.r] + '. First close ' + p2(D.c0) + ', last close ' + p2(D.closes[D.B - 1]) + ', change ' + M.fpct(D.pct[D.B - 1]) + '. High ' + p2(hi) + ', low ' + p2(lo) + '.' +
        (cmp ? ' Compared with ' + D.cmp.map(function (s) { return s.name + ' ' + pcf(s.pct[D.B - 1]); }).join(', ') + '.' : '') + ' The Table button lists every bar.');
      fillTable(); tipKey = '';
    }
    function fillTable() {
      if (tbl.hidden) return;
      $('tbody', tbl).innerHTML = D.bars.slice().reverse().map(function (b) { return '<tr><td>' + esc(b.t) + '</td><td>' + p2(b.o) + '</td><td>' + p2(b.h) + '</td><td>' + p2(b.l) + '</td><td>' + p2(b.c) + '</td><td>' + M.fmt(b.v, 0) + '</td></tr>'; }).join('');
    }
    var segs = [M.initSeg($('#cx-range', host), setRange), M.initSeg($('#cx-type', host), function (v) { change(function () { st.type = v; }); })];
    var indMenu = popMenu($('#cx-ind-b', host), $('#cx-ind', host)), cmpMenu = popMenu($('#cx-cmp-b', host), $('#cx-cmp', host));
    $('#cx-ind', host).addEventListener('click', function (e) { var b = e.target.closest('.mi'); if (b) change(function () { st.ind[b.dataset.k] = !st.ind[b.dataset.k]; }); });
    $('#cx-cmp', host).addEventListener('click', function (e) {
      var b = e.target.closest('.mi'); if (!b) return; var at = st.cmp.indexOf(b.dataset.k);
      if (at < 0 && st.cmp.length >= 3) { M.toast('Three comparisons at most. Remove one first.'); return; }
      change(function () { if (at >= 0) st.cmp.splice(at, 1); else st.cmp.push(b.dataset.k); });
    });
    $('#cx-lg', host).addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { change(function () { st.cmp.splice(st.cmp.indexOf(b.dataset.rm), 1); }); $('#cx-cmp-b', host).focus(); } });
    $('#cx-log', host).addEventListener('click', function () { change(function () { st.log = !st.log; }); });
    $('#cx-tbl', host).addEventListener('click', function () { tbl.hidden = !tbl.hidden; this.setAttribute('aria-pressed', tbl.hidden ? 'false' : 'true'); this.classList.toggle('is-on', !tbl.hidden); fillTable(); });
    function setFull(on) {
      st.full = on; box.classList.toggle('is-full', on); document.documentElement.classList.toggle('ml-chart-full', on);
      var b = $('#cx-full', host); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('is-on', on); $('span', b).textContent = on ? 'Exit full screen' : 'Full screen';
      segs.forEach(function (s) { s.place(false); }); draw();
    }
    $('#cx-full', host).addEventListener('click', function () { setFull(!st.full); });
    document.addEventListener('keydown', function (e) { if (st.full && (e.key === 'Escape' || e.key === '[' || e.key === ']')) setFull(false); });

    /* drawing tools */
    function setTool(k) {
      st.tool = k; pend = null; plot.classList.toggle('is-tool', k !== 'cursor');
      $$('[data-tool]', host).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tool === k ? 'true' : 'false'); });
    }
    function place(pt) {
      if (st.tool === 'hline') draws.push({ k: 'h', p: pt.p });
      else if (!pend) { pend = pt; live.textContent = 'First point placed at ' + p2(pt.p) + '. Choose the second point.'; draw(); return; }
      else draws.push({ k: 't', a: pend, b: pt });
      live.textContent = (st.tool === 'hline' ? 'Horizontal line placed at ' + p2(pt.p) : 'Trend line placed') + '. ' + draws.length + (draws.length === 1 ? ' drawing' : ' drawings') + ' saved for ' + id + '.';
      saveDraws(); setTool('cursor'); $('#cx-clear', host).disabled = false; draw();
    }
    $('.cx-rail', host).addEventListener('click', function (e) {
      var b = e.target.closest('[data-tool]'); if (b) { setTool(b.dataset.tool); draw(); if (b.dataset.tool !== 'cursor') live.textContent = b.getAttribute('aria-label') + ' selected. Click the chart to place it.'; }
    });
    $('#cx-clear', host).addEventListener('click', function () { var n = draws.length; draws = []; pend = null; saveDraws(); this.disabled = true; draw(); M.toast(n + (n === 1 ? ' drawing' : ' drawings') + ' cleared for ' + id + '.'); });

    /* pointer and keyboard */
    function loop() {
      if (raf) return;
      raf = requestAnimationFrame(function step() {
        raf = 0; if (!hov.on || !view) return;
        var d = view.X(hov.i) - hov.hx; hov.hx += M.rm() ? d : d * 0.4; draw();
        if (Math.abs(view.X(hov.i) - hov.hx) > 0.3) raf = requestAnimationFrame(step);
      });
    }
    function leave() { if (!hov.on) return; hov.on = false; hov.mark = null; tip.classList.remove('on'); note.classList.remove('on'); draw(); }
    function pos(e) { var r = plot.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    plot.addEventListener('pointermove', function (e) {
      if (!view) return; var p = pos(e), L = view.L, best = 11;
      if (p.x > L.iw + 2) { leave(); return; }
      hov.kb = false; hov.x = p.x; hov.y = p.y; hov.i = Math.max(0, Math.min(D.B - 1, Math.floor(p.x / view.step))); hov.mark = null;
      if (p.y > L.ay - 4) view.marks.forEach(function (q) { var dx = Math.abs(q.x - p.x); if (dx < best) { best = dx; hov.mark = q.e; } });
      if (!hov.on) { hov.on = true; hov.hx = view.X(hov.i); tip.classList.add('on'); }
      loop();
    });
    plot.addEventListener('pointerleave', leave);
    plot.addEventListener('click', function (e) {
      if (!view || st.tool === 'cursor') return; var p = pos(e), L = view.L, v;
      if (p.x > L.iw || p.y < L.pt || p.y > L.pt + L.ph) return;
      v = view.Y.inv(p.y); if (view.cmp) v = D.c0 * (1 + v / 100);
      place({ t: +((1 - (p.x / view.step - 0.5) / (D.B - 1)) * SPAN[D.r]).toFixed(4), p: +v.toFixed(4) });
    });
    function stepTo(i) {
      if (!view) return;
      hov.i = Math.max(0, Math.min(D.B - 1, i)); hov.kb = true; hov.mark = null;
      D.ev.forEach(function (x) { if (Math.round(x.f * (D.B - 1)) === hov.i) view.marks.forEach(function (q) { if (q.e === x) hov.mark = x; }); });
      if (!hov.on) { hov.on = true; hov.hx = view.X(hov.i); tip.classList.add('on'); }
      say(hov.i); loop();
    }
    plot.addEventListener('keydown', function (e) {
      var k = e.key, n = e.shiftKey ? 10 : 1, at = hov.on ? hov.i : D.B - 1;
      if (k === 'ArrowLeft') stepTo(hov.on ? at - n : at); else if (k === 'ArrowRight') stepTo(hov.on ? at + n : at); else if (k === 'Home') stepTo(0); else if (k === 'End') stepTo(D.B - 1);
      else if (k === 'Enter' && st.tool !== 'cursor' && hov.on) place({ t: +((1 - hov.i / (D.B - 1)) * SPAN[D.r]).toFixed(4), p: +D.bars[hov.i].c.toFixed(4) });
      else if (k === 'Escape' && (st.tool !== 'cursor' || hov.on)) { if (st.tool !== 'cursor') { setTool('cursor'); draw(); } else leave(); e.stopPropagation(); return; }
      else return;
      e.preventDefault();
    });
    plot.addEventListener('blur', function () { if (hov.kb) leave(); });

    /* ---------- first paint ---------- */
    D = build(st.range); compute(); sync();
    new ResizeObserver(function () { draw(); }).observe(plot);
    document.addEventListener('ml:paint', function () { draw(); });
    M.onTick(function (x) {
      if (x.id !== id || !D || mo) return;
      var b = D.bars[D.B - 1]; b.c = x.p; b.h = Math.max(b.h, x.p); b.l = Math.min(b.l, x.p); D.closes[D.B - 1] = x.p; compute(); tipKey = '';
      if (host.classList.contains('is-active')) draw();
    });
    return { show: function () {
      segs.forEach(function (s) { s.place(false); });
      if (!shown) {
        /* the line draws in from the left and the fill rises, once */
        shown = true;
        if (st.type !== 'candles' && !M.rm() && !M.compact()) { reveal = 0; fillA = 0; anim = M.tween(700, function (u) { reveal = u; fillA = Math.max(0, Math.min(1, (u * 700 - 150) / 500)); draw(); }, M.easeOut, function () { anim = null; }); }
      }
      draw();
    } };
  });

  /* =====================================================================
     Statistics: grouped figures, each with its formula and inputs
     ===================================================================== */
  M.stockTab('statistics', function (host, ctx) {
    var id = ctx.id, it = ctx.it, wd = world(ctx), R = ctx.DATA.restated, P = wd.P, sh = ctx.shares, eps = ctx.eps, cur = ctx.cur, FY = ctx.YEARS[4], PY = ctx.YEARS[3], Q = ctx.QTRS;
    function a(k, y) { return R[k].a[y == null ? 4 : y]; }
    function avg(k) { return (a(k) + a(k, 3)) / 2; }
    /* statement values are in millions */
    function money(v) { return (v < 0 ? '−' : '') + cur + M.fbig(Math.abs(v) * 1e6); }
    function px(v) { return cur + M.fmt(v); }
    function pc(v, dp) { return (v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(dp == null ? 1 : dp) + '%'; }
    function gr(v) { return M.fpct(v * 100, 1); }
    function x(v) { return v.toFixed(2); }
    function mean(arr) { var s = 0; arr.forEach(function (v) { s += v; }); return s / arr.length; }

    var mcap = sh * P, cashAll = a('cash') + a('sec'), ev = mcap + a('debt') - cashAll, ebitda = a('oi') + a('da'), pe = P / eps, fEps = eps / 0.9, grow = (fEps / eps - 1) * 100;
    var rate = a('tax') / a('pti'), nopat = a('oi') * (1 - rate), cap = (a('debt') + a('eq') + a('debt', 3) + a('eq', 3)) / 2;
    var d = wd.daily(), cl = d.map(function (r) { return r.c; }), ma50 = mean(cl.slice(-50)), ma200 = mean(cl.slice(-200));
    var chg52 = P / ctx.ranges['1Y']().d[0] - 1, idx = I[wd.index].n, idxChg = 1 / cmpStart(wd.index, '1Y') - 1, beta = 0.8 + (M.hash(id + 'b') % 70) / 100;
    var closely = sh * (0.004 + (M.hash(id + ':ins') % 30) / 1000), flt = sh - closely, shorts = wd.vavg / 1e6 * (1.2 + (M.hash(id + ':si') % 34) / 10);
    var past = wd.divs.slice(1, 5), ttmDiv = 0, old = wd.divs[21].a, fwd = ctx.div * 4;
    past.forEach(function (p) { ttmDiv += p.a; });
    var qRev = R.rev.q, TP = 'Analyst consensus: third-party data, not a Market Lens forecast.', ST = 'Worked out here from the sample statements (' + FY + ', latest restated).';
    var SP = 'Worked out here from the sample price history.', SX = 'Share counts come from the sample statements; short interest from a sample exchange report.', SD = 'Dividends and splits are company announcements in the sample history.';
    var PRICE = ['Price, close on 16 Nov 2026', px(P)], SHARES = ['Diluted shares', M.fbig(sh * 1e6)], MC = ['Market cap', money(mcap)], EVR = ['Enterprise value', money(ev)];

    /* group: title, caption, where its figures come from, rows. Row: label, value, formula, inputs, its own source note, small tag */
    var GROUPS = [
      ['Valuation', 'At the latest close', ST, [
        ['Market cap', money(mcap), 'Shares outstanding × price', [SHARES, PRICE]],
        ['Enterprise value', money(ev), 'Market cap + total debt − cash and marketable securities', [MC, ['Term debt', money(a('debt'))], ['Cash and marketable securities', money(cashAll)]]],
        ['P/E (trailing)', pe.toFixed(1), 'Price ÷ diluted EPS for the last four quarters', [PRICE, ['Diluted EPS, ' + FY, M.fmt(eps)]]],
        ['P/E (forward)', (pe * 0.9).toFixed(1), 'Price ÷ consensus EPS for the next fiscal year', [PRICE, ['Consensus EPS, next fiscal year', M.fmt(fEps)]], TP, 'third-party'],
        ['PEG ratio', x(pe / grow), 'Trailing P/E ÷ expected EPS growth for the next year, in percent', [['P/E (trailing)', pe.toFixed(1)], ['Expected EPS growth', grow.toFixed(1) + '%']], TP, 'third-party'],
        ['Price to sales', x(mcap / a('rev')), 'Market cap ÷ revenue for the last four quarters', [MC, ['Revenue, ' + FY, money(a('rev'))]]],
        ['Price to book', x(mcap / a('eq')), 'Market cap ÷ shareholders’ equity', [MC, ['Shareholders’ equity, ' + Q[7], money(a('eq'))]]],
        ['EV to revenue', x(ev / a('rev')), 'Enterprise value ÷ revenue for the last four quarters', [EVR, ['Revenue, ' + FY, money(a('rev'))]]],
        ['EV to EBITDA', x(ev / ebitda), 'Enterprise value ÷ (operating income + depreciation and amortisation)', [EVR, ['Operating income, ' + FY, money(a('oi'))], ['Depreciation and amortisation', money(a('da'))]]]
      ]],
      ['Profitability', FY, ST, [
        ['Gross margin', pc(a('gp') / a('rev')), 'Gross profit ÷ revenue', [['Gross profit', money(a('gp'))], ['Revenue', money(a('rev'))]]],
        ['Operating margin', pc(a('oi') / a('rev')), 'Operating income ÷ revenue', [['Operating income', money(a('oi'))], ['Revenue', money(a('rev'))]]],
        ['EBITDA margin', pc(ebitda / a('rev')), '(Operating income + depreciation and amortisation) ÷ revenue', [['EBITDA', money(ebitda)], ['Revenue', money(a('rev'))]]],
        ['Net margin', pc(a('ni') / a('rev')), 'Net income ÷ revenue', [['Net income', money(a('ni'))], ['Revenue', money(a('rev'))]]],
        ['Free cash flow margin', pc(a('fcf') / a('rev')), 'Free cash flow ÷ revenue', [['Free cash flow', money(a('fcf'))], ['Revenue', money(a('rev'))]]]
      ]],
      ['Management effectiveness', 'On average balances', ST, [
        ['Return on equity', pc(a('ni') / avg('eq')), 'Net income ÷ average shareholders’ equity', [['Net income, ' + FY, money(a('ni'))], ['Equity, end of ' + PY, money(a('eq', 3))], ['Equity, end of ' + FY, money(a('eq'))]]],
        ['Return on assets', pc(a('ni') / avg('ta')), 'Net income ÷ average total assets', [['Net income, ' + FY, money(a('ni'))], ['Total assets, end of ' + PY, money(a('ta', 3))], ['Total assets, end of ' + FY, money(a('ta'))]]],
        ['Return on invested capital', pc(nopat / cap), 'Operating income after tax ÷ average (term debt + equity)', [['Operating income, ' + FY, money(a('oi'))], ['Effective tax rate', pc(rate)], ['Average debt + equity', money(cap)]]],
        ['Asset turnover', x(a('rev') / avg('ta')), 'Revenue ÷ average total assets', [['Revenue, ' + FY, money(a('rev'))], ['Average total assets', money(avg('ta'))]]]
      ]],
      ['Share statistics', 'Sample exchange reports', SX, [
        ['Shares outstanding', M.fbig(sh * 1e6), 'Diluted shares at the end of the latest fiscal year', [['Diluted shares, ' + FY, M.fbig(sh * 1e6)], ['Diluted shares, ' + PY, M.fbig(a('sh', 3) * 1e6)]]],
        ['Change in share count', gr(sh / a('sh', 3) - 1), 'Diluted shares this year ÷ last year − 1', [['Diluted shares, ' + FY, M.fbig(sh * 1e6)], ['Diluted shares, ' + PY, M.fbig(a('sh', 3) * 1e6)]]],
        ['Float', M.fbig(flt * 1e6), 'Shares outstanding − closely held shares', [['Shares outstanding', M.fbig(sh * 1e6)], ['Closely held shares', M.fbig(closely * 1e6)]]],
        ['Shares short', M.fbig(shorts * 1e6), 'Reported by the exchange twice a month', [['Settlement date', '30 Oct 2026'], ['Shares short', M.fbig(shorts * 1e6)]]],
        ['Short interest, share of float', pc(shorts / flt, 2), 'Shares short ÷ float', [['Shares short', M.fbig(shorts * 1e6)], ['Float', M.fbig(flt * 1e6)]]],
        ['Days to cover', (shorts * 1e6 / wd.vavg).toFixed(1), 'Shares short ÷ average daily volume', [['Shares short', M.fbig(shorts * 1e6)], ['Average volume, 3 months', M.fbig(wd.vavg)]]]
      ]],
      ['Price history', 'Daily closes', SP, [
        ['Beta (5 years, monthly)', beta.toFixed(2), 'Slope of 60 monthly returns against the local index', [['Index', idx], ['Monthly returns used', '60']]],
        ['52-week high', px(ctx.HI52), 'Highest daily high in the last 52 weeks', [['High', px(ctx.HI52)], ['Reached on', fdate(wd.hiDate)]]],
        ['52-week low', px(ctx.LO52), 'Lowest daily low in the last 52 weeks', [['Low', px(ctx.LO52)]]],
        ['Below the 52-week high', gr(P / ctx.HI52 - 1), 'Price ÷ 52-week high − 1', [PRICE, ['52-week high', px(ctx.HI52)]]],
        ['52-week change', gr(chg52), 'Price ÷ close 52 weeks ago − 1', [PRICE, ['Close 52 weeks ago', px(P / (1 + chg52))]]],
        ['52-week change against the index', M.fsign((chg52 - idxChg) * 100, 1) + ' pts', 'Stock’s 52-week change − the index’s 52-week change', [[it.id, gr(chg52)], [idx, gr(idxChg)]]],
        ['50-day moving average', px(ma50), 'Mean of the last 50 daily closes', [PRICE, ['Price against the average', gr(P / ma50 - 1)]]],
        ['200-day moving average', px(ma200), 'Mean of the last 200 daily closes', [PRICE, ['Price against the average', gr(P / ma200 - 1)]]]
      ]],
      ['Income statement', FY + ', four quarters to ' + Q[7], ST, [
        ['Revenue', money(a('rev')), 'Sum of the last four reported quarters', [4, 5, 6, 7].map(function (q) { return [Q[q], money(qRev[q])]; })],
        ['Revenue per share', px(a('rev') / sh), 'Revenue ÷ diluted shares', [['Revenue', money(a('rev'))], SHARES]],
        ['Revenue growth, year on year', gr(a('rev') / a('rev', 3) - 1), 'Revenue this year ÷ last year − 1', [['Revenue, ' + FY, money(a('rev'))], ['Revenue, ' + PY, money(a('rev', 3))]]],
        ['Revenue growth, latest quarter', gr(qRev[7] / qRev[3] - 1), 'Quarter’s revenue ÷ the same quarter a year earlier − 1', [[Q[7], money(qRev[7])], [Q[3], money(qRev[3])]]],
        ['Gross profit', money(a('gp')), 'Revenue − cost of revenue', [['Revenue', money(a('rev'))], ['Cost of revenue', money(a('cor'))]]],
        ['EBITDA', money(ebitda), 'Operating income + depreciation and amortisation', [['Operating income', money(a('oi'))], ['Depreciation and amortisation', money(a('da'))]]],
        ['Net income', money(a('ni')), 'Income before taxes − income taxes', [['Income before taxes', money(a('pti'))], ['Income taxes', money(a('tax'))]]],
        ['Diluted EPS', M.fmt(eps), 'Net income ÷ diluted shares', [['Net income', money(a('ni'))], SHARES]],
        ['EPS growth, year on year', gr(eps / a('eps', 3) - 1), 'Diluted EPS this year ÷ last year − 1', [['Diluted EPS, ' + FY, M.fmt(eps)], ['Diluted EPS, ' + PY, M.fmt(a('eps', 3))]]]
      ]],
      ['Balance sheet', 'End of ' + Q[7], ST, [
        ['Cash and marketable securities', money(cashAll), 'Cash and equivalents + marketable securities', [['Cash and equivalents', money(a('cash'))], ['Marketable securities', money(a('sec'))]]],
        ['Cash per share', px(cashAll / sh), 'Cash and marketable securities ÷ diluted shares', [['Cash and marketable securities', money(cashAll)], SHARES]],
        ['Total debt', money(a('debt')), 'Term debt on the balance sheet', [['Term debt', money(a('debt'))]]],
        ['Net debt', money(a('debt') - cashAll), 'Total debt − cash and marketable securities. Negative means net cash', [['Total debt', money(a('debt'))], ['Cash and marketable securities', money(cashAll)]]],
        ['Debt to equity', x(a('debt') / a('eq')), 'Total debt ÷ shareholders’ equity', [['Total debt', money(a('debt'))], ['Shareholders’ equity', money(a('eq'))]]],
        ['Liabilities to assets', pc(a('tl') / a('ta')), 'Total liabilities ÷ total assets', [['Total liabilities', money(a('tl'))], ['Total assets', money(a('ta'))]]],
        ['Book value per share', px(a('eq') / sh), 'Shareholders’ equity ÷ diluted shares', [['Shareholders’ equity', money(a('eq'))], SHARES]]
      ]],
      ['Cash flow', FY, ST, [
        ['Cash from operations', money(a('cfo')), 'Net income + non-cash charges + changes in working capital', [['Net income', money(a('ni'))], ['Depreciation and amortisation', money(a('da'))], ['Share-based compensation', money(a('sbc'))], ['Changes in working capital', money(a('wc'))]]],
        ['Capital expenditure', money(a('capex')), 'Purchases of property, plant and equipment', [['Capital expenditure', money(a('capex'))], ['Share of revenue', pc(-a('capex') / a('rev'))]]],
        ['Free cash flow', money(a('fcf')), 'Cash from operations + capital expenditure', [['Cash from operations', money(a('cfo'))], ['Capital expenditure', money(a('capex'))]]],
        ['Free cash flow per share', px(a('fcf') / sh), 'Free cash flow ÷ diluted shares', [['Free cash flow', money(a('fcf'))], SHARES]],
        ['Free cash flow yield', pc(a('fcf') / mcap), 'Free cash flow ÷ market cap', [['Free cash flow', money(a('fcf'))], MC]],
        ['Share repurchases', money(-a('bb')), 'Cash spent buying back shares', [['Share repurchases', money(-a('bb'))], ['Share of free cash flow', pc(-a('bb') / a('fcf'))]]],
        ['Dividends paid', money(-a('div')), 'Cash dividends in the cash flow statement', [['Dividends paid', money(-a('div'))], ['Share of free cash flow', pc(-a('div') / a('fcf'))]]]
      ]],
      ['Dividends and splits', 'Per share', SD, [
        ['Forward annual dividend', px(fwd), 'Latest quarterly dividend × 4', [['Latest quarterly dividend', wd.dps(ctx.div)]]],
        ['Forward yield', pc(fwd / P, 2), 'Forward annual dividend ÷ price', [['Forward annual dividend', px(fwd)], PRICE]],
        ['Trailing annual dividend', px(ttmDiv), 'Sum of the last four dividends by ex-dividend date', past.map(function (p) { return [fdate(p.t), wd.dps(p.a)]; })],
        ['Payout ratio', pc(fwd / eps), 'Forward annual dividend ÷ diluted EPS', [['Forward annual dividend', px(fwd)], ['Diluted EPS, ' + FY, M.fmt(eps)]]],
        ['Dividend growth, 5 years', gr(Math.pow(ctx.div / old, 0.2) - 1) + ' a year', '(Latest quarterly dividend ÷ the one five years earlier) to the power of one fifth − 1', [[fdate(wd.divs[1].t), wd.dps(wd.divs[1].a)], [fdate(wd.divs[21].t), wd.dps(old)]]],
        ['Ex-dividend date', fdate(NEXT_EX), 'Announced by the company. Shares bought on or after this date do not receive the next dividend', [['Next ex-dividend date', fdate(NEXT_EX)], ['Previous ex-dividend date', fdate(wd.divs[1].t)]]],
        ['Last split', wd.split.n + '-for-1', 'Announced by the company. Earlier prices and per-share figures are shown on the new basis', [['Ratio', wd.split.n + ' new shares for each 1 held'], ['Effective', fdate(wd.split.t)]]]
      ]]
    ];
    var FLAT = [];
    function card(g) {
      return '<section class="card reveal"><header class="card-h"><h2>' + g[0] + '</h2><span class="label">' + esc(g[1]) + '</span></header><div class="sx-rows">' + g[3].map(function (s) {
        s[4] = s[4] || g[2]; FLAT.push(s);
        return '<div class="sx-row"><span class="sx-k">' + s[0] + '</span><button class="sx-v" type="button" data-i="' + (FLAT.length - 1) + '" aria-haspopup="dialog" aria-expanded="false" title="Show the formula and inputs">' + s[1] + (s[5] ? '<small>' + s[5] + '</small>' : '') + '</button></div>';
      }).join('') + '</div></section>';
    }
    host.innerHTML = '<div class="sx">' +
      '<div class="band">' + M.icon('doc') + '<span>As of the close on 16 Nov 2026, in ' + esc(it.c) + '. Every figure is worked out from the sample statements and prices on this page, so it agrees with Summary and Financials. Select a figure to see its formula and inputs.</span></div>' +
      '<div class="sx-cols"><div class="stack">' + GROUPS.slice(0, 5).map(card).join('') + '</div><div class="stack">' + GROUPS.slice(5).map(card).join('') + '</div></div>' +
      '<div class="pop sx-pop" id="sx-pop" role="dialog" aria-label="Formula and inputs" tabindex="-1"></div></div>';

    var root = $('.sx', host), pop = $('#sx-pop', host), from = null;
    function close(back) {
      if (!pop.classList.contains('open')) return;
      pop.classList.remove('open'); if (from) { from.setAttribute('aria-expanded', 'false'); if (back) from.focus({ preventScroll: true }); } from = null;
    }
    function open(btn) {
      var s = FLAT[+btn.dataset.i];
      if (from) from.setAttribute('aria-expanded', 'false');
      from = btn; btn.setAttribute('aria-expanded', 'true');
      pop.innerHTML = '<div class="sx-pop-h"><span class="micro">Formula</span><button class="iconbtn" type="button" data-x aria-label="Close">' + M.icon('x', 'ic-sm') + '</button></div>' +
        '<div class="sx-pop-t"><span>' + s[0] + '</span><b>' + s[1] + '</b></div><p class="sx-f">' + s[2] + '</p>' +
        '<div class="micro">Inputs</div><dl class="kv">' + s[3].map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
        '<p class="label">' + s[4] + ' Sample data.</p>';
      pop.classList.add('open');
      /* under the figure, or above it when there is no room below */
      var r = btn.getBoundingClientRect(), o = root.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, top = r.bottom - o.top + 6;
      if (r.bottom + ph + 12 > window.innerHeight && r.top - ph - 6 > 60) top = r.top - o.top - ph - 6;
      pop.style.left = Math.max(0, Math.min(o.width - pw, r.right - o.left - pw)) + 'px'; pop.style.top = top + 'px';
      pop.focus({ preventScroll: true });
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('.sx-v'); if (b) { if (b === from) close(true); else open(b); return; }
      if (e.target.closest('[data-x]')) close(true);
    });
    document.addEventListener('pointerdown', function (e) { if (!e.target.closest('.sx-pop, .sx-v')) close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
    pop.addEventListener('focusout', function (e) { if (e.relatedTarget && !pop.contains(e.relatedTarget) && !e.relatedTarget.classList.contains('sx-v')) close(false); });
    window.addEventListener('resize', function () { close(false); });
    return { show: function () { close(false); } };
  });

  /* =====================================================================
     Historical data: daily, weekly or monthly rows with dividends and splits inline
     ===================================================================== */
  M.stockTab('historical', function (host, ctx) {
    var id = ctx.id, wd = world(ctx), NOW = sod(ctx.NOW), all = wd.daily(), CAP = 500, list = [], counts = {};
    var PRE = [['1M', 30], ['3M', 91], ['6M', 182], ['YTD', 0], ['1Y', 365], ['5Y', 1826], ['Max', -1]];
    var FREQ = { d: ['Daily', 'trading days', 'daily'], w: ['Weekly', 'weeks', 'weekly'], m: ['Monthly', 'months', 'monthly'] };
    var st = { from: addDays(NOW, -365), to: NOW, freq: 'd', show: 'p', pre: '1Y', limit: CAP };
    function seg(idn, label, opts, on) { return '<div class="seg" id="' + idn + '" role="group" aria-label="' + label + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (o[0] === on) + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
    host.innerHTML = '<div class="hx">' +
      '<div class="toolbar hx-bar">' +
        '<div class="chips" id="hx-pre" role="group" aria-label="Date range">' + PRE.map(function (p) { return '<button type="button" class="chip" data-v="' + p[0] + '" aria-pressed="' + (p[0] === st.pre) + '">' + p[0] + '</button>'; }).join('') + '</div>' +
        '<label class="fld hx-date">From<input class="field" type="date" id="hx-from" min="' + iso(wd.listed) + '" max="' + iso(NOW) + '"></label>' +
        '<label class="fld hx-date">To<input class="field" type="date" id="hx-to" min="' + iso(wd.listed) + '" max="' + iso(NOW) + '"></label>' +
        seg('hx-freq', 'Frequency', [['d', 'Daily'], ['w', 'Weekly'], ['m', 'Monthly']], st.freq) +
        seg('hx-show', 'Show', [['p', 'Prices'], ['d', 'Dividends only'], ['s', 'Splits only']], st.show) +
        '<span class="sp"></span>' +
        '<button class="btn btn-sm" id="hx-csv" type="button">' + M.icon('download', 'ic-sm') + 'Download CSV</button>' +
      '</div>' +
      '<p class="label hx-sum" id="hx-sum" role="status"></p>' +
      '<div class="dt-wrap hx-wrap" id="hx-wrap" tabindex="0" role="region" aria-label="Historical data, scrollable"><table class="dt"><thead><tr><th scope="col">Date</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th>' +
        '<th scope="col" title="Adjusted for splits">Close</th><th scope="col" title="Adjusted for splits and dividends">Adj. close</th><th scope="col">Volume</th></tr></thead><tbody id="hx-body"></tbody></table></div>' +
      '<div class="hx-more" id="hx-more"></div>' +
      '<p class="label">Prices in ' + esc(ctx.it.c) + '. Close is adjusted for splits; adjusted close is also adjusted for dividends. Weekly and monthly rows are dated by their first trading day. Sample data.</p>' +
    '</div>';
    var body = $('#hx-body', host), fromEl = $('#hx-from', host), toEl = $('#hx-to', host), wrap = $('#hx-wrap', host);

    function compute() {
      var px = [], ev = [], g = null, i, key;
      if (st.show === 'p') {
        for (i = 0; i < all.length; i++) {
          var r = all[i]; if (r.t < st.from || r.t > st.to) continue;
          key = st.freq === 'd' ? i : st.freq === 'w' ? iso(addDays(r.t, 1 - r.t.getDay())) : r.t.getFullYear() * 12 + r.t.getMonth();
          if (!g || g.key !== key) { g = { key: key, t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, adj: r.adj, v: r.v }; px.push(g); }
          else { g.h = Math.max(g.h, r.h); g.l = Math.min(g.l, r.l); g.c = r.c; g.adj = r.adj; g.v += r.v; }
        }
      }
      if (st.show !== 's') wd.divs.forEach(function (x) { if (x.t >= st.from && x.t <= st.to && x.t <= NOW) ev.push({ t: x.t, ev: 'D', a: x.a }); });
      if (st.show !== 'd' && wd.split.t >= st.from && wd.split.t <= st.to) ev.push({ t: wd.split.t, ev: 'S' });
      counts = { px: px.length, d: ev.filter(function (e) { return e.ev === 'D'; }).length, s: ev.filter(function (e) { return e.ev === 'S'; }).length };
      /* newest first; an event sits above the price row of its own date */
      list = px.concat(ev).sort(function (p, q) { return (q.t - p.t) || ((p.ev ? 0 : 1) - (q.ev ? 0 : 1)); });
    }
    function rowHTML(r) {
      if (r.ev === 'D') return '<tr class="hx-ev"><td>' + fdate(r.t) + '</td><td colspan="6"><span class="badge">Dividend</span>' + wd.dps(r.a) + ' a share, ex-dividend date</td></tr>';
      if (r.ev === 'S') return '<tr class="hx-ev"><td>' + fdate(r.t) + '</td><td colspan="6"><span class="badge badge-accent">Split</span>' + wd.split.n + '-for-1 share split. Earlier prices are shown on the new basis</td></tr>';
      return '<tr><td>' + fdate(r.t) + '</td><td>' + p2(r.o) + '</td><td>' + p2(r.h) + '</td><td>' + p2(r.l) + '</td><td>' + p2(r.c) + '</td><td>' + p2(r.adj) + '</td><td>' + M.fmt(r.v, 0) + '</td></tr>';
    }
    function plural(n, one, many) { return M.fmt(n, 0) + ' ' + (n === 1 ? one : many); }
    function render() {
      var bad = st.from > st.to, n = list.length, parts = [];
      if (st.show === 'p') parts.push(plural(counts.px, FREQ[st.freq][1].replace(/s$/, ''), FREQ[st.freq][1]));
      if (st.show !== 's') parts.push(plural(counts.d, 'dividend', 'dividends'));
      if (st.show !== 'd') parts.push(plural(counts.s, 'split', 'splits'));
      $('#hx-sum', host).textContent = bad ? 'The start date is after the end date.' : fdate(st.from) + ' to ' + fdate(st.to) + ': ' + parts.join(', ') + '.';
      body.innerHTML = n && !bad ? list.slice(0, st.limit).map(rowHTML).join('')
        : '<tr class="hx-ev"><td colspan="7">' + (bad ? 'Choose a start date on or before the end date.' : st.show === 's' ? 'No splits in this period.' : st.show === 'd' ? 'No dividends in this period.' : 'No trading days in this period.') + '</td></tr>';
      /* the mockup renders about 500 rows at a time; the app virtualises the table instead */
      $('#hx-more', host).innerHTML = n > st.limit && !bad ? '<span class="label">Showing the latest ' + M.fmt(st.limit, 0) + ' of ' + M.fmt(n, 0) + ' rows. The CSV has all of them.</span><button class="btn btn-sm" type="button" id="hx-next">Show ' + M.fmt(Math.min(CAP, n - st.limit), 0) + ' more</button>' : '';
      $('#hx-csv', host).disabled = !n || bad;
    }
    function update(keep) { if (!keep) { st.limit = CAP; wrap.scrollTop = 0; } compute(); render(); }
    function setDates() { fromEl.value = iso(st.from); toEl.value = iso(st.to); $$('#hx-pre .chip', host).forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.v === st.pre ? 'true' : 'false'); }); }
    function parse(v) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(v); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; }

    $('#hx-pre', host).addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      var p = PRE.filter(function (x) { return x[0] === c.dataset.v; })[0];
      st.pre = p[0]; st.to = NOW; st.from = p[1] < 0 ? wd.listed : p[1] === 0 ? new Date(NOW.getFullYear(), 0, 1) : addDays(NOW, -p[1]);
      setDates(); update();
    });
    [fromEl, toEl].forEach(function (el) {
      el.addEventListener('change', function () {
        var v = parse(el.value); if (!v) { setDates(); return; }
        if (v < wd.listed) v = wd.listed; if (v > NOW) v = NOW;
        if (el === fromEl) st.from = v; else st.to = v;
        st.pre = ''; setDates(); update();
      });
    });
    var segs = [M.initSeg($('#hx-freq', host), function (v) { st.freq = v; update(); }), M.initSeg($('#hx-show', host), function (v) { st.show = v; update(); })];
    $('#hx-more', host).addEventListener('click', function (e) { if (e.target.closest('#hx-next')) { st.limit += CAP; update(true); } });
    wrap.addEventListener('scroll', function () { wrap.classList.toggle('is-scrolled', wrap.scrollTop > 2); }, { passive: true });
    $('#hx-csv', host).addEventListener('click', function () {
      var lines = ['Date,Open,High,Low,Close,Adj Close,Volume,Event'];
      list.forEach(function (r) {
        lines.push(r.ev ? iso(r.t) + ',,,,,,,' + (r.ev === 'D' ? 'Dividend ' + r.a + ' per share' : 'Split ' + wd.split.n + ' for 1')
          : [iso(r.t), r.o.toFixed(2), r.h.toFixed(2), r.l.toFixed(2), r.c.toFixed(2), r.adj.toFixed(2), r.v, ''].join(','));
      });
      var name = id.replace(/\W/g, '_') + '-' + (st.show === 'p' ? FREQ[st.freq][2] : st.show === 'd' ? 'dividends' : 'splits') + '-' + iso(st.from) + '-to-' + iso(st.to) + '-sample.csv';
      download(name, '﻿' + lines.join('\r\n'), 'text/csv');
      M.toast('Downloaded ' + name + ' (' + M.fmt(list.length, 0) + ' rows, sample data).');
    });
    setDates(); update();
    return { show: function () { segs.forEach(function (s) { s.place(false); }); } };
  });

  /* =====================================================================
     Profile: description, facts, executives, key dates
     ===================================================================== */
  M.stockTab('profile', function (host, ctx) {
    var id = ctx.id, it = ctx.it, wd = world(ctx), cur = ctx.cur, rev = ctx.DATA.restated.rev.a[4];
    function h(s) { return M.hash(id + ':' + s); }
    /* sector-level labels only: nothing here is a fact about the real company */
    var IND = { 'Technology': 'Hardware, software and semiconductors', 'Consumer Staples': 'Food and staples retailing', 'Communication': 'Interactive media and services', 'Financials': 'Banking and insurance', 'Energy': 'Integrated oil and gas', 'Consumer Discretionary': 'Retail and automobiles', 'Health Care': 'Pharmaceuticals and health services', 'Industrials': 'Aerospace, defence and airlines' };
    var staff = Math.round(rev * 1e6 / (1.2e6 + h('rpe') % 1.4e6) / 100) * 100, founded = 1962 + h('founded') % 34;
    var FACTS = [['Sector', esc(it.sec)], ['Industry', IND[it.sec] || 'Diversified'], ['Employees', M.fmt(staff, 0) + '<small>sample</small>'], ['Headquarters', esc(it.cty)], ['Founded', founded + '<small>sample</small>'], ['Fiscal year end', 'September'], ['Exchange', esc(it.x)], ['Trading currency', esc(it.c)]];
    var ROLES = ['Chief Executive Officer', 'Chief Financial Officer', 'Chief Operating Officer', 'Chief Technology Officer', 'General Counsel', 'Head of Investor Relations'];
    var EXEC = ROLES.map(function (r, i) {
      var pay = i === 5 ? null : i === 0 ? 9 + h('pay0') % 160 / 10 : 3 + h('pay' + i) % 60 / 10;
      return [r, 'Executive ' + 'ABCDEF'[i], 2011 + h('since' + i) % 14, pay];
    });
    var toEr = dayDiff(NEXT_ER, ctx.NOW), toEx = dayDiff(NEXT_EX, ctx.NOW);
    var DATES = [
      [fdate(NEXT_ER), 'Next earnings', 'Results for the latest quarter, after the close', 'In ' + toEr + ' days'],
      [fdate(NEXT_EX), 'Ex-dividend date', wd.dps(ctx.div) + ' a share for the quarter', 'In ' + toEx + ' days'],
      [fdate(wd.divs[1].t), 'Previous ex-dividend date', wd.dps(wd.divs[1].a) + ' a share'],
      [fdate(wd.earn[0]), 'Latest results', 'Quarterly results released'],
      ['September', 'Fiscal year end', 'The statements on Financials run to ' + ctx.YEARS[4]],
      [fdate(wd.split.t), 'Last split', wd.split.n + '-for-1'],
      [fdate(wd.listed), 'Listed on ' + esc(it.x), 'Start of the sample price history']
    ];
    host.innerHTML = '<div class="split pfx">' +
      '<div class="stack">' +
        '<section class="card reveal"><header class="card-h"><h2>Business description</h2><span class="badge badge-sample">Placeholder text</span></header>' +
          '<div class="pfx-desc"><p>This is generic sample text. It does not describe the real business of ' + esc(it.n) + ' or of any other company. In the app this section carries the business description from the latest annual filing: what the company sells, who buys it, how it is organised into segments and where it operates.</p>' +
          '<p>For the mockup, ' + esc(id) + ' is treated as a ' + esc(it.sec.toLowerCase()) + ' company based in ' + (/^United/.test(it.cty) ? 'the ' : '') + esc(it.cty) + ', listed on ' + esc(it.x) + ' and quoted in ' + esc(it.c) + '. Its sample statements report two segments, Products and Services, for a fiscal year that ends in September. The description would name the main product lines in each segment, the share of revenue from each, the largest customers and suppliers where the filing discloses them, and the principal competitors.</p>' +
          '<p>A last paragraph would cover how the company makes and distributes what it sells, its main sites, seasonality, and the regulation that matters most to it. Every sentence would link back to the passage in the filing it came from.</p></div></section>' +
        '<section class="card reveal" aria-label="Company facts"><div class="stats">' + FACTS.map(function (f) { return '<div class="stat"><div class="label">' + f[0] + '</div><div class="v">' + f[1] + '</div></div>'; }).join('') + '</div></section>' +
        '<section class="card reveal"><header class="card-h"><h2>Executives</h2><span class="label">Placeholder names. Pay is total compensation for ' + ctx.YEARS[4] + ', sample data</span></header>' +
          '<div class="dt-wrap"><table class="dt" id="pfx-exec"><thead><tr><th scope="col" data-sort="text" tabindex="0">Role</th><th scope="col" class="l" data-sort="text" tabindex="0">Name</th><th scope="col" data-sort="num" tabindex="0">In role since</th><th scope="col" data-sort="num" tabindex="0">Total pay</th></tr></thead><tbody>' +
          EXEC.map(function (e) { return '<tr><td>' + e[0] + '</td><td class="l muted">' + e[1] + '</td><td>' + e[2] + '</td>' + (e[3] == null ? '<td class="c dim" title="Not a named executive officer, so pay is not disclosed">—</td>' : '<td>' + cur + M.fmt(e[3], 1) + 'M</td>') + '</tr>'; }).join('') +
          '</tbody></table></div></section>' +
      '</div>' +
      '<div class="stack">' +
        '<section class="card reveal"><header class="card-h"><h2>Key dates</h2></header><ul class="pfx-dates">' + DATES.map(function (d) {
          return '<li><div class="pfx-when">' + d[0] + '</div><div><b>' + d[1] + '</b>' + (d[3] ? '<span class="badge badge-accent">' + d[3] + '</span>' : '') + '<div class="label">' + d[2] + '</div></div></li>';
        }).join('') + '</ul>' +
          '<div class="pfx-links"><button class="linkish" type="button" data-go="earnings">Earnings</button><button class="linkish" type="button" data-go="historical">Historical data</button><button class="linkish" type="button" data-go="financials">Financials</button></div></section>' +
        '<div class="band">' + M.icon('doc') + '<span>Names of people are placeholders throughout the mockup. Employees, founding year and pay are invented.</span></div>' +
      '</div></div>';
    var tb = $('#pfx-exec', host); M.sortable(tb);
    tb.tHead.addEventListener('keydown', function (e) { var th = e.target.closest('th[data-sort]'); if (th && (e.key === 'Enter' || e.key === ' ')) { th.click(); e.preventDefault(); } });
    host.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) ctx.go(b.dataset.go); });
  });
})();
