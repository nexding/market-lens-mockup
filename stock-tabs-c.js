/* Market Lens mockup: stock page tabs "Deep-dive" and "Drawdown check". All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, esc = M.esc;
  var FONT = '500 11px Inter, system-ui, sans-serif';

  /* ---------- shared pieces ---------- */
  var XI = {
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    flag: '<path d="M6 21V4h11l-2.5 4 2.5 4H6"/>',
    minus: '<path d="M6 12h12"/>',
    half: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>'
  };
  function ic(name, cls) { return XI[name] ? '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + XI[name] + '</svg>' : M.icon(name, cls); }
  function ord(n) { var t = n % 100; return n + (t > 10 && t < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); }
  function badge(t, cls) { return '<span class="badge' + (cls ? ' ' + cls : '') + '">' + t + '</span>'; }
  function pbar(p, lo, hi, base, label, hold) {
    return '<div class="pbar tc-pb' + (hold ? ' tc-hold' : '') + '" role="img" aria-label="' + esc(label) + '" style="--p:' + p + ';--lo:' + lo + '%;--hi:' + hi + '%' + (base != null ? ';--b:' + base + '%' : '') + '">' +
      '<div class="fill"></div><div class="band"></div>' + (base != null ? '<div class="base" title="Baseline ' + base + '%"></div>' : '') + '</div>';
  }
  /* a plain sentence, where it comes from, and how unusual it is */
  function sigRow(name, src, text, pct, rtext, extra) {
    return '<li class="tc-sig"><div class="tc-sig-k"><b>' + name + '</b><span class="tc-note">' + src + '</span></div><p>' + text + '</p>' +
      '<div class="tc-sig-r">' + (extra || '') + '<div class="tc-rar"><div class="meter" aria-hidden="true" style="--v:' + pct + '%"><i></i></div><span><b>' + ord(pct) + ' percentile.</b> ' + rtext + '</span></div></div></li>';
  }
  function table(head, rows, cls) {
    return '<div class="tc-tbl"><div class="dt-wrap"><table class="dt' + (cls ? ' ' + cls : '') + '"><thead><tr>' + head.map(function (h) { return '<th scope="col"' + (h[1] ? ' ' + h[1] : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div></div>';
  }
  function fillWhenSeen(nodes) {
    function on(n) { n.classList.add('in'); }
    if (M.rm() || !('IntersectionObserver' in window)) { nodes.forEach(on); return; }
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { on(e.target); io.unobserve(e.target); } }); }, { threshold: 0.6 });
    nodes.forEach(function (n) { io.observe(n); });
  }
  function plotCtx(hostEl) {
    var w = hostEl.clientWidth, h = hostEl.clientHeight; if (!w || !h) return null;
    return { c: M.fitCanvas($('canvas', hostEl), w, h), w: w, h: h };
  }
  /* repaint a tab's canvases on resize and when the colours or density change, while the tab is on screen */
  function keepPainted(host, fn, watch) {
    var raf = 0;
    function run() { raf = 0; if (host.offsetParent !== null) fn(); }
    function ask() { if (!raf) raf = requestAnimationFrame(run); }
    window.addEventListener('resize', ask); document.addEventListener('ml:paint', ask);
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(ask); (watch || []).forEach(function (n) { ro.observe(n); }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ask);
  }
  /* positioning readings quoted on both tabs */
  var SIG = { si: 2.8, siPeak: 1.6, siPct: 91, dtc: 3.1, ivr: 78, iv: 34, impl: 6.4, act: 4.9, skew: 5.2, skewPct: 83, pcOI: 0.92, pcMed: 0.71, pcVol: 1.10 };
  function siSeries(id) { return M.bridge(id + ':si-a', 40, 1.72, SIG.siPeak, 0.03).concat(M.bridge(id + ':si-b', 10, SIG.siPeak + 0.12, SIG.si, 0.015)); }
  function siSpark(cv, id) { M.spark(cv, siSeries(id), { w: 120, h: 32, fill: true, color: M.COL['data-2'] }); }
  var SI_TEXT = 'Short interest is ' + SIG.si + '% of the float, up from ' + SIG.siPeak + '% at the July peak, and would take ' + SIG.dtc + ' days of average volume to cover.';
  var INSIDER_TEXT = 'Two insiders, the Chief Financial Officer and a director, bought shares on the open market on 4 and 11 August, raising their own holdings by 6% and 11%. No insider has sold on the open market since the July peak; sales under pre-arranged 10b5-1 plans and option exercises are counted separately.';

  /* =====================================================================
     Deep-dive
     ===================================================================== */
  M.stockTab('deepdive', function (host, ctx) {
    var id = ctx.id, it = ctx.it, D = ctx.DATA.restated, nz = ctx.nz, Q = ctx.QTRS;
    function a4(k) { return D[k].a[4]; }
    var SECS = [['filing', 'Filing changes'], ['calls', 'Earnings calls'], ['cred', 'Credibility'], ['own', 'Ownership signals'], ['peers', 'Peers'], ['opts', 'Options signals'], ['chain', 'Supply chain']];
    function sec(k, title, badges, lead, body) {
      return '<section class="card tc-sec reveal" id="tc-' + k + '" data-s="' + k + '" aria-labelledby="tc-h-' + k + '"><header class="card-h"><h2 id="tc-h-' + k + '" tabindex="-1">' + title + '</h2><div class="card-a">' + badges + '</div></header>' +
        (lead ? '<p class="tc-lead">' + lead + '</p>' : '') + body + '</section>';
    }

    /* ----- 1. filing changes: [-removed-] and [+added+] mark the edits inside each paragraph ----- */
    function gmOf(y) { return D.gp.a[y] / D.rev.a[y] * 100; }
    function gmMove(y) { var bp = Math.round((gmOf(y) - gmOf(y - 1)) * 100); return (bp >= 0 ? 'an increase' : 'a decrease') + ' of ' + Math.abs(bp) + ' basis points'; }
    var gmUp = gmOf(4) >= gmOf(3);
    var CH = [
      { item: 'Item 1A · Risk factors', sec: 'rf' }, { same: 12, sec: 'rf' },
      { k: 'c1', sec: 'rf', t: 'Customer concentration', kind: 'Edited', cat: 'New risk', m: 4, flag: 1, why: 'First disclosure that two customers make up 23% of revenue.', q: 'two customers together accounted for approximately 23% of total net revenue',
        x: 'We sell our products and services to a broad base of customers through direct and indirect channels. The loss of, or a significant reduction in purchases by, one or more large customers could adversely affect our results of operations.[+ In fiscal 2025, two customers together accounted for approximately 23% of total net revenue, and we expect this concentration to continue.+]' },
      { same: 7, sec: 'rf' },
      { k: 'c2', sec: 'rf', t: 'Dependence on suppliers', kind: 'Edited', cat: 'New risk', m: 2, flag: 1, why: 'Names single-source components for the first time, without sizing the exposure.', q: 'some custom components are obtained from a single source',
        x: 'We rely on a limited number of suppliers for certain components[+, and some custom components are obtained from a single source+].[+ A disruption at a single-source supplier could delay shipments for one or more quarters.+]' },
      { same: 19, sec: 'rf' },
      { k: 'c3', sec: 'rf', t: 'Trade policy', kind: 'Edited', cat: 'Tone', m: 3, why: 'A possible cost has become a cost already incurred.', q: 'have increased and could further increase our costs',
        x: 'Changes in trade policy[- could increase-][+, including tariffs and export licensing requirements introduced during fiscal 2025, have increased and could further increase+] our costs and reduce demand for our products in some markets.' },
      { same: 4, sec: 'rf' },
      { k: 'c5', sec: 'rf', t: 'Patent dispute', kind: 'Removed', cat: 'Removed risk', m: 2, why: 'The dispute was settled during the year, so the paragraph was dropped.', q: 'We are a party to a patent dispute',
        x: '[-We are a party to a patent dispute concerning certain features of our products. An adverse outcome could require us to pay damages or to change those features.-]' },
      { same: 23, sec: 'rf' },
      { k: 'c4', sec: 'rf', t: 'Information security', kind: 'Edited', cat: 'Boilerplate', m: 1, why: 'A wording refresh; no new exposure is described.', q: 'aligned with recognised industry frameworks',
        x: 'We maintain an information security programme [-designed to protect-][+that is aligned with recognised industry frameworks and is designed to protect+] our systems and the data we hold.' },
      { same: 9, sec: 'rf' },
      { item: 'Item 7 · Management’s discussion and analysis (MD&A)', sec: 'mda' }, { same: 5, sec: 'mda' },
      { k: 'c7', sec: 'mda', t: 'Gross margin', kind: 'Edited', cat: 'Quantitative', m: 3, why: gmUp ? 'The margin commentary now names freight and component costs as a drag.' : 'The margin fell, and freight and component costs are named as the cause.', q: 'higher freight and component costs',
        x: 'Gross margin was [-' + gmOf(3).toFixed(1) + '% in fiscal 2024, ' + gmMove(3) + ' from fiscal 2023, driven by a larger share of services revenue-][+' + gmOf(4).toFixed(1) + '% in fiscal 2025, ' + gmMove(4) + ' from fiscal 2024, as ' +
          (gmUp ? 'a larger share of services revenue more than offset higher freight and component costs' : 'higher freight and component costs more than offset a larger share of services revenue') + '+].' },
      { same: 11, sec: 'mda' },
      { k: 'c6', sec: 'mda', t: 'Capital return', kind: 'Removed', cat: 'Removed guidance', m: 4, flag: 1, why: 'The only forward-looking capital-return paragraph is gone, with nothing in its place.', q: 'return approximately 90% of free cash flow to shareholders',
        x: '[-We expect to return approximately 90% of free cash flow to shareholders through dividends and share repurchases over the next three fiscal years.-]' },
      { same: 3, sec: 'mda' },
      { k: 'c8', sec: 'mda', t: 'Liquidity', kind: 'Edited', cat: 'Tone', m: 2, why: 'The liquidity statement now lists debt repayment among the needs.', q: 'working capital, capital expenditure and debt repayment needs',
        x: 'We believe our cash, cash equivalents and marketable securities will be sufficient to meet our [-needs-][+working capital, capital expenditure and debt repayment needs+] for at least the next 12 months.' },
      { same: 14, sec: 'mda' }
    ];
    var CHANGES = CH.filter(function (c) { return c.k; }), UNCH = CH.reduce(function (s, c) { return s + (c.same || 0); }, 0);
    function lvl(m) { return m >= 4 ? 'high' : m === 3 ? 'med' : 'low'; }
    function side(x, keep, tag, word) {
      var drop = keep === '+' ? '-' : '+';
      return esc(x).replace(new RegExp('\\[\\' + drop + '[\\s\\S]*?\\' + drop + '\\]', 'g'), '')
        .replace(new RegExp('\\[\\' + keep + '([\\s\\S]*?)\\' + keep + '\\]', 'g'), '<' + tag + '><span class="sr">' + word + ': </span>$1</' + tag + '>');
    }
    function density(x) {
      var ch = 0; x.replace(/\[[+-]([\s\S]*?)[+-]\]/g, function (m, s) { ch += s.trim().split(/\s+/).length; return ''; });
      return ch / x.replace(/\[[+-]|[+-]\]/g, ' ').trim().split(/\s+/).length;
    }
    function matHTML(m) {
      var l = m >= 4 ? 'High' : m === 3 ? 'Medium' : 'Low', p = '';
      for (var i = 1; i <= 5; i++) p += '<i' + (i <= m ? ' class="on"' : '') + '></i>';
      return '<span class="tc-mat" data-l="' + l.toLowerCase() + '"><span class="pips" aria-hidden="true">' + p + '</span>Materiality ' + m + ' of 5 · ' + l + '</span>';
    }
    function rowHTML(c) {
      if (c.item) return '<h3 class="tc-df-item" data-sec="' + c.sec + '">' + esc(c.item) + '</h3>';
      if (c.same) return '<div class="tc-df tc-df-same" data-sec="' + c.sec + '"><span class="tc-df-g"></span><span>' + c.same + ' unchanged paragraphs</span></div>';
      var d = density(c.x), pc = Math.round(d * 100);
      return '<article class="tc-df" id="tc-' + c.k + '" data-sec="' + c.sec + '" data-m="' + lvl(c.m) + '" aria-label="' + esc(c.t) + ': ' + c.kind.toLowerCase() + ', materiality ' + c.m + ' of 5" tabindex="-1">' +
        '<span class="tc-df-g" title="' + pc + '% of the words changed"><i style="--d:' + (0.14 + d * 0.86).toFixed(2) + '"></i></span>' +
        '<div class="tc-df-c" data-y="10-K FY2024">' + side(c.x, '-', 'del', 'Removed') + '</div>' +
        '<div class="tc-df-c" data-y="10-K FY2025">' + (c.kind === 'Removed' ? '<span class="dim">This paragraph is not in the FY2025 filing.</span>' : side(c.x, '+', 'ins', 'Added')) + '</div>' +
        '<div class="tc-df-m"><b>' + esc(c.t) + '</b>' + badge(c.kind + ' · ' + c.cat) + (c.flag ? badge(ic('flag', 'ic-sm') + 'Rule flag', 'tc-flagb') : '') + matHTML(c.m) +
        '<span class="tc-why">' + esc(c.why) + ' <span class="dim">' + pc + '% of the words changed.</span></span>' +
        '<span class="tc-ok">' + ic('check', 'ic-sm') + '<span>Quote verified against the ' + (c.kind === 'Removed' ? 'FY2024' : 'FY2025') + ' filing: <q>' + esc(c.q) + '</q></span></span></div></article>';
    }
    var FLAGS = [['c1', 'New customer-concentration sentence', 'New sentence on dependence on two customers for 23% of revenue', 'Risk factors', 4],
      ['c6', 'Guidance paragraph disappeared', 'Capital-return guidance paragraph removed from MD&A', 'MD&A', 4],
      ['c2', 'Supplier-dependence wording changed', 'Supplier wording expanded to single-source components', 'Risk factors', 2]];
    function cnt(fn) { return CHANGES.filter(fn).length; }
    function chips(key, label, opts) {
      return '<div class="chips" role="group" aria-label="Filter by ' + label.toLowerCase() + '" data-f="' + key + '"><span class="label">' + label + '</span>' + opts.map(function (o, i) {
        return '<button class="chip" type="button" data-v="' + o[0] + '" aria-pressed="' + (i === 0) + '">' + esc(o[1]) + ' <span class="dim">' + o[2] + '</span></button>';
      }).join('') + '</div>';
    }
    var filing =
      '<div class="tc-pins" role="group" aria-label="Rule flags"><div class="tc-pins-h">' + ic('flag', 'ic-sm') + '<b>3 rule flags</b><span class="tc-note">Raised by fixed rules, whatever the language model says. They stay pinned above the diff.</span></div><ul>' +
      FLAGS.map(function (f) {
        return '<li class="tc-pin"><i' + (f[4] < 3 ? ' class="lo"' : '') + ' aria-hidden="true"></i><div><b>' + esc(f[2]) + '</b><div class="tc-note">Rule: ' + f[1] + ' · ' + esc(f[3]) + ' · ' + (f[4] < 3 ? 'low materiality' : 'materiality ' + f[4] + ' of 5') + '</div></div>' +
          '<button class="linkish" type="button" data-jump="' + f[0] + '">Show in the diff</button></li>';
      }).join('') + '</ul></div>' +
      '<div class="tc-filters">' +
        chips('m', 'Materiality', [['all', 'All', CHANGES.length], ['high', 'High', cnt(function (c) { return c.m >= 4; })], ['med', 'Medium', cnt(function (c) { return c.m === 3; })], ['low', 'Low', cnt(function (c) { return c.m < 3; })]]) +
        chips('sec', 'Section', [['all', 'All', CHANGES.length], ['rf', 'Risk factors', cnt(function (c) { return c.sec === 'rf'; })], ['mda', 'MD&A', cnt(function (c) { return c.sec === 'mda'; })]]) +
        '<span class="sp"></span><span class="tc-note" id="tc-df-n" role="status"></span></div>' +
      '<div class="tc-key"><span><ins>Added in FY2025</ins> is underlined</span><span><del>Removed since FY2024</del> is struck through</span><span><i class="sw" aria-hidden="true"></i>Gutter: the darker the strip, the larger the share of the paragraph that changed</span></div>' +
      '<div class="tc-diff" id="tc-diff"><div class="tc-df-h" aria-hidden="true"><span></span><span>10-K FY2024</span><span>10-K FY2025</span></div>' + CH.map(rowHTML).join('') +
      '<p class="tc-df-none" id="tc-df-none" hidden>No changed paragraph matches these filters.</p></div>' +
      '<p class="tc-note" style="margin-top:10px">' + CHANGES.length + ' of ' + (CHANGES.length + UNCH) + ' aligned paragraphs changed. Paragraphs are matched locally; only changed ones are rated, and a rating is dropped if its quote is not found word for word in the filing.</p>';

    /* ----- 2. earnings calls ----- */
    var CALLS = ['Q4 FY23'].concat(Q), LATEST = Q[7];
    function tone(seed, base, last, rise) {
      var a = [], i;
      for (i = 0; i < 8; i++) a.push(base + nz(id + seed + i) * 0.08);
      if (rise) { a[6] = a[5] + 0.08; a[7] = a[6] + 0.08; }
      a.push(last); return a;
    }
    var TONE = [['Negative words', tone('tn', 1.18, 1.62)], ['Uncertain words', tone('tu', 0.92, 1.31)], ['Hedging words', tone('th', 0.58, 0.93, true)]];
    function avg8(a) { return a.slice(0, 8).reduce(function (s, v) { return s + v; }, 0) / 8; }
    var toneHTML = '<div class="tc-tone">' + TONE.map(function (t, i) {
      var a = t[1], last = a[8], mean = avg8(a), above = a.slice(0, 8).filter(function (v) { return v < last; }).length;
      return '<div class="tc-tone-c"><div class="label">' + t[0] + '</div><div class="tc-tone-v">' + last.toFixed(2) + '%<small>of words · own average ' + mean.toFixed(2) + '%</small></div>' +
        '<div class="plot tc-tone-p" data-tone="' + i + '"><canvas role="img" aria-label="' + t[0] + ' by call, ' + CALLS[0] + ' to ' + LATEST + ': ' + last.toFixed(2) + '% of words in the latest call against an average of ' + mean.toFixed(2) + '% over the previous eight"></canvas></div>' +
        '<p class="tc-note">' + M.fsign(last - mean, 2) + ' points against its own average; higher than in ' + (above === 8 ? 'all 8' : above + ' of the 8') + ' previous calls.</p></div>';
    }).join('') + '</div><div class="lg tc-tone-lg"><span><i style="background:var(--accent)"></i>Latest call (' + LATEST + ')</span><span><i style="background:var(--text-3)"></i>Previous eight calls</span><span><i class="dash"></i>Own eight-call average</span></div>';
    function drawTone(hostEl, a) {
      var p = plotCtx(hostEl); if (!p) return;
      var c = p.c, w = p.w, h = p.h, n = a.length, pt = 18, pb = 20, hi = Math.max.apply(null, a) * 1.06, gap = w < 240 ? 4 : 7, bw = (w - gap * (n - 1)) / n, base = h - pb;
      function Y(v) { return pt + (1 - v / hi) * (base - pt); }
      c.clearRect(0, 0, w, h); c.font = FONT; c.textBaseline = 'middle';
      a.forEach(function (v, i) {
        var x = i * (bw + gap), y = Y(v), r = Math.min(3, bw / 2);
        c.fillStyle = i === n - 1 ? M.COL.accent : M.rgba(M.COL['text-3'], 0.5);
        c.beginPath(); if (c.roundRect) c.roundRect(x, y, bw, base - y, [r, r, 0, 0]); else c.rect(x, y, bw, base - y); c.fill();
      });
      var my = Math.round(Y(avg8(a))) + 0.5;
      c.setLineDash([3, 3]); c.strokeStyle = M.COL['text-2']; c.lineWidth = 1; c.beginPath(); c.moveTo(0, my); c.lineTo(w - bw - gap, my); c.stroke(); c.setLineDash([]);
      c.fillStyle = M.COL['text-1']; c.textAlign = 'right'; c.fillText(a[n - 1].toFixed(2) + '%', w, Y(a[n - 1]) - 9);
      c.fillStyle = M.COL['text-3']; c.fillText(CALLS[n - 1], w, h - 8); c.textAlign = 'left'; c.fillText(CALLS[0], 0, h - 8);
    }
    function rnd(v) { var u = v > 5000 ? 100 : v > 500 ? 10 : 1; return M.fmt(Math.round(v / u) * u, 0); }
    function span(lo) { return lo.toFixed(1) + ' to ' + (lo + 1).toFixed(1) + '%'; }
    var gLo = Math.round(gmOf(4) * 2) / 2 - 1, capex = -a4('capex');
    var GUIDE = [['Revenue growth, next fiscal year', '5 to 7%', '6 to 8%', 'dn'], ['Gross margin, next fiscal year', span(gLo), span(gLo + 0.5), 'dn'], ['Operating expense growth', 'About 6%', 'About 6%', 'eq'],
      ['Capital expenditure (USD millions)', 'About ' + rnd(capex * 1.12), 'About ' + rnd(capex * 1.06), 'up'], ['Capital return', 'No figure given', 'About 90% of free cash flow over three years', 'x'], ['Tax rate', 'About 16%', 'About 16%', 'eq']];
    var DIR = { up: ['▲', 'Raised'], dn: ['▼', 'Lowered'], eq: ['–', 'Unchanged'], x: ['✕', 'Withdrawn'] };
    var guideHTML = table([['Metric'], ['This call (' + LATEST + ')'], ['Last call (' + Q[6] + ')'], ['Direction', 'class="l"']], GUIDE.map(function (g) {
      return '<tr><td>' + g[0] + '</td><td>' + g[1] + '</td><td>' + g[2] + '</td><td class="l"><span class="tc-dir"><i aria-hidden="true">' + DIR[g[3]][0] + '</i>' + DIR[g[3]][1] + '</span></td></tr>';
    }));
    var TAG = { a: ['check', 'Answered'], p: ['half', 'Partly answered'], d: ['warn', 'Deflected'] };
    var QA = [
      ['A', 'How much of next year’s revenue depends on the two largest customers?', 'p', 'Repeated the 23% figure for fiscal 2025 but gave no outlook by customer.'],
      ['B', 'Why was the capital-return target left out of the outlook?', 'd', 'Said the board keeps all options under review, then moved to the next question.'],
      ['C', 'What is behind the lower gross margin range?', 'a', 'Freight and component costs, sized at about 60 basis points.'],
      ['D', 'Is there a second source for the custom components?', 'p', 'A second supplier is being qualified; no date was given on the call.'],
      ['E', 'Have any orders been cancelled since the summer?', 'a', 'No cancellations; two customers moved deliveries back by a quarter.'],
      ['F', 'Will repurchases continue at the pace of the past two years?', 'd', 'Answered with a description of past repurchases and no statement about the future.'],
      ['G', 'What does the capital expenditure increase pay for?', 'a', 'Mostly the second assembly site, with the split given by quarter.'],
      ['H', 'How is services revenue growing against products?', 'a', 'Gave growth rates for both and the share of recurring contracts.']
    ];
    function nTag(t) { return QA.filter(function (q) { return q[2] === t; }).length; }
    var qaHTML = '<div class="tc-tally" role="img" aria-label="' + QA.length + ' analyst questions: ' + nTag('a') + ' answered, ' + nTag('p') + ' partly answered, ' + nTag('d') + ' deflected">' +
      ['a', 'p', 'd'].map(function (t) { return '<i data-t="' + t + '" style="flex:' + nTag(t) + '"></i>'; }).join('') + '</div>' +
      '<div class="lg tc-qa-lg">' + ['a', 'p', 'd'].map(function (t) { return '<span><i data-t="' + t + '"></i>' + TAG[t][1] + ' ' + nTag(t) + '</span>'; }).join('') + '</div>' +
      '<ul class="tc-qa">' + QA.map(function (q) {
        return '<li><span class="tc-qa-who">Analyst, Firm ' + q[0] + '</span><div><b>' + q[1] + '</b><p class="tc-note">' + q[3] + '</p></div><span class="tc-tag" data-t="' + q[2] + '">' + ic(TAG[q[2]][0], 'ic-sm') + TAG[q[2]][1] + '</span></li>';
      }).join('') + '</ul>';
    var calls = '<h3 class="tc-sub">Tone<small>dictionary word rates, this call against the company’s own previous eight</small></h3>' + toneHTML +
      '<h3 class="tc-sub">Guidance<small>statements with a metric, a value and a period</small></h3>' + guideHTML +
      '<h3 class="tc-sub">Analyst questions<small>did the answer address what was asked?</small></h3>' + qaHTML;

    /* ----- 3. credibility ----- */
    var OUT = { met: ['check', 'Met'], missed: ['x', 'Missed'], withdrawn: ['minus', 'Withdrawn'], open: ['clock', 'Open'] };
    var CLAIMS = [
      ['Qualify a second supplier for the custom components', '2026-10-29', '2026-12-31', 'open'],
      ['Revenue growth of 5 to 7% next fiscal year', '2026-10-29', '2027-09-30', 'open'],
      ['Hold headcount flat through the March quarter', '2026-10-29', '2027-03-31', 'open'],
      ['Return about 90% of free cash flow over three fiscal years', '2025-10-30', '2028-09-30', 'withdrawn', 'on 29 Oct 2026'],
      ['Full-year revenue growth of 7 to 9%', '2026-01-29', '2026-09-30', 'missed', 'lowered on 30 Jul'],
      ['Inventory under ten weeks of supply by the September quarter', '2026-04-30', '2026-09-30', 'met'],
      ['Finish the regional warehouse consolidation within the fiscal year', '2026-01-29', '2026-09-30', 'met'],
      ['Open 40 new service locations in the fiscal year', '2025-10-30', '2026-09-30', 'withdrawn', 'on 30 Apr 2026'],
      ['Second assembly site in volume production by the June quarter', '2025-10-30', '2026-06-30', 'missed', 'one quarter late'],
      ['Ship the next product generation in the first half of the fiscal year', '2025-10-30', '2026-03-31', 'met'],
      ['Launch in two more countries during the December quarter', '2025-10-30', '2025-12-31', 'met'],
      ['Move every customer account to the new billing platform by December', '2025-07-31', '2025-12-31', 'met']
    ];
    function dfmt(s) { var p = s.split('-'); return +p[2] + ' ' + ctx.MON[+p[1] - 1] + ' ' + p[0]; }
    var cred = '<div class="tc-cred"><div class="tc-cred-l">' +
      '<div class="label">Dated, checkable claims later met</div><div class="tc-big">71%<small>80% interval 58 to 82%</small></div>' +
      pbar(0.71, 58, 82, 64, 'Credibility 71%, 80% interval 58 to 82%, sector 64%') +
      '<div class="pbar-l"><span>24 resolved claims: 18 met, 4 missed, 2 withdrawn</span><span>Sector 64%</span></div>' +
      '<div class="tc-tiles"><div class="tc-tile"><span class="label">Guidance bias</span><b>Slightly cautious</b><span class="tc-note">Results landed 0.8% above the guided midpoint on average.</span></div>' +
      '<div class="tc-tile"><span class="label">Withdrawal rate</span><b>8%</b><span class="tc-note">2 of 24 claims withdrawn; the sector rate is 5%. Each counts as a miss.</span></div>' +
      '<div class="tc-tile"><span class="label">Hedging trend</span><b>Rising</b><span class="tc-note">Hedging words up for three calls running.</span><canvas class="tc-spark" id="tc-hed" role="img" aria-label="Hedging word rate over the last nine calls, rising for the last three"></canvas></div></div>' +
      '<p class="tc-method"><b>Method.</b> The share of dated, checkable claims that were later met (18 of 24), shrunk toward the sector rate of 64% because 24 claims is a small sample. With fewer than eight resolved claims the score reads “insufficient history”.</p>' +
      '<p class="tc-note" style="margin-top:8px">The score implies a forecast, “the next dated guidance is met: 71%”, which is written to the prediction ledger and compared with the sector rate.</p></div>' +
      '<div><h3 class="tc-sub">Claims<small>the 12 most recent of 27: 24 resolved, 3 open</small></h3>' +
      table([['Claim', 'data-sort="text"'], ['Made on', 'data-sort="text"'], ['Deadline', 'data-sort="text"'], ['Outcome', 'data-sort="text" class="l"']], CLAIMS.map(function (c) {
        return '<tr><td>' + c[0] + '</td><td data-v="' + c[1] + '">' + dfmt(c[1]) + '</td><td data-v="' + c[2] + '">' + dfmt(c[2]) + '</td><td class="l" data-v="' + c[3] + '"><span class="tc-out" data-o="' + c[3] + '">' + ic(OUT[c[3]][0], 'ic-sm') + OUT[c[3]][1] + (c[4] ? ' <small>' + c[4] + '</small>' : '') + '</span></td></tr>';
      }), 'tc-claims') + '</div></div>';

    /* ----- 4. ownership signals ----- */
    var own = '<ul class="tc-sigs">' +
      sigRow('Insider buying and selling', 'Form 4 filings to 13 Nov 2026', INSIDER_TEXT, 86, 'Open-market buying on this scale is rarer than in 86% of 90-day periods in this stock’s history.') +
      sigRow('Cluster activity', 'Form 4 filings to 13 Nov 2026', 'Two insiders bought within 30 days of each other. Three or more would count as a cluster, so this falls one short.', 71, 'Two buyers inside 30 days is rarer than 71% of periods.') +
      sigRow('13F holders', 'Positions as of 30 Sep 2026 ' + badge('45-day lag'), 'The number of institutional holders fell 2.9% in the quarter to 30 September: 64 funds closed their positions and 23 opened one. The ten largest holders own 38.2% of the shares, up from 37.9%. These filings were due on 14 November, so the picture is at least 45 days old.', 78, 'A fall in the holder count this large is rarer than 78% of quarters.') +
      sigRow('Short interest', 'Exchange settlement date 30 Oct 2026', SI_TEXT, SIG.siPct, 'Higher than ' + SIG.siPct + '% of readings in its own two-year history.', '<canvas class="tc-spark" id="tc-si" role="img" aria-label="Short interest as a share of the float over two years: flat near 1.7%, then rising to 2.8% since July"></canvas>') +
      '</ul>';

    /* ----- 5. peers ----- */
    var P0 = ctx.HI52 / 1.37, mcap = ctx.shares * P0, myPE = P0 / ctx.eps;
    var peers = M.LIST.filter(function (x) { return x.id !== id && x.sec === it.sec; }).concat(M.LIST.filter(function (x) { return x.id !== id && x.sec !== it.sec; })).slice(0, 8);
    var same = peers.filter(function (x) { return x.sec === it.sec; }).length;
    var MET = [
      { k: 'pe', n: 'P/E (trailing)', v: myPE, u: '×' },
      { k: 'ev', n: 'EV/EBITDA', v: (mcap + a4('debt') - a4('cash') - a4('sec')) / (a4('oi') + a4('da')), u: '×' },
      { k: 'ps', n: 'Price to sales', v: mcap / a4('rev'), u: '×' },
      { k: 'pb', n: 'Price to book', v: mcap / a4('eq'), u: '×' },
      { k: 'fy', n: 'Free-cash-flow yield', v: a4('fcf') / mcap * 100, u: '%', inv: 1 }
    ];
    MET.forEach(function (m) {
      m.p = peers.map(function (p) {
        var pe = 14 + M.hash(p.id + 'pe') % 22, f = 1 + nz(p.id + ':' + m.k) * 0.28;
        return m.k === 'pe' ? pe : m.inv ? m.v * myPE / pe * f : m.v / myPE * pe * f;
      });
      m.lo = m.inv ? m.v / 1.46 : m.v * 0.9; m.hi = m.inv ? m.v / 0.9 : m.v * 1.46;
      var all = m.p.concat([m.lo, m.hi]), mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), pad = (mx - mn) * 0.04;
      m.min = mn - pad; m.max = mx + pad;
      m.below = m.p.filter(function (v) { return v < m.v; }).length; m.above = m.p.filter(function (v) { return v > m.v; }).length;
    });
    function fv(m, v) { return M.fmt(v, 1) + m.u; }
    function pos(m, v) { return ((v - m.min) / (m.max - m.min) * 100).toFixed(2) + '%'; }
    var strips = MET.map(function (m) {
      var rank = m.below >= m.above ? 'Higher than ' + m.below + ' of 8 peers' : 'Lower than ' + m.above + ' of 8 peers', own5 = (m.inv ? 'high' : 'low') + ' in its own five-year range';
      return '<div class="tc-strip"><div class="tc-st-n">' + m.n + '</div>' +
        '<div role="img" aria-label="' + m.n + ': ' + esc(id) + ' at ' + fv(m, m.v) + '. ' + rank + ', which run from ' + fv(m, Math.min.apply(null, m.p)) + ' to ' + fv(m, Math.max.apply(null, m.p)) + '. Own five-year range ' + fv(m, m.lo) + ' to ' + fv(m, m.hi) + '">' +
        '<div class="tc-st-track"><span class="tc-st-band" style="--a:' + pos(m, m.lo) + ';--b:' + pos(m, m.hi) + '" title="Own five-year range: ' + fv(m, m.lo) + ' to ' + fv(m, m.hi) + '"></span>' +
        peers.map(function (p, i) { return '<i class="tc-st-dot" data-p="' + esc(p.id) + '" style="--x:' + pos(m, m.p[i]) + ';--j:' + (nz(p.id + 'j' + m.k) * 8).toFixed(1) + 'px" title="' + esc(p.id) + ' ' + fv(m, m.p[i]) + '"></i>'; }).join('') +
        '<i class="tc-st-me" style="--x:' + pos(m, m.v) + '" title="' + esc(id) + ' ' + fv(m, m.v) + '"></i></div>' +
        '<div class="tc-st-ax" aria-hidden="true"><span>' + fv(m, m.min) + '</span><span>' + fv(m, m.max) + '</span></div></div>' +
        '<div class="tc-st-v"><b>' + fv(m, m.v) + '</b><span class="tc-note">' + rank + '; ' + own5 + '.</span></div></div>';
    }).join('');
    var peerTable = table([['Company']].concat(MET.map(function (m) { return [m.n]; })),
      ['<tr class="tc-me"><td>' + esc(id) + ' (this stock)</td>' + MET.map(function (m) { return '<td>' + fv(m, m.v) + '</td>'; }).join('') + '</tr>'].concat(peers.map(function (p, i) {
        return '<tr data-p="' + esc(p.id) + '"><td>' + M.tk(p.id, { name: false }) + '</td>' + MET.map(function (m) { return '<td>' + fv(m, m.p[i]) + '</td>'; }).join('') + '</tr>';
      })).concat(['<tr><td>Own five-year range</td>' + MET.map(function (m) { return '<td>' + M.fmt(m.lo, 1) + ' to ' + fv(m, m.hi) + '</td>'; }).join('') + '</tr>']));
    var peersHTML = '<div class="tc-peerlist"><span class="label">Peer set</span>' + peers.map(function (p) { return '<span data-p="' + esc(p.id) + '">' + M.tk(p.id, { name: false }) + '</span>'; }).join('') +
      '<button class="btn btn-sm" type="button" data-stub="Editing the peer set">Edit peers</button></div>' + strips +
      '<div class="lg tc-peer-lg" style="margin-top:12px"><span><i class="me"></i>' + esc(id) + '</span><span><i class="pd"></i>A peer (hover or focus a ticker to follow it across the rows)</span><span><i class="bd"></i>' + esc(id) + '’s own five-year range, point in time</span></div>' +
      '<details class="tc-det"><summary>Show table</summary>' + peerTable + '</details>';

    /* ----- 6. options signals ----- */
    function cmp(rows, max) {
      return '<div class="tc-cmp">' + rows.map(function (r, i) { return '<span>' + r[0] + '</span><div class="meter' + (i ? ' ref' : '') + '" aria-hidden="true" style="--v:' + (r[1] / max * 100).toFixed(1) + '%"><i></i></div><b>' + r[2] + '</b>'; }).join('') + '</div>';
    }
    function rank(v) { return '<div><div class="meter" aria-hidden="true" style="--v:' + v + '%"><i></i></div><div class="tc-scale" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div></div>'; }
    var OPT = [
      ['Implied volatility rank', 'Implied volatility is ' + SIG.iv + '%, higher than on ' + SIG.ivr + '% of days in the past year: a rank of ' + SIG.ivr + ' out of 100.', rank(SIG.ivr)],
      ['Earnings move priced in', 'Options price in a move of about ' + SIG.impl + '% in either direction by 29 January, the next earnings date. The last eight earnings moves averaged ' + SIG.act + '%.', cmp([['Priced in', SIG.impl, SIG.impl + '%'], ['Average actual', SIG.act, SIG.act + '%']], 8)],
      ['Skew', 'Downside protection costs ' + SIG.skew + ' volatility points more than the equivalent upside (25-delta puts against calls), a wider gap than on ' + SIG.skewPct + '% of days in its own two-year history.', rank(SIG.skewPct)],
      ['Put/call positioning', 'There are ' + SIG.pcOI.toFixed(2) + ' puts open for every call, against a one-year median of ' + SIG.pcMed.toFixed(2) + '. Today’s volume ratio is ' + SIG.pcVol.toFixed(2) + '.', cmp([['Open interest', SIG.pcOI, SIG.pcOI.toFixed(2)], ['One-year median', SIG.pcMed, SIG.pcMed.toFixed(2)]], 1.2)]
    ];
    var opts = '<div class="tc-opts">' + OPT.map(function (o) { return '<div class="tc-opt"><span class="label">' + o[0] + '</span><p>' + o[1] + '</p>' + o[2] + '</div>'; }).join('') + '</div>' +
      '<div class="band">' + M.icon('doc') + '<span>These sentences describe what the options market is pricing and how unusual that is. No direction is predicted.</span></div>';

    /* ----- 7. supply chain ----- */
    var comp = M.LIST.filter(function (x) { return x.id !== id && x.sec === it.sec; }).slice(0, 2);
    function node(k, name, rel, kind, src, cls) {
      return '<div class="tc-n' + (cls ? ' ' + cls : '') + '"' + (k ? ' data-n="' + k + '"' : '') + ' data-kind="' + kind + '"><div class="tc-n-t">' + name + '</div><div class="tc-n-r">' + rel + '</div><div class="tc-n-s">' + (kind === 'fact' ? 'Filing fact' : 'Inference') + ' · ' + src + '</div></div>';
    }
    function compNode(k, i) { return node(k, comp[i] ? M.tk(comp[i].id, { name: false }) : 'Competitor ' + 'AB'[i], 'Competes with', 'inf', 'similar business descriptions'); }
    var EDGES = [['s1', 'me', 'h', 'fact'], ['s2', 'me', 'h', 'fact'], ['s3', 'me', 'h', 'inf'], ['me', 'k1', 'h', 'fact'], ['me', 'k2', 'h', 'fact'], ['me', 'k3', 'h', 'inf'], ['me', 'p1', 'v', 'inf'], ['me', 'p2', 'v', 'inf']];
    var ROWS = [['Supplier A', 'supplies', id, '—', '10-K FY2025, risk factors: custom components from a single source', 'fact'], ['Supplier B', 'supplies', id, '—', '10-K FY2025, business section: contract assembly', 'fact'],
      ['Freight carrier group', 'supplies', id, '—', 'Shipping records and news; no filing names the carrier', 'inf'], ['Materials supplier', 'supplies', 'Supplier A', '—', 'Supplier A’s own filing; second hop, so exposure is halved', 'inf'],
      ['Customer A', 'buys from', id, '13% (disclosed)', '10-K FY2025, concentration-risk fact', 'fact'], ['Customer B', 'buys from', id, '10% (disclosed)', '10-K FY2025, concentration-risk fact', 'fact'],
      ['Distributor group', 'buys from', id, 'Not disclosed', 'The distributor’s filing names the product line', 'inf']]
      .concat([0, 1].map(function (i) { return [comp[i] ? comp[i].id : 'Competitor ' + 'AB'[i], 'competes with', id, '—', 'Similar business descriptions', 'inf']; }));
    var chain = '<div class="tc-chain" id="tc-chain-g" role="group" aria-label="Supply-chain graph for ' + esc(id) + ': three suppliers on the left, three customers on the right, two competitors. Customer A and Customer B together buy 23% of revenue. The table below lists every link.">' +
      '<svg aria-hidden="true"></svg>' +
      '<div class="tc-col"><span class="micro">Suppliers</span>' + node('s1', 'Supplier A', 'Supplies custom components, single source', 'fact', '10-K FY2025') +
        node('', 'Materials supplier', 'Supplies Supplier A · second hop', 'inf', 'Supplier A’s filing', 'tc-n-sub') +
        node('s2', 'Supplier B', 'Supplies contract assembly', 'fact', '10-K FY2025') + node('s3', 'Freight carrier group', 'Supplies ocean and air freight', 'inf', 'shipping records and news') + '</div>' +
      '<div class="tc-col tc-mid-col">' + compNode('p1', 0) +
        '<div class="tc-n tc-n-me" data-n="me"><div class="tc-n-t"><span class="mono" style="--h:' + it.h + '" aria-hidden="true">' + it.mono + '</span>' + esc(id) + '</div><div class="tc-n-s">' + esc(it.n) + '</div></div>' + compNode('p2', 1) + '</div>' +
      '<div class="tc-col"><span class="micro">Customers</span>' + node('k1', 'Customer A', 'Buys from · 13% of revenue, disclosed', 'fact', '10-K FY2025') + node('k2', 'Customer B', 'Buys from · 10% of revenue, disclosed', 'fact', '10-K FY2025') +
        node('k3', 'Distributor group', 'Buys from · share not disclosed', 'inf', 'the distributor’s filing') + '</div></div>' +
      '<div class="tc-chain-f"><div class="lg tc-chain-lg"><span><svg viewBox="0 0 30 8" aria-hidden="true"><path class="tc-ln" d="M0 4h30"/></svg>Stated in a filing</span><span><svg viewBox="0 0 30 8" aria-hidden="true"><path class="tc-ln inf" d="M0 4h30"/></svg>Model inference</span><span>Arrows follow the goods; competitor links have none</span></div>' +
      '<a class="btn" href="mindmap.html">' + M.icon('map') + '<span>Open in the mind map</span></a></div>' +
      '<details class="tc-det"><summary>Show table</summary>' + table([['From'], ['Link', 'class="l"'], ['To', 'class="l"'], ['Share of revenue'], ['Evidence', 'class="l"'], ['Kind', 'class="l"']], ROWS.map(function (r) {
        return '<tr><td>' + esc(r[0]) + '</td><td class="l">' + r[1] + '</td><td class="l">' + esc(r[2]) + '</td><td>' + r[3] + '</td><td class="l tc-w">' + r[4] + '</td><td class="l">' + (r[5] === 'fact' ? 'Filing fact' : 'Inference') + '</td></tr>';
      })) + '</details>';
    function linkChain() {
      var box = $('#tc-chain-g', host), svg = $('svg', box), b = box.getBoundingClientRect(); if (!b.width) return;
      function rc(k) { var r = $('[data-n="' + k + '"]', box).getBoundingClientRect(); return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, b: r.bottom - b.top, cx: r.left - b.left + r.width / 2, cy: r.top - b.top + r.height / 2 }; }
      function n(v) { return v.toFixed(1); }
      var out = '';
      EDGES.forEach(function (e) {
        var a = rc(e[0]), z = rc(e[1]);
        if (e[2] === 'v') { out += '<path class="tc-ln ' + e[3] + '" d="M' + n(a.cx) + ' ' + n(z.t > a.b ? a.b : a.t) + 'L' + n(z.cx) + ' ' + n(z.t > a.b ? z.t : z.b) + '"/>'; return; }
        var x2 = z.l - 6, mx = (a.r + x2) / 2;
        out += '<path class="tc-ln ' + e[3] + '" d="M' + n(a.r) + ' ' + n(a.cy) + 'C' + n(mx) + ' ' + n(a.cy) + ' ' + n(mx) + ' ' + n(z.cy) + ' ' + n(x2) + ' ' + n(z.cy) + '"/>' +
          '<path class="tc-ah ' + e[3] + '" d="M' + n(z.l) + ' ' + n(z.cy) + 'l-7 -4v8z"/>';
      });
      svg.setAttribute('viewBox', '0 0 ' + n(b.width) + ' ' + n(b.height)); svg.innerHTML = out;
    }

    /* ----- assemble ----- */
    host.innerHTML = '<nav class="tc-nav" aria-label="Deep-dive sections">' + SECS.map(function (s, i) { return '<button type="button" data-s="' + s[0] + '"' + (i === 0 ? ' aria-current="true"' : '') + '>' + s[1] + '</button>'; }).join('') + '</nav><div class="tc-secs">' +
      sec('filing', 'Filing changes', badge('10-K FY2025 against FY2024'), 'What changed in risk factors and MD&amp;A since last year’s annual report. Each change carries a materiality rating, a one-line reason and a quote checked against the filing.', filing) +
      sec('calls', 'Earnings calls', badge('Latest call: ' + LATEST + ', 29 Oct 2026'), 'How the latest call compares with the company’s own habits, what was guided, and which questions were answered.', calls) +
      sec('cred', 'Management credibility', badge('24 resolved claims'), 'Whether management’s dated, checkable claims came true.', cred) +
      sec('own', 'Ownership signals', badge('Rule-based sentences'), 'What insiders, institutions and short sellers have done, and how unusual each reading is for this stock.', own) +
      sec('peers', 'Peer valuation', badge(same ? same + ' of 8 peers in ' + esc(it.sec) : 'No same-sector peers in the sample set'), 'Where ' + esc(id) + ' sits among its eight nearest peers and against its own five years. Peers are chosen by industry, size and how alike the business descriptions are.', peersHTML) +
      sec('opts', 'Options signals', badge('Close of 16 Nov 2026'), '', opts) +
      sec('chain', 'Supply chain and customers', badge('Links are hypotheses unless a filing states them'), 'Who supplies ' + esc(id) + ', who buys from it and who competes with it. Shares of revenue appear only where a filing discloses them.', chain) + '</div>';

    /* ----- behaviour ----- */
    var nav = $('.tc-nav', host), secs = $$('.tc-sec', host), lock = 0, raf = 0;
    function setCur(k) {
      $$('button', nav).forEach(function (b) {
        var on = b.dataset.s === k; if (on && b.getAttribute('aria-current') !== 'true' && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = b.offsetLeft - 24;
        if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }
    function spy() {
      raf = 0; if (host.offsetParent === null || Date.now() < lock) return;
      var cur = secs[0], y = 110 + nav.offsetHeight + 40;
      secs.forEach(function (s) { if (s.getBoundingClientRect().top <= y) cur = s; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1];
      setCur(cur.dataset.s);
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-s]'); if (!b) return;
      var s = $('#tc-' + b.dataset.s, host); lock = Date.now() + 800; setCur(b.dataset.s);
      s.scrollIntoView({ behavior: M.rm() ? 'auto' : 'smooth', block: 'start' }); $('h2', s).focus({ preventScroll: true });
      setTimeout(spy, 850);
    });

    var f = { m: 'all', sec: 'all' }, diff = $('#tc-diff', host);
    function setF(key, v) { f[key] = v; $$('[data-f="' + key + '"] .chip', host).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'); }); }
    function applyFilter() {
      var shown = { rf: 0, mda: 0 };
      $$('.tc-df', diff).forEach(function (r) {
        var ok = (f.sec === 'all' || r.dataset.sec === f.sec) && (r.dataset.m ? f.m === 'all' || r.dataset.m === f.m : f.m === 'all');
        r.hidden = !ok; if (ok && r.dataset.m) shown[r.dataset.sec]++;
      });
      $$('.tc-df-item', diff).forEach(function (h) { h.hidden = !shown[h.dataset.sec]; });
      var n = shown.rf + shown.mda;
      $('#tc-df-n', host).textContent = 'Showing ' + n + ' of ' + CHANGES.length + ' changed paragraphs';
      $('#tc-df-none', host).hidden = n > 0;
    }
    applyFilter();
    host.addEventListener('click', function (e) {
      var c = e.target.closest('[data-f] .chip'), j = e.target.closest('[data-jump]');
      if (c) { setF(c.parentNode.dataset.f, c.dataset.v); applyFilter(); }
      if (j) {
        setF('m', 'all'); setF('sec', 'all'); applyFilter();
        var r = $('#tc-' + j.dataset.jump, host);
        r.scrollIntoView({ behavior: M.rm() ? 'auto' : 'smooth', block: 'center' }); r.focus({ preventScroll: true });
        r.classList.remove('is-hit'); void r.offsetWidth; r.classList.add('is-hit'); setTimeout(function () { r.classList.remove('is-hit'); }, 1700);
      }
    });
    M.sortable($('.tc-claims', host));

    /* follow one peer across the strips, the peer list and the table */
    var pe = $('#tc-peers', host);
    function hl(p) { $$('[data-p]', pe).forEach(function (n) { var on = !!p && n.dataset.p === p; n.classList.toggle('is-hl', on); var t = $('.tk', n); if (t) t.classList.toggle('is-hl', on); }); }
    function hlFrom(e) { var n = e.target.closest ? e.target.closest('[data-p]') : null; hl(n ? n.dataset.p : null); }
    pe.addEventListener('pointerover', hlFrom); pe.addEventListener('focusin', hlFrom);
    pe.addEventListener('pointerleave', function () { hl(null); }); pe.addEventListener('focusout', function () { hl(null); });

    function paint() {
      $$('[data-tone]', host).forEach(function (h) { drawTone(h, TONE[+h.dataset.tone][1]); });
      siSpark($('#tc-si', host), id);
      M.spark($('#tc-hed', host), TONE[2][1], { w: 96, h: 26, color: M.COL.accent });
      linkChain();
    }
    keepPainted(host, paint, [$('#tc-chain-g', host)]);
    fillWhenSeen($$('.pbar', host));
    return { show: function () { paint(); spy(); } };
  });

  /* =====================================================================
     Drawdown check
     ===================================================================== */
  M.stockTab('drawdown', function (host, ctx) {
    var id = ctx.id, it = ctx.it, cur = ctx.cur, D = ctx.DATA.restated, Q = ctx.QTRS;
    var HI = ctx.HI52, P = HI / 1.37, DAYS = 138, LO = 0.5, YEAR = ctx.NOW.getFullYear();
    function dstr(ago) { var d = new Date(ctx.NOW.getTime() - ago * 864e5); return d.getDate() + ' ' + ctx.MON[d.getMonth()]; }
    var PEAK = dstr(DAYS), TODAY = dstr(0);

    /* ----- the path from the peak, with the three days that carry most of the company-specific fall ----- */
    var EV = [{ ago: 109, m: 'E', t: 'Third-quarter results; full-year revenue guidance lowered', pts: 9.5 }, { ago: 68, m: 'F', t: '8-K: a large customer cut its order forecast', pts: 2.2 }, { ago: 18, m: 'E', t: 'Fourth-quarter results; capital-return guidance withdrawn', pts: 3.6 }];
    EV.forEach(function (e) { e.f = 1 - e.ago / DAYS; e.d = dstr(e.ago); });
    var CP = [[0, 1.37], [EV[0].f - 0.008, 1.325], [EV[0].f + 0.006, 1.195], [EV[1].f - 0.008, 1.13], [EV[1].f + 0.006, 1.10], [EV[2].f - 0.008, 1.055], [EV[2].f + 0.006, 1.005], [1, 1]];
    var NP = 97, PATH = ctx.path(id + ':dd', NP, CP, 0.0055).map(function (v, i) { return i ? Math.min(1.365, v / it.p) : 1.37; });
    PATH[NP - 1] = 1;
    var LAYERS = [
      { n: 'Market', pts: 5, lo: 4, hi: 6, c: 'data-6', d: 'What the local index did over the same days, times the stock’s usual sensitivity to it' },
      { n: 'Sector', pts: 4, lo: 2, hi: 6, c: 'data-4', d: 'The industry’s move beyond the market' },
      { n: 'Style', pts: 1, lo: 0, hi: 2, c: 'data-3', d: 'Size, value and momentum factors' },
      { n: 'Company-specific', pts: 17, lo: 14, hi: 20, c: 'data-2', d: 'What is left once the other three are taken out' }
    ];

    /* ----- 30 past similar cases: 24-month paths as multiples of today’s price, four points a month ----- */
    var FAN = (function () {
      var r = M.rng(M.hash(id + ':fan')), out = [], i;
      function mk(months, end, kind, k) {
        var n = months * 4 + 1, wob = M.bridge(id + ':fan' + kind + k, n, 1, 1, 0.022), dip = 0.03 + r() * 0.11, a = [];
        for (var j = 0; j < n; j++) {
          var u = j / (n - 1), base = kind === 'ok' ? 1 + 0.37 * Math.pow(u, 1.25) - dip * 2 * Math.sin(Math.PI * u) * (1 - u) : 1 + (end - 1) * Math.pow(u, 0.8) - dip * 0.6 * Math.sin(Math.PI * u);
          a.push(Math.max(0.54, Math.min(kind === 'ok' ? 1.36 : 1.345, base * wob[j])));
        }
        a[0] = 1; a[n - 1] = end; return { a: a, kind: kind };
      }
      [3, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17, 19, 21, 23].forEach(function (m, k) { out.push(mk(m, 1.37, 'ok', k)); });
      [0.64, 0.72, 0.79, 0.85, 0.9, 0.95, 1.01, 1.07, 1.14, 1.21, 1.29].forEach(function (e, k) { out.push(mk(24, e, 'no', k)); });
      out.push(mk(15, 0.56, 'del', 0)); out.push(mk(9, 1.18, 'acq', 0));
      for (i = out.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
      return out;
    })();
    var NOK = FAN.filter(function (f) { return f.kind === 'ok'; }).length, NFAN = FAN.length;

    /* ----- fundamentals known at the peak and now (the same sample statements as the Financials tab) ----- */
    function ttm(k, e) { var q = D[k].q; return q[e] + q[e - 1] + q[e - 2] + q[e - 3]; }
    var revA = ttm('rev', 6), revB = ttm('rev', 7), gmA = ttm('gp', 6) / revA * 100, gmB = ttm('gp', 7) / revB * 100, omA = ttm('oi', 6) / revA * 100, omB = ttm('oi', 7) / revB * 100,
      fcfA = ttm('fcf', 6), fcfB = ttm('fcf', 7), shA = D.sh.q[6], shB = D.sh.q[7], epsA = ttm('ni', 6) / shA, epsB = ttm('ni', 7) / shB;
    var peA = HI / epsA, peB = P / epsB, dMult = (peB / peA - 1) * 100, dEps = (epsB / epsA - 1) * 100;
    var fLabel = dEps >= -1 ? 'Multiple compression only' : dMult <= -5 ? 'Both: a lower multiple and weaker fundamentals' : 'Fundamentals deteriorated';
    function chg(v, pts, neutral) {
      var up = v >= 0;
      return '<span class="' + (neutral ? 'muted' : up ? 'up' : 'dn') + '">' + (pts ? M.fsign(v, 1) + ' pts' : M.fpct(v, 1)) + ' <i class="tc-ar" aria-hidden="true">' + (up ? '▲' : '▼') + '</i></span>';
    }
    function pc(v) { return v.toFixed(1) + '%'; }
    function r1(v) { return Math.round(v * 10) / 10; }
    var FUND = [
      ['Revenue, trailing 12 months', M.fmt(revA, 0), M.fmt(revB, 0), chg((revB / revA - 1) * 100)],
      ['Gross margin', pc(gmA), pc(gmB), chg(r1(gmB) - r1(gmA), true)],
      ['Operating margin', pc(omA), pc(omB), chg(r1(omB) - r1(omA), true)],
      ['Free cash flow, trailing 12 months', M.fmt(fcfA, 0), M.fmt(fcfB, 0), chg((fcfB / fcfA - 1) * 100)],
      ['Guidance', 'Revenue growth of 7 to 9%; about 90% of free cash flow to be returned', 'Revenue growth of 5 to 7% next year; no capital-return figure', '<span class="muted">Lowered <i class="tc-ar" aria-hidden="true">▼</i></span>', 1],
      ['Diluted shares (millions)', M.fmt(shA, 0), M.fmt(shB, 0), chg((shB / shA - 1) * 100, false, true)]
    ];
    var spMax = Math.max(27, Math.abs(dMult), Math.abs(dEps));
    function spRow(name, sub, v) {
      return '<div class="tc-sp"><span>' + name + '<small>' + sub + '</small></span><div class="tc-bar" aria-hidden="true"><i class="' + (v >= 0 ? 'pos' : 'neg') + '" style="--w:' + (Math.abs(v) / spMax).toFixed(3) + '"></i></div><b class="' + (v >= 0 ? 'up' : 'dn') + '">' + M.fpct(v, 1) + ' <i class="tc-ar" aria-hidden="true">' + (v >= 0 ? '▲' : '▼') + '</i></b></div>';
    }

    /* ----- balance sheet ----- */
    var a4 = function (k) { return D[k].a[4]; }, nd = (a4('debt') - a4('cash') - a4('sec')) / (a4('oi') + a4('da')), cover = a4('oi') / (a4('debt') * 0.036);
    var ndTxt = M.fmt(nd, 1) + '×' + (nd < 0 ? ' (net cash)' : '');
    var CHK = [
      ['ok', 'Net debt to EBITDA', nd < 0 ? 'Cash and securities exceed debt.' : 'Low for the sector.', ndTxt],
      ['ok', 'Interest cover', 'Operating income against interest expense.', M.fmt(cover, 0) + '×'],
      ['ok', 'Debt maturities', 'No year carries more than a fifth of the debt; the largest is 2029.', '14% due within 24 months'],
      ['ok', 'Cash runway', 'Free cash flow is positive, so no runway clock is running.', 'Not burning cash'],
      ['watch', 'Customer concentration', 'Newly disclosed in the FY2025 10-K; one of the two cut its order forecast in September.', 'Two customers, 23% of revenue'],
      ['watch', 'Structural or cyclical demand', 'Revenue fell in one of the last three downturns; the run-up came mostly from volume, not price; backlog covers about two quarters.', 'Mixed']
    ];

    /* ----- model output ----- */
    var HZ = [[6, 24], [12, 40], [24, 58], [60, 71]];
    var DRV = [
      ['Leverage', 'Net debt to EBITDA ' + ndTxt, 0.29], ['Cause of the fall', 'Company-specific: 17 of the 27 points', -0.26], ['Profitability', 'Operating margin ' + pc(omB), 0.21],
      ['Valuation at the peak', 'Price to sales in its 88th percentile', -0.18], ['Rate direction', 'Policy rate falling', 0.15], ['Volatility level', 'Market volatility in its 41st percentile', 0.08],
      ['Depth within the bucket', '27%, the shallow end of 25 to 35%', 0.06], ['Market regime', 'Expansion', 0.01]
    ];
    var ERAS = [['2000 to 2002', 6, 2], ['2008 to 2009', 6, 4], ['2011 to 2012', 3, 2], ['2015 to 2016', 4, 3], ['2018', 3, 2], ['2020', 3, 3], ['2022', 5, 1]];

    /* ----- markup ----- */
    var verdict = '<section class="card tc-verdict" aria-labelledby="tc-v-h"><header class="card-h"><h2 id="tc-v-h">Verdict</h2><div class="card-a">' + badge('Industry-level base rate') + '</div></header>' +
      '<div class="label">P(regains prior high within 24 months)</div><div class="tc-big">58%<small>80% interval 41 to 72%</small></div>' +
      pbar(0.58, 41, 72, 49, 'P(regains prior high within 24 months) = 58%, 80% interval 41 to 72%, baseline 49%', true) +
      '<div class="pbar-l"><span>Prior high ' + cur + M.fmt(HI) + ', ' + PEAK + '</span><span>Baseline 49% for a fall of this depth</span></div>' +
      '<div class="tc-v2"><div><div class="label">P(within 60 months)</div><div class="tc-mid">71%<small>55 to 83%</small></div>' + pbar(0.71, 55, 83, null, 'P(regains prior high within 60 months) = 71%, 80% interval 55 to 83%', true) + '</div>' +
      '<div><div class="label">P(delisted for cause)</div><div class="tc-mid">4%<small>1 to 9%</small></div>' + pbar(0.04, 1, 9, null, 'P(delisted for cause within 60 months) = 4%, 80% interval 1 to 9%', true) + '</div></div>' +
      '<div class="band">' + M.icon('warn') + '<span>These are probabilities, not a promise of a bounce. In about four cases in ten like this one, the prior high was not regained within 24 months.</span></div>' +
      '<dl class="kv"><dt>Cause of the fall</dt><dd>Company-specific</dd><dt>Fundamentals</dt><dd>' + fLabel + '</dd><dt>Issued</dt><dd>' + TODAY + ' ' + YEAR + ', 16:00</dd></dl>' +
      '<div class="tc-ledger"><div class="label">Written to the prediction ledger</div><ol class="tc-hz">' + HZ.map(function (h) { return '<li' + (h[0] === 24 ? ' class="is-main"' : '') + '><span>' + h[0] + ' months</span><b>' + h[1] + '%</b></li>'; }).join('') + '</ol>' +
      '<p class="tc-note">The verdict is scored at 6, 12, 24 and 60 months against the baseline. The resolution rule was fixed when it was issued: a total-return close at or above the prior high, with delisting and takeovers handled by rule. It cannot be edited afterwards.</p>' +
      '<button class="linkish" type="button" data-goto="track">Open the track record</button></div></section>';

    var top = 0;
    var stageHTML = '<div class="tc-stage" id="tc-stage"><canvas role="img" aria-label="Price from the prior high of ' + cur + M.fmt(HI) + ' on ' + PEAK + ' to ' + cur + M.fmt(P) + ' on ' + TODAY + ', a fall of 27%. The fall splits into market 5 points, sector 4, style 1 and company-specific 17. Of ' + NFAN + ' past similar cases, ' + NOK + ' regained the prior high within 24 months and ' + (NFAN - NOK) + ' did not."></canvas>' +
      '<div class="tc-stack" aria-hidden="true">' + LAYERS.map(function (l, i) { var s = '<i class="tc-ly" style="--i:' + i + ';--c:var(--' + l.c + ');--t:' + (top / 27 * 100).toFixed(2) + '%;--h:' + (l.pts / 27 * 100).toFixed(2) + '%"></i>'; top += l.pts; return s; }).join('') + '<i class="tc-whole"></i></div>' +
      '<div class="tc-drop" aria-hidden="true">−27%</div>' +
      '<ol class="tc-lyl" aria-hidden="true">' + LAYERS.map(function (l, i) { return '<li style="--i:' + i + ';--c:var(--' + l.c + ')"><i></i>' + l.n + ' <b>' + l.pts + (l.pts === 1 ? ' pt' : ' pts') + '</b></li>'; }).join('') + '</ol>' +
      '<div class="tc-fanc" aria-hidden="true"><b>' + NOK + ' of ' + NFAN + '</b> <span>regained the prior high within 24 months</span></div></div>';
    var seq = '<section class="card tc-seq" aria-labelledby="tc-q-h"><header class="card-h"><h2 id="tc-q-h">From the July peak to now, and what followed in similar cases</h2><div class="card-a">' + badge('Cause label: company-specific') +
      '<button class="btn btn-sm" type="button" id="tc-replay">' + M.icon('replay', 'ic-sm') + 'Replay</button></div></header>' + stageHTML +
      '<div class="lg tc-seq-lg"><span><i class="px"></i>Price, ' + PEAK + ' to ' + TODAY + '</span><span><i class="ok"></i>Past case that regained the high: its line stops at the high (' + NOK + ')</span><span><i class="no"></i>Past case that did not: its line ends in a cap (' + (NFAN - NOK) + ')</span><span><b class="tc-mk">E</b>Earnings</span><span><b class="tc-mk">F</b>Filing</span></div>' +
      '<p class="tc-note" style="margin-top:8px"><b>' + NOK + ' of ' + NFAN + ' regained the prior high within 24 months.</b> Of the other ' + (NFAN - NOK) + ', 11 were still below it, 1 was delisted for cause and 1 was acquired below it. The cases that never recovered are always shown. They sit beside the model and are not blended into it.</p>' +
      '<h3 class="tc-sub">Where the 27% fall came from<small>about two thirds is specific to the company</small></h3>' +
      table([['Cause'], ['Points of the 27'], ['80% interval'], ['Share of the fall'], ['What it measures', 'class="l"']], LAYERS.map(function (l) {
        return '<tr><td><i class="tc-sw" style="--c:var(--' + l.c + ')" aria-hidden="true"></i>' + l.n + '</td><td>' + l.pts + '</td><td>' + l.lo + ' to ' + l.hi + '</td><td>' + Math.round(l.pts / 27 * 100) + '%</td><td class="l tc-w">' + l.d + '</td></tr>';
      })) +
      '<h3 class="tc-sub">Largest company-specific days<small>matched to earnings dates, filings and news</small></h3><ul class="tc-days">' + EV.map(function (e) {
        return '<li><b class="tc-mk" title="' + (e.m === 'E' ? 'Earnings' : 'Filing') + '">' + e.m + '</b><span class="d">' + e.d + '</span><span>' + e.t + '</span><b class="dn">' + M.fsign(-e.pts, 1) + ' pts <i class="tc-ar" aria-hidden="true">▼</i></b></li>';
      }).join('') + '</ul><p class="tc-note" style="margin-top:6px">These three days account for 15.3 of the 17 company-specific points. Sensitivities were measured on the year ending 21 days before the peak, so the fall could not shape them.</p>' +
      '<details class="tc-det"><summary>Show the ' + NFAN + ' cases by era</summary>' + table([['Era'], ['Cases'], ['Regained within 24 months'], ['Did not']], ERAS.map(function (e) { return '<tr><td>' + e[0] + '</td><td>' + e[1] + '</td><td>' + e[2] + '</td><td>' + (e[1] - e[2]) + '</td></tr>'; }).concat(['<tr><td><b>All</b></td><td><b>' + NFAN + '</b></td><td><b>' + NOK + '</b></td><td><b>' + (NFAN - NOK) + '</b></td></tr>'])) +
      '<p class="tc-note" style="margin-top:8px">Cases are capped per era so that one bad stretch cannot crowd out the rest.</p></details></section>';

    var fund = '<section class="card reveal" aria-labelledby="tc-f-h"><header class="card-h"><h2 id="tc-f-h">Fundamental-change check</h2><div class="card-a">' + badge(fLabel, 'badge-accent') + '</div></header>' +
      '<p class="tc-lead">Has the business changed, or only the price paid for it? Each column uses only what was known on that date.</p><div class="tc-two"><div>' +
      table([['Measure'], ['Known at the peak · ' + PEAK], ['Known now · ' + TODAY], ['Change']], FUND.map(function (r) {
        return '<tr><td>' + r[0] + '</td><td' + (r[4] ? ' class="tc-w"' : '') + '>' + r[1] + '</td><td' + (r[4] ? ' class="tc-w"' : '') + '>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
      })) +
      '<p class="tc-note" style="margin-top:8px">USD millions. The peak column uses results to ' + Q[6] + ' and the now column results to ' + Q[7] + ', as first reported. Filing flags since the peak: 3, two of them material. <button class="linkish" type="button" data-goto="deepdive">See filing changes</button></p></div>' +
      '<div><h3 class="tc-sub">How the 27% splits<small>price = multiple × earnings per share</small></h3><div class="tc-split">' +
      spRow('Price', cur + M.fmt(HI) + ' to ' + cur + M.fmt(P), -27) + spRow('Multiple: trailing P/E', M.fmt(peA, 1) + '× to ' + M.fmt(peB, 1) + '×', dMult) + spRow('Fundamentals: trailing earnings per share', M.fmt(epsA) + ' to ' + M.fmt(epsB), dEps) + '</div>' +
      '<p class="tc-note" style="margin-top:6px">The two parts compound, so they do not add up exactly. ' + (dEps >= -1 ? 'Earnings per share did not fall; the market is paying less for each unit of them.' : 'Both the multiple and the earnings behind it fell.') + '</p></div></div></section>';

    var inc = '<section class="card reveal" aria-labelledby="tc-i-h"><header class="card-h"><h2 id="tc-i-h">Recovery base rates</h2><div class="card-a">' + badge('Industry-level base rate') + '</div></header>' +
      '<p class="tc-lead">What happened after falls like this one, counting every outcome, including the cases that failed or were taken over.</p><div class="tc-two"><div>' +
      '<div class="plot" id="tc-inc"><canvas role="img" aria-label="Cumulative incidence over 60 months. Regained the prior high: 58% by 24 months and 71% by 60 months, with an 80% band of 55 to 83% at 60 months. Failed: 4% by 60 months. Acquired below the high: 6%. Still open: 19%. The baseline for this depth reaches 49% by 24 months."></canvas></div>' +
      '<p class="tc-note" style="margin-top:6px">Months after the fall first passed 25%. The shaded band is the 80% interval around “regained”.</p>' +
      '<details class="tc-det"><summary>Show table</summary>' + table([['Outcome'], ['By 24 months'], ['By 60 months']], [
        '<tr><td>Regained the prior high</td><td>58% (41 to 72%)</td><td>71% (55 to 83%)</td></tr>', '<tr><td>Failed: delisted for cause</td><td>2%</td><td>4% (1 to 9%)</td></tr>',
        '<tr><td>Acquired below the prior high</td><td>4%</td><td>6%</td></tr>', '<tr><td>Still open</td><td>36%</td><td>19%</td></tr>', '<tr><td>Baseline for this depth: regained</td><td>49%</td><td>61%</td></tr>']) + '</details></div>' +
      '<div><h3 class="tc-sub">Conditioning cell<small>the past cases these rates are measured on</small></h3>' +
      '<dl class="kv"><dt>Depth</dt><dd>25 to 35% below the high</dd><dt>Cause</dt><dd>Company-specific</dd><dt>Valuation at the peak</dt><dd>Top third by price to sales</dd><dt>Market state at the start</dt><dd>Rates falling, volatility below its median</dd>' +
      '<dt>Sample size</dt><dd>412 episodes in 37 calendar clusters, 1926 to 2024</dd><dt>Estimator</dt><dd>Aalen-Johansen, competing outcomes</dd></dl>' +
      '<p class="tc-note" style="margin-top:10px">Industry-level base rate: measured on industry portfolios because stock-level history that includes delisted firms is not available yet. The failure and takeover rates are rough guides for the same reason.</p></div></div></section>';

    var screen = '<section class="card reveal" aria-labelledby="tc-s-h"><header class="card-h"><h2 id="tc-s-h">Balance-sheet and demand screen</h2><div class="card-a">' + badge('A checklist, not a score') + '</div></header><ul class="tc-chk">' + CHK.map(function (c) {
      return '<li><span class="tc-st" data-s="' + c[0] + '">' + (c[0] === 'ok' ? ic('check', 'ic-sm') + 'Clear' : M.icon('warn', 'ic-sm') + 'Watch') + '</span><div><div class="tc-chk-h"><b>' + c[1] + '</b><span class="v">' + c[3] + '</span></div><p class="tc-note">' + c[2] + '</p></div></li>';
    }).join('') + '</ul></section>';

    var senti = '<section class="card reveal" aria-labelledby="tc-p-h"><header class="card-h"><h2 id="tc-p-h">Sentiment and positioning</h2><div class="card-a"><button class="linkish" type="button" data-goto="deepdive">More in Deep-dive</button></div></header><ul class="tc-sigs tc-sigs-s">' +
      sigRow('Short interest', 'Settlement date 30 Oct 2026', SI_TEXT, SIG.siPct, 'Higher than ' + SIG.siPct + '% of readings in its own two-year history.', '<canvas class="tc-spark" id="tc-si2" role="img" aria-label="Short interest as a share of the float over two years: flat near 1.7%, then rising to 2.8% since July"></canvas>') +
      sigRow('Implied volatility and skew', 'Options at the ' + TODAY + ' close', 'Implied volatility is ' + SIG.iv + '%, a rank of ' + SIG.ivr + ' out of 100 for the past year. Downside protection costs ' + SIG.skew + ' volatility points more than the equivalent upside, a wider gap than on ' + SIG.skewPct + '% of days in two years.', SIG.ivr, 'Implied volatility is higher than on ' + SIG.ivr + '% of days in the past year.') +
      sigRow('Insider buying since the peak', 'Form 4 filings to 13 Nov ' + YEAR, INSIDER_TEXT, 86, 'Open-market buying on this scale is rarer than in 86% of 90-day periods.') +
      '</ul><p class="tc-note" style="margin-top:12px">Positioning is shown for context. None of it enters the probability above.</p></section>';

    var sum = DRV.reduce(function (s, d) { return s + d[2]; }, 0);
    var explain = '<section class="card reveal" aria-labelledby="tc-e-h"><header class="card-h"><h2 id="tc-e-h">Why 58%</h2><div class="card-a">' + badge('Industry-level base rate') + badge('Penalised logistic model, 8 inputs') + '</div></header>' +
      '<div class="tc-exp"><div><div class="tc-drv tc-drv-h"><span>Input, ranked by weight</span><span>Lowers or raises the probability</span><span>Log-odds</span></div>' + DRV.map(function (d) {
        return '<div class="tc-drv"><span>' + d[0] + '<small>' + d[1] + '</small></span><div class="tc-bar" aria-hidden="true"><i class="' + (d[2] >= 0 ? 'pos' : 'neg') + '" style="--w:' + (Math.abs(d[2]) / 0.3).toFixed(3) + '"></i></div><b class="' + (d[2] >= 0 ? 'up' : 'dn') + '">' + M.fsign(d[2], 2) + '<small>' + (d[2] >= 0 ? 'raises' : 'lowers') + '</small></b></div>';
      }).join('') +
      '<p class="tc-sum">Start from the baseline for a fall of this depth: <b>49%</b> (log-odds −0.04). The eight inputs add <b>' + M.fsign(sum, 2) + '</b>, giving log-odds of +0.32, which is <b>58%</b>. The ' + NFAN + ' matched cases agree (' + NOK + ' of ' + NFAN + ', or 57%), so the interval was not widened.</p></div>' +
      '<div class="tc-exp-r"><div><div class="label" style="margin-bottom:8px">Inputs as of</div><dl class="kv"><dt>Prices</dt><dd>' + TODAY + ' ' + YEAR + ' close, delayed source</dd><dt>Fundamentals</dt><dd>10-K FY2025, as first reported</dd><dt>Factor returns</dt><dd>To 30 Oct ' + YEAR + '</dd>' +
      '<dt>Short interest</dt><dd>Settlement 30 Oct ' + YEAR + '</dd><dt>Options</dt><dd>' + TODAY + ' ' + YEAR + ' close</dd><dt>Insider filings</dt><dd>To 13 Nov ' + YEAR + '</dd><dt>13F holdings</dt><dd>30 Sep ' + YEAR + ' (45-day lag)</dd></dl></div>' +
      '<div><div class="label" style="margin-bottom:8px">Data and model</div><dl class="kv"><dt>Data label</dt><dd>Industry-level base rate</dd><dt>Stock-level history</dt><dd>Not available</dd><dt>Revised inputs</dt><dd>None</dd><dt>Model</dt><dd>Drawdown hazard, version 0.3</dd><dt>Next re-check</dt><dd>No sooner than 16 Dec ' + YEAR + '</dd></dl></div>' +
      '<button class="btn" type="button" data-stub="The model card">' + M.icon('doc') + '<span>Model card</span></button></div></div></section>';

    host.innerHTML = '<div class="tc-dd"><div class="tc-top">' + verdict + seq + '</div>' + fund + inc + '<div class="g2">' + screen + senti + '</div>' + explain + '</div>';

    /* ----- the stage: canvas for the path and the fan, DOM for the layers ----- */
    var stage = $('#tc-stage', host), cv = $('canvas', stage), lbl = $$('.tc-lyl li', stage), bars = $$('.tc-verdict .pbar', host), incHost = $('#tc-inc', host);
    var st = { draw: 1, fan: 1 }, timers = [], anims = [], played = false, FAN_MS = 900 + 15 * (NFAN - 1);
    function geo() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return null;
      var wide = w >= 560, pl = 10, pr = 12, pt = 46, yB = h - 30, gap = wide ? Math.max(264, Math.min(300, w * 0.3)) : 58, x1 = pl + (w - pl - pr - gap) * (wide ? 0.38 : 0.44);
      return { w: w, h: h, wide: wide, x0: pl, x1: x1, x2: x1 + gap, x3: w - pr, yB: yB, Y: function (m) { return yB - (m - LO) / (1.37 - LO) * (yB - pt); } };
    }
    /* put the layer column on the drop itself: from the prior-high line down to today’s price */
    function layout() {
      var g = geo(); if (!g) return;
      var yH = g.Y(1.37), dh = g.Y(1) - yH, cw = g.wide ? 14 : 8, step = cw + (g.wide ? 4 : 2), sx = g.x1 + (g.wide ? 14 : 9), s = stage.style, at = 0, prev = -99;
      s.setProperty('--sx', sx.toFixed(1) + 'px'); s.setProperty('--sy', yH.toFixed(1) + 'px'); s.setProperty('--sh', dh.toFixed(1) + 'px');
      s.setProperty('--cw', cw + 'px'); s.setProperty('--step', step + 'px'); s.setProperty('--lx', (sx + cw + 3 * step + 10).toFixed(1) + 'px');
      stage.classList.toggle('is-narrow', !g.wide);
      LAYERS.forEach(function (l, i) { var y = Math.max((at + l.pts / 2) / 27 * dh, prev + 17); at += l.pts; prev = y; lbl[i].style.top = (yH + y - 8).toFixed(1) + 'px'; });
    }
    function drawStage() {
      var g = geo(); if (!g) return;
      var c = M.fitCanvas(cv, g.w, g.h), C = M.COL, yH = g.Y(1.37), yP = g.Y(1), xw = g.x1 - g.x0, fw = g.x3 - g.x2, i;
      c.clearRect(0, 0, g.w, g.h); c.font = FONT; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1;
      /* zone titles and the two time axes */
      c.fillStyle = C['text-3']; c.textAlign = 'left'; c.fillText('Peak to now', g.x0, 10);
      if (g.wide) c.fillText('Causes of the fall', g.x1 + 14, 10);
      c.fillText(fw >= 215 ? NFAN + ' past similar cases, next 24 months' : NFAN + ' past cases', g.x2, 10);
      c.fillText(PEAK, g.x0, g.h - 10); c.textAlign = 'right'; c.fillText(TODAY, g.x1, g.h - 10);
      (g.wide ? [6, 12, 18, 24] : [12, 24]).forEach(function (m) {
        var x = g.x2 + m / 24 * fw; c.textAlign = m === 24 ? 'right' : 'center'; c.fillStyle = C['text-3']; c.fillText('+' + m + (m === 24 ? ' mo' : ''), x, g.h - 10);
        c.strokeStyle = M.rgba(C['text-1'], 0.14); c.beginPath(); c.moveTo(Math.round(x) - 0.5, g.yB); c.lineTo(Math.round(x) - 0.5, g.yB + 4); c.stroke();
      });
      /* the prior high across everything, and today’s level carried into the fan */
      c.setLineDash([4, 4]); c.strokeStyle = M.rgba(C['text-2'], 0.6); c.beginPath(); c.moveTo(g.x0, Math.round(yH) + 0.5); c.lineTo(g.x3, Math.round(yH) + 0.5); c.stroke();
      c.setLineDash([1, 4]); c.strokeStyle = M.rgba(C['text-2'], 0.5); c.beginPath(); c.moveTo(g.x1, Math.round(yP) + 0.5); c.lineTo(g.x3, Math.round(yP) + 0.5); c.stroke(); c.setLineDash([]);
      c.fillStyle = C['text-2']; c.textAlign = 'left'; c.fillText('Prior high ' + cur + M.fmt(HI), g.x0, yH - 10);
      /* price path, revealed left to right */
      c.save(); c.beginPath(); c.rect(0, 0, g.x0 + xw * st.draw + 1, g.h); c.clip();
      c.beginPath(); for (i = 0; i < NP; i++) { var x = g.x0 + i / (NP - 1) * xw, y = g.Y(PATH[i]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.lineWidth = 2; c.strokeStyle = C.loss; c.stroke();
      c.lineTo(g.x1, g.yB); c.lineTo(g.x0, g.yB); c.closePath();
      var gr = c.createLinearGradient(0, yH, 0, g.yB); gr.addColorStop(0, M.rgba(C.loss, 0.18)); gr.addColorStop(1, M.rgba(C.loss, 0)); c.fillStyle = gr; c.fill();
      c.lineWidth = 1; c.textAlign = 'center'; c.font = '600 9px Inter, system-ui, sans-serif';
      EV.forEach(function (e) {
        var ex = g.x0 + e.f * xw, ey = g.yB - 11;
        c.beginPath(); c.arc(ex, ey, 7, 0, 6.3); c.fillStyle = C['surface-1']; c.fill(); c.strokeStyle = C['text-3']; c.stroke(); c.fillStyle = C['text-2']; c.fillText(e.m, ex, ey + 0.5);
      });
      c.restore(); c.font = FONT;
      if (st.draw >= 1) {
        c.beginPath(); c.arc(g.x1, yP, 6, 0, 6.3); c.fillStyle = M.rgba(C.loss, 0.18); c.fill(); c.beginPath(); c.arc(g.x1, yP, 3, 0, 6.3); c.fillStyle = C.loss; c.fill();
        c.fillStyle = C['text-2']; c.textAlign = 'left'; c.fillText(g.wide ? 'Now ' + cur + M.fmt(P) + ' · 27% below the high' : '−27%', g.x1 + (g.wide ? 14 : 9), yP + 14);
      }
      /* past similar cases fan out from today’s level */
      if (st.fan <= 0) return;
      FAN.forEach(function (f, k) {
        var u = Math.max(0, Math.min(1, (st.fan * FAN_MS - k * 15) / 900)); if (u <= 0) return;
        var m = f.a.length - 1, upto = M.easeOut(u) * m, ok = f.kind === 'ok', px = g.x2, py = yP;
        c.beginPath(); c.moveTo(px, py);
        for (var j = 1; j <= Math.ceil(upto); j++) {
          var jj = Math.min(j, upto), a = Math.floor(jj), b = Math.min(m, a + 1);
          px = g.x2 + jj / 96 * fw; py = g.Y(f.a[a] + (f.a[b] - f.a[a]) * (jj - a)); c.lineTo(px, py);
        }
        c.lineWidth = ok ? 1.25 : 1; c.strokeStyle = M.rgba(ok ? C.accent : C['text-3'], ok ? 0.5 : 0.45); c.stroke();
        if (u < 1) return;
        if (ok) { c.beginPath(); c.arc(px, yH, 2.5, 0, 6.3); c.fillStyle = C.accent; c.fill(); }
        else { c.fillStyle = M.rgba(C.loss, 0.7); c.beginPath(); if (c.roundRect) c.roundRect(px - 1.5, py - 5, 3, 10, 1.5); else c.rect(px - 1.5, py - 5, 3, 10); c.fill(); }
      });
    }

    /* ----- the sequence: path draws, the drop splits and peels, the cases fan out, the bar fills ----- */
    function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function stop() { timers.forEach(clearTimeout); anims.forEach(function (a) { a.cancel(); }); timers = []; anims = []; }
    function setStage(n, instant) {
      if (instant) stage.classList.add('no-anim');
      ['s1', 's2', 's3'].forEach(function (cl, i) { stage.classList.toggle(cl, i < n); });
      if (instant) { void stage.offsetWidth; stage.classList.remove('no-anim'); }
    }
    function setBars(on, instant) {
      bars.forEach(function (b) { var fl = $('.fill', b); if (instant) fl.style.transition = 'none'; b.classList.toggle('in', on); b.classList.toggle('tc-hold', !on); if (instant) { void fl.offsetWidth; fl.style.transition = ''; } });
    }
    function still() { return M.rm() || M.compact(); }
    function final() { stop(); st.draw = 1; st.fan = 1; setStage(3, true); setBars(true, true); drawStage(); }
    function play() {
      stop();
      if (still()) { final(); return; }
      st.draw = 0; st.fan = 0; setStage(0, true); setBars(false, true); drawStage();
      anims.push(M.tween(700, function (u) { st.draw = u; drawStage(); }, M.easeOut, function () {
        setStage(1);
        later(460, function () {
          setStage(2);
          later(M.SPRING.gentle.ms + 280, function () {
            anims.push(M.tween(FAN_MS, function (u) { st.fan = u; drawStage(); }, null, function () {
              setStage(3); later(220, function () { setBars(true); });
            }));
          });
        });
      }));
    }
    function first() {
      if (still()) { final(); return; }
      st.draw = 0; st.fan = 0; setStage(0, true); drawStage();
      if (!('IntersectionObserver' in window)) { play(); return; }
      var io = new IntersectionObserver(function (en) {
        if (en[en.length - 1].isIntersecting) { io.disconnect(); play(); }
        else setBars(true); /* the stage is below the fold: do not hold the verdict bars back */
      }, { threshold: 0.3 });
      io.observe(stage);
    }
    $('#tc-replay', host).addEventListener('click', function () {
      if (still()) M.toast('Reduced motion or Compact is on, so the finished picture is shown without the animation.');
      play();
    });
    document.addEventListener('ml:pref', function () { if (played && still()) final(); });

    /* ----- cumulative incidence of the competing outcomes ----- */
    function F(t) { return 72.3 * (1 - Math.exp(-t / 15.1)); }
    var CURVES = [
      { n: 'Regained', s: 'Regained', f: F, c: 'accent', lw: 2 },
      { n: 'Depth baseline', s: 'Baseline', f: function (t) { return 62 * (1 - Math.exp(-t / 15.4)); }, c: 'text-2', dash: [4, 4] },
      { n: 'Still open', s: 'Open', f: function (t) { return 100 - F(t) - 5.15 * (1 - Math.exp(-t / 40)) - 6.6 * (1 - Math.exp(-t / 26)); }, c: 'text-3' },
      { n: 'Acquired', s: 'Acquired', f: function (t) { return 6.6 * (1 - Math.exp(-t / 26)); }, c: 'data-3' },
      { n: 'Failed', s: 'Failed', f: function (t) { return 5.15 * (1 - Math.exp(-t / 40)); }, c: 'loss' }
    ];
    function drawInc() {
      var p = plotCtx(incHost); if (!p) return;
      var c = p.c, w = p.w, h = p.h, C = M.COL, big = w >= 520, pl = 34, pr = big ? 122 : 88, pt = 12, pb = 24, iw = w - pl - pr, ih = h - pt - pb, t;
      function X(m) { return pl + m / 60 * iw; }
      function Y(v) { return pt + (1 - v / 100) * ih; }
      c.clearRect(0, 0, w, h); c.font = FONT; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 1;
      [0, 25, 50, 75].forEach(function (v) {
        var y = Math.round(Y(v)) + 0.5; c.strokeStyle = M.rgba(C['text-1'], v ? 0.06 : 0.16); c.beginPath(); c.moveTo(pl, y); c.lineTo(pl + iw, y); c.stroke();
        c.fillStyle = C['text-3']; c.textAlign = 'right'; c.fillText(v + '%', pl - 8, y);
      });
      c.textAlign = 'center'; [0, 12, 24, 36, 48, 60].forEach(function (m) { c.fillText(m === 60 ? '60 mo' : String(m), X(m), h - 9); });
      /* 80% band around "regained" */
      c.beginPath(); for (t = 0; t <= 60; t++) c.lineTo(X(t), Y(F(t) * (1.29 - 0.121 * t / 60)));
      for (t = 60; t >= 0; t--) c.lineTo(X(t), Y(F(t) * (0.66 + 0.115 * t / 60)));
      c.closePath(); c.fillStyle = M.rgba(C.accent, 0.14); c.fill();
      CURVES.forEach(function (s) {
        c.beginPath(); for (t = 0; t <= 60; t++) { if (t) c.lineTo(X(t), Y(s.f(t))); else c.moveTo(X(t), Y(s.f(t))); }
        c.lineWidth = s.lw || 1.5; c.strokeStyle = C[s.c]; c.setLineDash(s.dash || []); c.stroke(); c.setLineDash([]);
      });
      /* the 24-month reading */
      var x24 = Math.round(X(24)) + 0.5; c.lineWidth = 1; c.setLineDash([1, 4]); c.strokeStyle = M.rgba(C['text-1'], 0.3); c.beginPath(); c.moveTo(x24, Y(F(24))); c.lineTo(x24, Y(0)); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(X(24), Y(F(24)), 4, 0, 6.3); c.fillStyle = C['surface-1']; c.fill(); c.lineWidth = 2; c.strokeStyle = C.accent; c.stroke();
      c.fillStyle = C['text-1']; c.textAlign = 'right'; c.fillText('58% at 24 months', X(24) - 9, Y(F(24)) - 11);
      /* direct labels at the end of each line, nudged apart */
      var ys = CURVES.map(function (s) { return Y(s.f(60)); }), k;
      for (k = ys.length - 2; k >= 0; k--) ys[k] = Math.min(ys[k], ys[k + 1] - 14);
      c.textAlign = 'left';
      CURVES.forEach(function (s, i) { c.fillStyle = C[s.c === 'text-3' ? 'text-2' : s.c]; c.fillText((big ? s.n : s.s) + ' ' + Math.round(s.f(60)) + '%', pl + iw + 8, ys[i]); });
    }

    function paint() { layout(); drawStage(); drawInc(); siSpark($('#tc-si2', host), id); }
    keepPainted(host, paint, [stage, incHost]);
    return { show: function () { layout(); drawInc(); siSpark($('#tc-si2', host), id); if (!played) { played = true; first(); } else drawStage(); } };
  });
})();
