/* Market Lens mockup: stock page tabs News & mind map, Stress test, My position and Track record. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, esc = M.esc;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- shared helpers ---------- */
  function D(y, m, d) { return new Date(y, m - 1, d); }
  function fd(d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function pc(p) { return Math.round(p * 100) + '%'; }
  function money(v, cur, dp) { return (v < 0 ? '−' : '') + cur + M.fmt(Math.abs(v), dp == null ? 2 : dp); }
  function smoney(v, cur, dp) { return (v > 0 ? '+' : v < 0 ? '−' : '') + cur + M.fmt(Math.abs(v), dp == null ? 2 : dp); }
  /* a signed figure: sign, colour and an arrow, never colour alone */
  function sg(v, txt) { return v ? '<span class="tdx-sg ' + (v > 0 ? 'up' : 'dn') + '">' + txt + ' <i aria-hidden="true">' + (v > 0 ? '▲' : '▼') + '</i></span>' : '<span class="tdx-sg">' + txt + '</span>'; }
  function pc1(v) { v = Math.round(v * 10) / 10 || 0; return sg(v, M.fpct(v, 1)); }
  function gain(v, pct, cur, dp) { v = r2(v) || 0; return sg(v, smoney(v, cur, dp) + (pct == null ? '' : ' (' + M.fpct(pct, 1) + ')')); }
  /* 80% interval for a rate estimated from n comparable events and pulled toward a prior worth 8 events */
  function iv(p, n, k) { var hw = 1.2816 * Math.sqrt(p * (1 - p) / (n + 8)) * (k || 1); return [Math.max(0.02, p - hw), Math.min(0.98, p + hw)]; }
  function wilson(k, n) { var z = 1.2816, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [Math.max(0, c - w), Math.min(1, c + w)]; }
  function weights() { var t = M.portfolio().total, w = {}; Object.keys(M.HOLD).forEach(function (k) { w[k] = M.valueUSD(k) / t; }); return w; }
  function fld(label, attrs) { return '<label class="fld">' + label + '<input class="field" ' + attrs + '></label>'; }
  function hx(s) { var o = ''; for (var i = 0; i < 8; i++) o += ('0000000' + M.hash(s + ':' + i).toString(16)).slice(-8); return o; }
  function short(n) { return n.replace(/,? (Inc\.|Corp\.|plc)$/, ''); }   /* company name without its legal suffix, for running text */
  function list(a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join(''); }
  function hshort(h) { return h.slice(0, 8) + '…' + h.slice(-6); }

  /* what kind of company this is, and the event-library rates its industry carries */
  function profile(id) {
    var sec = I[id].sec, P = {
      chip: /Technology|Consumer Discretionary|Communication/.test(sec), energy: sec === 'Energy', fin: sec === 'Financials',
      airline: id === 'DAL' || id === 'IAG.L', bank: id === 'JPM' || id === 'HSBA.L', insurer: id === '1299.HK', defence: id === 'LMT'
    };
    P.ind = P.airline ? 'Airline' : P.defence ? 'Defence' : P.bank ? 'Bank' : P.insurer ? 'Insurance' : P.energy ? 'Integrated oil and gas' : sec;
    P.rate5 = P.bank ? 0.61 : P.insurer ? 0.47 : P.airline ? 0.47 : ({ 'Technology': 0.45, 'Consumer Discretionary': 0.44, 'Communication': 0.46, 'Energy': 0.52, 'Consumer Staples': 0.49, 'Health Care': 0.51, 'Industrials': 0.48 })[sec] || 0.49;
    P.chip5 = ({ 'Technology': 0.40, 'Consumer Discretionary': 0.46, 'Communication': 0.45 })[sec] || 0.5;
    return P;
  }
  /* the three sample events on the mind map, and the holdings each one reaches there */
  var E1 = D(2026, 11, 3), E2 = D(2026, 11, 9), E3 = D(2026, 11, 12);
  var TOUCH = { e1: ['SHEL.L', 'COST'], e2: ['MSFT', 'NVDA', '1299.HK'], e3: ['NVDA', 'AAPL'] };

  /* =====================================================================
     News & mind map
     ===================================================================== */
  var DIR = { good: ['up', 'Likely good', '▲'], bad: ['dn', 'Likely bad', '▼'], unclear: ['tdn-unc', 'Unclear', '?'] };
  var BASIS_T = 'Confirmed fact: stated in a filing, measured in data, or reported as having happened by two independent sources with checked quotes. Everything else is model inference.';

  M.stockTab('news', function (host, ctx) {
    var id = ctx.id, it = ctx.it, nm = esc(short(it.n)), P = profile(id), held = ctx.held, W = weights();
    var doc = it.cty === 'United States' ? '10-K' : 'annual report', tsm = M.tk('TSM', { name: false });
    var rq = ctx.DATA.restated.rev.q, rg = (rq[7] / rq[3] - 1) * 100, S = [];
    host.setAttribute('aria-label', 'News and mind map');

    /* ----- stories: one row per story, however many outlets carried it ----- */
    S.push({ k: 'freight', d: E1, score: 86, outlets: 14, direct: false, dir: 'bad', conf: 'medium', touch: TOUCH.e1,
      t: 'Shipping disruption in the Strait of Hormuz raises freight and component costs',
      why: P.energy ? 'Tankers are being sent around the strait, which raises shipping and insurance costs for crude and refined products. For ' + nm + ' that takes back part of what a higher oil price gives.'
        : P.fin ? 'Rerouted ships mean dearer freight and insurance for the companies ' + nm + ' lends to and insures. The effect reaches it through those customers and their suppliers, not directly.'
        : 'Ships are being sent around the strait, which lengthens delivery times and raises freight and insurance rates. ' + nm + ' depends on suppliers whose parts and goods travel by sea, so its costs may rise for a quarter or two.',
      route: P.fin ? 'via corporate customers and their suppliers; sector channel from the curated matrix'
        : 'via suppliers and sea freight; the FY2025 ' + doc + ' expanded its wording on single-source components',
      basis: 'The band comes from the event library, not from the language model: 9 comparable events, and the sector fell against the market over 5 days in 6 of them. The rate is pulled toward 50% because 9 is few.',
      quote: 'Carriers have begun routing vessels around the strait, adding 10 to 14 days to some sailings.', src: 'Wire service, 3 Nov 2026' });
    S.push({ k: 'results', d: D(2026, 10, 29), score: 81, outlets: 22, direct: true, dir: 'unclear', conf: 'low',
      t: 'Q4 FY25 results: revenue ' + (rg >= 0 ? 'up ' : 'down ') + Math.abs(rg).toFixed(1) + '% on a year earlier, margin outlook trimmed',
      why: 'Revenue landed inside the range management gave in July. The lower margin outlook is specific to the company, and it is one reason the shares have fallen further than the sector since the July high.',
      basis: 'Results are not an event type with a usable history in the event library, so no direction is called and the band stays low.',
      quote: 'We now expect gross margin for the coming quarter to be about half a point below our earlier range.', src: 'Chief Financial Officer, results call, 29 Oct 2026' });
    S.push({ k: 'customers', d: D(2026, 10, 31), score: 55, outlets: 5, direct: true, dir: 'unclear', conf: 'low',
      t: 'Two customers now account for 23% of revenue, the FY2025 ' + doc + ' shows',
      why: 'When two customers bring in almost a quarter of revenue, losing one contract does more damage. Last year’s filing did not carry this sentence. The Deep-dive tab shows the wording side by side.',
      basis: 'A filing change with no event history. The fact is confirmed from the filing; what it means for the share price is not called.',
      quote: 'Two customers accounted for approximately 23% of total net revenue.', src: 'FY2025 ' + doc + ', risk factors' });
    S.push({ k: 'rating', d: D(2026, 11, 6), score: 22, outlets: 3, direct: true, dir: 'unclear', conf: 'low',
      t: 'Analyst, Firm B lowers its rating from buy to hold',
      why: 'A third-party opinion, not a Market Lens forecast. In the event library a single rating change has not been followed by a reliable move in this sector.',
      basis: 'Too little history to call a direction.',
      quote: 'We see limited upside until margins stabilise.', src: 'Analyst, Firm B, 6 Nov 2026' });
    S.push({ k: 'fed', d: E2, score: 64, outlets: 27, direct: false, touch: TOUCH.e2,
      dir: P.bank ? 'good' : P.chip ? 'bad' : 'unclear', conf: P.bank ? 'medium' : 'low',
      t: 'Federal Reserve signals a slower pace of rate cuts',
      why: P.bank ? 'The 10-year yield rose 14 bp on the day. Rates that stay higher for longer support the margin a bank earns between what it lends at and what it pays on deposits.'
        : P.chip ? 'The 10-year yield rose 14 bp on the day. Higher yields lower the value placed on profits that are years away, which weighs most on highly valued shares such as ' + nm + '.'
        : 'The 10-year yield rose 14 bp and the dollar 0.6% on the day. For ' + P.ind.toLowerCase() + ' shares the record after signals like this is mixed, so no direction is called.',
      route: it.x === 'HKEX' ? 'via the US dollar and Hong Kong interest rates, which follow US rates; this stock’s beta to the dollar'
        : 'via the 10-year yield; this stock’s beta to rates over three years',
      basis: P.bank ? '17 comparable signals; bank shares rose against the market over 5 days in 11 of them.'
        : P.chip ? '17 comparable signals; the sector fell against the market over 5 days in 9 of them, barely more than half.'
        : '17 comparable signals, with no lean either way for this sector.',
      quote: 'The committee can afford to move more slowly from here.', src: 'Central bank official, speech, 9 Nov 2026' });
    if (P.energy) S.push({ k: 'oil', d: D(2026, 11, 4), score: 78, outlets: 31, direct: false, dir: 'good', conf: 'high', touch: TOUCH.e1,
      t: 'Oil rises 8% in two sessions after the Hormuz disruption',
      why: 'A higher oil price lifts what ' + nm + ' earns on each barrel it produces. The gain lasts only as long as the price does. The stock’s link to oil has been steady for three years.',
      route: 'via the oil price; this stock’s beta to oil over three years, stable',
      basis: '14 comparable events; integrated oil shares rose against the market over 5 days in 11 of them.',
      quote: 'Brent settled 8% higher over two sessions.', src: 'Wire service, 4 Nov 2026' });
    if (P.airline) S.push({ k: 'oil', d: D(2026, 11, 4), score: 76, outlets: 12, direct: false, dir: 'bad', conf: 'medium', touch: TOUCH.e1,
      t: 'Jet fuel costs jump as oil rises',
      why: 'Fuel is one of the largest costs for an airline and only part of it is hedged. A lasting rise in jet fuel would squeeze margins within a quarter.',
      route: 'via the oil price and jet fuel; fuel is a large share of costs according to the ' + doc,
      basis: '13 comparable events; airline shares fell against the market over 5 days in 9 of them.',
      quote: 'Brent settled 8% higher over two sessions.', src: 'Wire service, 4 Nov 2026' });
    if (P.defence) S.push({ k: 'oil', d: D(2026, 11, 4), score: 58, outlets: 8, direct: false, dir: 'good', conf: 'low', touch: TOUCH.e1,
      t: 'Defence shares rise after the shipping lane disruption',
      why: 'Conflict near a trade route has sometimes brought defence orders forward. The record is close to a coin toss, so the band is low.',
      route: 'via the defence sector; sector membership and beta',
      basis: '13 comparable events; the sector rose against the market over 5 days in 7 of them, barely more than half.',
      quote: 'Several governments said they would review naval escort plans.', src: 'Wire service, 4 Nov 2026' });
    if (P.chip) {
      var c = { k: 'chips', d: E3, outlets: 9, touch: TOUCH.e3, conf: 'low', t: 'Government opens a review of chip export controls',
        quote: 'The department will take comments for 30 days before deciding on any change.', src: 'Government notice, 12 Nov 2026' };
      if (id === 'TSM') { c.direct = true; c.score = 74; c.dir = 'unclear';
        c.why = 'The review could change which advanced chips may be sold to some customers. ' + nm + ' makes those chips, so the outcome matters directly, but nothing has been decided.';
        c.basis = '6 comparable reviews, too few to call a direction.';
      } else if (id === 'AAPL' || id === 'NVDA') { c.direct = false; c.score = 61; c.dir = 'bad';
        c.route = 'via ' + tsm + ', supplier, disclosed in the 2025 10-K';
        c.why = nm + ' relies on ' + esc(short(I.TSM.n)) + ' to make its most advanced chips. Tighter limits on that supplier could delay or restrict supply. The outcome of the review is unknown.';
        c.basis = 'The supplier link is a confirmed fact from the filing. The direction rests on 6 comparable reviews, so the band is low.';
      } else if (id === 'INTC') { c.direct = false; c.score = 52; c.dir = 'unclear';
        c.route = 'via ' + tsm + ', competitor; sector channel';
        c.why = 'Limits on a competitor could move orders toward ' + nm + ', or the review could tighten rules for the whole industry. The two effects pull in opposite directions.';
        c.basis = '6 comparable reviews, and the link is a model reading of three articles.';
      } else { c.direct = false; c.score = 46; c.dir = 'unclear';
        c.route = 'via chip suppliers, two steps away; sector channel';
        c.why = nm + ' buys large numbers of advanced chips through its suppliers. Tighter limits could slow deliveries, but the link is two steps long and weak.';
        c.basis = '6 comparable reviews, and the link is a model reading of three articles.';
      }
      S.push(c);
    }

    function exposure(s) {
      if (!held) return '';
      var others = (s.touch || []).filter(function (k) { return k !== id && M.HOLD[k]; }), tot = W[id];
      others.forEach(function (k) { tot += W[k]; });
      return '<p class="tdn-exp">' + M.icon('case', 'ic-sm') + '<span>About <b>' + Math.round(tot * 100) + '% of your portfolio</b> is exposed: ' +
        (others.length ? 'this holding (' + (W[id] * 100).toFixed(1) + '%) plus ' + list(others.map(function (k) { return M.tk(k, { name: false }); })) + ', which the same event reaches' : 'this holding alone') + '. Worked out on this computer.</span></p>';
    }
    function storyHTML(s) {
      var d = DIR[s.dir], tier = s.score >= 75 ? 'Major' : s.score >= 45 ? 'Notable' : 'Routine';
      return '<li class="tdn-story" data-k="' + s.k + '">' +
        '<div class="tdn-meta"><span class="tdn-tier" data-t="' + tier.toLowerCase() + '">' + tier + '</span><time datetime="' + iso(s.d) + '">' + fd(s.d) + '</time><span>' + s.outlets + ' outlets, shown once</span></div>' +
        '<h3 class="tdn-t">' + s.t + '</h3>' +
        '<p class="tdn-why"><b>Why it matters.</b> ' + s.why + '</p>' +
        '<div class="tdn-tags"><span class="chg ' + d[0] + '">' + d[1] + ' <i aria-hidden="true">' + d[2] + '</i></span>' +
          '<span class="badge tdn-conf" data-c="' + s.conf + '" title="' + esc(s.basis) + '">Confidence: ' + s.conf + '<span class="tdn-pips" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
          '<span class="badge' + (s.direct ? ' badge-accent' : '') + '">' + (s.direct ? 'Direct' : 'Indirect') + '</span></div>' +
        (s.direct ? '' : '<p class="tdn-route"><span class="label">Route</span>' + s.route + '</p>') + exposure(s) +
        '<details class="tdn-ev"><summary>Evidence</summary><div>' +
          '<p><b>Where the confidence band comes from.</b> ' + s.basis + '</p>' +
          '<blockquote>“' + s.quote + '”<cite>' + s.src + ' · quote checked against the source text</cite></blockquote>' +
          '<div class="tdn-ev-a"><a class="linkish" href="mindmap.html">Build a mind map from this story</a><button class="linkish" type="button" data-nr>Not relevant</button></div>' +
        '</div></details></li>';
    }

    /* ----- event exposure from the news engine ----- */
    var SC = [{ t: 'The disruption lasts beyond four weeks and freight and component costs stay high', p: 0.40, basis: 'inference', p5: 0.36, n: 9,
      why: 'Curated matrix: conflict on a shipping lane raises freight and insurance costs.', pw: 'The lane stayed restricted this long in 4 of the 9 comparable events.' },
    { t: 'No further rate cut before March and yields stay higher', p: 0.52, basis: 'fact', p5: P.rate5, n: 17,
      why: 'Measured: the 10-year yield rose 14 bp on the day of the signal.', pw: 'No cut followed within four months after 9 of the 17 comparable signals.' }];
    if (P.energy) SC.push({ t: 'Oil stays at least 8% above its level before the disruption', p: 0.44, basis: 'fact', p5: 0.71, n: 14,
      why: 'Measured: Brent rose 8% in the two sessions after the event.', pw: 'The rise held for a month in 6 of the 14 comparable events.' });
    else if (P.airline) SC.push({ t: 'Jet fuel stays dear while oil is high', p: 0.44, basis: 'fact', p5: 0.34, n: 13,
      why: 'Measured: the jet fuel crack spread widened.', pw: 'The rise held for a month in 6 of the 13 comparable events.' });
    else if (P.defence) SC.push({ t: 'Governments bring defence orders forward', p: 0.36, basis: 'inference', p5: 0.53, n: 13,
      why: 'Curated matrix: conflict near a trade route lifts defence spending.', pw: 'Orders were brought forward after 4 of the 13 comparable events.' });
    else if (P.chip) SC.push({ t: 'The review ends with tighter chip export limits', p: 0.38, basis: id === 'AAPL' || id === 'NVDA' ? 'fact' : 'inference', p5: P.chip5, n: 6,
      why: id === 'AAPL' || id === 'NVDA' ? 'Filing: ' + esc(short(I.TSM.n)) + ' is named as a supplier in the 2025 10-K. The outcome of the review is not known.' : 'Model reading of three articles. The outcome of the review is not known.',
      pw: 'Limits were tightened after 2 of the 6 comparable reviews.' });
    else SC.push({ t: 'The dollar keeps rising after the Fed signal', p: 0.40, basis: 'fact', p5: P.insurer ? 0.44 : P.bank ? 0.51 : 0.49, n: 11,
      why: 'Measured: the dollar index rose 0.6% on the day.', pw: 'The rise carried on for a month after 4 of the 11 comparable signals.' });
    function prow(lbl, p, n, k) {
      var v = iv(p, n, k), lo = Math.round(v[0] * 100), hi = Math.round(v[1] * 100);
      return '<div class="tdn-p"><div class="tdn-p-h"><span>' + lbl + '</span><b>' + pc(p) + '</b></div>' +
        '<div class="pbar" role="img" aria-label="' + pc(p) + ' chance, 80% interval ' + lo + ' to ' + hi + '%, against even odds of 50%" style="--p:' + p.toFixed(2) + ';--lo:' + lo + '%;--hi:' + hi + '%;--b:50%"><div class="fill"></div><div class="band"></div><div class="base" title="Even odds"></div></div>' +
        '<div class="pbar-l"><span>80% interval ' + lo + ' to ' + hi + '%</span><span>Even odds 50%</span></div></div>';
    }
    function scHTML(s, i) {
      return '<li class="tdn-sc"><div class="tdn-sc-h"><span class="tdn-rank" aria-hidden="true">' + (i + 1) + '</span><h3>' + s.t + '</h3></div>' +
        '<div class="tdn-sc-m"><span class="badge tdn-basis" data-b="' + s.basis + '" title="' + BASIS_T + '">' + (s.basis === 'fact' ? 'Confirmed fact' : 'Model inference') + '</span><span>Scenario probability <b>' + pc(s.p) + '</b></span></div>' +
        '<p class="tdn-sc-w">' + s.why + ' ' + s.pw + '</p>' +
        prow('Sector’s 5-day abnormal return is positive', s.p5, s.n, 1) + prow('Sector’s 30-day abnormal return is positive', 0.5 + (s.p5 - 0.5) * 0.7, s.n, 1.2) +
        '<p class="label">' + s.n + ' comparable past events · sector: ' + esc(P.ind.toLowerCase()) + '</p></li>';
    }

    var nDirect = S.filter(function (s) { return s.direct; }).length;
    host.innerHTML = '<div class="split tdn">' +
      '<section class="card reveal" aria-labelledby="tdn-h"><header class="card-h"><h2 id="tdn-h">Stories about ' + esc(id) + '</h2><div class="card-a"><span class="badge" title="Stories in this mockup are invented">Prototype data</span></div></header>' +
        (held ? '<p class="band accent">' + M.icon('case') + '<span>You hold ' + esc(id) + ': ' + (W[id] * 100).toFixed(1) + '% of your portfolio. The exposure figures below are worked out on this computer from your holdings. Your holdings are never sent to a news source or to the language model.</span></p>' : '') +
        '<div class="toolbar tdn-bar"><div class="seg" id="tdn-f" role="group" aria-label="Show stories">' +
          '<button type="button" data-v="all" aria-pressed="true">All ' + S.length + '</button><button type="button" data-v="direct" aria-pressed="false">Direct ' + nDirect + '</button><button type="button" data-v="indirect" aria-pressed="false">Indirect ' + (S.length - nDirect) + '</button></div>' +
          '<span class="sp"></span><span class="label">Sort by</span><div class="seg" id="tdn-s" role="group" aria-label="Sort stories">' +
          '<button type="button" data-v="imp" aria-pressed="true">Importance</button><button type="button" data-v="date" aria-pressed="false">Date</button></div></div>' +
        '<p class="label" id="tdn-count" aria-live="polite"></p>' +
        '<ol class="tdn-feed">' + S.map(storyHTML).join('') + '</ol>' +
        '<p class="label tdn-foot">Direction and wording come from the language model. The confidence band does not: it is the event library’s record for that kind of event and sector, shown as low, medium or high until the ledger holds enough resolved calls to justify numbers.</p></section>' +
      '<div class="stack">' +
        '<section class="card reveal" aria-labelledby="tdn-x-h"><header class="card-h"><h2 id="tdn-x-h">Event exposure</h2><div class="card-a"><span class="badge">News engine</span></div></header>' +
          '<p class="tdx-note">How ' + esc(P.ind.toLowerCase()) + ' shares moved against the market after comparable past events, for the scenarios that reach ' + esc(id) + ' most. No price levels: each bar is a probability with its interval. The badge says what the link to the sector rests on.</p>' +
          '<ol class="tdn-scs">' + SC.map(scHTML).join('') + '</ol>' +
          '<p class="label">Scenarios are hypotheticals and are not written to the ledger. Direction calls on events that have happened are: see <button class="linkish" type="button" data-goto="track">Track record</button>.</p></section>' +
        '<section class="card reveal" aria-labelledby="tdn-m-h"><header class="card-h"><h2 id="tdn-m-h">Mind map</h2></header>' +
          '<div class="tdn-chain" role="img" aria-label="Route of the top story: Hormuz shipping disruption, then freight and insurance costs up, then ' + (P.fin ? 'corporate customers' : 'suppliers') + ', then ' + esc(id) + '">' +
            '<span data-t="event">Hormuz shipping disruption</span><i>→</i><span data-t="factor">Freight and insurance ↑</span><i>→</i><span data-t="company">' + (P.fin ? 'Corporate customers' : 'Suppliers') + '</span><i>→</i><span data-t="' + (held ? 'holding' : 'company') + '">' + esc(id) + '</span></div>' +
          '<p class="tdx-note">See how the three open events reach ' + esc(id) + (held ? ' and your other holdings' : '') + ', link by link, with the evidence for each link.</p>' +
          '<a class="btn btn-primary tdn-build" href="mindmap.html">' + M.icon('map') + '<span>Build mind map</span></a>' +
          '<p class="label">Links between events are hypotheses, not facts.</p></section>' +
      '</div></div>';

    /* ----- filter and sort: rows glide to their new places ----- */
    var feed = $('.tdn-feed', host), count = $('#tdn-count', host), nodes = {}, st = { f: 'all', s: 'imp' };
    $$('.tdn-story', feed).forEach(function (n) { nodes[n.dataset.k] = n; });
    function arrange(animate) {
      var anim = animate && !M.rm(), first = {}, shown = 0, outlets = 0;
      if (anim) S.forEach(function (s) { var n = nodes[s.k]; if (!n.hidden) first[s.k] = n.getBoundingClientRect().top; });
      var order = S.slice().sort(function (a, b) { return st.s === 'imp' ? b.score - a.score : (b.d - a.d) || (b.score - a.score); });
      order.forEach(function (s) {
        var n = nodes[s.k], on = st.f === 'all' || (st.f === 'direct') === !!s.direct;
        n.hidden = !on; feed.appendChild(n); if (on) { shown++; outlets += s.outlets; }
      });
      count.textContent = shown + (shown === 1 ? ' story' : ' stories') + ' from ' + outlets + ' outlet reports, ' + (st.s === 'imp' ? 'most important' : 'newest') + ' first. Each story is shown once.';
      if (!anim) return;
      order.forEach(function (s) {
        var n = nodes[s.k]; if (n.hidden) return;
        n.style.transition = 'none';
        if (first[s.k] == null) n.style.opacity = '0';
        else { var dy = first[s.k] - n.getBoundingClientRect().top; if (dy) n.style.transform = 'translateY(' + dy + 'px)'; }
      });
      void feed.offsetHeight;
      order.forEach(function (s) { var n = nodes[s.k]; n.style.transition = ''; n.style.transform = ''; n.style.opacity = ''; });
    }
    var segs = [M.initSeg($('#tdn-f', host), function (v) { st.f = v; arrange(true); }), M.initSeg($('#tdn-s', host), function (v) { st.s = v; arrange(true); })];
    arrange(false);
    feed.addEventListener('click', function (e) {
      if (!e.target.closest('[data-nr]')) return;
      M.toast('Marked as not relevant. The click is logged so the ranking can be checked later.');
    });
    var barsIn = false;
    return { show: function () {
      segs.forEach(function (s) { s.place(false); });
      if (barsIn) return; barsIn = true;
      setTimeout(function () { $$('.pbar', host).forEach(function (p) { p.classList.add('in'); }); }, M.rm() ? 0 : 300);
    } };
  });

  /* =====================================================================
     Stress test
     ===================================================================== */
  var FACT = [
    { k: 'oil', n: 'Oil price', min: -50, max: 60, step: 5, preset: 40, u: '%', div: 1, per: 'per 1% in oil', dp: 2, chip: 'Oil +40%' },
    { k: 'rates', n: 'Rates (10-year yield)', min: -200, max: 200, step: 25, preset: 100, u: ' bp', div: 100, per: 'per 100 bp', dp: 1, chip: 'Rates +100 bp' },
    { k: 'usd', n: 'US dollar', min: -10, max: 10, step: 1, preset: 5, u: '%', div: 1, per: 'per 1% in the dollar', dp: 2, chip: 'Dollar +5%' },
    { k: 'eq', n: 'Equities', min: -40, max: 20, step: 5, preset: -20, u: '%', div: 1, per: 'per 1% in the market', dp: 2, chip: 'Equities −20%' }
  ];
  /* % move in the stock per unit of each factor: oil +1%, rates +100 bp, dollar +1%, market +1% */
  var SECB = {
    'Technology': [-0.02, -5.5, -0.45, 1.25], 'Consumer Staples': [-0.04, -2.0, -0.15, 0.70], 'Communication': [-0.02, -4.5, -0.80, 1.10], 'Financials': [0.03, 4.0, -0.25, 1.10],
    'Energy': [0.42, -1.0, -0.35, 0.85], 'Consumer Discretionary': [-0.08, -4.0, -0.30, 1.30], 'Health Care': [-0.01, -1.5, -0.20, 0.65], 'Industrials': [-0.05, -2.5, -0.25, 1.05]
  };
  var OWNB = { '1299.HK': [0.00, 1.5, -0.90, 1.00], 'HSBA.L': [0.04, 3.5, -0.55, 0.95], '9988.HK': [-0.03, -4.0, -0.85, 1.15], 'DAL': [-0.30, -2.0, -0.20, 1.35], 'IAG.L': [-0.28, -2.0, -0.35, 1.30], 'LMT': [0.04, -1.5, -0.10, 0.60] };
  var SE0 = [0.03, 1.4, 0.2, 0.08];
  function betas(id) {
    var base = OWNB[id] || SECB[I[id].sec] || SECB.Industrials, r = M.rng(M.hash(id + ':betas'));
    return {
      b: base.map(function (v, i) { return +(v * (0.9 + r() * 0.2) + (r() - 0.5) * SE0[i] * 0.4).toFixed(FACT[i].dp); }),
      se: SE0.map(function (v, i) { return +(v * (0.8 + r() * 0.5)).toFixed(FACT[i].dp); }),
      resid: +(4.5 + r() * 4).toFixed(1)   /* one-month residual risk, % */
    };
  }
  /* effect = sum of beta x shock; the spread comes from the betas' standard errors and residual risk */
  function effect(B, sh) {
    var e = 0, m = 0, parts = [], sex = [];
    FACT.forEach(function (f, i) { var x = sh[f.k] / f.div; parts.push(B.b[i] * x); sex.push(B.se[i] * x); e += B.b[i] * x; m += Math.pow(sh[f.k] / f.preset, 2); });
    return { e: e, parts: parts, sex: sex, res: B.resid * Math.min(1, Math.sqrt(m)) };
  }
  function half(x) { var v = x.res * x.res; x.sex.forEach(function (s) { v += s * s; }); return 1.2816 * Math.sqrt(v); }
  function fsh(f, v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + f.u; }

  M.stockTab('stress', function (host, ctx) {
    var id = ctx.id, it = ctx.it, held = ctx.held, cur = ctx.cur, B = betas(id), sh = { oil: 40, rates: 0, usd: 0, eq: 0 };
    var HIDS = Object.keys(M.HOLD), W = weights(), total = M.portfolio().total, HB = {}, SECS = [];
    HIDS.forEach(function (k) { HB[k] = betas(k); if (SECS.indexOf(I[k].sec) < 0) SECS.push(I[k].sec); });
    host.setAttribute('aria-label', 'Stress test');

    function wfHTML(kind, items) {
      function r(k, label, tot) {
        return '<li class="tds-wf-r' + (tot ? ' tds-wf-tot' : '') + (k === id ? ' is-me' : '') + '" data-k="' + esc(k) + '"><span class="tds-wf-n">' + label + '</span>' +
          '<span class="tds-wf-track"><i class="tds-wf-zero"></i>' + (tot ? '<i class="tds-wf-band"></i>' : '') + '<i class="tds-wf-bar"></i></span><span class="tds-wf-v"></span></li>';
      }
      return '<div class="panel' + (kind === 'holding' ? ' is-active' : '') + '" data-v="' + kind + '"><ul class="tds-wf" data-wf="' + kind + '" style="--n:' + (items.length + 1) + '">' +
        items.map(function (x) { return r(x.k, x.label); }).join('') + r('__total', 'Portfolio', true) + '</ul>' +
        '<div class="tds-wf-ax" aria-hidden="true"><span></span><div class="rangebar-l"><span data-lo></span><span>points of portfolio value</span><span data-hi></span></div><span></span></div></div>';
    }
    var holdItems = HIDS.map(function (k) { return { k: k, label: M.tk(k, { sub: (W[k] * 100).toFixed(1) + '% of portfolio' + (k === id ? ' · this stock' : '') }) }; });
    var secItems = SECS.map(function (s) {
      var w = 0, n = 0; HIDS.forEach(function (k) { if (I[k].sec === s) { w += W[k]; n++; } });
      return { k: s, label: '<span class="tds-wf-sec"><b>' + esc(s) + '</b><small>' + (w * 100).toFixed(1) + '% · ' + n + (n === 1 ? ' holding' : ' holdings') + '</small></span>' };
    });

    host.innerHTML = '<div class="tdx-head"><div><h2 class="t2">Historical sensitivity, not a forecast</h2>' +
        '<p>What a shock to oil, rates, the dollar or the stock market would have meant for ' + esc(id) + ', going by how the stock moved with each of them over the last three years.</p></div>' +
        '<span class="badge" title="Sensitivities in this mockup are invented">Prototype data</span></div>' +
      '<div class="tds-grid">' +
        '<section class="card reveal tds-ctl" aria-labelledby="tds-c-h"><header class="card-h"><h2 id="tds-c-h">Scenario</h2><div class="card-a"><button class="btn btn-quiet btn-sm" type="button" data-reset>Reset</button></div></header>' +
          '<div class="chips" role="group" aria-label="Preset shocks">' + FACT.map(function (f) { return '<button class="chip" type="button" data-preset="' + f.k + '" aria-pressed="false">' + f.chip + '</button>'; }).join('') +
            '<button class="chip" type="button" data-preset="all" aria-pressed="false">All four</button></div>' +
          '<div class="tds-fs">' + FACT.map(function (f) {
            return '<div class="tds-f"><div class="tds-f-h"><label for="tds-r-' + f.k + '">' + f.n + '</label><output id="tds-o-' + f.k + '" for="tds-r-' + f.k + '"></output></div>' +
              '<input class="rng" id="tds-r-' + f.k + '" data-k="' + f.k + '" type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + sh[f.k] + '">' +
              '<div class="rangebar-l"><span>' + fsh(f, f.min) + '</span><span>' + fsh(f, f.max) + '</span></div></div>';
          }).join('') + '</div>' +
          '<p class="label tds-how">Presets can be mixed. Each sensitivity is the stock’s average move when the factor moved, from three years of weekly data, pulled toward the sector’s value. The effect is the sum of sensitivity times shock. Its 80% interval comes from the standard errors and the stock’s own residual risk over a month.</p>' +
          '<p class="sr" id="tds-live" aria-live="polite"></p></section>' +
        '<div class="stack">' +
          '<section class="card reveal" aria-labelledby="tds-s-h"><header class="card-h"><h2 id="tds-s-h">' + esc(id) + ': sensitivities and estimated effect</h2><div class="card-a"><span class="badge">3 years, weekly</span></div></header>' +
            '<div class="tds-eff"><div class="label">Estimated effect on ' + esc(id) + ' under this scenario</div>' +
              '<div class="bignum" id="tds-e"></div>' +
              '<div class="tds-iv" id="tds-iv" role="img"><i class="tds-iv-band"></i><i class="tds-iv-pt"></i></div>' +
              '<div class="rangebar-l" aria-hidden="true"><span data-lo></span><span>0</span><span data-hi></span></div>' +
              (held ? '<p class="tdx-note" id="tds-pos"></p>' : '') + '</div>' +
            '<div class="dt-wrap"><table class="dt tds-t"><thead><tr><th scope="col">Factor</th><th scope="col">Sensitivity ± standard error</th><th scope="col">Shock</th><th scope="col" class="l">Contribution</th><th scope="col">Effect</th></tr></thead>' +
              '<tbody>' + FACT.map(function (f, i) {
                return '<tr data-k="' + f.k + '"><th scope="row">' + f.n + '</th><td><b>' + M.fpct(B.b[i], f.dp) + '</b> <span class="dim">± ' + B.se[i].toFixed(f.dp) + ' ' + f.per + '</span></td><td data-sh></td>' +
                  '<td class="l"><div class="tds-bar" aria-hidden="true"><i></i></div></td><td data-c></td></tr>';
              }).join('') + '</tbody>' +
              '<tfoot><tr data-k="sum"><td>All four together</td><td class="dim">residual risk ± ' + B.resid.toFixed(1) + '% a month</td><td></td><td class="l"><div class="tds-bar" aria-hidden="true"><i></i></div></td><td data-c></td></tr></tfoot></table></div></section>' +
          (held ?
            '<section class="card reveal" aria-labelledby="tds-p-h"><header class="card-h"><h2 id="tds-p-h">Effect on my portfolio</h2><div class="card-a"><div class="seg" id="tds-by" role="group" aria-label="Break the effect down">' +
                '<button type="button" data-v="holding" aria-pressed="true">By holding</button><button type="button" data-v="sector" aria-pressed="false">By sector</button></div></div></header>' +
              '<div class="tds-eff"><div class="label">Estimated effect on the whole portfolio (' + HIDS.length + ' holdings, $' + M.fmt(total, 0) + ')</div><div class="bignum" id="tds-pe"></div></div>' +
              '<div class="tds-wfs" id="tds-wfs">' + wfHTML('holding', holdItems) + wfHTML('sector', secItems) + '</div>' +
              '<p class="label tds-pn">Sorted by size, largest first. Each bar starts where the one above ends, so the last bar ends at the portfolio total; the shaded band on it is the 80% interval. Your holdings are read on this computer and reach the stress test as a plain list of securities and weights.</p></section>'
            : '<p class="band">' + M.icon('case') + '<span>You do not hold ' + esc(id) + ', so no portfolio effect is shown here. The stress test under Tools runs the same scenario on all your holdings, a watchlist or a pasted list.</span></p>') +
          '<p class="band">' + M.icon('warn') + '<span>A scenario is a what-if, not a prediction, so it is not written to the ledger. The sensitivities are checked out of sample by attributing actual moves in past shock windows.</span></p>' +
        '</div></div>';

    var sliders = {}, outs = {}, trs = {}, live = $('#tds-live', host), ivEl = $('#tds-iv', host), wf = {};
    FACT.forEach(function (f) { sliders[f.k] = $('#tds-r-' + f.k, host); outs[f.k] = $('#tds-o-' + f.k, host); });
    $$('.tds-t tr[data-k]', host).forEach(function (tr) { trs[tr.dataset.k] = { sh: $('[data-sh]', tr), c: $('[data-c]', tr), bar: $('.tds-bar i', tr) }; });
    $$('.tds-wf', host).forEach(function (ul) {
      var rows = {}; $$('.tds-wf-r', ul).forEach(function (li) { rows[li.dataset.k] = { li: li, bar: $('.tds-wf-bar', li), zero: $('.tds-wf-zero', li), band: $('.tds-wf-band', li), v: $('.tds-wf-v', li) }; });
      wf[ul.dataset.wf] = { rows: rows, ax: ul.nextElementSibling };
    });
    function setBar(el, v, S) { el.style.transform = 'scaleX(' + Math.max(-1, Math.min(1, v / S)).toFixed(4) + ')'; el.classList.toggle('neg', v < 0); }
    function span(el, a, b) { var lo = Math.min(a, b), hi = Math.max(a, b); el.style.transform = 'translateX(' + (lo * 100).toFixed(2) + '%) scaleX(' + Math.max(0.004, hi - lo).toFixed(4) + ')'; }
    function at(el, x) { el.style.transform = 'translateX(' + (Math.max(0, Math.min(0.995, x)) * 100).toFixed(2) + '%)'; }

    /* a sorted waterfall: rows slide to their rank, bars stretch between running totals */
    function wfUpdate(kind, items, tot, hw) {
      var w = wf[kind], order = items.slice().sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v) || a.i - b.i; }), run = 0, pts = [0, tot - hw, tot + hw];
      order.forEach(function (x) { x.a = run; run += x.v; x.b = run; pts.push(run); });
      var lo = Math.floor(Math.min.apply(null, pts) / 2) * 2, hi = Math.ceil(Math.max.apply(null, pts) / 2) * 2;
      if (hi - lo < 4) { lo -= 2; hi += 2; }
      function X(v) { return (v - lo) / (hi - lo); }
      function val(v) { var p = Math.round(v * 100) / 100 || 0; return sg(p, M.fsign(p, 2) + ' pp') + '<small>' + smoney(Math.round(v / 100 * total), '$', 0) + '</small>'; }
      order.forEach(function (x, rank) {
        var r = w.rows[x.k]; r.li.style.setProperty('--i', rank);
        span(r.bar, X(x.a), X(x.b)); r.bar.classList.toggle('neg', x.v < 0); at(r.zero, X(0)); r.v.innerHTML = val(x.v);
      });
      var t = w.rows.__total; t.li.style.setProperty('--i', order.length);
      span(t.bar, X(0), X(tot)); t.bar.classList.toggle('neg', tot < 0); span(t.band, X(tot - hw), X(tot + hw)); at(t.zero, X(0)); t.v.innerHTML = val(tot);
      $('[data-lo]', w.ax).textContent = M.fsign(lo, 0); $('[data-hi]', w.ax).textContent = M.fsign(hi, 0);
    }

    function calc(announce) {
      var e = effect(B, sh), tot = e.e, hw = half(e), any = FACT.some(function (f) { return sh[f.k] !== 0; });
      var S = Math.max(10, Math.ceil(Math.max(Math.abs(tot - hw), Math.abs(tot + hw), Math.max.apply(null, e.parts.map(Math.abs))) / 10) * 10);
      FACT.forEach(function (f, i) {
        var v = sh[f.k];
        outs[f.k].textContent = fsh(f, v); sliders[f.k].setAttribute('aria-valuetext', fsh(f, v).replace('%', ' percent').replace(' bp', ' basis points'));
        trs[f.k].sh.textContent = fsh(f, v); trs[f.k].c.innerHTML = pc1(e.parts[i]); setBar(trs[f.k].bar, e.parts[i], S);
      });
      trs.sum.c.innerHTML = pc1(tot); setBar(trs.sum.bar, tot, S);
      var range = any ? '80% interval ' + M.fpct(tot - hw, 1) + ' to ' + M.fpct(tot + hw, 1) : 'No shock applied. Pick a preset or move a slider.';
      $('#tds-e', host).innerHTML = pc1(tot) + '<small>' + range + '</small>';
      span($('.tds-iv-band', ivEl), (tot - hw + S) / (2 * S), (tot + hw + S) / (2 * S)); at($('.tds-iv-pt', ivEl), (tot + S) / (2 * S));
      ivEl.setAttribute('aria-label', 'Estimated effect ' + M.fpct(tot, 1) + (any ? ', ' + range : ''));
      var ax = ivEl.nextElementSibling; $('[data-lo]', ax).textContent = '−' + S + '%'; $('[data-hi]', ax).textContent = '+' + S + '%';
      $$('[data-preset]', host).forEach(function (c) {
        var k = c.dataset.preset, on = k === 'all' ? FACT.every(function (f) { return sh[f.k] === f.preset; }) : sh[k] === FACT.filter(function (f) { return f.k === k; })[0].preset;
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var said = 'Estimated effect on ' + id + ': ' + M.fpct(tot, 1) + (any ? ', ' + range : '') + '.';
      if (held) {
        var val = held.q * it.p;
        $('#tds-pos', host).innerHTML = 'On your ' + M.fmt(held.q, 0) + ' shares, worth ' + money(val, cur, 0) + ': about <b>' + smoney(Math.round(val * tot / 100), cur, 0) + '</b>' +
          (any ? ', 80% interval ' + smoney(Math.round(val * (tot - hw) / 100), cur, 0) + ' to ' + smoney(Math.round(val * (tot + hw) / 100), cur, 0) : '') + '.';
        /* portfolio: residual risks are independent across holdings; errors in the same factor's betas are added up */
        var items = HIDS.map(function (k, i) { var x = effect(HB[k], sh); return { k: k, i: i, v: W[k] * x.e, x: x }; }), ptot = 0, pv = 0;
        items.forEach(function (x) { ptot += x.v; pv += Math.pow(W[x.k] * x.x.res, 2); });
        FACT.forEach(function (f, j) { var s = 0; items.forEach(function (x) { s += W[x.k] * x.x.sex[j]; }); pv += s * s; });
        var phw = 1.2816 * Math.sqrt(pv);
        $('#tds-pe', host).innerHTML = pc1(ptot) + '<small>about ' + smoney(Math.round(ptot / 100 * total), '$', 0) + (any ? ' · 80% interval ' + M.fpct(ptot - phw, 1) + ' to ' + M.fpct(ptot + phw, 1) : '') + '</small>';
        wfUpdate('holding', items, ptot, phw);
        wfUpdate('sector', SECS.map(function (s, i) { var v = 0; items.forEach(function (x) { if (I[x.k].sec === s) v += x.v; }); return { k: s, i: i, v: v }; }), ptot, phw);
        said += ' Portfolio: ' + M.fpct(ptot, 1) + '.';
      }
      if (announce) live.textContent = said;
    }
    function set(k, v) { sh[k] = v; sliders[k].value = v; }
    host.addEventListener('input', function (e) { var r = e.target.closest('input[data-k]'); if (!r) return; sh[r.dataset.k] = +r.value; calc(false); });
    host.addEventListener('change', function (e) { if (e.target.closest('input[data-k]')) calc(true); });
    host.addEventListener('click', function (e) {
      var c = e.target.closest('[data-preset]');
      if (c) {
        var k = c.dataset.preset, on = c.getAttribute('aria-pressed') === 'true';
        FACT.forEach(function (f) { if (k === 'all' || k === f.k) set(f.k, on ? 0 : f.preset); });
        calc(true);
      } else if (e.target.closest('[data-reset]')) { FACT.forEach(function (f) { set(f.k, 0); }); calc(true); }
    });
    var by = held ? M.initSeg($('#tds-by', host), function (v) { M.showPanel($('#tds-wfs', host), v, v === 'sector' ? 1 : -1); }) : null;
    calc(false);
    return { show: function () { if (by) by.place(false); } };
  });

  /* =====================================================================
     My position
     ===================================================================== */
  M.stockTab('position', function (host, ctx) {
    var id = ctx.id, it = ctx.it, h = ctx.held, cur = ctx.cur, today = iso(ctx.NOW);
    host.setAttribute('aria-label', 'My position');
    function sheetForm(title, body, save, onOpen) {
      M.sheet(title, '<form class="tdx-form" novalidate>' + body + '<dl class="kv tdx-prev" aria-live="polite"></dl>' +
        '<p class="label">Tracking figures, not tax computations. Nothing is saved in this mockup.</p>' +
        '<div class="sheet-f"><button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">' + save + '</button></div></form>',
      function (sh) {
        var f = $('form', sh), prev = $('.tdx-prev', sh);
        function num(n) { return parseFloat(f.elements[n].value) || 0; }
        function run() { return onOpen(num, prev, f); }
        f.addEventListener('input', run); run();
        f.addEventListener('submit', function (e) { e.preventDefault(); var msg = run(); if (!msg) return; M.closeSheet(); M.toast(msg); });
      });
    }
    function kv(rows) { return rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join(''); }

    if (!h) {
      host.innerHTML = '<section class="card"><div class="empty tdp-empty">' + M.icon('case') + '<h2 class="t2">You do not hold ' + esc(id) + '</h2>' +
        '<p>Add a holding to see its lots, gains, dividends and transactions here. Holdings stay on this computer.</p>' +
        '<button class="btn btn-primary" type="button" data-add>' + M.icon('plus') + '<span>Add a holding</span></button></div></section>';
      $('[data-add]', host).addEventListener('click', function () {
        sheetForm('Add a holding of ' + id,
          fld('Trade date', 'type="date" name="d" value="' + today + '" max="' + today + '"') +
          '<div class="tdx-2">' + fld('Shares', 'type="number" name="q" inputmode="decimal" min="0" step="1" value="10"') + fld('Price per share (' + it.c + ')', 'type="number" name="p" inputmode="decimal" min="0" step="0.01" value="' + it.p.toFixed(2) + '"') + '</div>' +
          fld('Fees (' + it.c + ')', 'type="number" name="f" inputmode="decimal" min="0" step="0.01" value="1.00"'), 'Save holding',
          function (num, prev) {
            var q = num('q'), cost = q * num('p') + num('f');
            prev.innerHTML = q > 0 ? kv([['Opens', 'one lot of ' + M.fmt(q, 0) + ' shares'], ['Cost, fees included', money(cost, cur)], ['Cost per share', money(cost / q, cur)]]) : kv([['Check', 'Enter a number of shares above zero.']]);
            return q > 0 ? 'A lot of ' + M.fmt(q, 0) + ' ' + id + ' would be opened. This mockup does not save holdings.' : '';
          });
      });
      return {};
    }

    /* ----- two open lots that sum to the holding and average to its cost; one earlier sale from the older lot ----- */
    var q = h.q, unit = q >= 1000 ? 100 : q >= 100 ? 10 : 1;
    var a = Math.round(q * 0.6 / unit) * unit, b = q - a, s = Math.max(unit, Math.round(a * 0.25 / unit) * unit), a0 = a + s;
    var dA = D(2023, 3, 9), dB = D(2024, 9, 17), dS = D(2026, 2, 12);
    var pA = r2(h.cost * 0.86), feeA0 = r2(Math.max(1, a0 * pA * 0.0008)), feeA = r2(feeA0 * a / a0), costA = r2(a * pA + feeA);
    var costB = r2(q * h.cost - costA), pB = Math.floor((costB - Math.max(1, costB * 0.0008)) / b * 100) / 100, feeB = r2(costB - b * pB);
    var pS = r2(it.pc * 1.12), feeS = r2(Math.max(1, s * pS * 0.0008)), proceeds = r2(s * pS - feeS), matched = r2(s * pA + feeA0 - feeA), realised = r2(proceeds - matched);
    var LOTS = [
      { d: dA, q: a, p: pA, fee: feeA, cost: costA, note: M.fmt(s, 0) + ' of the original ' + M.fmt(a0, 0) + ' sold on ' + fd(dS) },
      { d: dB, q: b, p: pB, fee: feeB, cost: costB, note: 'Whole lot still held' }
    ];
    /* dividends: quarterly, net of tax withheld, on the shares held at each ex-dividend date */
    var DIVS = [], wh = it.cty === 'United States' ? 0.3 : 0;
    for (var y = 2023; y <= 2026; y++) [[2, 13], [5, 15], [8, 14], [11, 13]].forEach(function (m) {
      var d = D(y, m[0], m[1]); if (d <= dA || d > ctx.NOW) return;
      var sh = d < dB ? a0 : d < D(2026, 2, 20) ? a0 + b : q, per = Math.max(0.01, r2(ctx.div * Math.pow(0.96, 2026 - y))), gross = r2(sh * per), tax = r2(gross * wh);
      DIVS.push({ d: d, sh: sh, per: per, gross: gross, tax: tax, net: r2(gross - tax) });
    });
    DIVS.reverse();
    var divNet = 0, divGross = 0, divTax = 0; DIVS.forEach(function (x) { divNet += x.net; divGross += x.gross; divTax += x.tax; });
    var TX = [
      { d: dA, type: 'Buy', sh: a0, p: pA, fee: feeA0, amt: -r2(a0 * pA + feeA0), note: 'Opens lot 1' },
      { d: dB, type: 'Buy', sh: b, p: pB, fee: feeB, amt: -costB, note: 'Opens lot 2' },
      { d: dS, type: 'Sell', sh: -s, p: pS, fee: feeS, amt: proceeds, note: 'Closes ' + M.fmt(s, 0) + ' shares of lot 1, first in, first out' }
    ].concat(DIVS.map(function (x) { return { d: x.d, type: 'Dividend', sh: x.sh, p: x.per, fee: x.tax, amt: x.net, note: (wh ? 'Net of ' + Math.round(wh * 100) + '% tax withheld' : 'No tax withheld') + (x.sh !== q && x.d > dS ? '; on the shares held at the ex-dividend date, before the sale' : '') }; }))
      .sort(function (x, z) { return z.d - x.d; });

    function tiles() {
      var val = q * it.p, cost = q * h.cost, un = val - cost, day = q * (it.p - it.pc), w = M.valueUSD(id) / M.portfolio().total * 100;
      function t(l, v, sub) { return '<div class="tdx-tile"><div class="label">' + l + '</div><div class="tdx-v">' + v + '</div><div class="tdx-s">' + sub + '</div></div>'; }
      return t('Shares', M.fmt(q, 0), '2 open lots') +
        t('Average cost', money(h.cost, cur), 'a share, fees included') +
        t('Value', money(val, cur), it.c === 'USD' ? M.fmt(q, 0) + ' × ' + M.fmt(it.p) : 'about $' + M.fmt(M.valueUSD(id), 0) + ' at today’s rate') +
        t('Unrealised gain', gain(un, null, cur), M.fpct(un / cost * 100, 1) + ' on a cost of ' + money(cost, cur, 0)) +
        t('Today’s change', gain(day, null, cur), M.fpct(M.pctOf(it)) + ' since the previous close') +
        t('Share of portfolio', w.toFixed(1) + '%', '<span class="meter"><i style="--v:' + Math.min(100, w * 4).toFixed(0) + '%"></i></span>' + (w >= 10 ? 'Above the 10% single-stock warning' : 'Below the 10% single-stock warning'));
    }
    function lotsBody() {
      return LOTS.map(function (l, i) {
        var v = l.q * it.p, g = v - l.cost;
        return '<tr><td><b>Lot ' + (i + 1) + '</b><span class="tdx-sub">' + l.note + '</span></td><td>' + fd(l.d) + '</td><td>' + M.fmt(l.q, 0) + '</td><td>' + M.fmt(l.p) + '</td><td>' + M.fmt(l.fee) + '</td><td>' + M.fmt(l.cost) + '</td><td>' + M.fmt(v) + '</td><td>' + gain(g, g / l.cost * 100, '') + '</td></tr>';
      }).join('');
    }
    function lotsFoot() {
      var v = q * it.p, c = q * h.cost, g = v - c;
      return '<tr><td>Open position</td><td></td><td>' + M.fmt(q, 0) + '</td><td>' + M.fmt(h.cost) + '<span class="tdx-sub">average cost</span></td><td>' + M.fmt(feeA + feeB) + '</td><td>' + M.fmt(c) + '</td><td>' + M.fmt(v) + '</td><td>' + gain(g, g / c * 100, '') + '</td></tr>';
    }
    function totalReturn() {
      var un = q * (it.p - h.cost);
      return kv([['Realised gain', gain(realised, null, cur)], ['Dividends received, net', gain(divNet, null, cur)], ['Unrealised gain', gain(un, null, cur)], ['<b>Total return on ' + esc(id) + '</b>', '<b>' + gain(realised + divNet + un, null, cur) + '</b>']]);
    }
    var txShown = 8;
    host.innerHTML = '<div class="tdx-head"><div><h2 class="t2">My position in ' + esc(id) + '</h2>' +
        '<p>Cost basis is first in, first out: a sale closes the oldest lot first. These are tracking figures, not tax computations. Amounts are in ' + it.c + ', the trade currency.</p></div>' +
        '<div class="toolbar"><span class="badge" title="Prices come from an unofficial source until a licensed feed replaces it">Prototype data</span>' +
          '<button class="btn" type="button" data-sale>Record a sale</button><button class="btn" type="button" data-divd>Record a dividend</button></div></div>' +
      '<div class="stack">' +
        '<section class="card reveal" aria-label="Position summary"><div class="tdx-tiles" data-n="6" id="tdp-tiles">' + tiles() + '</div></section>' +
        '<section class="card reveal" aria-labelledby="tdp-l-h"><header class="card-h"><h2 id="tdp-l-h">Open lots</h2><div class="card-a"><span class="badge">First in, first out</span></div></header>' +
          '<div class="dt-wrap"><table class="dt" id="tdp-lots"><thead><tr><th scope="col">Lot</th><th scope="col">Bought</th><th scope="col">Shares</th><th scope="col">Price</th><th scope="col">Fees</th><th scope="col">Cost</th><th scope="col">Value</th><th scope="col">Gain</th></tr></thead>' +
          '<tbody>' + lotsBody() + '</tbody><tfoot>' + lotsFoot() + '</tfoot></table></div></section>' +
        '<div class="g2">' +
          '<section class="card reveal" aria-labelledby="tdp-r-h"><header class="card-h"><h2 id="tdp-r-h">Realised gains</h2><div class="card-a"><span class="badge">1 sale</span></div></header>' +
            '<div class="tdx-flush"><div class="dt-wrap"><table class="dt"><thead><tr><th scope="col">Sold</th><th scope="col">Shares</th><th scope="col">Net proceeds</th><th scope="col">Matched cost</th><th scope="col">Gain</th></tr></thead>' +
            '<tbody><tr><td>' + fd(dS) + '<span class="tdx-sub">from lot 1, bought ' + fd(dA) + '</span></td><td>' + M.fmt(s, 0) + '</td><td>' + M.fmt(proceeds) + '<span class="tdx-sub">' + M.fmt(pS) + ' a share less ' + M.fmt(feeS) + ' fees</span></td><td>' + M.fmt(matched) + '</td><td>' + gain(realised, realised / matched * 100, '') + '</td></tr></tbody></table></div></div>' +
            '<dl class="kv tdp-tr" id="tdp-tr">' + totalReturn() + '</dl></section>' +
          '<section class="card reveal" aria-labelledby="tdp-d-h"><header class="card-h"><h2 id="tdp-d-h">Dividends received</h2><div class="card-a"><button class="linkish" type="button" data-more="div" aria-expanded="false">Show all ' + DIVS.length + '</button></div></header>' +
            '<div class="dt-wrap"><table class="dt" id="tdp-divs"><thead><tr><th scope="col">Paid</th><th scope="col" title="Shares held on the ex-dividend date">Shares on ex-date</th><th scope="col">Per share</th><th scope="col">Gross</th><th scope="col">Tax withheld</th><th scope="col">Net</th></tr></thead>' +
            '<tbody>' + DIVS.map(function (x, i) { return '<tr' + (i >= 4 ? ' hidden data-x' : '') + '><td>' + fd(x.d) + '</td><td>' + M.fmt(x.sh, 0) + '</td><td>' + M.fmt(x.per) + '</td><td>' + M.fmt(x.gross) + '</td><td>' + M.fmt(x.tax) + '</td><td>' + M.fmt(x.net) + '</td></tr>'; }).join('') + '</tbody>' +
            '<tfoot><tr><td>' + DIVS.length + ' payments since ' + fd(dA) + '</td><td></td><td></td><td>' + M.fmt(divGross) + '</td><td>' + M.fmt(divTax) + '</td><td>' + M.fmt(divNet) + '</td></tr></tfoot></table></div></section>' +
        '</div>' +
        '<section class="card reveal" aria-labelledby="tdp-t-h"><header class="card-h"><h2 id="tdp-t-h">Transactions in ' + esc(id) + '</h2><div class="card-a"><button class="linkish" type="button" data-more="tx" aria-expanded="false">Show all ' + TX.length + '</button></div></header>' +
          '<div class="dt-wrap"><table class="dt" id="tdp-tx"><thead><tr><th scope="col" data-sort="text" aria-sort="descending">Date</th><th scope="col" class="l" data-sort="text">Type</th><th scope="col" data-sort="num">Shares</th><th scope="col" data-sort="num">Price or rate</th><th scope="col" data-sort="num">Fees or tax</th><th scope="col" data-sort="num">Amount</th><th scope="col" class="l">Note</th></tr></thead>' +
          '<tbody>' + TX.map(function (x, i) {
            return '<tr' + (i >= txShown ? ' hidden data-x' : '') + '><td data-v="' + iso(x.d) + '">' + fd(x.d) + '</td><td class="l"><span class="badge tdp-ty" data-t="' + x.type.toLowerCase() + '">' + x.type + '</span></td><td>' + (x.type === 'Dividend' ? M.fmt(x.sh, 0) : M.fsign(x.sh, 0)) + '</td><td>' + M.fmt(x.p) + '</td><td>' + M.fmt(x.fee) + '</td><td data-v="' + x.amt + '">' + M.fsign(x.amt) + '</td><td class="l dim">' + x.note + '</td></tr>';
          }).join('') + '</tbody></table></div></section>' +
        '<section class="card reveal" aria-labelledby="tdp-m-h"><header class="card-h"><h2 id="tdp-m-h">What the modules say about this holding</h2></header><ul class="tdp-links">' +
          [['Drawdown check', '58% chance of regaining the prior high within 24 months, 80% interval 41 to 72%, against an industry base rate of 49%', 'drawdown'],
            ['Filing changes', '3 material changes in the FY2025 filing against FY2024', 'deepdive'],
            ['News exposure', 'Top story: shipping disruption, likely bad, confidence medium, indirect', 'news'],
            ['Stress sensitivities', 'How this holding and the portfolio respond to oil, rates, the dollar and equities', 'stress']].map(function (l) {
            return '<li><span class="label">' + l[0] + '</span><span>' + l[1] + '</span><button class="linkish" type="button" data-goto="' + l[2] + '">Open</button></li>';
          }).join('') + '</ul></section>' +
      '</div>';
    M.sortable($('#tdp-tx', host));

    /* value, gain and today's change follow the live price */
    M.onTick(function (x) {
      if (x.id !== id || !host.isConnected) return;
      $('#tdp-tiles', host).innerHTML = tiles(); $('#tdp-lots tbody', host).innerHTML = lotsBody(); $('#tdp-lots tfoot', host).innerHTML = lotsFoot(); $('#tdp-tr', host).innerHTML = totalReturn();
    });

    host.addEventListener('click', function (e) {
      var more = e.target.closest('[data-more]');
      if (more) {
        var open = more.getAttribute('aria-expanded') !== 'true', tb = $(more.dataset.more === 'tx' ? '#tdp-tx' : '#tdp-divs', host), n = more.dataset.more === 'tx' ? TX.length : DIVS.length;
        more.setAttribute('aria-expanded', open ? 'true' : 'false'); more.textContent = open ? 'Show fewer' : 'Show all ' + n;
        $$('tr[data-x]', tb).forEach(function (tr) { tr.hidden = !open; });
        return;
      }
      if (e.target.closest('[data-sale]')) {
        sheetForm('Record a sale of ' + id,
          fld('Trade date', 'type="date" name="d" value="' + today + '" max="' + today + '"') +
          '<div class="tdx-2">' + fld('Shares', 'type="number" name="q" inputmode="decimal" min="0" max="' + q + '" step="1" value="' + s + '"') + fld('Price per share (' + it.c + ')', 'type="number" name="p" inputmode="decimal" min="0" step="0.01" value="' + it.p.toFixed(2) + '"') + '</div>' +
          fld('Fees (' + it.c + ')', 'type="number" name="f" inputmode="decimal" min="0" step="0.01" value="' + r2(Math.max(1, s * it.p * 0.0008)).toFixed(2) + '"') +
          '<label class="fld">Lots to close<select class="select" name="m"><option value="fifo">Oldest first (first in, first out)</option><option value="pick">Name the lots</option></select></label>', 'Save sale',
          function (num, prev, f) {
            var n = num('q'), left = n, cost = 0, parts = [], ok = n > 0 && n <= q;
            f.elements.q.setAttribute('aria-invalid', ok ? 'false' : 'true');
            if (!ok) { prev.innerHTML = kv([['Check', n > q ? 'You hold ' + M.fmt(q, 0) + ' shares.' : 'Enter a number of shares above zero.']]); return ''; }
            LOTS.forEach(function (l, i) { var take = Math.min(left, l.q); if (take > 0) { cost += take * l.cost / l.q; parts.push(M.fmt(take, 0) + ' from lot ' + (i + 1)); left -= take; } });
            var net = n * num('p') - num('f'), g = net - cost;
            prev.innerHTML = kv([['Closes', parts.join(', ')], ['Matched cost', money(cost, cur)], ['Net proceeds', money(net, cur)], ['Realised gain', gain(g, cost ? g / cost * 100 : null, cur)], ['Shares left', M.fmt(q - n, 0)]]) +
              (f.elements.m.value === 'pick' ? '<dt>Named lots</dt><dd>Not part of this mockup: oldest first is used.</dd>' : '');
            return 'Sale of ' + M.fmt(n, 0) + ' ' + id + ' worked out, realised ' + smoney(g, cur, 0) + '. This mockup does not save transactions.';
          });
      } else if (e.target.closest('[data-divd]')) {
        sheetForm('Record a dividend from ' + id,
          fld('Payment date', 'type="date" name="d" value="' + today + '" max="' + today + '"') +
          '<div class="tdx-2">' + fld('Shares on the ex-dividend date', 'type="number" name="q" inputmode="decimal" min="0" step="1" value="' + q + '"') + fld('Amount per share (' + it.c + ')', 'type="number" name="p" inputmode="decimal" min="0" step="0.01" value="' + ctx.div.toFixed(2) + '"') + '</div>' +
          fld('Tax withheld (%)', 'type="number" name="t" inputmode="decimal" min="0" max="100" step="1" value="' + Math.round(wh * 100) + '"'), 'Save dividend',
          function (num, prev) {
            var gross = num('q') * num('p'), tax = gross * Math.min(100, num('t')) / 100;
            if (gross <= 0) { prev.innerHTML = kv([['Check', 'Enter the shares and the amount per share.']]); return ''; }
            prev.innerHTML = kv([['Gross', money(gross, cur)], ['Tax withheld', money(tax, cur)], ['Net received', money(gross - tax, cur)], ['Counts toward', 'total return, not cost basis']]);
            return 'Dividend of ' + money(gross - tax, cur) + ' net worked out. This mockup does not save transactions.';
          });
      }
    });
    return {};
  });

  /* =====================================================================
     Track record
     ===================================================================== */
  M.stockTab('track', function (host, ctx) {
    var id = ctx.id, P = profile(id), r = M.rng(M.hash(id + ':ledger')), TODAY = D(2026, 11, 16), rows = [];
    var sector = P.ind.toLowerCase() + ' sector';
    host.setAttribute('aria-label', 'Track record');

    /* ----- every live forecast about this stock ----- */
    [[6, 0.17, 0.08, 0.29, 0.14, D(2027, 5, 2)], [12, 0.36, 0.22, 0.50, 0.30, D(2027, 11, 2)], [24, 0.58, 0.41, 0.72, 0.49, D(2028, 11, 2)], [60, 0.77, 0.61, 0.87, 0.71, D(2031, 11, 2)]].forEach(function (d) {
      rows.push({ kind: 'dd', iss: D(2026, 11, 2), mod: 'Drawdown check', model: 'drawdown-base-rate v0.4', q: esc(id) + ' closes at or above its prior high within ' + d[0] + ' months', p: d[1], lo: d[2], hi: d[3], b: d[4], bl: 'industry base rate', hz: d[0] + ' months', end: d[5],
        rule: 'Regains the prior peak by the end date, on closing prices adjusted for splits. A delisting counts as no; an acquisition at or above the peak counts as yes.', bases: 'Industry-level base rate for this depth of fall ' + pc(d[4]) });
    });
    [[D(2026, 4, 30), D(2026, 7, 30), 0.69, 0.56, 0.80, 'third-quarter gross margin lands inside the guided range', 0, 'No: margin came in below the range'],
      [D(2026, 7, 30), D(2026, 10, 29), 0.70, 0.57, 0.81, 'fourth-quarter revenue lands inside the guided range', 1, 'Yes: revenue was inside the range'],
      [D(2026, 10, 29), D(2027, 1, 29), 0.71, 0.58, 0.82, 'first-quarter gross margin lands inside the trimmed range', null, '']].forEach(function (c) {
      rows.push({ kind: 'cred', iss: c[0], mod: 'Deep-dive', model: 'credibility-beta-binomial v0.2', q: 'Management credibility: ' + c[5], p: c[2], lo: c[3], hi: c[4], b: 0.64, bl: 'sector rate', hz: 'To next results', end: c[1], o: c[6], out: c[7],
        rule: 'Guidance met: the reported figure falls inside the range management gave, as first reported.', bases: 'Sector rate of dated claims met 64%' });
    });
    function calls(name, d0, e5, e30, p5, n, fix) {
      [[5, e5, p5, 1], [30, e30, 0.5 + (p5 - 0.5) * 0.7, 1.2]].forEach(function (x, j) {
        var p = Math.round(x[2] * 100) / 100, v = iv(p, n, x[3]), done = x[1] < TODAY, o = null, out = '', u = r(), mag = (0.4 + r() * 2.4) * (j ? 1.8 : 1);
        if (done) { o = fix != null && !j ? fix : (u < p + (p - 0.5) * 0.4 ? 1 : 0); out = (o ? 'Yes' : 'No') + ': abnormal return ' + M.fpct(o ? mag : -mag, 1); }
        rows.push({ kind: 'dir', iss: d0, mod: 'News engine', model: 'event-study-shrunk-mean v0.3', q: 'After “' + name + '”: the ' + sector + '’s abnormal return over ' + x[0] + ' trading days is positive', p: p, lo: v[0], hi: v[1], b: 0.5, bl: 'even odds', hz: x[0] + ' trading days', end: x[1], o: o, out: out,
          today: +x[1] === +TODAY, rule: 'Sign of the sector’s abnormal return over ' + x[0] + ' trading days: the sector’s return less the market-model prediction fitted on days −250 to −30.',
          bases: 'Even odds 50%; the sector’s unconditional up-rate ' + pc(0.5 + (u - 0.5) * 0.06) + '; the curated matrix alone ' + pc(0.5 + (p - 0.5) * 0.6), n: n });
      });
    }
    function lean() { return 0.5 + (r() < 0.5 ? -1 : 1) * (0.06 + r() * 0.1); }
    calls('Tariff schedule announced', D(2026, 8, 5), D(2026, 8, 12), D(2026, 9, 17), lean(), 12);
    calls('Dock strike at west-coast ports', D(2026, 9, 14), D(2026, 9, 21), D(2026, 10, 26), lean(), 8);
    calls('Rate cut of a quarter point', D(2026, 10, 28), D(2026, 11, 4), D(2026, 12, 10), lean(), 21);
    calls('Hormuz shipping disruption', E1, D(2026, 11, 10), D(2026, 12, 16), 0.36, 9, 0);
    calls('Fed signals slower cuts', E2, D(2026, 11, 16), D(2026, 12, 22), P.rate5, 17);
    if (P.chip) calls('Chip export-control review', E3, D(2026, 11, 19), D(2026, 12, 28), P.chip5, 6);
    rows.sort(function (x, z) { return x.iss - z.iss; });
    var seq = 1168 + M.hash(id + ':seq') % 24;
    rows.forEach(function (x) {
      seq += 1 + Math.floor(r() * 4); x.seq = seq; x.hash = hx(id + ':row:' + seq); x.prev = hx(id + ':row:' + (seq - 1));
      if (x.o != null) { x.bs = Math.pow(x.p - x.o, 2); x.bb = Math.pow(x.b - x.o, 2); }
    });
    rows.reverse();

    /* ----- scores: only resolved live calls count ----- */
    var res = rows.filter(function (x) { return x.o != null; }), n = res.length, hits = 0, sbs = 0, sbb = 0;
    res.forEach(function (x) { if ((x.p >= 0.5 ? 1 : 0) === x.o) hits++; sbs += x.bs; sbb += x.bb; });
    var skill = 1 - sbs / sbb, mean = (sbb - sbs) / n, sd = Math.sqrt(res.reduce(function (t, x) { return t + Math.pow(x.bb - x.bs - mean, 2); }, 0) / (n - 1)), hw = wilson(hits, n), windows = 0, lastEnd = 0;
    res.slice().sort(function (x, z) { return x.end - z.end; }).forEach(function (x) { if (+x.iss >= lastEnd) { windows++; lastEnd = +x.end; } });
    var shw = 1.2816 * sd / Math.sqrt(windows) / (sbb / n);   /* overlapping calls are not independent, so the spread uses the number of windows */
    var BINS = [[0, 0.4, 'Below 40%'], [0.4, 0.6, '40 to 60%'], [0.6, 1.01, 'Above 60%']].map(function (bn) {
      var xs = res.filter(function (x) { return x.p >= bn[0] && x.p < bn[1]; }), k = 0, sp = 0;
      xs.forEach(function (x) { k += x.o; sp += x.p; });
      return xs.length ? { label: bn[2], n: xs.length, p: sp / xs.length, f: k / xs.length, w: wilson(k, xs.length) } : { label: bn[2], n: 0 };
    });
    var head = hx('ledger-head-2026-11-16');

    function rowHTML(x) {
      var done = x.o != null;
      return '<tr tabindex="0" data-seq="' + x.seq + '" data-st="' + (done ? 'resolved' : 'open') + '">' +
        '<td data-v="' + iso(x.iss) + '-' + x.seq + '">' + fd(x.iss) + '<span class="tdx-sub">row ' + M.fmt(x.seq, 0) + '</span></td>' +
        '<td class="l">' + x.mod + '</td><td class="l tdt-q">' + x.q + '</td>' +
        '<td data-v="' + x.p + '"><b>' + pc(x.p) + '</b><span class="tdx-sub">' + Math.round(x.lo * 100) + ' to ' + pc(x.hi) + '</span></td>' +
        '<td data-v="' + x.b + '">' + pc(x.b) + '<span class="tdx-sub">' + x.bl + '</span></td>' +
        '<td data-v="' + iso(x.end) + '">' + x.hz + '<span class="tdx-sub">' + (done ? 'ended ' : 'to ') + fd(x.end) + '</span></td>' +
        '<td class="l" data-v="' + (done ? 'resolved' : 'open') + '"><span class="badge' + (done ? '' : ' badge-accent') + '">' + (done ? 'Resolved' : 'Open') + '</span></td>' +
        '<td class="l tdt-o">' + (done ? x.out : '<span class="dim">' + (x.today ? 'Resolves at today’s close' : 'Not yet known') + '</span>') + '</td>' +
        '<td data-v="' + (done ? x.bs.toFixed(4) : '') + '">' + (done ? x.bs.toFixed(2) + '<span class="tdx-sub">baseline ' + x.bb.toFixed(2) + ', ' + (x.bs < x.bb ? 'better' : x.bs > x.bb ? 'worse' : 'level') + '</span>' : '<span class="dim">' + (x.kind === 'dd' ? 'Scored as a set' : 'Pending') + '</span>') + '</td></tr>';
    }
    function s2(v) { return M.fsign(Math.round(v * 100) / 100 || 0, 2); }
    function tile(l, v, sub) { return '<div class="tdx-tile"><div class="label">' + l + '</div><div class="tdx-v">' + v + '</div><div class="tdx-s">' + sub + '</div></div>'; }
    function chainText() { return '<b>Hash chain verified.</b> 1,284 ledger rows checked from the first to the head (' + hshort(head) + ') at 16:00 on 16 Nov 2026. Each row carries the hash of the one before it, and rows cannot be changed or deleted.'; }
    var spans = skill - shw < 0 && skill + shw > 0;

    host.innerHTML = '<div class="tdx-head"><div><h2 class="t2">Track record for ' + esc(id) + '</h2>' +
        '<p>Every forecast Market Lens has written to its ledger about this stock, with what happened and how it scored against a simple baseline. Live forecasts only: backtests are never mixed in.</p></div>' +
        '<span class="badge badge-sample tdt-verdict">' + M.icon('warn', 'ic-sm') + 'Not yet meaningful: fewer than 10 independent windows</span></div>' +
      '<div class="stack">' +
        '<section class="card reveal" aria-label="Summary of the track record"><div class="tdx-tiles" data-n="4">' +
          tile('Forecasts issued', rows.length, 'all live, none from backtests') +
          tile('Resolved', n, (rows.length - n) + ' still open') +
          tile('Hit rate', pc(hits / n), hits + ' of ' + n + ' on the right side of 50% · 80% interval ' + Math.round(hw[0] * 100) + ' to ' + pc(hw[1])) +
          tile('Skill against the baseline', s2(skill), '80% interval ' + s2(skill - shw) + ' to ' + s2(skill + shw) + ' · Brier skill, above 0 beats the baseline') + '</div>' +
          '<p class="band warn tdt-why">' + M.icon('warn') + '<span>The ' + n + ' resolved calls fall in ' + windows + ' independent windows, because calls on the same event overlap. A verdict needs 10. ' +
            (spans ? 'The interval on the skill score spans zero, so these numbers do not yet show whether the forecasts beat the baseline.' : 'The interval on the skill score is wide, so treat these numbers as early.') + '</span></p></section>' +
        '<section class="card reveal" aria-labelledby="tdt-l-h"><header class="card-h"><h2 id="tdt-l-h">Ledger forecasts about ' + esc(id) + '</h2>' +
          '<div class="card-a"><div class="chips" role="group" aria-label="Show forecasts"><button class="chip" type="button" data-f="all" aria-pressed="true">All ' + rows.length + '</button><button class="chip" type="button" data-f="open" aria-pressed="false">Open ' + (rows.length - n) + '</button><button class="chip" type="button" data-f="resolved" aria-pressed="false">Resolved ' + n + '</button></div></div></header>' +
          '<div class="dt-wrap"><table class="dt" id="tdt-t"><thead><tr><th scope="col" data-sort="text" aria-sort="descending">Issued</th><th scope="col" class="l" data-sort="text">Module</th><th scope="col" class="l">Question</th><th scope="col" data-sort="num">Probability</th><th scope="col" data-sort="num">Baseline</th><th scope="col" data-sort="text">Horizon</th><th scope="col" class="l" data-sort="text">Status</th><th scope="col" class="l">Outcome</th><th scope="col" data-sort="num" title="Brier score: 0 is perfect, lower is better">Score</th></tr></thead>' +
          '<tbody>' + rows.map(rowHTML).join('') + '</tbody></table></div></section>' +
        '<div class="split">' +
          '<section class="card reveal" aria-labelledby="tdt-c-h"><header class="card-h"><h2 id="tdt-c-h">Calibration</h2><div class="card-a"><span class="badge">' + n + ' resolved calls</span></div></header>' +
            '<p class="tdx-note">If the forecasts are well calibrated, things given a 60% chance happen about 60% of the time and the points sit on the dashed line. Bars are 80% intervals. With so few calls they are wide.</p>' +
            '<div class="tdt-cal-w"><span class="label tdt-ax-y">Share that happened</span><div class="plot tdt-cal" id="tdt-cal"><canvas role="img" aria-label="Calibration plot. ' + BINS.map(function (bn) { return bn.label + ': ' + (bn.n ? bn.n + ' calls, average forecast ' + pc(bn.p) + ', ' + pc(bn.f) + ' happened' : 'no calls'); }).join('. ') + '."></canvas></div><span class="label tdt-ax-x">Forecast probability</span></div>' +
            '<details class="tdt-alt"><summary>Show the calibration data as a table</summary><div class="dt-wrap"><table class="dt"><thead><tr><th scope="col">Forecast</th><th scope="col">Calls</th><th scope="col">Average forecast</th><th scope="col">Share that happened</th><th scope="col">80% interval</th></tr></thead><tbody>' +
              BINS.map(function (bn) { return '<tr><td>' + bn.label + '</td><td>' + bn.n + '</td><td>' + (bn.n ? pc(bn.p) : '—') + '</td><td>' + (bn.n ? pc(bn.f) : '—') + '</td><td>' + (bn.n ? Math.round(bn.w[0] * 100) + ' to ' + pc(bn.w[1]) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div></details></section>' +
          '<section class="card reveal" aria-labelledby="tdt-h-h"><header class="card-h"><h2 id="tdt-h-h">How this is scored</h2></header><dl class="kv tdt-how">' +
            '<dt>Yes or no calls</dt><dd>Brier score against the stored baseline</dd><dt>Drawdown horizons</dt><dd>Ranked probability score across 6, 12, 24 and 60 months</dd><dt>Direction calls</dt><dd>Sign of the abnormal return at 5 and 30 trading days</dd><dt>Baselines</dt><dd>Stored beside each forecast when it is issued</dd><dt>Verdict</dt><dd>Only after 10 independent windows</dd></dl>' +
            '<p class="label">Choose a row in the table for its resolution rule, baselines and hashes. The Track record page under Tools has the same scores for each module across all stocks.</p></section>' +
        '</div>' +
        '<p class="band tdt-chain">' + M.icon('doc') + '<span class="tdt-chain-t">' + chainText() + '</span><button class="btn btn-sm" type="button" data-verify>Verify again</button></p>' +
      '</div>';

    var table = $('#tdt-t', host);
    M.sortable(table);
    $$('[data-f]', host).forEach(function (c) {
      c.addEventListener('click', function () {
        var f = c.dataset.f;
        $$('[data-f]', host).forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        $$('tbody tr', table).forEach(function (tr) { tr.hidden = f !== 'all' && tr.dataset.st !== f; });
      });
    });
    function open(tr) {
      var x = rows.filter(function (o) { return String(o.seq) === tr.dataset.seq; })[0]; if (!x) return;
      var done = x.o != null;
      M.sheet('Ledger row ' + M.fmt(x.seq, 0), '<p class="tdx-note">' + x.q + '</p><dl class="kv tdt-row">' +
        '<dt>Issued</dt><dd>' + fd(x.iss) + ', live</dd><dt>Module and model</dt><dd>' + x.mod + '<br><span class="dim">' + x.model + '</span></dd>' +
        '<dt>Probability</dt><dd>' + pc(x.p) + ', 80% interval ' + Math.round(x.lo * 100) + ' to ' + pc(x.hi) + '</dd>' +
        '<dt>Baselines stored</dt><dd>' + x.bases + '</dd><dt>Resolution rule, fixed at issue</dt><dd>' + x.rule + '</dd>' +
        '<dt>Horizon</dt><dd>' + fd(x.iss) + ' to ' + fd(x.end) + '</dd>' + (x.n ? '<dt>Rests on</dt><dd>' + x.n + ' comparable past events</dd>' : '') +
        '<dt>Status</dt><dd>' + (done ? 'Resolved ' + fd(x.end) : x.today ? 'Open, resolves at today’s close' : 'Open') + '</dd>' +
        (done ? '<dt>Outcome</dt><dd>' + x.out + '</dd><dt>Brier score</dt><dd>' + x.bs.toFixed(3) + ' against ' + x.bb.toFixed(3) + ' for the baseline</dd>' : '') +
        '<dt>Inputs as of</dt><dd>' + fd(x.iss) + ', previous close</dd><dt>Taint</dt><dd>' + (x.kind === 'dir' ? 'Event type read by the language model; the probability comes from the event library' : 'None') + '</dd>' +
        '<dt>Previous hash</dt><dd class="tdt-hash">' + x.prev + '</dd><dt>Row hash</dt><dd class="tdt-hash">' + x.hash + '</dd></dl>' +
        '<div class="sheet-f"><button class="btn" type="button" data-close>Close</button></div>');
    }
    table.tBodies[0].addEventListener('click', function (e) { var tr = e.target.closest('tr'); if (tr) open(tr); });
    table.tBodies[0].addEventListener('keydown', function (e) { var tr = e.target.closest('tr'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(tr); } });
    $('[data-verify]', host).addEventListener('click', function () {
      var btn = this, t = $('.tdt-chain-t', host); btn.disabled = true; t.textContent = 'Checking 1,284 rows…';
      setTimeout(function () { t.innerHTML = chainText(); btn.disabled = false; M.toast('Hash chain verified: 1,284 rows, no breaks.'); }, M.rm() ? 0 : 700);
    });

    /* ----- calibration plot ----- */
    var calHost = $('#tdt-cal', host), cv = $('canvas', calHost), prog = 0, played = false;
    function draw() {
      var w = calHost.clientWidth, h = calHost.clientHeight; if (!w || !h) return;
      var c = M.fitCanvas(cv, w, h), C = M.COL, pl = 40, pr = 14, pt = 12, pb = 26, iw = w - pl - pr, ih = h - pt - pb;
      function X(p) { return pl + p * iw; }
      function Y(p) { return pt + (1 - p) * ih; }
      c.clearRect(0, 0, w, h); c.font = '500 11px Inter, system-ui, sans-serif'; c.lineWidth = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach(function (g) {
        c.strokeStyle = M.rgba(C['text-1'], 0.06);
        c.beginPath(); c.moveTo(pl, Math.round(Y(g)) + 0.5); c.lineTo(pl + iw, Math.round(Y(g)) + 0.5); c.moveTo(Math.round(X(g)) + 0.5, pt); c.lineTo(Math.round(X(g)) + 0.5, pt + ih); c.stroke();
        c.fillStyle = C['text-3']; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(Math.round(g * 100) + '%', pl - 8, Y(g));
        c.textAlign = g === 0 ? 'left' : g === 1 ? 'right' : 'center'; c.textBaseline = 'top'; c.fillText(Math.round(g * 100) + '%', X(g), pt + ih + 8);
      });
      c.setLineDash([3, 4]); c.strokeStyle = M.rgba(C['text-2'], 0.6); c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(1), Y(1)); c.stroke(); c.setLineDash([]);
      BINS.forEach(function (bn) {
        if (!bn.n) return;
        var x = X(bn.p), y = Y(bn.f), y0 = y + (Y(bn.w[0]) - y) * prog, y1 = y + (Y(bn.w[1]) - y) * prog, rad = (3 + Math.sqrt(bn.n) * 1.8) * (0.4 + 0.6 * prog);
        c.strokeStyle = M.rgba(C.accent, 0.55); c.lineWidth = 2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.moveTo(x - 5, y0); c.lineTo(x + 5, y0); c.moveTo(x - 5, y1); c.lineTo(x + 5, y1); c.stroke();
        c.beginPath(); c.arc(x, y, rad, 0, 6.3); c.fillStyle = C.accent; c.fill(); c.lineWidth = 2; c.strokeStyle = C['surface-1']; c.stroke();
        c.globalAlpha = prog; c.fillStyle = C['text-2']; c.textAlign = x > pl + iw - 60 ? 'right' : 'left'; c.textBaseline = 'middle';
        c.fillText(bn.n + (bn.n === 1 ? ' call' : ' calls'), x + (x > pl + iw - 60 ? -rad - 8 : rad + 8), y); c.globalAlpha = 1;
      });
    }
    new ResizeObserver(draw).observe(calHost);
    document.addEventListener('ml:paint', draw);
    return { show: function () {
      if (played) { draw(); return; }
      played = true; M.tween(600, function (u) { prog = u; draw(); }, M.easeOut);
    } };
  });
})();
