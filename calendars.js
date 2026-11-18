/* Market Lens mockup: Calendars page. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc;
  M.shell('Calendars');

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], WDL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  /* time zones as [city, hours from UTC]; fixed winter offsets, which hold for the weeks the sample covers */
  var Z = { NY: ['New York', -5], LON: ['London', 0], FRA: ['Frankfurt', 1], HK: ['Hong Kong', 8], SHA: ['Shanghai', 8], TPE: ['Taipei', 8], TYO: ['Tokyo', 9] };
  var XZ = { NASDAQ: 'NY', NYSE: 'NY', HKEX: 'HK', LSE: 'LON' }, XC = { NASDAQ: '$', NYSE: '$', HKEX: 'HK$', LSE: '£' };
  var CTY = { US: 'United States', UK: 'United Kingdom', HK: 'Hong Kong', JP: 'Japan', CN: 'China', EA: 'Euro area', DE: 'Germany', TW: 'Taiwan' };
  /* "now" is Monday 16 November 2026, 16:00 in Hong Kong (08:00 UTC), as on Home */
  var NOW = Date.UTC(2026, 10, 16, 8, 0), MINW = -2, MAXW = 6;
  var st = { type: 'earnings', w: 0, day: null, h: true, wl: true, tz: 'HK' };

  function nz(seed) { return (M.rng(M.hash(seed))() - 0.5) * 2; }
  function dateOf(w, d) { return new Date(2026, 10, 16 + 7 * w + d); }
  function dmy(dt) { return dt.getDate() + ' ' + MON[dt.getMonth()] + ' ' + dt.getFullYear(); }
  function hm(min) { min = ((min % 1440) + 1440) % 1440; return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + min % 60).slice(-2); }
  function utcOf(w, d, min, z) { return Date.UTC(2026, 10, 16 + 7 * w + d) + (min - Z[z][1] * 60) * 60000; }
  /* an exchange-zone time in the viewer's zone; the weekday is named when it falls on another day */
  function yours(d, min, z) {
    var t = d * 1440 + min + (Z[st.tz][1] - Z[z][1]) * 60, ld = Math.floor(t / 1440);
    return (ld !== d ? '<span class="dim">' + WD[((ld % 7) + 7) % 7] + '</span> ' : '') + hm(t);
  }
  function dash(why) { return '<span class="dim" title="' + why + '">—</span>'; }
  function plural(n, T) { return n + ' ' + T.n[n === 1 ? 0 : 1]; }
  function cyc(w, off) { return ((w - off) % 13 + 13) % 13 === 0; }

  /* ---------- sample events ---------- */
  /* weeks from 16 November in which each company reports (every 13 weeks), and the fixed entries for that week, which match Home */
  var EOFF = { '0700.HK': 0, NVDA: 0, '9988.HK': 0, 'AZN.L': 0, LMT: 0, INTC: 0, 'IAG.L': 0, F: 0, AAPL: -2, MSFT: -2, AMZN: -2, 'SHEL.L': -2, 'HSBA.L': -2, XOM: -2, '1299.HK': -1, TSM: -1, PLTR: -1, UNH: -1, DAL: -1, TSLA: 1, COST: 3, JPM: 8 };
  var E0 = { F: [0, 'After close', 965], '0700.HK': [1, 'After close', 990], LMT: [1, 'Before open', 450], NVDA: [2, 'After close', 980], '9988.HK': [3, 'Before open', 510], 'AZN.L': [3, 'Before open', 420], INTC: [3, 'After close', 965], 'IAG.L': [4, 'Before open', 420] };
  var DOFF = { XOM: 0, COST: 0, F: 0, MSFT: 0, 'SHEL.L': 0, LMT: 0, AAPL: -1, 'HSBA.L': -1, DAL: 1, 'IAG.L': 2, UNH: 3, TSM: 4, JPM: 6 };
  var D0 = { XOM: 0, COST: 0, F: 1, MSFT: 2, 'SHEL.L': 3, LMT: 4 };
  /* [week, day, ticker, new shares, old shares, announced] */
  var SPLITS = [[0, 4, 'COST', 3, 1, '29 Oct 2026'], [2, 1, 'LMT', 2, 1, '12 Nov 2026']];
  /* [week, day, invented name, proposed symbol, exchange, range low, range high, shares offered in millions] */
  var IPOS = [
    [-2, 2, 'Sandbox Health Systems Inc.', 'SBOX', 'NASDAQ', 16, 19, 10], [-1, 1, 'Dummy Cloud Software Inc.', 'DMMY', 'NYSE', 22, 25, 18], [-1, 3, 'Illustrative Logistics Ltd', '9902', 'HKEX', 5.4, 6.2, 240],
    [0, 1, 'Sample Robotics Co.', 'SMPR', 'NASDAQ', 18, 21, 12.5], [0, 2, 'Specimen Foods Holdings Ltd', '9901', 'HKEX', 8.8, 10.2, 180], [0, 3, 'Demo Grid Energy plc', 'DEMO', 'LSE', 2.1, 2.6, 95],
    [1, 2, 'Example Biotech Ltd', 'EXBT', 'NASDAQ', 14, 16, 8], [2, 3, 'Placeholder Payments Inc.', 'PLHD', 'NYSE', 26, 30, 22], [3, 1, 'Mock Semiconductor Corp.', 'MOCK', 'NASDAQ', 31, 35, 15],
    [3, 4, 'Test Pattern Media plc', 'TPAT', 'LSE', 1.45, 1.8, 60], [4, 2, 'Fictional Freight Group Ltd', '9903', 'HKEX', 3.2, 3.9, 310]
  ];
  /* economic releases rotate over four weeks; the first group is the week of 16 November.
     [day, zone, minute of the day, country, event, importance 1 to 3, prior, consensus, decimals, unit, keep the level fixed] */
  var ECON = [[
    [0, 'TYO', 530, 'JP', 'GDP, quarter on quarter, first estimate', 3, 0.3, 0.2, 1, '%'],
    [0, 'SHA', 600, 'CN', 'Industrial production, year on year', 2, 5.9, 5.7, 1, '%'],
    [0, 'SHA', 600, 'CN', 'Retail sales, year on year', 2, 3.4, 3.2, 1, '%'],
    [0, 'NY', 510, 'US', 'Regional manufacturing survey', 1, 4.2, 2, 1, ''],
    [1, 'LON', 420, 'UK', 'Unemployment rate', 2, 4.6, 4.6, 1, '%'],
    [1, 'NY', 510, 'US', 'Retail sales, month on month', 3, 0.3, 0.4, 1, '%'],
    [1, 'NY', 555, 'US', 'Industrial production, month on month', 1, 0.1, 0.2, 1, '%'],
    [1, 'HK', 990, 'HK', 'Unemployment rate', 1, 3.7, 3.7, 1, '%'],
    [2, 'LON', 420, 'UK', 'Consumer price index, year on year', 3, 3.4, 3.3, 1, '%'],
    [2, 'FRA', 660, 'EA', 'Consumer price index, year on year, final', 2, 2.1, 2.1, 1, '%'],
    [2, 'NY', 510, 'US', 'Housing starts, annual rate', 1, 1.36, 1.38, 2, 'M'],
    [2, 'NY', 840, 'US', 'Central bank meeting minutes', 3, null, null, 0, ''],
    [3, 'NY', 600, 'US', 'Existing home sales, annual rate', 1, 4.05, 4.1, 2, 'M'],
    [4, 'TYO', 510, 'JP', 'Consumer price index, year on year', 2, 2.7, 2.6, 1, '%'],
    [4, 'SHA', 540, 'CN', 'Loan prime rate, one year', 2, 3, 3, 2, '%', 1],
    [4, 'LON', 420, 'UK', 'Retail sales, month on month', 2, 0.5, -0.2, 1, '%'],
    [4, 'LON', 570, 'UK', 'Flash composite PMI', 2, 51.2, 51, 1, ''],
    [4, 'FRA', 600, 'EA', 'Flash composite PMI', 2, 50.8, 50.6, 1, ''],
    [4, 'NY', 585, 'US', 'Flash composite PMI', 2, 53.4, 53.1, 1, ''],
    [4, 'TPE', 960, 'TW', 'Export orders, year on year', 1, 12.4, 11, 1, '%'],
    [4, 'HK', 990, 'HK', 'Consumer price index, year on year', 1, 1.9, 1.8, 1, '%']
  ], [
    [0, 'FRA', 600, 'DE', 'Business climate index', 2, 88.4, 88.9, 1, ''],
    [1, 'NY', 510, 'US', 'Durable goods orders, month on month', 2, -0.4, 0.6, 1, '%'],
    [1, 'NY', 600, 'US', 'Consumer confidence index', 2, 98.6, 99, 1, ''],
    [2, 'NY', 510, 'US', 'GDP, annualised quarter on quarter, second estimate', 3, 2.4, 2.5, 1, '%'],
    [2, 'NY', 600, 'US', 'Personal consumption price index, year on year', 3, 2.6, 2.6, 1, '%'],
    [3, 'FRA', 660, 'EA', 'Economic sentiment index', 1, 97.2, 97.5, 1, ''],
    [3, 'HK', 990, 'HK', 'Retail sales, year on year', 1, 2.4, 2.1, 1, '%'],
    [4, 'TYO', 530, 'JP', 'Industrial production, month on month', 1, 0.6, -0.3, 1, '%'],
    [4, 'SHA', 570, 'CN', 'Manufacturing PMI, official', 2, 49.6, 49.8, 1, ''],
    [4, 'LON', 420, 'UK', 'House price index, month on month', 1, 0.3, 0.2, 1, '%'],
    [4, 'FRA', 660, 'EA', 'Consumer price index, year on year, flash', 3, 2.1, 2.2, 1, '%']
  ], [
    [0, 'SHA', 585, 'CN', 'Manufacturing PMI, private survey', 2, 50.4, 50.3, 1, ''],
    [0, 'LON', 570, 'UK', 'Manufacturing PMI, final', 1, 49.2, 49.4, 1, ''],
    [0, 'NY', 600, 'US', 'Manufacturing PMI', 3, 49.1, 49.5, 1, ''],
    [1, 'FRA', 660, 'EA', 'Unemployment rate', 1, 6.3, 6.3, 1, '%'],
    [1, 'NY', 600, 'US', 'Job openings', 2, 7.21, 7.15, 2, 'M'],
    [2, 'HK', 510, 'HK', 'Private sector PMI', 1, 50.6, 50.4, 1, ''],
    [2, 'NY', 600, 'US', 'Services PMI', 3, 52.4, 52, 1, ''],
    [3, 'LON', 570, 'UK', 'Construction PMI', 1, 46.8, 47, 1, ''],
    [3, 'NY', 510, 'US', 'Trade balance', 1, -61.2, -60, 1, 'B'],
    [4, 'NY', 510, 'US', 'Non-farm payrolls, monthly change', 3, 112, 125, 0, 'K'],
    [4, 'NY', 510, 'US', 'Unemployment rate', 3, 4.3, 4.3, 1, '%']
  ], [
    [0, 'SHA', 570, 'CN', 'Consumer price index, year on year', 2, 0.4, 0.5, 1, '%'],
    [1, 'LON', 420, 'UK', 'Average earnings, year on year', 2, 4.7, 4.6, 1, '%'],
    [1, 'FRA', 660, 'DE', 'Investor sentiment index', 2, 34.2, 36, 1, ''],
    [2, 'NY', 510, 'US', 'Consumer price index, year on year', 3, 2.9, 2.8, 1, '%'],
    [2, 'NY', 510, 'US', 'Consumer price index, month on month', 3, 0.3, 0.2, 1, '%'],
    [3, 'LON', 420, 'UK', 'GDP, month on month', 3, 0.1, 0.2, 1, '%'],
    [3, 'NY', 510, 'US', 'Producer price index, month on month', 2, 0.2, 0.2, 1, '%'],
    [4, 'HK', 990, 'HK', 'GDP, year on year, final', 2, 3.1, 3.1, 1, '%'],
    [4, 'NY', 600, 'US', 'Consumer sentiment index, preliminary', 2, 61.4, 62, 1, '']
  ]];
  var WEEKLY = [[3, 'NY', 510, 'US', 'Initial jobless claims', 2, 224, 228, 0, 'K']];

  var cache = {};
  function weekOf(w) {
    if (cache[w]) return cache[w];
    var out = { earnings: [], dividends: [], splits: [], ipos: [], economic: [] };
    M.LIST.forEach(function (it) {
      var id = it.id, z = XZ[it.x], h = M.hash(id + 'es'), e;
      if (cyc(w, EOFF[id])) {
        e = w === 0 && E0[id];
        if (!e) e = z === 'NY' ? (h % 2 ? [0, 'After close', 965 + 5 * (h % 4)] : [0, 'Before open', 420 + 30 * (h % 3)]) : z === 'HK' ? [0, 'After close', 990] : [0, 'Before open', 420];
        out.earnings.push({ d: w === 0 && E0[id] ? e[0] : M.hash(id + 'ed' + w) % 5, id: id, s: e[1], min: e[2], z: z, eps: it.p / (14 + M.hash(id + 'pe') % 22) / 4 * (1 + nz(id + 'ce' + w) * 0.04) });
      }
      if (cyc(w, DOFF[id])) {
        var d = w === 0 && D0[id] != null ? D0[id] : M.hash(id + 'dd' + w) % 5, amt = Math.max(0.01, +(it.p * 0.0045).toFixed(2)), pay = dateOf(w, d);
        pay.setDate(pay.getDate() + 14 + M.hash(id + 'pay') % 14);
        out.dividends.push({ d: d, id: id, amt: amt, pay: pay, yld: amt * 4 / it.p * 100 });
      }
    });
    SPLITS.forEach(function (s) { if (s[0] === w) out.splits.push({ d: s[1], id: s[2], a: s[3], b: s[4], ann: s[5] }); });
    IPOS.forEach(function (p) {
      if (p[0] !== w) return;
      var past = w < 0, px = p[5] + (p[6] - p[5]) * (0.25 + (M.hash(p[3]) % 60) / 100);
      out.ipos.push({ d: p[1], n: p[2], sym: p[3], x: p[4], lo: p[5], hi: p[6], sh: p[7], cur: XC[p[4]], priced: past ? +px.toFixed(2) : null });
    });
    ECON[((w % 4) + 4) % 4].concat(WEEKLY).forEach(function (t) {
      var u = Math.pow(10, -t[8]), seed = w + t[3] + t[4], shift = w === 0 || t[10] ? 0 : Math.round(nz('ec' + seed) * 2) * u;
      var e = { d: t[0], z: t[1], min: t[2], c: t[3], n: t[4], imp: t[5], dp: t[8], u: t[9], done: utcOf(w, t[0], t[2], t[1]) <= NOW };
      if (t[6] != null) { e.prior = t[6] + shift; e.cons = t[7] + shift; if (e.done) e.act = e.cons + Math.round(nz('ea' + seed) * 1.4) * u; }
      out.economic.push(e);
    });
    out.earnings.concat(out.economic).forEach(function (e) { e.k = e.min - Z[e.z][1] * 60; });
    Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.d - b.d || (a.k || 0) - (b.k || 0); }); });
    cache[w] = out; return out;
  }

  /* ---------- cells ---------- */
  function held(id) {
    var h = M.HOLD[id];
    return h ? '<span class="badge badge-accent">Held · ' + M.fmt(h.q, 0) + ' shares</span>' : M.WATCH.indexOf(id) >= 0 ? '<span class="badge">Watchlist</span>' : dash('Not in your holdings or watchlist');
  }
  function third(label) { return label + ' <span class="badge badge-x" title="From an outside data provider, not a Market Lens forecast">Third-party</span>'; }
  function imp(n) {
    var word = ['Low', 'Medium', 'High'][n - 1];
    return '<span class="cal-imp" aria-hidden="true" title="' + word + ' importance"><i class="on"></i><i' + (n > 1 ? ' class="on"' : '') + '></i><i' + (n > 2 ? ' class="on"' : '') + '></i></span><span class="sr">' + word + ' importance, ' + n + ' of 3</span>';
  }
  function val(e, v) { v = +v.toFixed(e.dp); return M.fmt(v === 0 ? 0 : v, e.dp) + e.u; }
  function yourCol() { return 'Your time · ' + Z[st.tz][0]; }
  function ids(evs) { return evs.slice(0, 3).map(function (e) { return e.id || e.sym; }).join(', ') + (evs.length > 3 ? ' +' + (evs.length - 3) : ''); }

  var TYPES = {
    earnings: {
      label: 'Earnings', n: ['report', 'reports'], none: 'No earnings reports', pv: ids,
      band: 'Analyst consensus: third-party data, not a Market Lens forecast.',
      cols: function () { return [['Company'], ['Session', 'l'], ['Exchange time'], [yourCol()], [third('Consensus EPS')], ['Your position', 'l']]; },
      row: function (e) {
        var it = I[e.id];
        return '<td>' + M.tk(e.id) + '</td><td class="l">' + e.s + '</td><td>' + hm(e.min) + ' <span class="dim">' + Z[e.z][0] + '</span></td><td>' + yours(e.d, e.min, e.z) + '</td><td>' + M.CCY[it.c] + M.fmt(e.eps, 2) + '</td><td class="l">' + held(e.id) + '</td>';
      }
    },
    dividends: {
      label: 'Dividends', n: ['dividend', 'dividends'], none: 'No ex-dividend dates', pv: ids,
      band: 'Expected income assumes you still hold the shares on the ex-dividend date. Amounts are before withholding tax.',
      cols: function () { return [['Company'], ['Ex-dividend date'], ['Pay date'], ['Amount per share'], ['Yield'], ['Your shares'], ['Expected income']]; },
      row: function (e, w) {
        var it = I[e.id], h = M.HOLD[e.id], c = M.CCY[it.c], inc = h ? h.q * e.amt : 0;
        return '<td>' + M.tk(e.id) + '</td><td>' + dmy(dateOf(w, e.d)) + '</td><td>' + dmy(e.pay) + '</td><td>' + c + M.fmt(e.amt, 2) + '</td><td>' + e.yld.toFixed(2) + '%</td>' +
          '<td>' + (h ? M.fmt(h.q, 0) : dash('Not held')) + '</td><td>' + (h ? '<b class="cal-b">' + c + M.fmt(inc, 2) + '</b>' + (it.c !== 'USD' ? ' <span class="dim">≈ $' + M.fmt(inc * M.FX[it.c], 2) + '</span>' : '') : dash('Not held')) + '</td>';
      }
    },
    splits: {
      label: 'Splits', n: ['split', 'splits'], none: 'No splits', pv: ids,
      cols: function () { return [['Company'], ['Ratio'], ['Type', 'l'], ['Announced'], ['Effective'], ['Your shares']]; },
      row: function (e, w) {
        var it = I[e.id], h = M.HOLD[e.id], c = M.CCY[it.c];
        return '<td>' + M.tk(e.id) + '</td><td>' + e.a + '-for-' + e.b + '</td><td class="l">' + (e.a > e.b ? 'Forward split' : 'Reverse split') + '</td><td>' + e.ann + '</td><td>' + dmy(dateOf(w, e.d)) + '</td>' +
          '<td>' + (h ? '<div class="cal-2"><span>' + M.fmt(h.q, 0) + ' → ' + M.fmt(h.q * e.a / e.b, 0) + '</span><span class="dim">average cost ' + c + M.fmt(h.cost, 2) + ' → ' + c + M.fmt(h.cost * e.b / e.a, 2) + '</span></div>' : dash('Not held')) + '</td>';
      }
    },
    ipos: {
      label: 'IPOs', n: ['listing', 'listings'], none: 'No listings', pv: ids,
      band: 'IPO names and terms are invented placeholders for this mockup, not real companies.',
      cols: function () { return [['Company'], ['Symbol', 'l'], ['Exchange', 'l'], ['Price range'], ['Shares offered'], ['Raise at mid-point'], ['Status', 'l']]; },
      row: function (e) {
        return '<td><span class="cal-co"><span class="mono" style="--h:' + M.hash(e.n) % 360 + '" aria-hidden="true">' + e.n.split(' ').slice(0, 2).map(function (x) { return x[0]; }).join('') + '</span><span class="tk-t"><span class="tk-s">' + esc(e.n) + '</span><span class="tk-n">Invented name · sample</span></span></span></td>' +
          '<td class="l">' + e.sym + '</td><td class="l"><span class="badge badge-x">' + e.x + '</span></td><td>' + e.cur + M.fmt(e.lo, 2) + ' to ' + e.cur + M.fmt(e.hi, 2) + '</td><td>' + M.fmt(e.sh, 1) + 'M</td><td>' + e.cur + M.fbig((e.lo + e.hi) / 2 * e.sh * 1e6) + '</td>' +
          '<td class="l">' + (e.priced ? 'Priced at ' + e.cur + M.fmt(e.priced, 2) : 'Expected') + '</td>';
      }
    },
    economic: {
      label: 'Economic events', n: ['event', 'events'], none: 'No events',
      pv: function (evs) { var hi = evs.filter(function (e) { return e.imp === 3; }).length; return hi ? hi + ' high importance' : ''; },
      band: 'Consensus figures are third-party survey medians, not a Market Lens forecast. Actual values appear once released.',
      cols: function () { return [['Time'], [yourCol()], ['Country', 'l'], ['Event', 'l'], ['Importance', 'c'], ['Prior'], [third('Consensus')], ['Actual']]; },
      row: function (e) {
        var has = e.prior != null, act;
        if (!e.done) act = dash('Not released yet');
        else if (!has) act = 'Published';
        else act = '<b class="cal-b">' + val(e, e.act) + '</b> <span class="dim">' + (Math.abs(e.act - e.cons) < 1e-9 ? 'in line' : e.act > e.cons ? 'above' : 'below') + '</span>';
        return '<td>' + hm(e.min) + ' <span class="dim">' + Z[e.z][0] + '</span></td><td>' + yours(e.d, e.min, e.z) + '</td><td class="l"><span class="badge badge-x">' + e.c + '</span> ' + CTY[e.c] + '</td><td class="l cal-ev">' + esc(e.n) + '</td><td class="c">' + imp(e.imp) + '</td>' +
          '<td>' + (has ? val(e, e.prior) : dash('No figure for this event')) + '</td><td>' + (has ? val(e, e.cons) : dash('No figure for this event')) + '</td><td>' + act + '</td>';
      }
    }
  };

  /* ---------- filters ---------- */
  var CODE = {}; Object.keys(CTY).forEach(function (k) { CODE[CTY[k]] = k; });
  function countries(list) { var o = {}; list.forEach(function (id) { o[CODE[I[id].cty]] = 1; }); return o; }
  function keep(e) {
    if (st.type === 'ipos' || (!st.h && !st.wl)) return true;
    if (st.type === 'economic') return !!((st.h && countries(Object.keys(M.HOLD))[e.c]) || (st.wl && countries(M.WATCH)[e.c]));
    return !!((st.h && M.HOLD[e.id]) || (st.wl && M.WATCH.indexOf(e.id) >= 0));
  }
  function days() {
    var out = [[], [], [], [], []];
    weekOf(st.w)[st.type].filter(keep).forEach(function (e) { out[e.d].push(e); });
    return out;
  }
  function who() { return st.h && st.wl ? 'your holdings and watchlist' : st.h ? 'your holdings' : st.wl ? 'your watchlist' : 'everything in the sample set'; }

  /* ---------- week strip ---------- */
  function weekLabel() {
    var a = dateOf(st.w, 0), b = dateOf(st.w, 4);
    return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MONL[a.getMonth()] : '') + (a.getFullYear() !== b.getFullYear() ? ' ' + a.getFullYear() : '') + ' to ' + b.getDate() + ' ' + MONL[b.getMonth()] + ' ' + b.getFullYear();
  }
  function renderWeek() {
    var T = TYPES[st.type], ds = days(), all = weekOf(st.w)[st.type], shown = ds.reduce(function (s, d) { return s + d.length; }, 0), ipo = st.type === 'ipos';
    $('#cal-wk').textContent = weekLabel();
    $('#cal-prev').setAttribute('aria-disabled', st.w <= MINW); $('#cal-next').setAttribute('aria-disabled', st.w >= MAXW); $('#cal-now').disabled = st.w === 0;
    $$('#cal-flt .chip').forEach(function (c) {
      var k = c.dataset.f; c.setAttribute('aria-pressed', k === 'h' ? st.h : k === 'w' ? st.wl : !st.h && !st.wl);
      c.disabled = ipo && k !== 'all'; c.title = c.disabled ? 'Holdings and watchlist filters do not apply to IPOs' : '';
    });
    $('#cal-week').innerHTML = ds.map(function (evs, d) {
      var dt = dateOf(st.w, d), today = st.w === 0 && d === 0, n = evs.length;
      return '<button type="button" class="cal-d' + (today ? ' today' : '') + (n ? '' : ' is-empty') + '" data-d="' + d + '" aria-pressed="' + (st.day === d) + '" aria-label="' + WDL[d] + ' ' + dt.getDate() + ' ' + MONL[dt.getMonth()] + (today ? ', today' : '') + ': ' + (n ? plural(n, T) : 'no ' + T.n[1]) + '">' +
        '<span class="cal-d-h"><span>' + WD[d] + ' ' + dt.getDate() + '</span>' + (today ? '<span class="badge badge-accent badge-x">TODAY</span>' : '') + '</span>' +
        '<span class="cal-d-n">' + n + '</span><span class="cal-d-l">' + T.n[n === 1 ? 0 : 1] + '</span><span class="cal-d-m">' + (n ? esc(T.pv(evs)) : '') + '</span></button>';
    }).join('');
    var sum;
    if (ipo) sum = plural(shown, T) + ' this week. Holdings and watchlist filters do not apply to IPOs.';
    else if (st.type === 'economic') {
      var cs = {}; ds.forEach(function (d) { d.forEach(function (e) { cs[CTY[e.c]] = 1; }); });
      sum = plural(shown, T) + ' this week' + (st.h || st.wl ? ' for countries where ' + (st.h && st.wl ? 'you hold or watch' : st.h ? 'you hold' : 'you watch') + ' stocks' + (shown ? ': ' + Object.keys(cs).join(', ') : '') + '. ' + all.length + ' across all countries.' : ' across all countries.');
    } else {
      sum = plural(shown, T) + ' this week from ' + who() + '.' + (st.h || st.wl ? ' ' + all.length + ' in the whole sample set.' : '');
      if (st.type === 'dividends') {
        var inc = 0; ds.forEach(function (d) { d.forEach(function (e) { var h = M.HOLD[e.id]; if (h) inc += h.q * e.amt * M.FX[I[e.id].c]; }); });
        sum += ' Expected income from your holdings this week: <b>$' + M.fmt(inc, 2) + '</b>.';
      }
    }
    $('#cal-sum').innerHTML = sum;
    var band = $('#cal-band'); band.hidden = !T.band; band.textContent = T.band || '';
  }

  /* ---------- agenda, grouped by day ---------- */
  function renderAgenda(dir) {
    var T = TYPES[st.type], ds = days(), cols = T.cols(), box = $('#cal-agenda'), all = weekOf(st.w)[st.type].length;
    if (!ds.some(function (d) { return d.length; })) {
      box.innerHTML = '<section class="card"><div class="empty cal-empty">' + M.icon('clock') + '<h2 class="t2">' + T.none + ' this week</h2><p>' +
        (all ? 'Nothing from ' + who() + ' in the week of ' + weekLabel() + '. ' + plural(all, T) + ' elsewhere in the sample set.' : 'Nothing is scheduled in the week of ' + weekLabel() + ' in the sample set.') + '</p>' +
        '<div class="cal-empty-a">' + (all ? '<button class="btn btn-primary" type="button" data-act="all">Show all</button>' : '') + (st.w < MAXW ? '<button class="btn" type="button" data-act="next">Next week</button>' : '') + '</div></div></section>';
    } else {
      box.innerHTML = '<div class="dt-wrap"><table class="dt cal-t cal-t-' + st.type + '"><caption class="sr">' + T.label + ', week of ' + weekLabel() + ', grouped by day</caption><thead><tr>' +
        cols.map(function (c) { return '<th scope="col"' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + c[0] + '</th>'; }).join('') + '</tr></thead>' +
        ds.map(function (evs, d) {
          if (st.day != null && st.day !== d) return '';
          var dt = dateOf(st.w, d);
          return '<tbody><tr class="cal-g"><th colspan="' + cols.length + '" scope="colgroup"><span class="cal-g-in">' + WDL[d] + ' ' + dt.getDate() + ' ' + MONL[dt.getMonth()] +
            (st.w === 0 && d === 0 ? '<span class="badge badge-accent badge-x">TODAY</span>' : '') + '<span class="label">' + (evs.length ? plural(evs.length, T) : T.none) + '</span></span></th></tr>' +
            (evs.length ? evs.map(function (e) { return '<tr>' + T.row(e, st.w) + '</tr>'; }).join('') : '<tr class="cal-none"><td colspan="' + cols.length + '">' + T.none + (st.type === 'ipos' ? '' : ' from ' + who()) + ' on this day.</td></tr>') + '</tbody>';
        }).join('') + '</table></div>';
    }
    if (dir && !M.rm()) { box.classList.add(dir > 0 ? 'enter-r' : 'enter-l'); void box.offsetWidth; box.classList.remove('enter-r', 'enter-l'); }
  }
  function render(dir) { renderWeek(); renderAgenda(dir); }

  /* ---------- controls ---------- */
  $('#cal-prev').innerHTML = M.icon('left'); $('#cal-next').innerHTML = M.icon('right');
  function step(by) {
    var w = Math.max(MINW, Math.min(MAXW, st.w + by));
    if (w === st.w) { M.toast('The sample calendar covers 2 November 2026 to 1 January 2027.'); return; }
    st.w = w; st.day = null; render(by);
  }
  $('#cal-prev').addEventListener('click', function () { step(-1); });
  $('#cal-next').addEventListener('click', function () { step(1); });
  $('#cal-now').addEventListener('click', function () { var by = -st.w; st.w = 0; st.day = null; render(by); });
  $('#cal-week').addEventListener('click', function (e) {
    var b = e.target.closest('.cal-d'); if (!b) return;
    var d = +b.dataset.d; st.day = st.day === d ? null : d;
    $$('#cal-week .cal-d').forEach(function (x) { x.setAttribute('aria-pressed', +x.dataset.d === st.day); });
    renderAgenda(0);
  });
  function setFilter(k) {
    if (k === 'all') { st.h = false; st.wl = false; } else if (k === 'h') st.h = !st.h; else st.wl = !st.wl;
    st.day = null; render(0);
  }
  $('#cal-flt').addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (c && !c.disabled) setFilter(c.dataset.f); });
  $('#cal-agenda').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'all') setFilter('all'); else step(1);
    $('#cal-wk').focus();
  });
  $('#cal-wk').tabIndex = -1;
  $('#cal-tz').addEventListener('change', function () { st.tz = this.value; renderAgenda(0); });

  /* type tabs, deep-linkable as #dividends */
  function go(v, dir) {
    st.type = v; st.day = null; $('#cal-panel').setAttribute('aria-label', TYPES[v].label); render(dir);
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* file:// */ }
  }
  var tabs = M.initTabs($('#cal-tabs'), go);
  function fromHash(animate) { var v = location.hash.slice(1); if (TYPES[v] && v !== st.type) tabs.select(v, animate); }
  render(0);
  fromHash(false);
  window.addEventListener('hashchange', function () { fromHash(true); });
})();
