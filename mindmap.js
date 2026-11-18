/* Market Lens mockup: event mind map. Shared logic (graph, state, panel, toolbar, keyboard) plus the flat Canvas
   renderer with spring physics. The globe renderer is mindmap-globe.js. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, esc = M.esc, COL = M.COL;
  M.shell('Mind Maps');

  /* R is the active renderer, flat or globe. Both offer: start, kick, zoomBy, fit, refit, intro, flyTo, reveal, rotateBy, exportBlob, repaint, setParallax, pause, rebuild, destroy */
  var host = $('#map'), stage = $('#main'), R = null, FLAT_LABEL = host.getAttribute('aria-label');
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateOf(d) { var t = new Date(2026, 10, 3 + Math.floor(d)); return t.getDate() + ' ' + MON[t.getMonth()] + ' ' + t.getFullYear(); }
  var TYPE = {
    event: { r: 25, c: 'data-1', name: 'Event' }, factor: { r: 21, c: 'data-2', name: 'Factor' }, sector: { r: 23, c: 'data-3', name: 'Sector' },
    company: { r: 20, c: 'data-6', name: 'Company' }, holding: { r: 22, c: 'data-4', name: 'Your holding' }
  };
  /* node rows: id, type, label, first day, options. Events, companies and holdings carry the place they are pinned to on the globe */
  var BASE_N = [
    ['e1', 'event', 'Hormuz shipping disruption', 0, { lat: 26.57, lng: 56.25, place: 'Strait of Hormuz' }], ['f_oil', 'factor', 'Oil price ↑', 1], ['f_gold', 'factor', 'Gold ↑', 1], ['f_freight', 'factor', 'Freight and insurance ↑', 2],
    ['s_def', 'sector', 'Defense', 2, { ab: 'DF' }], ['s_energy', 'sector', 'Integrated oil and gas', 2, { ab: 'OG' }], ['f_jet', 'factor', 'Jet fuel cost ↑', 2],
    ['s_ship', 'sector', 'Shipping', 3, { ab: 'SH' }], ['s_retail', 'sector', 'Retail', 4, { ab: 'RT' }], ['c_lmt', 'company', 'Lockheed Martin', 3, { sym: 'LMT', ab: 'LM', lat: 39.03, lng: -77.14, place: 'Bethesda, Maryland' }],
    ['c_shel', 'holding', 'Shell', 3, { sym: 'SHEL.L', ab: 'SH', w: 13.4, lat: 51.50, lng: -0.12, place: 'London' }], ['s_air', 'sector', 'Airlines', 3, { ab: 'AL' }], ['c_maersk', 'company', 'Maersk', 4, { ab: 'MA', lat: 55.69, lng: 12.60, place: 'Copenhagen' }],
    ['c_cost', 'holding', 'Costco', 5, { sym: 'COST', ab: 'CO', w: 9.2, lat: 47.55, lng: -122.05, place: 'Issaquah, Washington' }], ['c_iag', 'company', 'IAG', 4, { sym: 'IAG.L', ab: 'IA', lat: 51.49, lng: -0.49, place: 'Harmondsworth, London' }],
    ['e2', 'event', 'Fed signals slower cuts', 6, { lat: 38.89, lng: -77.05, place: 'Federal Reserve, Washington DC' }], ['f_10y', 'factor', '10-year yield ↑', 6], ['f_usd', 'factor', 'US dollar ↑', 7],
    ['s_tech', 'sector', 'Large-cap tech', 7, { ab: 'LT' }], ['s_hkfin', 'sector', 'Hong Kong insurers', 8, { ab: 'HI' }],
    ['c_msft', 'holding', 'Microsoft', 8, { sym: 'MSFT', ab: 'MI', w: 12.5, lat: 47.64, lng: -122.13, place: 'Redmond, Washington' }], ['c_aia', 'holding', 'AIA Group', 9, { sym: '1299.HK', ab: 'AI', w: 6.6, lat: 22.28, lng: 114.16, place: 'Hong Kong' }],
    ['e3', 'event', 'Chip export-control review', 9, { lat: 38.89, lng: -77.03, place: 'Commerce Department, Washington DC' }], ['c_tsm', 'company', 'TSMC', 9, { sym: 'TSM', ab: 'TS', lat: 24.77, lng: 121.01, place: 'Hsinchu, Taiwan' }],
    ['c_nvda', 'holding', 'NVIDIA', 10, { sym: 'NVDA', ab: 'NV', w: 16.4, lat: 37.37, lng: -121.96, place: 'Santa Clara, California' }], ['c_aapl', 'holding', 'Apple', 10, { sym: 'AAPL', ab: 'AP', w: 15.0, lat: 37.33, lng: -122.01, place: 'Cupertino, California' }]
  ];
  var BASE_L = [
    ['e1', 'f_oil', 1, 0.86, 'fact', 'Measured: Brent rose 8% in the two sessions after the event', 5],
    ['e1', 'f_gold', 1, 0.62, 'fact', 'Measured: gold rose 2.1% over the same window', 3],
    ['e1', 'f_freight', 1, 0.71, 'inference', 'Curated matrix: conflict on a shipping lane raises freight and insurance. Held in 10 of 14 past events', 4],
    ['e1', 's_def', 1, 0.44, 'inference', 'Curated matrix. Held in 7 of 13 past events', 2],
    ['f_oil', 's_energy', 1, 0.78, 'inference', 'Curated matrix and the sector’s beta to oil. Held in 11 of 14 past events', 3],
    ['f_oil', 'f_jet', 1, 0.83, 'fact', 'Measured: the jet fuel crack spread widened', 2],
    ['f_jet', 's_air', -1, 0.69, 'inference', 'Curated matrix. Held in 9 of 13 past events', 3],
    ['f_freight', 's_ship', 1, 0.58, 'inference', 'Curated matrix. Held in 8 of 14 past events', 2],
    ['f_freight', 's_retail', -1, 0.31, 'inference', 'Model reading of two articles; weak history (5 of 12)', 2],
    ['s_def', 'c_lmt', 1, 0.40, 'inference', 'Sector membership and beta', 1],
    ['s_energy', 'c_shel', 1, 0.74, 'inference', 'Stock beta to oil over three years, stable', 2],
    ['s_ship', 'c_maersk', 1, 0.60, 'inference', 'Sector membership and beta', 1],
    ['s_air', 'c_iag', -1, 0.57, 'inference', 'Sector membership; fuel is 27% of costs per the annual report', 2],
    ['s_retail', 'c_cost', -1, 0.16, 'inference', 'Model-only link from one article. Not yet scored', 1],
    ['e2', 'f_10y', 1, 0.80, 'fact', 'Measured: 10-year yield up 14 bp on the day', 4],
    ['e2', 'f_usd', 1, 0.55, 'fact', 'Measured: dollar index up 0.6%', 3],
    ['f_10y', 's_tech', -1, 0.52, 'inference', 'Curated matrix. Held in 9 of 17 past events', 3],
    ['f_usd', 's_hkfin', -1, 0.22, 'inference', 'Factor beta, unstable across windows', 1],
    ['s_tech', 'c_msft', -1, 0.45, 'inference', 'Sector membership and beta', 1],
    ['s_tech', 'c_nvda', -1, 0.47, 'inference', 'Sector membership and beta', 1],
    ['s_hkfin', 'c_aia', -1, 0.30, 'inference', 'Sector membership and beta', 1],
    ['e3', 'c_tsm', -1, 0.26, 'inference', 'Model reading of three articles; the outcome of the review is unknown', 3],
    ['c_tsm', 'c_nvda', -1, 0.66, 'fact', 'Filing: TSMC named as primary foundry supplier in the 2025 10-K', 1],
    ['c_tsm', 'c_aapl', -1, 0.61, 'fact', 'Filing: TSMC named as a sole-source supplier in the 2025 10-K', 1]
  ];
  var HUBS = [['New York', 40.71, -74.01], ['Chicago', 41.88, -87.63], ['Houston', 29.76, -95.37], ['Toronto', 43.65, -79.38], ['São Paulo', -23.55, -46.63], ['Mexico City', 19.43, -99.13],
    ['London', 51.51, -0.13], ['Paris', 48.86, 2.35], ['Frankfurt', 50.11, 8.68], ['Amsterdam', 52.37, 4.90], ['Zurich', 47.38, 8.54], ['Stockholm', 59.33, 18.07],
    ['Dubai', 25.20, 55.27], ['Riyadh', 24.71, 46.68], ['Mumbai', 19.08, 72.88], ['Singapore', 1.35, 103.82], ['Hong Kong', 22.32, 114.17], ['Shanghai', 31.23, 121.47],
    ['Shenzhen', 22.54, 114.06], ['Seoul', 37.57, 126.98], ['Tokyo', 35.68, 139.69], ['Taipei', 25.03, 121.57], ['Sydney', -33.87, 151.21], ['Johannesburg', -26.20, 28.05]];
  function band(c) { return c >= 0.7 ? 'Strong' : c >= 0.4 ? 'Moderate' : c >= 0.2 ? 'Weak' : 'Speculative'; }
  function tier(l) { return l.basis === 'fact' ? 'fact' : l.conf < 0.2 ? 'spec' : 'inference'; }

  /* ---------- graph ---------- */
  var nodes = [], links = [], byId = {}, dense = false, stress = false;
  /* the stress graph for the globe: 1,000 invented nodes and 3,000 invented links, the same on every load. Links only run
     from an earlier node to a later one, so there are no loops */
  function buildStress() {
    var rnd = M.rng(99), ids = { event: [], factor: [], sector: [], company: [] }, seen = {};
    [['event', 40, 'Event '], ['factor', 120, 'Factor '], ['sector', 140, 'Sector '], ['company', 700, 'Company ']].forEach(function (t) {
      for (var i = 0; i < t[1]; i++) {
        var id = t[0].charAt(0) + 'x' + i, o = {}, type = t[0];
        if (type === 'event' || type === 'company') { var hub = HUBS[Math.floor(rnd() * HUBS.length)]; o.lat = Math.max(-75, Math.min(75, hub[1] + (rnd() * 2 - 1) * 8)); o.lng = hub[2] + (rnd() * 2 - 1) * 8; o.place = 'Near ' + hub[0]; }
        if (type === 'company' && i % 35 === 0) { type = 'holding'; o.w = +(1 + rnd() * 4).toFixed(1); }
        add(id, type, t[2] + (i + 1) + (type === 'factor' ? ' ↑' : ''), Math.floor(rnd() * 12), o); ids[t[0]].push(id);
      }
    });
    [['event', 'factor', 300], ['factor', 'factor', 200], ['factor', 'sector', 600], ['sector', 'company', 1500], ['company', 'company', 400]].forEach(function (k) {
      for (var made = 0; made < k[2];) {
        var a = Math.floor(rnd() * ids[k[0]].length), b = Math.floor(rnd() * ids[k[1]].length), t;
        if (k[0] === k[1]) { if (a === b) continue; if (a > b) { t = a; a = b; b = t; } }
        var key = k[0] + a + '>' + k[1] + b; if (seen[key]) continue; seen[key] = 1;
        link(ids[k[0]][a], ids[k[1]][b], rnd() < 0.5 ? 1 : -1, 0.08 + rnd() * 0.85, rnd() < 0.25 ? 'fact' : 'inference', 'Invented link for the 1,000-node test', 1); made++;
      }
    });
  }
  function build() {
    nodes = []; links = []; byId = {};
    if (stress) { buildStress(); layout(); return; }
    BASE_N.forEach(function (r) { add(r[0], r[1], r[2], r[3], r[4]); });
    BASE_L.forEach(function (r) { link(r[0], r[1], r[2], r[3], r[4], r[5], r[6]); });
    if (dense) {
      /* a second stream places the invented companies near financial centres, so the graph itself is the same as before */
      var rnd = M.rng(77), geo = M.rng(78), hosts = nodes.filter(function (n) { return n.type === 'sector' || n.type === 'company' || n.type === 'holding'; }).map(function (n) { return n.id; });
      for (var i = 0; i < 36; i++) {
        var p = byId[hosts[Math.floor(rnd() * hosts.length)]], id = 'x' + i, ab = String.fromCharCode(65 + i % 26) + (1 + Math.floor(i / 26));
        var hub = HUBS[Math.floor(geo() * HUBS.length)];
        add(id, 'company', 'Related company ' + ab, Math.min(11, p.day + 1 + Math.floor(rnd() * 3)), { ab: ab, lat: hub[1] + (geo() * 2 - 1) * 1.5, lng: hub[2] + (geo() * 2 - 1) * 1.5, place: hub[0] });
        link(p.id, id, rnd() < 0.5 ? 1 : -1, 0.1 + rnd() * 0.4, 'inference', 'Invented second-order link for the 60-node test', 1);
        if (rnd() < 0.3) hosts.push(id);
      }
    }
    layout();
  }
  function add(id, type, label, day, o) {
    o = o || {};
    var n = { id: id, type: type, label: label, day: day, sym: o.sym, ab: o.ab, w: o.w, lat: o.lat, lng: o.lng, place: o.place, r: TYPE[type].r, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, ins: [], outs: [], born: -1e9, tlA: 1, hA: 1, dim: 1, collapsed: false, hideTo: null, hidden: 0 };
    nodes.push(n); byId[id] = n;
  }
  function link(s, t, sign, conf, basis, why, src) {
    var l = { s: byId[s], t: byId[t], sign: sign, conf: conf, basis: basis, why: why, src: src, t0: -1e9, dur: 420, phase: Math.random(), dim: 1, len: 200 };
    links.push(l); l.s.outs.push(l); l.t.ins.push(l);
  }
  function layout() {
    var i, changed = true;
    nodes.forEach(function (n) { n.depth = 0; });
    while (changed) { changed = false; links.forEach(function (l) { if (l.t.depth < l.s.depth + 1) { l.t.depth = l.s.depth + 1; changed = true; } }); }
    var cols = []; nodes.forEach(function (n) { (cols[n.depth] = cols[n.depth] || []).push(n); });
    cols.forEach(function (c) { c.forEach(function (n, j) { n.ord = j; }); });
    function bary(n, arr) { return arr.length ? arr.reduce(function (s, l) { return s + (l.s === n ? l.t.yy : l.s.yy); }, 0) / arr.length : n.yy; }
    var gap = dense ? 66 : 86;
    cols.forEach(function (c) { c.forEach(function (n, j) { n.yy = (j - (c.length - 1) / 2) * gap; }); });
    for (i = 0; i < 6; i++) {
      (i % 2 ? cols.slice().reverse() : cols).forEach(function (c, ci) {
        if (!(i % 2) && ci === 0) return;
        c.forEach(function (n) { n.b = bary(n, i % 2 ? n.outs : n.ins); });
        c.sort(function (a, b) { return a.b - b.b; });
        /* place near the neighbours' average while keeping a minimum gap */
        c.forEach(function (n, j) { n.yy = j === 0 ? n.b : Math.max(n.b, c[j - 1].yy + gap); });
        var shift = (c[0].yy + c[c.length - 1].yy) / 2 - c.reduce(function (s, n) { return s + n.b; }, 0) / c.length;
        c.forEach(function (n) { n.yy -= shift; });
      });
    }
    var colx = dense ? 230 : 262, mid = (cols.length - 1) / 2, ys = nodes.map(function (n) { return n.yy; }), cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    nodes.forEach(function (n) { n.ax = (n.depth - mid) * colx + (n.ord % 2 ? 16 : -16); n.ay = n.yy - cy; n.x = n.ax; n.y = n.ay; n.vx = n.vy = 0; });
  }

  /* ---------- state shared by both renderers ---------- */
  var hover = null, hoverLink = null, sel = null, focusId = null, hasFocus = false;
  var tl = 11, playing = null, particlesOn = true, parallax = false, rotateOn = true, focusHolding = '';
  var clock0 = performance.now(), growStart = 0, tip = $('#mm-tip');
  function now() { return performance.now() - clock0; }
  function kick() { if (R) R.kick(); }

  /* ---------- growth schedule: the first event, then links draw outward and nodes pop as each link arrives ---------- */
  function schedule(animated) {
    var t = now();
    if (!animated || M.rm() || M.compact()) { nodes.forEach(function (n) { n.born = -1e9; }); links.forEach(function (l) { l.t0 = -1e9; }); growStart = -1e9; R.intro(false); return; }
    var roots = nodes.filter(function (n) { return !n.ins.length; }).sort(function (a, b) { return a.day - b.day; }), order = nodes.slice().sort(function (a, b) { return a.depth - b.depth; });
    nodes.forEach(function (n) { n.b0 = Infinity; });
    roots.forEach(function (r, i) { r.b0 = i * 620; });
    order.forEach(function (n) { n.outs.forEach(function (l) { l.rel = n.b0 + 150; l.t.b0 = Math.min(l.t.b0, l.rel + 400); }); });
    var total = Math.max.apply(null, nodes.map(function (n) { return n.b0; })) + 500, sc = Math.min(1, 2400 / total), lead = 650;
    growStart = t;
    nodes.forEach(function (n) { n.born = t + lead + n.b0 * sc; });
    links.forEach(function (l) { l.t0 = t + lead + l.rel * sc; l.dur = 420 * sc; });
    /* the camera starts close on the first event and eases out as the map grows */
    R.intro(true, roots[0], lead + total * sc);
    kick();
  }
  function pop(ms) { if (ms <= 0) return 0; var x = ms / 1000; return 1 - Math.exp(-10 * x) * Math.cos(9 * x); }

  /* ---------- visibility: timeline, folded nodes, hover chain, holding filter ---------- */
  function refold() {
    var seen = {}, q = nodes.filter(function (n) { return !n.ins.length; });
    q.forEach(function (n) { seen[n.id] = 1; });
    while (q.length) { var n = q.shift(); if (n.collapsed) continue; n.outs.forEach(function (l) { if (!seen[l.t.id]) { seen[l.t.id] = 1; q.push(l.t); } }); }
    nodes.forEach(function (n) { n.hidden = 0; });
    nodes.forEach(function (n) {
      if (seen[n.id]) { n.hideTo = null; return; }
      var p = n, guard = 0; while (p && !(p.collapsed && seen[p.id]) && guard++ < 50) p = p.ins.length ? p.ins[0].s : null;
      n.hideTo = p || nodes[0]; n.hideTo.hidden++;
    });
    kick();
  }
  function chain(n) {
    var set = {}; set[n.id] = 1;
    (function up(x) { x.ins.forEach(function (l) { if (!set[l.s.id]) { set[l.s.id] = 1; up(l.s); } }); })(n);
    (function down(x) { x.outs.forEach(function (l) { if (!set[l.t.id]) { set[l.t.id] = 1; down(l.t); } }); })(n);
    return set;
  }
  function upstream(n) { var set = {}; set[n.id] = 1; (function up(x) { x.ins.forEach(function (l) { if (!set[l.s.id]) { set[l.s.id] = 1; up(l.s); } }); })(n); return set; }
  function targets() {
    var hset = hover ? chain(hover) : (hoverLink ? (function () { var s = {}; s[hoverLink.s.id] = 1; s[hoverLink.t.id] = 1; return s; })() : null);
    /* a holding filter keeps only the chains that reach that holding: the globe hides the rest, the flat map dims it */
    var fset = focusHolding ? upstream(byId[focusHolding]) : null, off = R && R.name === 'globe' ? 0 : 0.14;
    nodes.forEach(function (n) { n.dimT = (hset && !hset[n.id] ? 0.15 : 1) * (fset && !fset[n.id] ? off : 1); n.lit = !!(hset && hset[n.id]); });
    links.forEach(function (l) { var on = (!hset || (hset[l.s.id] && hset[l.t.id])) && (!hoverLink || hoverLink === l); l.dimT = (on ? 1 : 0.12) * (fset && !(fset[l.s.id] && fset[l.t.id]) ? off : 1); l.lit = !!((hset || hoverLink) && on); });
  }

  /* ---------- per-node and per-link animation state, advanced once a frame by the active renderer ---------- */
  function animate(t, dt) {
    var i, n, l, rate = M.rm() ? 1 : 1 - Math.exp(-dt * 13), rate2 = M.rm() ? 1 : 1 - Math.exp(-dt * 9);
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.tlA += ((n.day <= tl + 0.001 ? 1 : 0) - n.tlA) * rate2; n.hA += ((n.hideTo ? 0 : 1) - n.hA) * rate2; n.dim += (n.dimT - n.dim) * rate;
      n.sc = pop(t - n.born); n.al = Math.min(1, Math.max(0, (t - n.born) / 160)) * n.tlA * n.hA;
    }
    for (i = 0; i < links.length; i++) {
      l = links[i]; l.dim += (l.dimT - l.dim) * rate;
      var gp = Math.max(0, Math.min(1, (t - l.t0) / l.dur)); l.gp = 1 - Math.pow(1 - gp, 3);
      l.al = Math.min(1, Math.max(0, (t - l.s.born) / 160)) * l.s.tlA * l.t.tlA * l.s.hA * l.t.hA;
    }
  }
  function report(fps) {
    /* on the globe the counts are what is on show: the timeline, folded nodes and the holding filter all reduce them */
    var globe = R && R.name === 'globe', shown = nodes.filter(function (n) { return n.al > 0.5 && (!globe || n.dimT > 0.05); }).length;
    var lk = globe ? links.filter(function (l) { return l.al > 0.5 && l.dimT > 0.05; }).length : links.length;
    $('#mm-fps').textContent = (fps === -1 ? 'paused' : fps === -2 ? 'idle' : Math.min(120, Math.round(fps)) + ' fps') + ' · ' + shown + ' nodes · ' + lk + ' links';
  }

  /* ---------- tooltips ---------- */
  var tipNode = null;   /* the node a tooltip is pinned to: hovered, focused from the keyboard, or tapped once on the globe */
  function tierName(l) { var t = tier(l); return t === 'fact' ? 'confirmed fact' : t === 'spec' ? 'speculative' : 'model inference'; }
  function linkTip(l) {
    return '<b>' + esc(l.s.label) + ' → ' + esc(l.t.label) + '</b><br><span class="' + (l.sign > 0 ? 'up' : 'dn') + '">' + (l.sign > 0 ? 'Raises' : 'Lowers') + '</span> · ' + band(l.conf) + ' confidence · ' + tierName(l) + '<br><span class="dim">' + esc(l.why) + '</span>';
  }
  /* the most confident link that is on show at this node, in either direction */
  function strongest(n) { var best = null; n.ins.concat(n.outs).forEach(function (l) { if (l.al > 0.5 && l.dimT > 0.05 && (!best || l.conf > best.conf)) best = l; }); return best; }
  function nodeTip(n) {
    var l = strongest(n), h = '<b>' + esc(n.label) + '</b><br>' + TYPE[n.type].name + (n.place ? ' · ' + esc(n.place) : '') + (n.w ? ' · ' + n.w.toFixed(1) + '% of portfolio' : '');
    if (!l) return h + '<br><span class="dim">No links shown</span>';
    var out = l.s === n;
    return h + '<br><span class="dim">Strongest link:</span> ' + (out ? '→ ' : '← ') + esc((out ? l.t : l.s).label) + '<br><span class="' + (l.sign > 0 ? 'up' : 'dn') + '">' + (l.sign > 0 ? 'Raises' : 'Lowers') + '</span> · ' + band(l.conf) + ' (' + l.conf.toFixed(2) + ') · ' + tierName(l);
  }
  function placeTip(x, y) { tip.style.left = Math.max(8, Math.min(stage.clientWidth - 280, x + 14)) + 'px'; tip.style.top = Math.max(8, Math.min(stage.clientHeight - 110, y + 14)) + 'px'; }
  function showTip(html, x, y) { tip.innerHTML = html; placeTip(x, y); tip.classList.add('on'); }
  function hideTip() { tip.classList.remove('on'); tipNode = null; }
  /* pin a node's tooltip to it; the globe renderer keeps it in place as the view turns */
  function pin(n) { tipNode = n; tip.innerHTML = nodeTip(n); }

  /* ====================================================================
     Flat renderer: the 2D Canvas map with spring physics
     ==================================================================== */
  function flatRenderer() {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d'), W = 0, H = 0, DPR = 1;
    host.appendChild(cv);
    var cam = { x: 0, y: 0, k: 1 }, camT = { x: 0, y: 0, k: 1 }, camRate = 7;
    var drag = null, panning = false, moved = false, last = { x: 0, y: 0 }, grab = { x: 0, y: 0 };
    var par = { x: 0, y: 0, tx: 0, ty: 0 }, asleep = true, sprites = {}, fpsAvg = 60, lastT = 0, raf = 0;
    function resize() {
      W = stage.clientWidth; H = stage.clientHeight; DPR = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    }
    function fit(instant) {
      var vis = nodes.filter(function (n) { return !n.hideTo; }), xs = vis.map(function (n) { return n.ax; }), ys = vis.map(function (n) { return n.ay; });
      var x0 = Math.min.apply(null, xs) - 90, x1 = Math.max.apply(null, xs) + 110, y0 = Math.min.apply(null, ys) - 50, y1 = Math.max.apply(null, ys) + 70;
      var k = Math.max(0.3, Math.min((W - 40) / (x1 - x0), (H - 150) / (y1 - y0), 1.2));
      camT = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 12 / k, k: k };
      if (instant || M.rm()) cam = { x: camT.x, y: camT.y, k: camT.k };
      kick();
    }
    function toWorld(mx, my) { return { x: (mx - W / 2) / cam.k + cam.x, y: (my - H / 2) / cam.k + cam.y }; }

    /* ---------- physics: springs to the layout, links pull neighbours along ---------- */
    function physics(dt) {
      var KA = 26, KL = 42, C = 7.5, i, n, moving = false;
      for (i = 0; i < nodes.length; i++) { n = nodes[i]; n.fx = (n.ax - n.x) * KA; n.fy = (n.ay - n.y) * KA; }
      for (i = 0; i < links.length; i++) {
        var l = links[i], dx = (l.t.x - l.s.x) - (l.t.ax - l.s.ax), dy = (l.t.y - l.s.y) - (l.t.ay - l.s.ay);
        l.s.fx += dx * KL; l.s.fy += dy * KL; l.t.fx -= dx * KL; l.t.fy -= dy * KL;
      }
      var damp = Math.exp(-C * dt);
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i]; if (n === drag) continue;
        n.vx = (n.vx + n.fx * dt) * damp; n.vy = (n.vy + n.fy * dt) * damp; n.x += n.vx * dt; n.y += n.vy * dt;
        if (Math.abs(n.vx) + Math.abs(n.vy) > 0.6 || Math.abs(n.x - n.ax) + Math.abs(n.y - n.ay) > 0.4) moving = true;
      }
      if (!moving && !drag) { nodes.forEach(function (x) { x.x = x.ax; x.y = x.ay; x.vx = x.vy = 0; }); asleep = true; }
    }

    /* ---------- drawing ---------- */
    function sprite(key) {
      var id = key + (COL.dark ? 'd' : 'l'); if (sprites[id]) return sprites[id];
      var c = document.createElement('canvas'); c.width = c.height = 96; var g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      gr.addColorStop(0, M.rgba(COL[key], COL.dark ? 0.55 : 0.32)); gr.addColorStop(0.4, M.rgba(COL[key], COL.dark ? 0.16 : 0.1)); gr.addColorStop(1, M.rgba(COL[key], 0));
      g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return (sprites[id] = c);
    }
    function pos(n) {
      if (!n.hideTo || n.hA >= 1) return n;
      var e = 1 - Math.pow(1 - n.hA, 3), p = n.hideTo; return { x: p.x + (n.x - p.x) * e, y: p.y + (n.y - p.y) * e };
    }
    function geom(l) {
      var a = pos(l.s), b = pos(l.t), x0 = a.x + l.s.r + 2, y0 = a.y, x3 = b.x - l.t.r - 9, y3 = b.y, c = Math.max(46, Math.abs(x3 - x0) * 0.5);
      l.g = [x0, y0, x0 + c, y0, x3 - c, y3, x3, y3];
      l.len = Math.max(60, Math.hypot(x3 - x0, y3 - y0) * 1.12);
    }
    function bz(g, u) {
      var v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
      return [a * g[0] + b * g[2] + c * g[4] + d * g[6], a * g[1] + b * g[3] + c * g[5] + d * g[7]];
    }
    function shape(type, x, y, r) {
      ctx.beginPath();
      if (type === 'event') { if (ctx.roundRect) ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.36); else ctx.rect(x - r, y - r, r * 2, r * 2); }
      else if (type === 'factor') { var d = r * 1.18; ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y); ctx.closePath(); }
      else if (type === 'sector') { for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i, px = x + Math.cos(a) * r * 1.1, py = y + Math.sin(a) * r * 1.1; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); }
      else ctx.arc(x, y, r, 0, 6.2832);
    }
    function draw(t, dt) {
      var k = cam.k, i, n, l;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = COL.canvas; ctx.fillRect(0, 0, W, H);
      par.x += (par.tx - par.x) * (1 - Math.exp(-dt * 6)); par.y += (par.ty - par.y) * (1 - Math.exp(-dt * 6));
      function layer(depth) { ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * (W / 2 - cam.x * k + par.x * depth), DPR * (H / 2 - cam.y * k + par.y * depth)); }

      /* background dot grid, fades out when zoomed out */
      var ga = Math.max(0, Math.min(1, (k - 0.45) / 0.4)) * (COL.dark ? 0.1 : 0.14);
      if (ga > 0.01) {
        layer(1); ctx.fillStyle = M.rgba(COL['text-1'], ga);
        var s = 30, x0 = Math.floor((cam.x - W / 2 / k) / s) * s, y0 = Math.floor((cam.y - H / 2 / k) / s) * s, x1 = cam.x + W / 2 / k + s, y1 = cam.y + H / 2 / k + s, d = 1.3 / k;
        for (var gx = x0; gx < x1; gx += s) for (var gy = y0; gy < y1; gy += s) ctx.fillRect(gx, gy, d, d);
      }
      /* loading: faint dots drift into place while the map builds */
      var since = t - growStart;
      if (since < 1300) {
        layer(0.6); var la = 0.4 * Math.min(1, since / 200) * (1 - Math.max(0, Math.min(1, (since - 700) / 500)));
        ctx.fillStyle = M.rgba(COL['text-2'], la);
        for (i = 0; i < nodes.length && i < 28; i++) {
          n = nodes[i]; var e = Math.min(1, since / 900), ee = 1 - Math.pow(1 - e, 3), sx = n.ax * 0.25 + Math.sin(i * 12.9) * 160, sy = n.ay * 0.25 + Math.cos(i * 7.3) * 120;
          ctx.beginPath(); ctx.arc(sx + (n.ax - sx) * ee + Math.sin(t / 300 + i) * 3, sy + (n.ay - sy) * ee + Math.cos(t / 340 + i) * 3, 2.2, 0, 6.2832); ctx.fill();
        }
      }

      /* links */
      layer(0.35);
      ctx.lineCap = 'round';
      for (i = 0; i < links.length; i++) {
        l = links[i]; var gp = l.gp;
        if (gp <= 0 || l.al < 0.01) continue;
        geom(l);
        var g = l.g, spec = l.conf < 0.2, a = (spec ? 0.3 : 0.26 + 0.5 * l.conf) * l.al * l.dim, lw = 1 + 3 * l.conf;
        ctx.strokeStyle = l.lit ? M.rgba(COL.accent, Math.min(1, a + 0.35)) : M.rgba(COL['text-2'], a); ctx.lineWidth = lw;
        ctx.setLineDash(l.basis === 'fact' ? [] : spec ? [2, 7] : [7, 6]);
        ctx.beginPath(); ctx.moveTo(g[0], g[1]);
        if (gp >= 1) ctx.bezierCurveTo(g[2], g[3], g[4], g[5], g[6], g[7]);
        else { for (var st = 1; st <= 22; st++) { var u = st / 22 * gp, p = bz(g, u); ctx.lineTo(p[0], p[1]); } }
        ctx.stroke(); ctx.setLineDash([]);
        if (gp >= 1) {
          /* arrowhead, then a small sign badge at the midpoint */
          var ah = 5 + lw; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(g[6] + ah, g[7]); ctx.lineTo(g[6] - 1, g[7] - ah * 0.55); ctx.lineTo(g[6] - 1, g[7] + ah * 0.55); ctx.closePath(); ctx.fill();
          if (k > 0.55) {
            var m = bz(g, 0.5); ctx.globalAlpha = l.al * l.dim; ctx.beginPath(); ctx.arc(m[0], m[1], 7.5, 0, 6.2832); ctx.fillStyle = COL['surface-1']; ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = M.rgba(COL['text-1'], 0.16); ctx.stroke();
            ctx.fillStyle = l.sign > 0 ? COL.gain : COL.loss; ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.sign > 0 ? '+' : '−', m[0], m[1] + 0.5); ctx.globalAlpha = 1;
          }
        }
      }
      /* particles travel in the direction of cause and effect: fast on strong links, slow and flickering on weak ones */
      if (particlesOn && !M.rm() && !M.compact()) {
        var sp = sprite('accent'); ctx.globalCompositeOperation = COL.dark ? 'lighter' : 'source-over';
        for (i = 0; i < links.length; i++) {
          l = links[i]; if (l.gp < 1 || l.al * l.dim < 0.3) continue;
          var cnt = l.conf >= 0.6 ? 3 : l.conf >= 0.3 ? 2 : 1, speed = 40 + 100 * l.conf;
          for (var j = 0; j < cnt; j++) {
            var uu = ((t / 1000 * speed / l.len) + j / cnt + l.phase) % 1, pp = bz(l.g, uu), fl = l.conf < 0.3 ? 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t / 1000 * 12.566 + l.phase * 20 + j)) : 1;
            ctx.globalAlpha = Math.sin(Math.PI * uu) * fl * l.al * l.dim * 0.95; var sz = 7 + 7 * l.conf;
            ctx.drawImage(sp, pp[0] - sz, pp[1] - sz, sz * 2, sz * 2);
          }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      /* nodes */
      layer(0.35);
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i]; if (n.al < 0.01 || n.sc <= 0) continue;
        var P = pos(n), ty = TYPE[n.type], c = COL[ty.c], al = n.al * n.dim, r = n.r * n.sc * (0.6 + 0.4 * n.hA) * (n === hover ? 1.07 : 1);
        ctx.globalAlpha = al * (n.lit || n === sel ? 1 : 0.6); ctx.drawImage(sprite(ty.c), P.x - r * 2.6, P.y - r * 2.6, r * 5.2, r * 5.2);
        ctx.globalAlpha = al;
        shape(n.type, P.x, P.y, r); ctx.fillStyle = COL['surface-1']; ctx.fill(); ctx.fillStyle = M.rgba(c, COL.dark ? 0.2 : 0.12); ctx.fill();
        ctx.lineWidth = n === sel ? 2.5 : 1.5; ctx.strokeStyle = c; ctx.stroke();
        if (n.type === 'holding') { ctx.beginPath(); ctx.arc(P.x, P.y, r + 5, 0, 6.2832); ctx.lineWidth = 1; ctx.strokeStyle = M.rgba(c, 0.6); ctx.stroke(); }
        if (hasFocus && n.id === focusId) { ctx.beginPath(); ctx.arc(P.x, P.y, r + 10, 0, 6.2832); ctx.lineWidth = 2; ctx.strokeStyle = COL.accent; ctx.stroke(); }
        ctx.fillStyle = COL['text-1']; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (n.type === 'event') { ctx.beginPath(); ctx.arc(P.x, P.y, r * 0.2, 0, 6.2832); ctx.fillStyle = c; ctx.fill(); }
        else if (n.type === 'factor') { ctx.font = '600 ' + Math.round(r * 0.8) + 'px Inter, system-ui, sans-serif'; ctx.fillText('↑', P.x, P.y + 1); }
        else { ctx.font = '600 ' + Math.round(r * 0.52) + 'px Inter, system-ui, sans-serif'; ctx.fillText(n.ab || '', P.x, P.y + 0.5); }
        if (n.collapsed && n.hidden) {
          var bx = P.x + r * 0.8, by = P.y - r * 0.8; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 6.2832); ctx.fillStyle = COL.accent; ctx.fill();
          ctx.fillStyle = COL.dark ? '#0a0b0d' : '#ffffff'; ctx.font = '600 10px Inter, system-ui, sans-serif'; ctx.fillText('+' + n.hidden, bx, by + 0.5);
        }
        /* level of detail: when zoomed out, plain company labels show only on hover or selection */
        if (k > 0.42 && n.sc > 0.5 && (k > 0.62 || n.type !== 'company' || n.lit || n === sel || n === hover)) {
          ctx.globalAlpha = al * Math.min(1, (n.sc - 0.5) * 2.5); ctx.textBaseline = 'top';
          /* labels keep a readable size on screen when zoomed out, with a halo so links do not cut through them */
          var fs = Math.max(12, Math.min(17, 12 / k)); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = COL.canvas;
          ctx.font = '500 ' + fs + 'px Inter, system-ui, sans-serif'; ctx.strokeText(n.label, P.x, P.y + n.r + 9); ctx.fillStyle = COL['text-1']; ctx.fillText(n.label, P.x, P.y + n.r + 9);
          if (n.w) { ctx.font = '500 ' + (fs - 1) + 'px Inter, system-ui, sans-serif'; ctx.strokeText(n.w.toFixed(1) + '% of portfolio', P.x, P.y + n.r + 10 + fs * 1.3); ctx.fillStyle = COL['text-3']; ctx.fillText(n.w.toFixed(1) + '% of portfolio', P.x, P.y + n.r + 10 + fs * 1.3); }
        }
        ctx.globalAlpha = 1;
      }
    }

    /* ---------- frame loop: runs while anything moves, sleeps otherwise ---------- */
    function busy(t) {
      if (drag || !asleep || playing) return true;
      if (particlesOn && !M.rm() && !M.compact()) return true;
      if (t - growStart < 4200) return true;
      if (Math.abs(cam.x - camT.x) + Math.abs(cam.y - camT.y) > 0.2 || Math.abs(cam.k - camT.k) > 0.001) return true;
      if (Math.abs(par.x - par.tx) + Math.abs(par.y - par.ty) > 0.2) return true;
      for (var i = 0; i < nodes.length; i++) { var n = nodes[i]; if (Math.abs(n.dim - n.dimT) > 0.01 || Math.abs(n.tlA - (n.day <= tl + 0.001 ? 1 : 0)) > 0.01 || Math.abs(n.hA - (n.hideTo ? 0 : 1)) > 0.01) return true; }
      for (i = 0; i < links.length; i++) if (Math.abs(links[i].dim - links[i].dimT) > 0.01) return true;
      return false;
    }
    var lastFps = 0;
    function frame(ts) {
      raf = 0; if (document.hidden) return;
      var t = now(), dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts;
      if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.08;
      if (!asleep && !M.rm()) { physics(dt / 2); physics(dt / 2); }
      var cr = M.rm() ? 1 : 1 - Math.exp(-dt * camRate);
      cam.x += (camT.x - cam.x) * cr; cam.y += (camT.y - cam.y) * cr; cam.k += (camT.k - cam.k) * cr;
      targets(); animate(t, dt); draw(t, dt);
      if (ts - lastFps > 500) { lastFps = ts; report(fpsAvg); }
      if (busy(t)) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }

    /* ---------- hit testing ---------- */
    function nodeAt(mx, my) {
      var w = toWorld(mx, my), best = null, bd = 1e9;
      nodes.forEach(function (n) { if (n.al < 0.5 || n.hideTo) return; var d = Math.hypot(n.x - w.x, n.y - w.y); if (d < n.r + 8 && d < bd) { bd = d; best = n; } });
      return best;
    }
    function linkAt(mx, my) {
      var w = toWorld(mx, my), best = null, bd = 9 / cam.k + 3;
      links.forEach(function (l) { if (!l.g || l.gp < 1 || l.al < 0.5) return; for (var u = 0; u <= 1; u += 0.05) { var p = bz(l.g, u), d = Math.hypot(p[0] - w.x, p[1] - w.y); if (d < bd) { bd = d; best = l; } } });
      return best;
    }

    /* ---------- pointer ---------- */
    function xy(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) {
      var p = xy(e), n = nodeAt(p.x, p.y); cv.setPointerCapture(e.pointerId); moved = false; last = p; tip.classList.remove('on');
      if (n) { drag = n; var w = toWorld(p.x, p.y); grab = { x: n.x - w.x, y: n.y - w.y }; asleep = false; } else panning = true;
      cv.classList.add('grabbing'); kick();
    });
    cv.addEventListener('pointermove', function (e) {
      var p = xy(e);
      if (parallax && !M.rm()) { par.tx = (p.x / W - 0.5) * -12; par.ty = (p.y / H - 0.5) * -12; }
      if (drag) {
        if (Math.hypot(p.x - last.x, p.y - last.y) > 3) moved = true;
        if (moved) { var w = toWorld(p.x, p.y); drag.x = w.x + grab.x; drag.y = w.y + grab.y; drag.vx = drag.vy = 0; asleep = false; }
      } else if (panning) {
        var dx = p.x - last.x, dy = p.y - last.y; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        cam.x -= dx / cam.k; cam.y -= dy / cam.k; camT.x = cam.x; camT.y = cam.y; camT.k = cam.k; last = p;
      } else {
        var n = nodeAt(p.x, p.y), l = n ? null : linkAt(p.x, p.y);
        if (n !== hover || l !== hoverLink) { hover = n; hoverLink = l; }
        cv.classList.toggle('pointing', !!(n || l));
        if (l) {
          tip.innerHTML = linkTip(l);
          tip.style.left = Math.min(W - 280, p.x + 14) + 'px'; tip.style.top = Math.min(H - 110, p.y + 14) + 'px'; tip.classList.add('on');
        } else tip.classList.remove('on');
      }
      kick();
    });
    function up(e) {
      var wasDrag = drag, wasPan = panning; drag = null; panning = false; cv.classList.remove('grabbing');
      if (wasDrag && M.rm()) { wasDrag.x = wasDrag.ax; wasDrag.y = wasDrag.ay; asleep = true; }
      if (wasDrag && !moved) choose(wasDrag);
      else if (wasPan && !moved && e.type === 'pointerup') closePanel();
      kick();
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () { if (!drag && !panning) { hover = null; hoverLink = null; tip.classList.remove('on'); par.tx = par.ty = 0; kick(); } });
    cv.addEventListener('dblclick', function (e) { var p = xy(e), n = nodeAt(p.x, p.y); if (n && n.outs.length) { n.collapsed = !n.collapsed; refold(); if (sel === n) openPanel(n); } });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault(); var p = xy(e), w = toWorld(p.x, p.y), k = Math.max(0.25, Math.min(2.5, cam.k * Math.exp(-e.deltaY * 0.0016)));
      cam.k = camT.k = k; cam.x = camT.x = w.x - (p.x - W / 2) / k; cam.y = camT.y = w.y - (p.y - H / 2) / k; kick();
    }, { passive: false });

    /* ---------- the renderer interface ---------- */
    function intro(animated, r0, ms) {
      if (!animated) { fit(true); return; }
      cam = { x: r0.ax + 120, y: r0.ay, k: 1.25 }; fit(false); camRate = 1.5;
      setTimeout(function () { camRate = 7; }, ms);
    }
    function flyTo(n) { var off = W > 900 ? 190 : 0, k = Math.max(cam.k, 1.1); camT = { x: n.ax + off / k, y: n.ay, k: k }; }
    function reveal(to) {
      var sx = (to.ax - cam.x) * cam.k + W / 2, sy = (to.ay - cam.y) * cam.k + H / 2;
      if (sx < 80 || sx > W - 80 || sy < 100 || sy > H - 120) { camT.x = to.ax; camT.y = to.ay; }
    }
    resize();
    return {
      name: 'flat', kick: kick, fit: fit, intro: intro, flyTo: flyTo, reveal: reveal,
      start: function () { new ResizeObserver(function () { resize(); fit(now() - growStart > 3500); kick(); }).observe(stage); },
      zoomBy: function (f) { camT.k = Math.max(0.25, Math.min(2.5, camT.k * f)); kick(); },
      exportBlob: function (cb) { cv.toBlob(cb); },
      repaint: function () { sprites = {}; kick(); },
      setParallax: function (on) { if (!on) par.tx = par.ty = 0; },
      rebuild: function () {}, destroy: function () {}, refit: function () {}, pause: function () {}, rotateBy: function () {}
    };
  }

  /* ---------- details panel ---------- */
  var STORY = {
    e1: [['Tanker traffic through the Strait of Hormuz halts after drone strikes', 14], ['Insurers suspend war-risk cover for Gulf transits', 9], ['Navies begin escorting the first convoys', 6]],
    e2: [['Fed chair signals a slower pace of rate cuts', 21], ['Futures price out one cut for the first half', 8]],
    e3: [['Commerce Department opens review of advanced-chip export rules', 11], ['Foundry customers asked to document end users', 4]],
    f_oil: [['Brent jumps 8% in two sessions on supply fears', 17], ['Analysts split on how long the premium lasts', 5]],
    c_shel: [['Shell says Gulf cargoes rerouted, guidance unchanged', 7]], c_cost: [['Retailers warn of higher landed costs if freight stays elevated', 6]]
  };
  var TIERS = [['fact', 'Confirmed fact', 'CONFIRMED FACT'], ['inference', 'Model inference', 'MODEL INFERENCE'], ['spec', 'Speculative', 'SPECULATIVE']];
  /* one link as seen from node n. The last line is the implied direction that goes into the prediction ledger: it is always about the link's target */
  function lkRow(l, n, badge) {
    var out = l.s === n, other = out ? l.t : l.s;
    return '<div class="lk"><span>' + (out ? '→' : '←') + ' <b>' + esc(other.label) + '</b> <span class="' + (l.sign > 0 ? 'up' : 'dn') + '">' + (l.sign > 0 ? 'raises' : 'lowers') + '</span></span>' +
      '<span class="conf"><i style="--c:' + Math.round(l.conf * 100) + '%"></i>' + band(l.conf) + '</span>' +
      '<span class="src"><span class="badge badge-x">' + badge + '</span> ' + esc(l.why) + ' · ' + l.src + (l.src > 1 ? ' sources' : ' source') + '</span>' +
      '<span class="led">Ledger: ' + esc(l.t.label.replace(' ↑', '')) + (l.sign > 0 ? ' rises ↑' : ' falls ↓') + ' · ' + band(l.conf) + ' (' + l.conf.toFixed(2) + ')</span></div>';
  }
  function tierSections(n) {
    var all = n.ins.concat(n.outs);
    return (all.length ? '<p class="label led-key">← a cause of this node · → an effect of it. Each ledger line is the implied direction that is scored later.</p>' : '') + TIERS.map(function (T) {
      var ls = all.filter(function (l) { return tier(l) === T[0]; }).sort(function (a, b) { return b.conf - a.conf; });
      return ls.length ? '<section><div class="micro">' + T[1] + ' (' + ls.length + ')</div>' + ls.map(function (l) { return lkRow(l, n, T[2]); }).join('') + '</section>' : '';
    }).join('');
  }
  function openPanel(n, focusIn) {
    var p = $('#mm-panel'), ty = TYPE[n.type], st = STORY[n.id] || [[n.label.replace(' ↑', '') + ': what moved and why', 3]];
    p.innerHTML = '<button class="iconbtn x" id="mm-x" aria-label="Close">' + M.icon('x') + '</button>' +
      '<span class="badge" style="border-color:' + COL[ty.c] + ';color:' + COL[ty.c] + '">' + ty.name + '</span>' +
      '<h2 class="t2">' + esc(n.label) + '</h2><div class="label">First seen ' + dateOf(n.day) + (n.sym ? ' · ' + esc(n.sym) : '') + (n.place ? ' · ' + esc(n.place) : '') + '</div>' +
      (n.w ? '<section><div class="story"><b>' + n.w.toFixed(1) + '% of your portfolio</b> is in ' + esc(n.label) + '.<div class="meta">Exposure is worked out on this computer and never sent to a model.</div></div></section>' : '') +
      '<section><div class="micro">News (' + st.length + ')</div>' + st.map(function (s) { return '<div class="story">' + esc(s[0]) + '<div class="meta">' + s[1] + ' outlets, shown once · ' + dateOf(n.day) + '</div></div>'; }).join('') + '</section>' +
      tierSections(n) +
      '<section style="display:flex;gap:8px;flex-wrap:wrap">' + (n.sym && M.I[n.sym] ? '<a class="btn btn-sm btn-primary" href="stock.html?s=' + encodeURIComponent(n.sym) + '">Open stock page</a>' : '') +
      (n.outs.length ? '<button class="btn btn-sm" id="mm-fold" type="button">' + (n.collapsed ? 'Unfold effects' : 'Fold effects') + '</button>' : '') + '</section>' +
      '<p class="label" style="margin-top:16px">Links are hypotheses, not facts. Sample data.</p>';
    p.classList.add('open');
    $('#mm-x').addEventListener('click', closePanel);
    var f = $('#mm-fold'); if (f) f.addEventListener('click', function () { n.collapsed = !n.collapsed; refold(); openPanel(n, true); });
    if (focusIn) $('#mm-x').focus();
  }
  /* closing hands the keyboard back to the map if it was inside the panel */
  function closePanel() { var p = $('#mm-panel'), had = p.contains(document.activeElement); p.classList.remove('open'); sel = null; if (had) host.focus(); kick(); }
  $('#mm-panel').addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  function choose(n, focusIn) {
    sel = n; focusId = n.id; hideTip(); R.flyTo(n); openPanel(n, focusIn); say(n); kick();
  }
  function say(n, lead) { $('#mm-live').textContent = (lead ? lead + ' ' : '') + TYPE[n.type].name + ': ' + n.label + (n.place ? ', ' + n.place : '') + '. ' + n.ins.length + ' causes, ' + n.outs.length + ' effects.' + (n.w ? ' ' + n.w.toFixed(1) + '% of portfolio.' : ''); }

  /* ---------- keyboard ---------- */
  host.addEventListener('focus', function () { hasFocus = true; if (!focusId) focusId = nodes[0].id; say(byId[focusId]); kick(); });
  host.addEventListener('blur', function () { hasFocus = false; if (tipNode && tipNode.id === focusId && hover === tipNode) { hideTip(); hover = null; } kick(); });
  /* On the globe the arrow keys follow cause and effect, since screen position changes as it turns: Right goes to the most
     confident effect, Left to the most confident cause, Up and Down step through the alternatives at that point in the chain */
  var navVia = null;   /* the link the focus last moved along */
  function stepGlobe(n, key) {
    var shown = function (x) { return !x.hideTo && x.day <= tl && x.dimT > 0.05; }, byConf = function (a, b) { return b.conf - a.conf; }, ls, i;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      var out = key === 'ArrowRight';
      ls = (out ? n.outs : n.ins).filter(function (l) { return shown(out ? l.t : l.s); }).sort(byConf); if (!ls.length) return null;
      navVia = ls[0]; return { n: out ? ls[0].t : ls[0].s, l: ls[0], lead: (out ? 'Effect' : 'Cause') + ' 1 of ' + ls.length + '.' };
    }
    var causes = n.ins.filter(function (l) { return shown(l.s); }).sort(byConf), via = navVia && (navVia.s === n || navVia.t === n) ? navVia : causes[0], step = key === 'ArrowDown' ? 1 : -1;
    if (!causes.length) {
      /* a node with no cause: step through the other starting events in date order */
      ls = nodes.filter(function (x) { return !x.ins.length && shown(x); }).sort(function (a, b) { return a.day - b.day; }); i = ls.indexOf(n) + step;
      return ls[i] ? { n: ls[i], lead: 'Event ' + (i + 1) + ' of ' + ls.length + '.' } : null;
    }
    var down = via.t === n, hub = down ? via.s : via.t;
    ls = (down ? hub.outs : hub.ins).filter(function (l) { return shown(down ? l.t : l.s); }).sort(byConf); i = ls.indexOf(via) + step;
    if (!ls[i]) return null;
    navVia = ls[i]; return { n: down ? ls[i].t : ls[i].s, l: ls[i], lead: (down ? 'Effect ' : 'Cause ') + (i + 1) + ' of ' + ls.length + ' of ' + hub.label + '.' };
  }
  host.addEventListener('keydown', function (e) {
    var n = byId[focusId] || nodes[0], to = null, vis = function (x) { return !x.hideTo && x.day <= tl; };
    if (R.name === 'globe' && /^Arrow/.test(e.key)) {
      e.preventDefault();
      if (e.shiftKey) { R.rotateBy(e.key === 'ArrowLeft' ? -15 : e.key === 'ArrowRight' ? 15 : 0, e.key === 'ArrowUp' ? 15 : e.key === 'ArrowDown' ? -15 : 0); return; }
      var st = stepGlobe(n, e.key);
      if (st) { focusId = st.n.id; say(st.n, st.lead + (st.l ? ' ' + (st.l.sign > 0 ? 'Raises' : 'Lowers') + ', ' + band(st.l.conf) + ' ' + st.l.conf.toFixed(2) + ', ' + tierName(st.l) + '.' : '')); R.reveal(st.n); hover = st.n; hoverLink = null; pin(st.n); kick(); }
      return;
    }
    if (e.key === 'ArrowRight') to = n.outs.map(function (l) { return l.t; }).filter(vis).sort(function (a, b) { return Math.abs(a.ay - n.ay) - Math.abs(b.ay - n.ay); })[0];
    else if (e.key === 'ArrowLeft') to = n.ins.map(function (l) { return l.s; }).filter(vis)[0];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var col = nodes.filter(function (x) { return x.depth === n.depth && vis(x); }).sort(function (a, b) { return a.ay - b.ay; }), i = col.indexOf(n); to = col[i + (e.key === 'ArrowDown' ? 1 : -1)]; }
    else if (e.key === 'Enter') { choose(n, true); e.preventDefault(); return; }
    else if (e.key === ' ') { if (n.outs.length) { n.collapsed = !n.collapsed; refold(); } e.preventDefault(); return; }
    else if (e.key === 'Escape') { if (tipNode) { hideTip(); hover = null; kick(); } else closePanel(); return; }
    else if (e.key === '+' || e.key === '=') { R.zoomBy(1.25); return; }
    else if (e.key === '-') { R.zoomBy(1 / 1.25); return; }
    else if (e.key === '0') { R.fit(); return; }
    else return;
    e.preventDefault();
    if (to) { focusId = to.id; say(to); R.reveal(to); hover = to; kick(); }
  });

  /* ---------- toolbar, timeline, table, export ---------- */
  $('#mm-replay').innerHTML = M.icon('replay', 'ic-sm') + 'Replay'; $('#mm-fit').innerHTML = M.icon('fit', 'ic-sm'); $('#mm-tbl').innerHTML = M.icon('table', 'ic-sm') + 'Table'; $('#mm-png').innerHTML = M.icon('download', 'ic-sm') + 'Export image';
  $('#mm-play').innerHTML = M.icon('play', 'ic-sm');
  function toggleBtn(sel0, fn) { $(sel0).addEventListener('click', function () { var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on); this.classList.toggle('is-on', on); fn(on); kick(); }); }
  toggleBtn('#mm-part', function (on) { particlesOn = on; });
  toggleBtn('#mm-para', function (on) { parallax = on; R.setParallax(on); });
  function regraph() { closePanel(); hideTip(); hover = hoverLink = null; focusId = null; navVia = null; build(); fillFocus(); fillTable(); setTl(11); refold(); R.rebuild(); schedule(true); }
  toggleBtn('#mm-dense', function (on) { dense = on; regraph(); });
  /* ?stress=1 adds a switch for the 1,000-node graph; it is a frame-rate test for the globe, so the flat map does not offer it */
  toggleBtn('#mm-stress', function (on) { stress = on; $('#mm-dense').disabled = on; regraph(); });
  toggleBtn('#mm-leg', function (on) { stage.classList.toggle('leg-open', on); $('#mm-leg').setAttribute('aria-expanded', on); });
  toggleBtn('#mm-rot', function (on) { rotateOn = on; });
  toggleBtn('#mm-tbl', function (on) { $('#mm-table').classList.toggle('open', on); R.pause(on); });
  /* reduced motion switches these three off whatever they are set to: say so on the buttons */
  function motionButtons() {
    ['#mm-part', '#mm-para', '#mm-rot'].forEach(function (id) { var b = $(id); if (M.rm()) { b.setAttribute('aria-disabled', 'true'); b.title = 'Off while reduced motion is on'; } else { b.removeAttribute('aria-disabled'); b.removeAttribute('title'); } });
  }
  motionButtons(); document.addEventListener('ml:pref', motionButtons);
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)'); if (mq.addEventListener) mq.addEventListener('change', function () { setTimeout(motionButtons, 0); });
  $('#mm-replay').addEventListener('click', function () { closePanel(); setTl(11); schedule(true); });
  $('#mm-fit').addEventListener('click', function () { R.fit(); });
  $('#mm-in').addEventListener('click', function () { R.zoomBy(1.25); });
  $('#mm-out').addEventListener('click', function () { R.zoomBy(1 / 1.25); });
  $('#mm-png').addEventListener('click', function () {
    R.exportBlob(function (b) { var a = M.el('a'); a.href = URL.createObjectURL(b); a.download = 'market-lens-mind-map-sample.png'; document.body.appendChild(a); a.click(); a.remove(); M.toast('Exported the map as an image (sample data).'); });
  });
  function fillFocus() {
    var s = $('#mm-focus'); s.innerHTML = '<option value="">All holdings</option>' + nodes.filter(function (n) { return n.type === 'holding'; }).map(function (n) { return '<option value="' + n.id + '">' + esc(n.label) + '</option>'; }).join(''); focusHolding = '';
    $('#mm-scope').textContent = '· whole portfolio · 3 to 14 Nov 2026';
  }
  $('#mm-focus').addEventListener('change', function () {
    focusHolding = this.value; var h = byId[focusHolding];
    $('#mm-scope').textContent = '· ' + (h ? 'chains reaching ' + h.label : 'whole portfolio') + ' · 3 to 14 Nov 2026';
    targets(); fillTable();
    if (sel && sel.dimT < 0.05) closePanel();
    $('#mm-live').textContent = h ? 'Showing ' + Object.keys(upstream(h)).length + ' nodes in chains that reach ' + h.label + '.' : 'Showing the whole portfolio.';
    R.refit(); kick();
  });
  function fillTable() {
    /* the table follows the holding filter, so it lists the same links the map shows */
    var fset = focusHolding ? upstream(byId[focusHolding]) : null, rows = links.filter(function (l) { return !fset || (fset[l.s.id] && fset[l.t.id]); });
    $('#mm-table').innerHTML = '<table><thead><tr><th>Cause</th><th>Effect</th><th>Direction</th><th>Confidence</th><th>Basis</th><th>Evidence</th><th>Where</th><th>First seen</th></tr></thead><tbody>' +
      rows.map(function (l) {
        var t = tier(l), where = [l.s.place, l.t.place].filter(Boolean).join(' → ');
        return '<tr><td>' + esc(l.s.label) + '</td><td>' + esc(l.t.label) + '</td><td class="' + (l.sign > 0 ? 'up' : 'dn') + '">' + (l.sign > 0 ? '+ raises' : '− lowers') + '</td><td>' + band(l.conf) + ' (' + l.conf.toFixed(2) + ')</td><td>' + (t === 'fact' ? 'Confirmed fact' : t === 'spec' ? 'Speculative' : 'Model inference') + '</td><td style="white-space:normal;min-width:260px">' + esc(l.why) + '</td><td>' + (where ? esc(where) : '—') + '</td><td>' + dateOf(l.t.day) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  var slider = $('#mm-slider');
  function setTl(v) { tl = v; slider.value = v; $('#mm-date').textContent = dateOf(v); kick(); }
  slider.addEventListener('input', function () { stopPlay(); setTl(+this.value); });
  function stopPlay() { if (playing) { playing.cancel(); playing = null; $('#mm-play').innerHTML = M.icon('play', 'ic-sm'); } }
  $('#mm-play').addEventListener('click', function () {
    if (playing) { stopPlay(); return; }
    nodes.forEach(function (n) { n.born = -1e9; }); links.forEach(function (l) { l.t0 = -1e9; });
    $('#mm-play').innerHTML = M.icon('pause', 'ic-sm');
    if (M.rm()) { setTl(11); stopPlay(); return; }
    var t0 = performance.now(), id;
    playing = { cancel: function () { cancelAnimationFrame(id); } };
    setTl(0);
    (function step(ts) { var v = Math.min(11, Math.max(0, (ts - t0) / 200)); setTl(v); if (v < 11 && playing) id = requestAnimationFrame(step); else stopPlay(); })(t0);
  });

  /* ---------- what the globe renderer may read and call ---------- */
  var core = {
    host: host, stage: stage, TYPE: TYPE, band: band, tier: tier, dateOf: dateOf, now: now, targets: targets, animate: animate, report: report,
    choose: choose, closePanel: closePanel, say: say,
    replay: function () { schedule(true); },
    /* pointer results from the globe: a node (its tooltip stays pinned to it), a link (tooltip at the pointer) or nothing */
    overNode: function (n) { if (n === hover && !hoverLink && tipNode === n) return; hover = n; hoverLink = null; if (n) pin(n); else hideTip(); },
    overLink: function (l, x, y) { hover = null; hoverLink = l; tipNode = null; showTip(linkTip(l), x, y); },
    tipAt: function (x, y, seen) { placeTip(x, y); tip.classList.toggle('on', !!seen); },
    fold: function (n) { if (n.outs.length) { n.collapsed = !n.collapsed; refold(); if (sel === n) openPanel(n); } },
    fail: function (why) { R.destroy(); R = null; host.textContent = ''; note('The globe view could not start (' + why + '). Showing the flat map instead.'); begin('flat'); }
  };
  [['nodes', function () { return nodes; }], ['links', function () { return links; }], ['byId', function () { return byId; }], ['hover', function () { return hover; }],
    ['hoverLink', function () { return hoverLink; }], ['tipNode', function () { return tipNode; }], ['sel', function () { return sel; }], ['focusId', function () { return focusId; }], ['hasFocus', function () { return hasFocus; }],
    ['tl', function () { return tl; }], ['playing', function () { return playing; }], ['particlesOn', function () { return particlesOn; }], ['parallax', function () { return parallax; }], ['rotateOn', function () { return rotateOn; }],
    ['focusHolding', function () { return focusHolding; }], ['growStart', function () { return growStart; }], ['dense', function () { return dense; }]
  ].forEach(function (g) { Object.defineProperty(core, g[0], { get: g[1] }); });

  function note(msg) {
    var el = $('#mm-note');
    el.innerHTML = M.icon('warn') + '<span>' + esc(msg) + '</span><button class="btn btn-sm" type="button" data-a="retry">Try again</button><button class="iconbtn" type="button" data-a="x" aria-label="Dismiss">' + M.icon('x') + '</button>';
    el.hidden = false; $('#mm-live').textContent = msg;
    $('[data-a="retry"]', el).addEventListener('click', function () { location.reload(); });
    $('[data-a="x"]', el).addEventListener('click', function () { el.hidden = true; });
  }

  /* ---------- start: the globe is the default view; ?view=flat asks for the flat map, which is also what a failed globe falls back to ---------- */
  function begin(view) {
    if (view === 'globe' && !M.mmGlobe) view = 'flat';
    stage.dataset.view = view;
    host.setAttribute('aria-label', view !== 'globe' ? FLAT_LABEL : 'Event mind map on a globe. Right and Left arrow keys follow effects and causes, Up and Down step through alternatives, Shift with an arrow key turns the globe, Enter opens a node, Space folds it, Escape closes. A table of the same links is available from the toolbar.');
    $('#mm-stress').hidden = !(view === 'globe' && /[?&]stress=1\b/.test(location.search));
    R = view === 'globe' ? M.mmGlobe(core) : flatRenderer();
    refold(); targets();
    nodes.forEach(function (n) { n.dim = n.dimT; }); links.forEach(function (l) { l.dim = l.dimT; });
    schedule(true);
    R.start();
  }
  build(); fillFocus(); fillTable();
  begin((/[?&]view=(globe|flat)\b/.exec(location.search) || [0, 'globe'])[1]);
  document.addEventListener('ml:paint', function () { if (R) R.repaint(); });
  document.addEventListener('ml:pref', function () { kick(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
})();
