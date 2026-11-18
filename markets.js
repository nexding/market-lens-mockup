/* Market Lens mockup: Markets page. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, esc = M.esc;
  M.shell('Markets');
  $('#mk-delay').innerHTML = M.icon('clock', 'ic-sm') + 'Delayed 15 min · as of 16:00';

  var NOW = new Date(2026, 10, 16, 16, 0), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* one daily path of five years per row; these are the points one year, one month, one week ago and at the start of the year */
  var N = 1260, I1Y = 1008, I1M = N - 23, IYTD = N - 222, I7D = N - 8;
  function nz(seed) { return (M.rng(M.hash(seed))() - 0.5) * 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function arrow(up) { return ' <i aria-hidden="true">' + (up ? '▲' : '▼') + '</i>'; }
  function pct(v, dp) { return '<span class="chg bare ' + (v >= 0 ? 'up' : 'dn') + '">' + M.fpct(v, dp) + arrow(v >= 0) + '</span>'; }
  function bp(v) { return '<span class="chg bare ' + (v >= 0 ? 'up' : 'dn') + '">' + M.fsign(v, 1) + ' bp' + arrow(v >= 0) + '</span>'; }
  function dash(why) { return '<span class="dim" title="' + why + '">—</span>'; }

  /* ---------- sample data ---------- */
  /* per asset class: v1 intraday step, vd daily step, m typical one-month move (%), y one-year move [centre, spread] (%),
     a5 five-year start as a multiple of today [centre, spread], s session [first minute, length], tv tick size */
  var CLS = {
    idx: { v1: 0.0009, vd: 0.01, m: 4, y: [13, 9], a5: [0.62, 0.1], s: [570, 390], tv: 1 },
    sec: { v1: 0.0011, vd: 0.012, m: 5, y: [11, 14], a5: [0.64, 0.14], s: [570, 390], tv: 1 },
    fx: { v1: 0.0004, vd: 0.004, m: 1.8, y: [0, 6], a5: [1, 0.1], s: [960, 1440], tv: 0.35 },
    cmd: { v1: 0.0016, vd: 0.014, m: 7, y: [6, 18], a5: [0.74, 0.2], s: [1080, 1380], tv: 1.4 },
    bond: { v1: 0.0012, vd: 0.012, m: 0, y: [0, 0], a5: [0.4, 0], s: [480, 540], tv: 0.8 },
    cry: { v1: 0.003, vd: 0.03, m: 14, y: [35, 45], a5: [0.3, 0.14], s: [960, 1440], tv: 2.2 }
  };
  /* US Treasury curve: today, one month ago, one year ago, today's move in basis points, and the level five years ago as a multiple */
  var TEN = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'],
    TNAME = ['1-Month', '3-Month', '6-Month', '1-Year', '2-Year', '3-Year', '5-Year', '7-Year', '10-Year', '20-Year', '30-Year'],
    Y0 = [3.62, 3.6, 3.58, 3.55, 3.61, 3.68, 3.84, 4.01, 4.184, 4.62, 4.71],
    Y1M = [3.87, 3.84, 3.78, 3.7, 3.69, 3.72, 3.83, 3.97, 4.11, 4.52, 4.6],
    Y1Y = [4.35, 4.3, 4.22, 4.05, 3.82, 3.8, 3.88, 4.02, 4.21, 4.7, 4.78],
    YBP = [-0.2, -0.3, 0.1, 0.6, 1.4, 1.9, 2.4, 2.9, 3.2, 3.5, 3.6],
    Y5 = [0.02, 0.02, 0.03, 0.05, 0.14, 0.23, 0.32, 0.37, 0.38, 0.43, 0.42];
  var BONDS = TEN.map(function (t, i) {
    return { id: 'US' + t, n: 'US ' + TNAME[i], sub: i < 4 ? 'Treasury bill' : i < 9 ? 'Treasury note' : 'Treasury bond', p: Y0[i], pc: Y0[i] - YBP[i] / 100, dp: 3, u: '%', t: i, y1m: Y1M[i], y1y: Y1Y[i], a5: Y5[i] };
  }).concat([
    { id: 'UK10Y', n: 'UK 10-Year', sub: 'Gilt', p: 4.412, pc: 4.391, dp: 3, u: '%', y1m: 4.35, y1y: 4.48, a5: 0.22 },
    { id: 'DE10Y', n: 'Germany 10-Year', sub: 'Bund', p: 2.708, pc: 2.694, dp: 3, u: '%', y1m: 2.66, y1y: 2.39, a5: -0.09 },
    { id: 'JP10Y', n: 'Japan 10-Year', sub: 'Government bond', p: 1.842, pc: 1.848, dp: 3, u: '%', y1m: 1.78, y1y: 1.07, a5: 0.04 },
    { id: 'HK10Y', n: 'Hong Kong 10-Year', sub: 'Government bond', p: 3.521, pc: 3.497, dp: 3, u: '%', y1m: 3.47, y1y: 3.58, a5: 0.42 }
  ]);
  /* rows with no price of their own (SPX, HSI, GOLD and so on) are the live items of ML.STRIP */
  var PAGES = {
    indexes: { cls: 'idx', t: 'US indexes', first: 'Index', cols: ['r52', 'ytd'], rows: [
      { id: 'SPX', sub: 'SPX · large companies', a1: 1 / 1.141 },
      { id: 'IXIC', sub: 'IXIC · Nasdaq Composite' },
      { id: 'DJI', sub: 'DJI · 30 large companies' },
      { id: 'NDX', n: 'Nasdaq 100', sub: 'NDX · large non-financial companies', p: 25480.12, d: 0.58 },
      { id: 'RUT', n: 'Russell 2000', sub: 'RUT · small companies', p: 2512.84, d: -0.21 },
      { id: 'MID', n: 'S&P MidCap 400', sub: 'MID · mid-sized companies', p: 3421.6, d: 0.12 },
      { id: 'ES', sub: 'Futures · December 2026 contract', s: [1080, 1380] },
      { id: 'NQ', n: 'Nasdaq 100 Futures', sub: 'Futures · December 2026 contract', p: 25541.5, d: 0.61, s: [1080, 1380] },
      { id: 'VIX', sub: 'Implied volatility of S&P 500 options', a5: 1.22, a1: 1.08, am: 1.11, vd: 0.03, v1: 0.004 }
    ] },
    sectors: { cls: 'sec', t: 'S&P 500 sectors', first: 'Sector', cols: ['m1', 'ytd', 'wt', 'mine'], heat: true, rows: [
      { id: 'S-TEC', n: 'Technology', p: 5412.3, d: 0.92, w: 31.6, gc: 4, gr: 4 },
      { id: 'S-FIN', n: 'Financials', p: 912.44, d: 0.31, w: 13.4, gc: 3, gr: 2 },
      { id: 'S-HLC', n: 'Health Care', p: 1688.1, d: -0.44, w: 10.8, gc: 3, gr: 2 },
      { id: 'S-CDI', n: 'Consumer Discretionary', tile: 'Consumer Disc.', p: 1842.75, d: -0.18, w: 10.4, gc: 2, gr: 2 },
      { id: 'S-COM', n: 'Communication', p: 398.26, d: 0.52, w: 9.2, gc: 2, gr: 1 },
      { id: 'S-IND', n: 'Industrials', p: 1236.9, d: 0.74, w: 8.3, gc: 2, gr: 1 },
      { id: 'S-STP', n: 'Consumer Staples', tile: 'Staples', p: 861.52, d: -0.61, w: 5.6, gc: 2, gr: 1 },
      { id: 'S-ENE', n: 'Energy', p: 742.18, d: 2.14, w: 3.4, gc: 2, gr: 1 },
      { id: 'S-UTL', n: 'Utilities', p: 431.07, d: -0.22, w: 2.5, gc: 3, gr: 1 },
      { id: 'S-MAT', n: 'Materials', p: 588.63, d: 0.28, w: 2.4, gc: 3, gr: 1 },
      { id: 'S-REA', n: 'Real Estate', p: 262.41, d: -0.95, w: 2.4, gc: 2, gr: 1 }
    ] },
    world: { cls: 'idx', t: 'World markets', first: 'Index', spark: 'Last session', note: 'Chart times are local to each market', cols: ['rg', 'ytd', 'r52'], rows: [
      { id: 'HSI', sub: 'Hong Kong · HKD', rg: 'Asia-Pacific' },
      { id: 'HSCEI', n: 'Hang Seng China Enterprises', sub: 'Hong Kong · HKD', rg: 'Asia-Pacific', p: 9512.6, d: 1.12 },
      { id: 'SSEC', n: 'Shanghai Composite', sub: 'China · CNY', rg: 'Asia-Pacific', p: 3912.45, d: 0.36, s: [570, 330] },
      { id: 'N225', n: 'Nikkei 225', sub: 'Japan · JPY', rg: 'Asia-Pacific', p: 51240.8, d: 0.84, s: [540, 390] },
      { id: 'KS11', n: 'KOSPI', sub: 'South Korea · KRW', rg: 'Asia-Pacific', p: 3984.15, d: 1.31, s: [540, 390] },
      { id: 'TWII', n: 'Taiwan Weighted', sub: 'Taiwan · TWD', rg: 'Asia-Pacific', p: 27640.9, d: 0.95, s: [540, 270] },
      { id: 'AXJO', n: 'S&P/ASX 200', sub: 'Australia · AUD', rg: 'Asia-Pacific', p: 9012.4, d: 0.22, s: [600, 360] },
      { id: 'NSEI', n: 'Nifty 50', sub: 'India · INR', rg: 'Asia-Pacific', p: 26180.55, d: -0.34, s: [555, 375] },
      { id: 'FTSE', sub: 'United Kingdom · GBP', rg: 'Europe', s: [480, 510] },
      { id: 'GDAXI', n: 'DAX', sub: 'Germany · EUR', rg: 'Europe', p: 24318.7, d: -0.27, s: [540, 510] },
      { id: 'FCHI', n: 'CAC 40', sub: 'France · EUR', rg: 'Europe', p: 8104.35, d: -0.11, s: [540, 510] },
      { id: 'SX5E', n: 'Euro Stoxx 50', sub: 'Euro area · EUR', rg: 'Europe', p: 5688.2, d: -0.19, s: [540, 510] },
      { id: 'GSPTSE', n: 'S&P/TSX Composite', sub: 'Canada · CAD', rg: 'Americas', p: 30412.8, d: 0.18 },
      { id: 'BVSP', n: 'Bovespa', sub: 'Brazil · BRL', rg: 'Americas', p: 151220, d: -0.62, dp: 0, s: [600, 420] }
    ] },
    currencies: { cls: 'fx', t: 'Currencies', first: 'Pair', spark: '24 hours', day: 'past 24 hours', cols: ['rday', 'm1', 'ytd'], rows: [
      { id: 'DXY', sub: 'Dollar index against a basket of six currencies' },
      { id: 'EURUSD', n: 'EUR/USD', sub: 'Euro in US dollars', p: 1.1642, d: 0.18, dp: 4 },
      { id: 'GBPUSD', n: 'GBP/USD', sub: 'Pound in US dollars', tag: 1, p: 1.268, d: -0.09, dp: 4 },
      { id: 'USDHKD', n: 'USD/HKD', sub: 'US dollar in Hong Kong dollars · pegged', tag: 1, p: 7.7821, d: 0.01, dp: 4, am: 1.0004, a1: 0.9991, a5: 1.0012, vd: 0.00012, v1: 0.00002, tv: 0.02 },
      { id: 'GBPHKD', n: 'GBP/HKD', sub: 'Pound in Hong Kong dollars', tag: 1, p: 9.8677, d: -0.08, dp: 4 },
      { id: 'USDJPY', n: 'USD/JPY', sub: 'US dollar in yen', p: 148.32, d: 0.24 },
      { id: 'USDCNH', n: 'USD/CNH', sub: 'US dollar in offshore yuan', p: 7.0214, d: -0.12, dp: 4 },
      { id: 'AUDUSD', n: 'AUD/USD', sub: 'Australian dollar in US dollars', p: 0.6712, d: 0.31, dp: 4 },
      { id: 'USDCAD', n: 'USD/CAD', sub: 'US dollar in Canadian dollars', p: 1.3618, d: -0.06, dp: 4 },
      { id: 'USDCHF', n: 'USD/CHF', sub: 'US dollar in Swiss francs', p: 0.7984, d: -0.15, dp: 4 },
      { id: 'EURGBP', n: 'EUR/GBP', sub: 'Euro in pounds', p: 0.9181, d: 0.27, dp: 4 }
    ] },
    commodities: { cls: 'cmd', t: 'Commodities', first: 'Commodity', note: 'Front-month futures', cols: ['grp', 'm1', 'ytd', 'r52'], rows: [
      { id: 'GOLD', sub: 'USD per troy ounce', grp: 'Metals', vd: 0.008 },
      { id: 'SILVER', n: 'Silver', sub: 'USD per troy ounce', grp: 'Metals', p: 46.82, d: 1.24 },
      { id: 'PLAT', n: 'Platinum', sub: 'USD per troy ounce', grp: 'Metals', p: 1412.5, d: -0.42 },
      { id: 'COPPER', n: 'Copper', sub: 'USD per pound', grp: 'Metals', p: 5.124, d: 0.66, dp: 3 },
      { id: 'WTI', sub: 'West Texas Intermediate · USD per barrel', grp: 'Energy' },
      { id: 'BRENT', n: 'Brent Crude', sub: 'North Sea · USD per barrel', grp: 'Energy', p: 75.62, d: 2.31 },
      { id: 'NATGAS', n: 'Natural Gas', sub: 'USD per million British thermal units', grp: 'Energy', p: 3.842, d: -1.92, dp: 3, vd: 0.022 },
      { id: 'CORN', n: 'Corn', sub: 'US cents per bushel', grp: 'Agriculture', p: 452.25, d: 0.44 },
      { id: 'WHEAT', n: 'Wheat', sub: 'US cents per bushel', grp: 'Agriculture', p: 571.5, d: -0.71 }
    ] },
    bonds: { cls: 'bond', t: 'Government bond yields', first: 'Bond', last: 'Yield', chg: 'Change, bp', bp: true, curve: true, def: 'US10Y', cols: ['y1m', 'b1m', 'y1y', 'b1y'], rows: BONDS },
    crypto: { cls: 'cry', t: 'Crypto', first: 'Asset', spark: '24 hours', day: 'past 24 hours', note: 'Trades around the clock · change is over 24 hours', cols: ['d7', 'cap', 'vol'], rows: [
      { id: 'BTC', sub: 'BTC · US dollars', sup: 19.95e6, tn: 0.021 },
      { id: 'ETH', n: 'Ethereum', sub: 'ETH · US dollars', p: 3842.6, d: 2.14, sup: 120.7e6, tn: 0.043 },
      { id: 'SOL', n: 'Solana', sub: 'SOL · US dollars', p: 212.48, d: 3.62, sup: 545e6, tn: 0.052 },
      { id: 'ADA', n: 'Cardano', sub: 'ADA · US dollars', p: 0.8124, d: -1.18, dp: 4, sup: 36.1e9, tn: 0.031 },
      { id: 'DOGE', n: 'Dogecoin', sub: 'DOGE · US dollars', p: 0.2416, d: 0.92, dp: 4, sup: 151e9, tn: 0.048 },
      { id: 'LINK', n: 'Chainlink', sub: 'LINK · US dollars', p: 22.84, d: 1.76, sup: 680e6, tn: 0.039 },
      { id: 'AVAX', n: 'Avalanche', sub: 'AVAX · US dollars', p: 38.92, d: -2.31, sup: 425e6, tn: 0.036 },
      { id: 'LTC', n: 'Litecoin', sub: 'LTC · US dollars', p: 118.36, d: -0.54, sup: 76.4e6, tn: 0.027 }
    ] }
  };
  var KEYS = Object.keys(PAGES).concat('regime');

  /* ---------- rows and their price paths ---------- */
  function mk(s, ck) {
    var it = M.I[s.id] && M.I[s.id].kind === 'index' ? M.I[s.id] : null;
    var r = { id: s.id, x: s, c: CLS[ck], live: !!it, n: s.n || it.n, sub: s.sub || (s.w ? s.w.toFixed(1) + '% of the S&P 500' : ''), dp: it ? it.dp : (s.dp == null ? 2 : s.dp) };
    r.p = it ? it.p : s.p;
    r.pc = it ? it.pc : (s.pc != null ? s.pc : s.p / (1 + s.d / 100));
    if (s.y1m) { s.am = s.y1m / r.p; s.a1 = s.y1y / r.p; }
    return r;
  }
  function dayPct(r) { return (r.p - r.pc) / Math.abs(r.pc) * 100; }
  function f(r, v) { return M.fmt(v, r.dp) + (r.x.u || ''); }
  function day(r) { if (!r.d1) r.d1 = M.bridge(r.id + ':1d', 79, r.pc, r.p, r.x.v1 || r.c.v1); return r.d1; }
  /* five years of daily values through fixed points five years, one year and one month ago, with noise that is zero at each of them */
  function master(r) {
    if (r.m) return r.m;
    var s = r.x, c = r.c, out = [], j, k;
    var am = s.am != null ? s.am : 1 / (1 + nz(r.id + 'm') * c.m / 100);
    var a1 = s.a1 != null ? s.a1 : 1 / (1 + (c.y[0] + nz(r.id + 'y') * c.y[1]) / 100);
    var a5 = s.a5 != null ? s.a5 : c.a5[0] + nz(r.id + '5') * c.a5[1];
    var pts = [[0, a5], [I1Y, a1], [I1M, am], [N - 1, 1]];
    for (j = 0; j < 3; j++) {
      var a = pts[j], b = pts[j + 1], len = b[0] - a[0] + 1, noise = M.bridge(r.id + ':m' + j, len, 1, 1, s.vd || c.vd);
      for (k = j ? 1 : 0; k < len; k++) out.push(r.p * (a[1] + (b[1] - a[1]) * k / (len - 1)) * Math.max(0.35, noise[k]));
    }
    r.m = out; return out;
  }
  function stats(r) {
    if (r.st) return r.st;
    var m = master(r), y = m.slice(I1Y), d = day(r);
    r.st = { p1m: m[I1M], p1y: m[I1Y], m1: (r.p / m[I1M] - 1) * 100, y1: (r.p / m[I1Y] - 1) * 100, ytd: (r.p / m[IYTD] - 1) * 100, d7: (r.p / m[I7D] - 1) * 100,
      lo: Math.min.apply(null, y), hi: Math.max.apply(null, y), dlo: Math.min.apply(null, d), dhi: Math.max.apply(null, d) };
    return r.st;
  }
  function spanTip(days, long) {
    return function (x) { var d = new Date(NOW.getTime() - (1 - x) * days * 864e5); return long ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()]; };
  }
  function dayTip(r) {
    var s = r.x.s || r.c.s;
    return function (x) { var m = (s[0] + Math.round(x * s[1])) % 1440; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); };
  }
  function rangeData(r, k) {
    if (k === '1D') return { d: day(r), base: r.pc, tip: dayTip(r), from: 'Previous close', word: 'today' };
    var m = master(r), d, o;
    if (k === '1M') {
      var z = M.bridge(r.id + ':f', 140, 1, 1, (r.x.vd || r.c.vd) * 0.25);
      d = M.resample(m.slice(I1M), 140).map(function (v, i) { return v * z[i]; });
      o = { tip: spanTip(30), from: '1 month ago', word: 'over 1 month' };
    } else if (k === '1Y') { d = m.slice(I1Y); o = { tip: spanTip(365, true), from: '1 year ago', word: 'over 1 year' }; }
    else { d = m.slice(); o = { tip: spanTip(1826, true), from: '5 years ago', word: 'over 5 years' }; }
    d[d.length - 1] = r.p; o.d = d; return o;
  }
  function axisFmt(r) {
    return function (v) { var a = Math.abs(v); return M.fmt(v, r.dp > 2 ? r.dp : r.dp === 0 || a >= 1000 ? 0 : a >= 100 ? 1 : 2) + (r.x.u || ''); };
  }

  /* ---------- cells ---------- */
  function rbar(lo, hi, v, r) {
    var p = clamp((v - lo) / ((hi - lo) || 1) * 100, 0, 100);
    return '<div class="mk-rb"><span>' + M.fmt(lo, r.dp) + '</span><div class="rangebar" style="--p:' + p.toFixed(1) + '%" role="img" aria-label="Now ' + Math.round(p) + '% of the way from low to high"><i></i></div><span>' + M.fmt(hi, r.dp) + '</span></div>';
  }
  function pos(lo, hi, v) { return clamp((v - lo) / ((hi - lo) || 1) * 100, 0, 100).toFixed(1); }
  function mine(r) {
    var tot = 0, sec = 0;
    Object.keys(M.HOLD).forEach(function (id) { var v = M.valueUSD(id); tot += v; if (M.I[id].sec === r.n) sec += v; });
    return sec / tot * 100;
  }
  /* the extra columns each sub-page picks from */
  var X = {
    ytd: { h: 'YTD %', cell: function (r) { return pct(stats(r).ytd); } },
    m1: { h: '1 month %', cell: function (r) { return pct(stats(r).m1); } },
    d7: { h: '7 days %', cell: function (r) { return pct(stats(r).d7); } },
    r52: { h: '52-week range', live: true, v: function (r) { var s = stats(r); return pos(s.lo, s.hi, r.p); }, cell: function (r) { var s = stats(r); return rbar(s.lo, s.hi, r.p, r); } },
    rday: { h: 'Day range', live: true, v: function (r) { var s = stats(r); return pos(s.dlo, s.dhi, r.p); }, cell: function (r) { var s = stats(r); return rbar(Math.min(s.dlo, r.p), Math.max(s.dhi, r.p), r.p, r); } },
    wt: { h: 'Index weight', cell: function (r) { return r.x.w.toFixed(1) + '%'; } },
    mine: { h: 'Your portfolio', cell: function (r) { var v = mine(r); return v ? v.toFixed(1) + '%' : dash('You hold nothing in this sector'); } },
    rg: { h: 'Region', cls: 'l', sort: 'text', cell: function (r) { return esc(r.x.rg); } },
    grp: { h: 'Group', cls: 'l', sort: 'text', cell: function (r) { return esc(r.x.grp); } },
    y1m: { h: '1 month ago', cell: function (r) { return M.fmt(stats(r).p1m, 3) + '%'; } },
    b1m: { h: 'Change, bp', cell: function (r) { return bp((r.p - stats(r).p1m) * 100); } },
    y1y: { h: '1 year ago', cell: function (r) { return M.fmt(stats(r).p1y, 3) + '%'; } },
    b1y: { h: 'Change, bp', cell: function (r) { return bp((r.p - stats(r).p1y) * 100); } },
    cap: { h: 'Market cap', cell: function (r) { return '$' + M.fbig(r.x.sup * r.p); } },
    vol: { h: 'Volume (24h)', cell: function (r) { return '$' + M.fbig(r.x.sup * r.p * r.x.tn); } }
  };
  function th(label, sort, cls) { return '<th scope="col" data-sort="' + sort + '"' + (cls ? ' class="' + cls + '"' : '') + '><button type="button" class="mk-th">' + label + '</button></th>'; }
  function absHTML(pg, r) { var d = r.p - r.pc; return '<span class="' + (d >= 0 ? 'up' : 'dn') + '">' + (pg.bp ? M.fsign(d * 100, 1) + ' bp' : M.fsign(d, r.dp)) + '</span>'; }
  function chgInner(r) { var p = dayPct(r); return { cls: 'chg bare ' + (p >= 0 ? 'up' : 'dn'), html: M.fpct(p) + arrow(p >= 0) }; }
  function chip(pg, r) {
    var d = r.p - r.pc, up = d >= 0;
    return '<span class="chg ' + (up ? 'up' : 'dn') + '">' + (pg.bp ? M.fsign(d * 100, 1) + ' bp' : M.fsign(d, r.dp)) + ' (' + M.fpct(dayPct(r)) + ')' + arrow(up) + '</span>';
  }
  function rowHTML(pg, r) {
    var c = chgInner(r);
    return '<tr data-id="' + r.id + '" tabindex="-1">' +
      '<td data-v="' + esc(r.n) + '"><div class="mk-n"><span class="mk-n1">' + esc(r.n) + (r.x.tag ? '<span class="badge badge-x" title="Converts holdings you own into US dollars">Your holdings</span>' : '') + '</span><span class="mk-n2">' + esc(r.sub) + '</span></div></td>' +
      '<td>' + (r.live ? M.pxHTML(r.id) : '<span class="px"><span>' + M.fmt(r.p, r.dp) + '</span></span>') + (r.x.u || '') + '</td>' +
      '<td data-c="abs">' + absHTML(pg, r) + '</td>' +
      '<td>' + (r.live ? M.chgHTML(r.id, { bare: true }) : '<span class="' + c.cls + '" data-own>' + c.html + '</span>') + '</td>' +
      '<td class="c"><canvas aria-hidden="true"></canvas></td>' +
      pg.cols.map(function (k) { var col = X[k]; return '<td' + (col.cls ? ' class="' + col.cls + '"' : '') + (col.live ? ' data-c="' + k + '"' : '') + (col.v ? ' data-v="' + col.v(r) + '"' : '') + '>' + col.cell(r) + '</td>'; }).join('') + '</tr>';
  }
  function drawSpark(r) { M.spark(r.cv, M.resample(day(r), 30), { w: 72, h: 24, base: r.pc }); }

  /* ---------- a sub-page: chart of the selected row, then the table ---------- */
  var cur = null, built = {}, LIVE = {};
  function build(key, pn) {
    var pg = PAGES[key], rows = pg.rows.map(function (s) { return mk(s, pg.cls); });
    pg.list = rows; pg.by = {}; pg.own = rows.filter(function (r) { return !r.live; }); pg.def = pg.def || rows[0].id; pg.sel = pg.def; pg.range = '1D';
    rows.forEach(function (r) { pg.by[r.id] = r; if (r.live) LIVE[r.id] = { pg: pg, r: r }; });
    var top = '<section class="card mk-top reveal" aria-label="Chart of the selected row">' +
      '<header class="card-h"><div class="mk-id"><h2 data-el="name"></h2><span class="label" data-el="sub"></span></div>' +
      '<div class="card-a"><div class="seg" role="group" aria-label="Chart range">' + ['1D', '1M', '1Y', '5Y'].map(function (v, i) { return '<button type="button" data-v="' + v + '" aria-pressed="' + (i === 0) + '">' + v + '</button>'; }).join('') + '</div></div></header>' +
      '<div class="mk-q"><span class="mk-px" data-el="px"></span><span data-el="chg"></span><span class="label">' + (pg.day || 'today') + '</span></div>' +
      '<div class="mk-plot" data-el="plot"></div><dl class="mk-stats" data-el="stats"></dl></section>';
    var heat = pg.heat ? '<section class="card reveal" aria-labelledby="mk-heat-h"><header class="card-h"><h2 id="mk-heat-h">Sectors today</h2><div class="card-a"><span class="label">Tile size follows index weight · colour is the day’s move · select a tile to chart it</span></div></header>' +
      '<div class="heat mk-heat" role="group" aria-label="Sector heatmap"></div></section>' : '';
    var curve = pg.curve ? '<section class="card reveal" aria-labelledby="mk-curve-h"><header class="card-h"><h2 id="mk-curve-h">US Treasury yield curve</h2><div class="card-a"><div class="lg mk-lg">' +
      '<span><i style="border-color:var(--accent)"></i>Today</span><span><i class="d1" style="border-color:var(--data-2)"></i>1 month ago</span><span><i class="d2" style="border-color:var(--data-6)"></i>1 year ago</span></div></div></header>' +
      '<div class="plot mk-curve" role="img" data-el="curve"></div><dl class="mk-stats" data-el="spread"></dl></section>' : '';
    var table = '<section class="card mk-tcard reveal" aria-labelledby="mk-h-' + key + '"><header class="card-h"><h2 id="mk-h-' + key + '">' + pg.t + '</h2><div class="card-a"><span class="label">' + (pg.note ? pg.note + ' · ' : '') + 'Select a row to chart it</span></div></header>' +
      '<div class="dt-wrap"><table class="dt mk-t"><thead><tr>' + th(pg.first, 'text') + th(pg.last || 'Last', 'num') + th(pg.chg || 'Change', 'num') + th('Change %', 'num') + '<th scope="col" class="c">' + (pg.spark || 'Today') + '</th>' +
      pg.cols.map(function (k) { return th(X[k].h, X[k].sort || 'num', X[k].cls); }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return rowHTML(pg, r); }).join('') + '</tbody></table></div></section>';
    pn.innerHTML = '<div class="stack">' + (curve ? '<div class="g2">' + top + curve + '</div>' : top) + heat + table + '</div>';

    pg.el = {}; $$('[data-el]', pn).forEach(function (n) { pg.el[n.dataset.el] = n; });
    pg.tb = $('tbody', pn);
    $$('tr', pg.tb).forEach(function (tr) { var r = pg.by[tr.dataset.id]; r.tr = tr; r.cv = $('canvas', tr); drawSpark(r); });
    pg.roll = new M.Roll(pg.el.px, f(pg.by[pg.sel], pg.by[pg.sel].p));
    pg.chart = new M.AreaChart(pg.el.plot, { label: pg.t });
    pg.seg = M.initSeg($('.seg', pn), function (v) { pg.range = v; setChart(pg); });
    M.sortable($('table', pn));
    pg.tb.addEventListener('click', function (e) { var tr = e.target.closest('tr'); if (tr) select(pg, tr.dataset.id); });
    pg.tb.addEventListener('keydown', function (e) {
      var tr = e.target.closest('tr'); if (!tr) return;
      var trs = $$('tr', pg.tb), i = trs.indexOf(tr), n = null;
      if (e.key === 'ArrowDown') n = trs[i + 1]; else if (e.key === 'ArrowUp') n = trs[i - 1]; else if (e.key === 'Home') n = trs[0]; else if (e.key === 'End') n = trs[trs.length - 1];
      else if (e.key === 'Enter' || e.key === ' ') { select(pg, tr.dataset.id); e.preventDefault(); return; }
      else return;
      e.preventDefault(); if (n) { n.focus(); select(pg, n.dataset.id); }
    });
    if (pg.heat) buildHeat(pg);
    if (pg.curve) buildCurve(pg);
    select(pg, pg.sel, 'draw');
  }
  function select(pg, id, mode) {
    var r = pg.by[id]; if (!r) return;
    pg.sel = id;
    pg.list.forEach(function (x) {
      var on = x === r; x.tr.classList.toggle('is-sel', on); x.tr.tabIndex = on ? 0 : -1;
      if (on) x.tr.setAttribute('aria-current', 'true'); else x.tr.removeAttribute('aria-current');
      if (x.tile) x.tile.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    pg.el.name.textContent = r.n; pg.el.sub.textContent = r.sub;
    pg.roll.set(f(r, r.p), 0); pg.el.chg.innerHTML = chip(pg, r);
    setChart(pg, mode);
    if (pg === PAGES[cur]) setHash();
  }
  function setChart(pg, mode) {
    var r = pg.by[pg.sel], d = rangeData(r, pg.range);
    if (pg.day && pg.range === '1D') { d.from = '24 hours ago'; d.word = 'in the ' + pg.day; }
    pg.cur = d; pg.chart.opt.fmt = axisFmt(r);
    pg.chart.set(d.d, { base: d.base, labels: [0, 0.25, 0.5, 0.75, 1].map(function (x) { return { f: x, t: d.tip(x) }; }), tip: d.tip, mode: mode });
    sumChart(pg);
  }
  /* the figures under the chart double as its text alternative */
  function sumChart(pg) {
    var r = pg.by[pg.sel], d = pg.cur, start = d.base != null ? d.base : d.d[0];
    var lo = Math.min(r.p, Math.min.apply(null, d.d)), hi = Math.max(r.p, Math.max.apply(null, d.d)), ch = pg.bp ? (r.p - start) * 100 : (r.p / start - 1) * 100;
    pg.el.stats.innerHTML = [[d.from, f(r, start)], ['Low', f(r, lo)], ['High', f(r, hi)], ['Change ' + d.word, pg.bp ? bp(ch) : pct(ch)]].map(function (s) { return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('');
    pg.chart.cv.setAttribute('aria-label', r.n + ' ' + d.word + ': ' + (pg.bp ? M.fsign(ch, 1) + ' basis points' : M.fpct(ch)) + ', from ' + f(r, start) + ' to ' + f(r, r.p) + '. Low ' + f(r, lo) + ', high ' + f(r, hi) + '. The same figures are listed under the chart.');
  }

  /* sector heatmap: the same tiles as Home, here as buttons that pick the charted sector */
  function tint(p) { var a = Math.min(1, Math.abs(p) / 3); return 'color-mix(in srgb, var(' + (p >= 0 ? '--gain' : '--loss') + ') ' + Math.round(14 + a * 56) + '%, var(--surface-3))'; }
  function tileText(r) { var p = dayPct(r); return M.fpct(p) + '<i aria-hidden="true">' + (p >= 0 ? '▲' : '▼') + '</i>'; }
  function buildHeat(pg) {
    var heat = $('.mk-heat', pg.tb.closest('.stack'));
    pg.list.forEach(function (r, i) {
      var t = M.el('button', 'tile' + (r.x.gr === 1 ? ' sm' : '')); t.type = 'button'; t.dataset.id = r.id; t.setAttribute('aria-pressed', 'false');
      t.style.gridColumn = 'span ' + r.x.gc; t.style.gridRow = 'span ' + r.x.gr; t.style.setProperty('--i', i); t.style.backgroundColor = tint(dayPct(r));
      t.innerHTML = '<span class="nm">' + esc(r.x.tile || r.n) + '</span><span class="pc">' + tileText(r) + '</span>';
      heat.appendChild(t); r.tile = t;
    });
    heat.addEventListener('click', function (e) { var t = e.target.closest('.tile'); if (t) select(pg, t.dataset.id); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { heat.classList.add('in'); }); });
  }

  /* yield curve: today against one month and one year ago */
  function buildCurve(pg) {
    pg.us = pg.list.filter(function (r) { return r.x.t != null; });
    pg.curveChart = M.lines(pg.el.curve, curveSeries(pg), { fmt: function (v) { return v.toFixed(2) + '%'; }, labels: TEN.map(function (t, i) { return { f: i / (TEN.length - 1), t: t }; }) });
    curveText(pg);
  }
  function curveSeries(pg) {
    return [
      { data: pg.us.map(function (r) { return r.x.y1y; }), color: 'data-6', lw: 1.5, dash: [2, 4] },
      { data: pg.us.map(function (r) { return r.x.y1m; }), color: 'data-2', lw: 1.5, dash: [6, 4] },
      { data: pg.us.map(function (r) { return r.p; }), color: 'accent', lw: 2.25 }
    ];
  }
  function curveText(pg) {
    var u = pg.us;
    function gap(a, b, k) { return ((k ? u[a].x[k] : u[a].p) - (k ? u[b].x[k] : u[b].p)) * 100; }
    function item(label, a, b) {
      return '<div><dt>' + label + '</dt><dd>' + M.fsign(gap(a, b), 0) + ' bp <span class="dim">· 1 month ago ' + M.fsign(gap(a, b, 'y1m'), 0) + ' · 1 year ago ' + M.fsign(gap(a, b, 'y1y'), 0) + '</span></dd></div>';
    }
    var now = gap(8, 4), was = gap(8, 4, 'y1m');
    pg.el.spread.innerHTML = item('10-year minus 2-year', 8, 4) + item('10-year minus 3-month', 8, 1) +
      '<div><dt>Shape</dt><dd>' + (now >= 0 ? 'Upward sloping' : 'Inverted') + ', ' + (now >= was ? 'steeper' : 'flatter') + ' than a month ago</dd></div>';
    pg.el.curve.setAttribute('aria-label', 'US Treasury yield curve from 1 month to 30 years. Today it runs from ' + f(u[0], u[0].p) + ' at 1 month to ' + f(u[10], u[10].p) + ' at 30 years, with the 10-year ' + Math.round(now) +
      ' basis points above the 2-year. One month ago that gap was ' + Math.round(was) + ' basis points and one year ago ' + Math.round(gap(8, 4, 'y1y')) + '. Every maturity is listed in the table below with its yield one month and one year ago.');
  }

  /* ---------- live prices: ML.STRIP rows tick with the shell, the invented rows tick here ---------- */
  function flash(n, dir) { n.classList.remove('fu', 'fd'); void n.offsetWidth; n.classList.add(dir > 0 ? 'fu' : 'fd'); setTimeout(function () { n.classList.remove('fu', 'fd'); }, 60); }
  function paintRow(pg, r, prev) {
    var tr = r.tr, dir = r.p > prev ? 1 : -1;
    if (!r.live) {
      var px = $('.px', tr), c = chgInner(r), own = $('[data-own]', tr);
      px.firstChild.textContent = M.fmt(r.p, r.dp); flash(px, dir);
      own.className = c.cls; own.innerHTML = c.html;
    }
    $('[data-c="abs"]', tr).innerHTML = absHTML(pg, r);
    pg.cols.forEach(function (k) { if (X[k].live) $('[data-c="' + k + '"]', tr).innerHTML = X[k].cell(r); });
    day(r)[78] = r.p; drawSpark(r);
    if (r.tile) { r.tile.style.backgroundColor = tint(dayPct(r)); $('.pc', r.tile).innerHTML = tileText(r); }
    if (pg.curve && r.x.t != null) { pg.curveChart.set(curveSeries(pg)); curveText(pg); }
    if (pg.sel === r.id) {
      pg.roll.set(f(r, r.p), dir); pg.el.chg.innerHTML = chip(pg, r);
      if (pg.range === '1D') pg.chart.nudge(r.p);
      sumChart(pg);
    }
  }
  M.onTick(function (it, prev) { var l = LIVE[it.id]; if (!l) return; l.r.p = it.p; paintRow(l.pg, l.r, prev); });
  setInterval(function () {
    var pg = PAGES[cur]; if (document.hidden || !pg || !pg.own || !pg.own.length) return;
    var seen = {};
    for (var k = 0; k < 3; k++) {
      var r = pg.own[Math.floor(Math.random() * pg.own.length)]; if (seen[r.id]) continue; seen[r.id] = 1;
      var prev = r.p, unit = Math.pow(10, -r.dp), step = (Math.random() - 0.5) * 2 * Math.abs(r.p) * 0.0009 * (r.x.tv != null ? r.x.tv : r.c.tv);
      if (Math.abs(step) < unit) step = step < 0 ? -unit : unit;
      r.p = +(r.p + step).toFixed(r.dp); paintRow(pg, r, prev);
    }
  }, 2300);
  document.addEventListener('ml:paint', function () { KEYS.forEach(function (k) { if (PAGES[k] && PAGES[k].list) PAGES[k].list.forEach(drawSpark); }); });

  /* ---------- market regime: the existing crash-probability model, shown with its score ---------- */
  function pc0(v) { return Math.round(v * 100) + '%'; }
  function buildRegime(pn) {
    var spx = (PAGES.indexes.by && PAGES.indexes.by.SPX) || mk(PAGES.indexes.rows[0], 'idx'), st = stats(spx);
    var term = M.I.US10Y.p - Y0[1], dd = Math.abs(spx.p / Math.max(st.hi, spx.p) - 1) * 100;
    /* monthly history, November 2016 to October 2026 */
    function bump(i, c, w) { return Math.exp(-Math.pow((i - c) / w, 2) / 2); }
    var H = M.bridge('regime:p', 120, 0.105, 0.14, 0.035).map(function (v, i) {
      var p = clamp(v + 0.19 * bump(i, 40, 2.2) + 0.1 * bump(i, 67, 4), 0.03, 0.45), sp = 0.08 + 0.84 * bump(i, 40, 1.8) + 0.5 * bump(i, 67, 3);
      return { p: p, lo: p * 0.5, hi: Math.min(0.48, p * 1.72), b: 0.118 + 0.002 * i / 119, s: sp >= 0.5, y: 2016 + Math.floor((i + 10) / 12), mo: (i + 10) % 12 };
    });
    var last = H[119];
    var DRV = [
      ['Valuation', 'Cyclically adjusted P/E of 34.1, in the top 4% of its history', 3.4],
      ['Bubble-like acceleration', 'Pattern confidence 0.21 on a scale of 0 to 1', 1.9],
      ['Return over 12 months', 'S&P 500 ' + M.fpct(st.y1, 1), 0.4],
      ['Current drawdown', M.fmt(dd, 1) + '% below the 52-week high', -0.3],
      ['Term spread', '10-year minus 3-month yield: ' + M.fsign(term, 2) + ' points', -0.6],
      ['Stress probability', '8% from the regime model, so the label is calm', -0.9],
      ['Credit spread', '1.5 points, narrower than its long-run average', -1.9]
    ];
    var net = DRV.reduce(function (s, d) { return s + d[2]; }, 0);
    pn.innerHTML = '<div class="split">' +
      '<div class="stack">' +
        '<section class="card reveal" aria-labelledby="rg-h"><header class="card-h"><h2 id="rg-h">Chance of a 20% fall in the US stock market within 12 months</h2>' +
          '<div class="card-a"><span class="badge mk-nb">' + M.icon('warn', 'ic-sm') + 'Not beating the baseline</span><span class="label">Skill −4.5% · 90% interval −22.1% to +9.9%</span></div></header>' +
          '<div class="mk-rg">' +
            '<div><div class="label">Model estimate</div><div class="bignum">' + pc0(last.p) + '<small>80% interval ' + Math.round(last.lo * 100) + ' to ' + pc0(last.hi) + '</small></div></div>' +
            '<div><div class="label">Baseline</div><div class="bignum">' + pc0(last.b) + '<small>how often it has happened before</small></div></div>' +
            '<div><div class="label">Regime label</div><div class="bignum">Calm<small>stress probability 8%</small></div></div>' +
          '</div>' +
          '<div class="pbar" id="rg-bar" role="img" aria-label="Model estimate ' + pc0(last.p) + ', 80% interval ' + Math.round(last.lo * 100) + ' to ' + pc0(last.hi) + ', baseline ' + pc0(last.b) + '" style="--p:' + (last.p * 2).toFixed(3) + ';--lo:' + (last.lo * 200).toFixed(1) + '%;--hi:' + (last.hi * 200).toFixed(1) + '%;--b:' + (last.b * 200).toFixed(1) + '%"><div class="fill"></div><div class="band"></div><div class="base" title="Baseline"></div></div>' +
          '<div class="pbar-l"><span>0%</span><span>Scale runs to 50% · the tick is the baseline</span><span>50%</span></div>' +
          '<p class="mk-p">The estimate sits 2 points above the baseline and well inside its own interval. In backtests the model has not scored better than quoting the baseline every month, so treat it as background, not as a signal. The regime label, calm or stressed, comes from a two-state model of monthly returns that is refitted once a year; it is stamped on every forecast Market Lens makes.</p>' +
          '<p class="mk-p dim">Data as of 30 October 2026, the last complete month. Updated monthly. A probability with its interval, not a prediction of where the market will be.</p>' +
        '</section>' +
        '<section class="card reveal" aria-labelledby="rg-hist-h"><header class="card-h"><h2 id="rg-hist-h">History of the estimate</h2><div class="card-a"><button class="btn btn-sm" type="button" id="rg-tbl-btn" aria-expanded="false" aria-controls="rg-tbl">' + M.icon('table', 'ic-sm') + 'Show table</button></div></header>' +
          '<div class="lg mk-lg mk-lg-h"><span><i style="border-color:var(--accent)"></i>Model estimate</span><span><i class="blk" style="background:var(--accent-wash);border-color:var(--accent)"></i>80% interval</span><span><i class="d1" style="border-color:var(--text-2)"></i>Baseline</span><span><i class="blk" style="background:var(--warn);border-color:var(--warn)"></i>Months labelled stressed</span></div>' +
          '<div class="plot mk-hist" id="rg-hist"></div>' +
          '<div class="dt-wrap mk-hist-t" id="rg-tbl" hidden><table class="dt"><thead><tr><th scope="col">Month</th><th scope="col">Model estimate</th><th scope="col">80% interval</th><th scope="col">Baseline</th><th scope="col" class="l">Regime label</th></tr></thead><tbody>' +
            H.slice(-12).reverse().map(function (h) { return '<tr><td>' + MON[h.mo] + ' ' + h.y + '</td><td>' + pc0(h.p) + '</td><td>' + Math.round(h.lo * 100) + ' to ' + pc0(h.hi) + '</td><td>' + pc0(h.b) + '</td><td class="l">' + (h.s ? 'Stressed' : 'Calm') + '</td></tr>'; }).join('') +
          '</tbody></table></div>' +
        '</section>' +
      '</div>' +
      '<div class="stack">' +
        '<section class="card reveal" aria-labelledby="rg-score-h"><header class="card-h"><h2 id="rg-score-h">Score against the baseline</h2></header>' +
          '<div class="bignum mk-b">−4.5%<small>skill · 90% interval −22.1% to +9.9%</small></div>' +
          '<div class="mk-skill" role="img" aria-label="Skill −4.5%, with a 90% interval from −22.1% to +9.9%. The interval includes zero." style="--lo:15.8%;--hi:79.8%;--p:51%;--z:60%"><i class="band"></i><i class="zero"></i><i class="pt"></i></div>' +
          '<div class="pbar-l"><span>−30%</span><span>0 is level with the baseline</span><span>+20%</span></div>' +
          '<dl class="kv mk-kv"><dt>Verdict</dt><dd>Not beating the baseline</dd><dt>Brier score, model</dt><dd>0.1104</dd><dt>Brier score, baseline</dt><dd>0.1056</dd><dt>Forecasts scored</dt><dd>612 monthly, 1975 to 2025</dd><dt>Origin</dt><dd>Backtest · no live forecast yet</dd></dl>' +
          '<p class="mk-p">Skill is the improvement in Brier score over the baseline. Below zero means the baseline alone scored better. The interval spans zero, so the record cannot tell the model from the baseline.</p>' +
        '</section>' +
        '<section class="card reveal" aria-labelledby="rg-drv-h"><header class="card-h"><h2 id="rg-drv-h">What moves the estimate</h2><div class="card-a"><span class="label">Points against the baseline, approximate</span></div></header>' +
          '<ul class="mk-drv" id="rg-drv">' + DRV.map(function (d) {
            return '<li><div class="t"><b>' + d[0] + '</b><span>' + d[1] + '</span></div><div class="mk-sb" aria-hidden="true"><i class="' + (d[2] >= 0 ? 'pos' : 'neg') + '" style="--w:' + (Math.abs(d[2]) / 3.4 * 48).toFixed(1) + '%"></i></div>' +
              '<div class="v"><b>' + M.fsign(d[2], 1) + ' pts</b><span>' + (d[2] >= 0 ? 'raises it' : 'lowers it') + '</span></div></li>';
          }).join('') + '</ul>' +
          '<p class="mk-p">Baseline ' + (last.b * 100).toFixed(1) + '% · drivers ' + M.fsign(net, 1) + ' points · model ' + (last.p * 100).toFixed(1) + '%</p>' +
        '</section>' +
        '<div class="band">' + M.icon('down') + '<span>Kept as context for the drawdown check, which uses the regime label and market conditions at the start of a fall. It is not a timing tool. <a class="linkish" href="stock.html?s=NVDA#drawdown">Open a drawdown check</a></span></div>' +
      '</div></div>';

    histChart($('#rg-hist'), H);
    $('#rg-tbl-btn').addEventListener('click', function () {
      var on = this.getAttribute('aria-expanded') !== 'true'; this.setAttribute('aria-expanded', on); this.classList.toggle('is-on', on);
      $('#rg-tbl').hidden = !on; this.lastChild.textContent = on ? 'Hide table' : 'Show table';
    });
    setTimeout(function () { $('#rg-bar').classList.add('in'); $('#rg-drv').classList.add('in'); }, M.rm() ? 0 : 350);
  }
  /* estimate with its interval band, the baseline and the months labelled stressed */
  function histChart(host, H) {
    var cv = M.el('canvas'), tip = M.el('div', 'chart-tip'), n = H.length, TOP = 0.5, PR = 44, reveal = 0, hov = -1, last = H[n - 1];
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Monthly model estimate from November 2016 to October 2026, with its 80% interval, the baseline and the months labelled stressed. Latest: ' + pc0(last.p) + ', interval ' + Math.round(last.lo * 100) + ' to ' + pc0(last.hi) + ', baseline ' + pc0(last.b) + '. Show table lists the last 12 months.');
    host.classList.add('chart'); host.appendChild(cv); host.appendChild(tip);
    function draw() {
      var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      var ctx = M.fitCanvas(cv, w, h), C = M.COL, pt = 26, pb = 36, iw = w - PR, ih = h - pt - pb, step = iw / (n - 1), i;
      function X(k) { return k * step; }
      function Y(v) { return pt + (1 - v / TOP) * ih; }
      function trace(key) { for (var k = 0; k < n; k++) { if (k) ctx.lineTo(X(k), Y(H[k][key])); else ctx.moveTo(X(k), Y(H[k][key])); } }
      ctx.clearRect(0, 0, w, h); ctx.font = '500 11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.lineWidth = 1;
      [0.1, 0.2, 0.3, 0.4].forEach(function (g) {
        var y = Math.round(Y(g)) + 0.5;
        ctx.strokeStyle = M.rgba(C['text-1'], 0.06); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(iw, y); ctx.stroke();
        ctx.fillStyle = C['text-3']; ctx.textAlign = 'left'; ctx.fillText(Math.round(g * 100) + '%', iw + 8, y);
      });
      ctx.fillStyle = C['text-3']; ctx.textAlign = 'center';
      for (i = 0; i < n; i++) if (H[i].mo === 0 && H[i].y % 2 === 0) ctx.fillText(String(H[i].y), X(i), h - 9);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, iw * reveal + 1, h); ctx.clip();
      ctx.fillStyle = M.rgba(C['text-1'], 0.08); ctx.fillRect(0, pt + ih + 6, iw, 4);
      ctx.fillStyle = C.warn;
      for (i = 0; i < n; i++) if (H[i].s) ctx.fillRect(Math.max(0, X(i) - step / 2), pt + ih + 6, step + 0.5, 4);
      ctx.beginPath(); trace('hi'); for (i = n - 1; i >= 0; i--) ctx.lineTo(X(i), Y(H[i].lo)); ctx.closePath(); ctx.fillStyle = M.rgba(C.accent, 0.16); ctx.fill();
      ctx.beginPath(); trace('b'); ctx.setLineDash([6, 4]); ctx.lineWidth = 1.25; ctx.strokeStyle = M.rgba(C['text-2'], 0.8); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); trace('p'); ctx.lineWidth = 1.75; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.restore();
      if (reveal >= 1) {
        ctx.beginPath(); ctx.arc(X(n - 1), Y(last.p), 6, 0, 6.3); ctx.fillStyle = M.rgba(C.accent, 0.18); ctx.fill();
        ctx.beginPath(); ctx.arc(X(n - 1), Y(last.p), 3, 0, 6.3); ctx.fillStyle = C.accent; ctx.fill();
      }
      if (hov >= 0) {
        var p = H[hov], x = Math.round(X(hov)) + 0.5;
        ctx.strokeStyle = M.rgba(C['text-1'], 0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, pt - 4); ctx.lineTo(x, pt + ih); ctx.stroke();
        ctx.beginPath(); ctx.arc(X(hov), Y(p.p), 4.5, 0, 6.3); ctx.fillStyle = C['surface-1']; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.accent; ctx.stroke();
        tip.innerHTML = '<span>' + MON[p.mo] + ' ' + p.y + '</span><b>' + pc0(p.p) + '</b><span class="x">' + Math.round(p.lo * 100) + ' to ' + pc0(p.hi) + (w > 460 ? ' · baseline ' + pc0(p.b) : '') + ' · ' + (p.s ? 'stressed' : 'calm') + '</span>';
        var tw = tip.offsetWidth; tip.style.transform = 'translate(' + clamp(X(hov) - tw / 2, 0, Math.max(0, w - tw)) + 'px, 0)';
      }
    }
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect(); hov = clamp(Math.round((e.clientX - r.left) / (host.clientWidth - PR) * (n - 1)), 0, n - 1); tip.classList.add('on'); draw();
    });
    host.addEventListener('pointerleave', function () { hov = -1; tip.classList.remove('on'); draw(); });
    new ResizeObserver(draw).observe(host);
    document.addEventListener('ml:paint', draw);
    M.tween(700, function (u) { reveal = u; draw(); }, M.easeOut);
  }

  /* ---------- sub-tabs, deep-linkable as #bonds or #bonds/US2Y ---------- */
  function setHash() {
    var pg = PAGES[cur], h = '#' + cur + (pg && pg.list && pg.sel !== pg.def ? '/' + pg.sel : '');
    try { history.replaceState(null, '', h); } catch (e) { /* file:// */ }
  }
  function go(v, dir) {
    var pn = $('#mk-panels > [data-v="' + v + '"]'); cur = v;
    M.showPanel($('#mk-panels'), v, dir);
    if (!built[v]) { built[v] = 1; if (v === 'regime') buildRegime(pn); else build(v, pn); M.observeReveal(pn); }
    else if (PAGES[v]) PAGES[v].seg.place(false);
    setHash();
  }
  var tabs = M.initTabs($('#mk-tabs'), go);
  function fromHash(animate) {
    var h = location.hash.slice(1).split('/'), v = h[0];
    try { h[1] = h[1] && decodeURIComponent(h[1]); } catch (e) { h[1] = ''; }
    if (KEYS.indexOf(v) < 0) return;
    if (v !== cur) { if ($('#mk-tabs .tab.is-active').dataset.v === v) go(v, 1); else tabs.select(v, animate); }
    if (h[1] && PAGES[v] && PAGES[v].by[h[1]] && PAGES[v].sel !== h[1]) select(PAGES[v], h[1]);
  }
  fromHash(false);
  if (!cur) go('indexes', 1);
  window.addEventListener('hashchange', function () { fromHash(true); });
})();
