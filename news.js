/* Market Lens mockup: My News. Every story is invented and agrees with the sample events on the mind map. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, HOLD = M.HOLD, esc = M.esc;
  M.shell('My News');

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], TODAY = 16;
  var EV = { e1: 'Hormuz shipping disruption', e2: 'Fed signals slower cuts', e3: 'Chip export-control review' };
  var IMP = { major: 'Major', notable: 'Notable', routine: 'Routine' }, RANK = { major: 0, notable: 1, routine: 2 };
  var DIR = { good: ['Likely good', 'up', '▲'], bad: ['Likely bad', 'dn', '▼'], unc: ['Unclear', 'unc', '↔'] };
  var CONF = { low: ['low', 1], med: ['medium', 2], high: ['high', 3] };

  /* one record per story, never one per outlet. d is the day in November 2026; aff rows are [holding, direction, confidence band, route] */
  var S = [
    { id: 'surcharge', d: 16, t: '11:40', imp: 'major', kind: 'indirect', ev: 'e1', n: 12, title: 'Carriers add war-risk surcharges as Gulf rerouting drags on',
      why: 'Longer routes and dearer insurance raise the landed cost of imported goods within weeks, while the supply premium in oil that helps producers stays in place.',
      aff: [['SHEL.L', 'good', 'med', 'via oil price, integrated oil and gas. The stock’s beta to oil has been stable for three years'], ['COST', 'bad', 'low', 'via freight and insurance, retail. Model-only link from one article, not yet scored']] },
    { id: 'nvda-date', d: 16, t: '09:15', imp: 'routine', kind: 'direct', n: 9, title: 'NVIDIA to report quarterly results on Wednesday after the close',
      why: 'A scheduled date, not news about the business. It is listed because results days move the stock and this is one of your larger holdings.',
      aff: [['NVDA', 'unc', 'low', '']] },
    { id: 'tencent-date', d: 13, t: '17:30', imp: 'routine', kind: 'direct', n: 6, title: 'Tencent to report quarterly results on Tuesday after the Hong Kong close',
      why: 'A scheduled date. Nothing in the announcement changes what is known about the business.',
      aff: [['0700.HK', 'unc', 'low', '']] },
    { id: 'endusers', d: 13, t: '14:20', imp: 'notable', kind: 'indirect', ev: 'e3', n: 4, title: 'Foundry customers asked to document end users',
      why: 'The request suggests the review could reach chips made for other companies, not only direct exports. Nothing has been decided. Two of your holdings rely on the same foundry.',
      aff: [['NVDA', 'bad', 'low', 'via TSMC, supplier, named as primary foundry in the 2025 10-K'], ['AAPL', 'unc', 'low', 'via TSMC, supplier, disclosed in the 2025 10-K']] },
    { id: 'review', d: 12, t: '15:05', imp: 'major', kind: 'indirect', ev: 'e3', n: 11, title: 'Commerce Department opens review of advanced-chip export rules',
      why: 'Tighter rules could limit what the largest contract chipmaker may build for some customers. The outcome of the review is unknown, so the direction for your holdings is a weak inference.',
      aff: [['NVDA', 'bad', 'low', 'via TSMC, supplier, named as primary foundry in the 2025 10-K'], ['AAPL', 'bad', 'low', 'via TSMC, supplier, disclosed in the 2025 10-K']] },
    { id: 'aia-filing', d: 11, t: '16:35', imp: 'routine', kind: 'direct', n: 1, src: 'Exchange announcement', title: 'AIA Group files its monthly return on share movements',
      why: 'A routine exchange filing with no change to the business. Listed for completeness.',
      aff: [['1299.HK', 'unc', 'low', '']] },
    { id: 'futures', d: 10, t: '13:30', imp: 'notable', kind: 'indirect', ev: 'e2', n: 8, title: 'Futures price out one cut for the first half',
      why: 'Markets now expect policy rates to stay higher into the middle of next year. Higher long yields have tended to weigh on highly valued technology shares, though only slightly more often than not.',
      aff: [['MSFT', 'bad', 'low', 'via 10-year yield, large-cap tech. Held in 9 of 17 past events'], ['NVDA', 'bad', 'low', 'via 10-year yield, large-cap tech. Held in 9 of 17 past events']] },
    { id: 'fed', d: 9, t: '19:10', imp: 'major', kind: 'indirect', ev: 'e2', n: 21, title: 'Fed chair signals a slower pace of rate cuts',
      why: 'The 10-year yield rose 14 basis points and the dollar 0.6% on the day. Those moves are measured. What they mean for your stocks is inferred from past rate surprises.',
      aff: [['MSFT', 'bad', 'low', 'via 10-year yield, large-cap tech. Held in 9 of 17 past events'], ['NVDA', 'bad', 'low', 'via 10-year yield, large-cap tech. Held in 9 of 17 past events'], ['1299.HK', 'unc', 'low', 'via US dollar, Hong Kong insurers. The factor beta is unstable across windows']] },
    { id: 'landed', d: 8, t: '10:20', imp: 'notable', kind: 'indirect', ev: 'e1', n: 6, title: 'Retailers warn of higher landed costs if freight stays elevated',
      why: 'Importers say container and insurance costs would reach shelf prices or margins early next year if the disruption lasts.',
      aff: [['COST', 'bad', 'low', 'via freight and insurance, retail. Model reading of two articles; held in 5 of 12 past events']] },
    { id: 'shell', d: 6, t: '08:05', imp: 'notable', kind: 'direct', ev: 'e1', n: 7, title: 'Shell says Gulf cargoes rerouted, guidance unchanged',
      why: 'A direct statement from a company you hold. Cargoes are moving by longer routes and the full-year guidance stands, so the effect on results could go either way.',
      aff: [['SHEL.L', 'unc', 'med', '']] },
    { id: 'cover', d: 5, t: '12:45', imp: 'notable', kind: 'indirect', ev: 'e1', n: 9, title: 'Insurers suspend war-risk cover for Gulf transits',
      why: 'Without cover most carriers will not sail the lane, so freight and insurance costs rise for goods routed through the Gulf.',
      aff: [['COST', 'bad', 'low', 'via freight and insurance, retail. Model reading of two articles; weak history']] },
    { id: 'brent', d: 4, t: '17:30', imp: 'major', kind: 'indirect', ev: 'e1', n: 17, title: 'Brent jumps 8% in two sessions on supply fears',
      why: 'Oil is the main channel from this event to your portfolio. Integrated producers rose over five days in 11 of 14 comparable supply shocks.',
      aff: [['SHEL.L', 'good', 'high', 'via oil price, integrated oil and gas. A measured move, and the stock’s beta to oil has been stable for three years']] },
    { id: 'hormuz', d: 3, t: '06:40', imp: 'major', kind: 'indirect', ev: 'e1', n: 14, title: 'Tanker traffic through the Strait of Hormuz halts after drone strikes',
      why: 'The strait is one of the main routes for seaborne oil. A closure lifts oil and freight costs; which of your stocks gain or lose depends on how long it lasts.',
      aff: [['SHEL.L', 'good', 'med', 'via oil price, integrated oil and gas'], ['COST', 'bad', 'low', 'via freight and insurance, retail. Model-only link, not yet scored']] }
  ];
  /* arrives a few seconds after the page loads */
  var NEXT = { id: 'convoy', d: 16, t: '16:02', imp: 'notable', kind: 'indirect', ev: 'e1', n: 5, fresh: true, title: 'Second escorted convoy clears the strait and spot tanker rates ease',
    why: 'If escorts keep the lane open, the supply premium in oil and the surcharges on freight should both shrink. That would trim the tailwind for oil producers and take some pressure off importers.',
    aff: [['SHEL.L', 'unc', 'low', 'via oil price, integrated oil and gas. A smaller premium lowers realised prices, but normal cargoes resume'], ['COST', 'good', 'low', 'via freight and insurance, retail. Model reading of two articles; weak history']] };

  /* ---------- helpers ---------- */
  var F = { hold: '', imp: { major: 1, notable: 1, routine: 1 }, kind: 'all', sort: 'date' };
  var feed = $('#feed'), pill = $('#pill'), pending = NEXT, first = true;
  function byId(id) { return S.filter(function (s) { return s.id === id; })[0]; }
  function mins(s) { return s.d * 1440 + (+s.t.slice(0, 2)) * 60 + (+s.t.slice(3)); }
  function when(s) { return (s.d === TODAY ? 'Today' : s.d + ' Nov') + ', ' + s.t; }
  function dayLabel(d) { return (d === TODAY ? 'Today · ' : '') + DAYS[new Date(2026, 10, d).getDay()] + ' ' + d + ' November'; }
  function outlets(s) { return s.n === 1 ? (s.src || '1 outlet') : s.n + ' outlets, shown once'; }
  /* share of the portfolio in the holdings a story touches: worked out here, on this computer */
  function expo(s) { var tot = M.portfolio().total; return s.aff.reduce(function (a, x) { return a + M.valueUSD(x[0]); }, 0) / tot * 100; }
  function touches(s, id) { return s.aff.some(function (a) { return a[0] === id; }); }
  function passes(s) { return (!F.hold || touches(s, F.hold)) && F.imp[s.imp] && (F.kind === 'all' || s.kind === F.kind); }
  function filtered() { return F.hold || F.kind !== 'all' || !(F.imp.major && F.imp.notable && F.imp.routine); }

  /* ---------- story markup ---------- */
  function affHTML(a) {
    var d = DIR[a[1]], c = CONF[a[2]];
    return '<li class="aff" data-aff="' + a[0] + '">' + M.tk(a[0], { name: false }) +
      '<span class="chg ' + d[1] + '">' + d[0] + ' <i aria-hidden="true">' + d[2] + '</i></span>' +
      '<span class="cband" data-c="' + c[1] + '"><i></i><i></i><i></i><span>Confidence: ' + c[0] + '</span></span>' +
      '<span class="aff-route">' + (a[3] ? esc(a[3]) : 'Direct: the company is the subject of the story') + '</span></li>';
  }
  function storyHTML(s, cls) {
    var x = Math.round(expo(s));
    return '<article class="card st' + (cls || '') + (s.nr ? ' is-muted' : '') + '" id="st-' + s.id + '" data-k="' + s.id + '" aria-labelledby="t-' + s.id + '">' +
      '<div class="st-meta"><span class="badge imp imp-' + s.imp + '">' + IMP[s.imp] + '</span><span class="badge">' + (s.kind === 'direct' ? 'Direct' : 'Indirect') + '</span>' +
        (s.fresh ? '<span class="badge badge-accent">New</span>' : '') + '<span>' + when(s) + '</span><span aria-hidden="true">·</span><span>' + outlets(s) + '</span>' +
        (s.ev ? '<span aria-hidden="true">·</span><span>Event: ' + esc(EV[s.ev]) + '</span>' : '') + '</div>' +
      '<h3 class="st-t" id="t-' + s.id + '">' + esc(s.title) + '</h3>' +
      '<p class="st-why"><b>Why it matters.</b> ' + esc(s.why) + '</p>' +
      '<div><div class="micro">Affects your stocks</div><ul class="affs">' + s.aff.map(affHTML).join('') + '</ul></div>' +
      '<div class="st-foot"><div class="st-exp"><div class="meter" aria-hidden="true"><i style="--v:' + x + '%"></i></div><span>About <b>' + x + '%</b> of your portfolio is exposed</span></div><span class="sp"></span>' +
        '<button class="btn btn-sm btn-quiet" type="button" data-nr="' + s.id + '" aria-pressed="' + (s.nr ? 'true' : 'false') + '">Not relevant</button>' +
        '<a class="btn btn-sm" href="mindmap.html" aria-label="Open mind map for: ' + esc(s.title) + '">' + M.icon('map', 'ic-sm') + 'Open mind map</a></div></article>';
  }

  /* ---------- feed ---------- */
  function render() {
    var list = S.filter(passes), fresh = list.filter(function (s) { return s.fresh; }), rest = list.filter(function (s) { return !s.fresh; }), html = '', last = null, shown = 0;
    rest.sort(function (a, b) { return (F.sort === 'imp' ? RANK[a.imp] - RANK[b.imp] : 0) || mins(b) - mins(a); });
    function head(k, t) { return '<h2 class="micro feed-g" data-k="g-' + k + '">' + t + '</h2>'; }
    if (fresh.length) html += head('new', 'Just in') + fresh.map(function (s) { return storyHTML(s); }).join('');
    rest.forEach(function (s) {
      var g = F.sort === 'imp' ? s.imp : 'd' + s.d;
      if (g !== last) { html += head(g, F.sort === 'imp' ? IMP[s.imp] : dayLabel(s.d)); last = g; }
      html += storyHTML(s, first && shown++ < 6 ? ' reveal' : '');
    });
    if (!list.length) html = '<div class="card empty"><h2 class="t3">No stories match these filters</h2><p>' + (F.hold ? 'Nothing in the last 14 days touches ' + esc(F.hold) + ' with the importance and link type you chose.' : 'Turn an importance chip back on, or clear the filters.') + '</p><button class="btn" type="button" data-clear>Clear filters</button></div>';
    feed.innerHTML = html;
    if (first) { first = false; M.observeReveal(feed); }
    $('#f-count').textContent = list.length + (list.length === 1 ? ' story' : ' stories') + (filtered() ? ' of ' + S.length : '') + ' · 3 to 16 November 2026 · ' + S.reduce(function (a, s) { return a + s.n; }, 0) + ' articles grouped';
    $('#f-reset').hidden = !filtered();
    $$('#f-imp .chip').forEach(function (c) { var k = c.dataset.v; c.textContent = IMP[k] + ' ' + S.filter(function (s) { return s.imp === k; }).length; });
  }

  /* ---------- holdings sidebar ---------- */
  function renderSide() {
    var tot = M.portfolio().total;
    $('#hold-rows').innerHTML = Object.keys(HOLD).sort(function (a, b) { return M.valueUSD(b) - M.valueUSD(a); }).map(function (id) {
      var n = S.filter(function (s) { return touches(s, id); }).length;
      return '<li class="row" data-hold="' + id + '">' + M.tk(id) + '<span class="hold-w">' + (M.valueUSD(id) / tot * 100).toFixed(1) + '%</span>' +
        (n ? '<button class="chip" type="button" data-f="' + id + '" aria-pressed="' + (F.hold === id) + '" aria-label="Show only the ' + n + (n === 1 ? ' story that touches ' : ' stories that touch ') + id + '">' + n + (n === 1 ? ' story' : ' stories') + '</button>' : '<span class="label">No stories</span>') + '</li>';
    }).join('');
  }
  var rows = $('#hold-rows'), curAff = null, pulseT;
  function pulse(sym) {
    $$('[data-hold="' + sym + '"]', rows).forEach(function (r) { r.classList.remove('pulse'); void r.offsetWidth; r.classList.add('pulse'); });
  }
  function unpulse() { $$('.pulse', rows).forEach(function (r) { r.classList.remove('pulse'); }); }
  rows.addEventListener('animationend', function (e) { if (e.animationName === 'pulse') e.target.classList.remove('pulse'); });
  rows.addEventListener('click', function (e) { var c = e.target.closest('[data-f]'); if (c) setHold(F.hold === c.dataset.f ? '' : c.dataset.f); });

  /* hovering or focusing a ticker under "Affects your stocks" pulses that holding's row */
  function affEnter(e) {
    var a = e.target.closest('.aff'); if (!a || a === curAff) return;
    curAff = a; clearTimeout(pulseT); if (M.rm()) unpulse(); pulse(a.dataset.aff);
  }
  function affLeave(e) {
    if (!curAff || (e.relatedTarget && curAff.contains(e.relatedTarget))) return;
    curAff = null; if (M.rm()) unpulse();   /* under reduced motion the outline is static and lasts only while pointed at */
  }
  feed.addEventListener('pointerover', affEnter); feed.addEventListener('focusin', affEnter);
  feed.addEventListener('pointerout', affLeave); feed.addEventListener('focusout', affLeave);
  feed.addEventListener('click', function (e) {
    if (e.target.closest('[data-clear]')) { resetFilters(); return; }
    var b = e.target.closest('[data-nr]'); if (!b) return;
    var s = byId(b.dataset.nr); s.nr = !s.nr; b.setAttribute('aria-pressed', s.nr ? 'true' : 'false'); b.closest('.st').classList.toggle('is-muted', !!s.nr);
    M.toast(s.nr ? 'Marked not relevant. The click is logged to check the ranking later; nothing is retrained (sample).' : 'Mark removed.');
  });

  /* ---------- filters ---------- */
  $('#f-hold').innerHTML = '<option value="">All holdings</option>' + Object.keys(HOLD).map(function (id) { return '<option value="' + id + '">' + id + ' · ' + esc(I[id].n) + '</option>'; }).join('');
  function setHold(id) { F.hold = id; $('#f-hold').value = id; render(); $$('[data-f]', rows).forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.f === id ? 'true' : 'false'); }); }
  $('#f-hold').addEventListener('change', function () { setHold(this.value); });
  $('#f-imp').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    var on = c.getAttribute('aria-pressed') !== 'true'; c.setAttribute('aria-pressed', on ? 'true' : 'false'); F.imp[c.dataset.v] = on ? 1 : 0; render();
  });
  var segKind = M.initSeg($('#f-kind'), function (v) { F.kind = v; render(); });
  M.initSeg($('#f-sort'), function (v) { F.sort = v; render(); });
  function resetFilters() {
    F.hold = ''; F.kind = 'all'; F.imp = { major: 1, notable: 1, routine: 1 };
    $$('#f-imp .chip').forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
    segKind.select('all', true, true); setHold('');
  }
  $('#f-reset').addEventListener('click', resetFilters);

  /* ---------- digest ---------- */
  var DIGEST = ['surcharge', 'review', 'fed', 'endusers'];
  $('#dg-date').textContent = 'Monday 16 November 2026 · built 12:00';
  $('#dg-changed').innerHTML = '<b>What changed since Friday.</b> One new major story. The Gulf disruption has turned from an oil-price story into a freight-cost story, which moves the exposure from Shell toward Costco. Nothing new on interest rates or on the chip export review.';
  $('#dg-list').innerHTML = DIGEST.map(function (id, i) {
    var s = byId(id);
    return '<li><span class="dg-n" aria-hidden="true">' + (i + 1) + '</span><a class="dg-t" href="#st-' + id + '" data-go="' + id + '">' + esc(s.title) + '</a>' +
      '<div class="dg-m"><span>' + IMP[s.imp] + ' · ' + when(s) + ' · ' + outlets(s) + '</span>' + s.aff.map(function (a) { return M.tk(a[0], { name: false }); }).join('') + '</div>' +
      '<div class="dg-x"><b>About ' + Math.round(expo(s)) + '%</b> of portfolio exposed</div></li>';
  }).join('');
  function flash(node, delay) {
    node.classList.remove('fade'); node.classList.add('is-new');
    setTimeout(function () { node.classList.add('fade'); }, delay || 80);
    setTimeout(function () { node.classList.remove('is-new', 'fade'); }, (delay || 80) + 2700);
  }
  function goStory(id, delay) {
    if (!$('#st-' + id)) resetFilters();
    var node = $('#st-' + id); if (!node) return;
    node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'start', behavior: M.rm() ? 'auto' : 'smooth' }); flash(node, delay || 500);
  }
  $('#dg-list').addEventListener('click', function (e) { var a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); goStory(a.dataset.go); } });

  /* ---------- a new story arrives ---------- */
  function land() {
    var s = pending, before = {}; if (!s) return null;
    pending = null; pill.classList.remove('on');
    $$('[data-k]', feed).forEach(function (n) { before[n.dataset.k] = n.getBoundingClientRect().top; });
    S.unshift(s); if (!passes(s)) resetFilters(); else render();
    renderSide();
    var node = $('#st-' + s.id);
    if (!M.rm()) {
      /* the new card fades down into place; the rest start where they were and slide by transform only */
      $$('[data-k]', feed).forEach(function (n) {
        var was = before[n.dataset.k]; if (was == null) return;
        n.style.transition = 'none'; n.style.transform = 'translateY(' + (was - n.getBoundingClientRect().top) + 'px)';
      });
      node.style.transition = 'none'; node.classList.add('enter'); void feed.offsetHeight;
      $$('[data-k]', feed).forEach(function (n) { n.style.transition = ''; n.style.transform = ''; });
      node.classList.remove('enter');
    }
    flash(node, 400);
    s.aff.forEach(function (a) { pulse(a[0]); });   /* once on arrival */
    if (M.rm()) pulseT = setTimeout(unpulse, 1200);
    $('#news-live').textContent = 'New story: ' + s.title + '. ' + IMP[s.imp] + '. About ' + Math.round(expo(s)) + '% of your portfolio is exposed.';
    return node;
  }
  function arrive() {
    /* slide it in only if the top of the feed is on screen and the filters would show it; otherwise offer a pill instead of moving content */
    var top = feed.getBoundingClientRect().top;
    if (top < 100 || top > window.innerHeight - 140 || !passes(pending)) {
      pill.innerHTML = '<span aria-hidden="true">' + (top < 100 ? '↑' : '↓') + '</span>1 new story'; pill.classList.add('on');
      $('#news-live').textContent = '1 new story. Use the "1 new story" button to go to it.';
    } else land();
  }
  pill.addEventListener('click', function () {
    if (!pending || !pill.classList.contains('on')) return;
    pill.classList.remove('on');
    if (!passes(pending)) resetFilters();
    feed.scrollIntoView({ block: 'start', behavior: M.rm() ? 'auto' : 'smooth' });
    setTimeout(function () { var node = land(); if (node) { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); } }, M.rm() ? 0 : 520);
  });
  setTimeout(arrive, 4500);

  /* ---------- static text and first paint ---------- */
  $('#pf-map').insertAdjacentHTML('afterbegin', M.icon('map'));
  $('#news-stamp').textContent = 'Sample feed · checked today at 16:00';
  $('#news-note').innerHTML = M.icon('warn') + '<span>Links between an event and your stocks are hypotheses, not facts. Only public news text is sent for analysis; your holdings, their sizes and what you paid never are. “About 23% of your portfolio” is worked out on this computer.</span>';
  render(); renderSide();
})();
