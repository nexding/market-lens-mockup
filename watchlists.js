/* Market Lens mockup: Watchlists page. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, CCY = M.CCY, esc = M.esc, fmt = M.fmt;
  M.shell('Watchlists');

  /* ---------- data: three lists, and per-ticker figures derived the way the stock page derives them ---------- */
  var LISTS = [
    { id: 'l1', n: 'Watchlist', ids: M.WATCH.slice() },
    { id: 'l2', n: 'Chips and AI', ids: ['NVDA', 'TSM', 'MSFT', 'INTC', 'PLTR'] },
    { id: 'l3', n: 'Income ideas', ids: ['SHEL.L', 'HSBA.L', 'XOM', 'JPM', '1299.HK', 'UNH'] }
  ], listSeq = 3, cur = LISTS[0], sel = cur.ids[0];
  var RECENT = ['PLTR', 'LMT', 'UNH', 'TSLA', 'DAL', 'COST', 'AAPL', 'F'];
  var EARN = { '0700.HK': '17 Nov 2026', 'NVDA': '18 Nov 2026', '9988.HK': '19 Nov 2026', 'AZN.L': '19 Nov 2026' };   /* the dates on Home's earnings strip */
  var NOW = new Date(2026, 10, 16, 16, 0), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nz(seed) { return (M.rng(M.hash(seed))() - 0.5) * 2; }
  var S = {};
  M.LIST.forEach(function (it) {
    var id = it.id, K = id === 'AAPL' ? 1 : 0.12 + (M.hash(id + 'k') % 90) / 100, PE = 14 + M.hash(id + 'pe') % 22;
    function leaf(key, base, nv) { return base * K * (1 + nz(id + key + 4) * nv); }
    var ni = (leaf('prod', 298000, 0.02) + leaf('serv', 104000, 0.015) - leaf('cprod', 188000, 0.02) - leaf('cserv', 28500, 0.02) - leaf('rnd', 33500, 0.01) - leaf('sga', 27200, 0.01) + leaf('oth', 420, 0.6)) * (1 - 0.162);
    var sh = ni / (it.p / PE) * (1 + nz(id + 'sh' + 4) * 0.002);   /* shares, in millions */
    S[id] = { hi52: it.p * 1.37, lo52: it.p * 0.9, dlo: Math.min(it.p, it.pc) * 0.994, dhi: Math.max(it.p, it.pc) * 1.005, sh: sh, eps: ni / sh, vol: 48210000 * K + 4e6, earn: EARN[id] || '29 Jan 2027' };
  });
  var SP = {};
  function sparkOf(id) { return SP[id] || (SP[id] = M.series(id, 32, 0.005)); }
  function nf(v) { return fmt(v, v < 1000 ? 2 : 0); }
  function rangeHTML(lo, hi, v) {
    return '<span class="rb" title="Low ' + nf(lo) + ', high ' + nf(hi) + '"><span class="rb-n">' + nf(lo) + '</span><span class="rangebar" style="--p:' + Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1) + '%"><i></i></span><span class="rb-n">' + nf(hi) + '</span></span>';
  }
  function popover(btn, pop) {
    function set(on) { pop.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    btn.addEventListener('click', function () { set(!pop.classList.contains('open')); });
    document.addEventListener('pointerdown', function (e) { if (!pop.contains(e.target) && !btn.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop.classList.contains('open')) { set(false); btn.focus(); } });
  }
  function say(msg) { $('#wl-live').textContent = msg; }

  /* ---------- columns ---------- */
  var COLS = [
    { k: 'px', n: 'Price', html: function (id) { return '<span class="dim">' + CCY[I[id].c] + '</span>' + M.pxHTML(id); } },
    { k: 'chg', n: 'Change', html: function (id) { return M.chgHTML(id); } },
    { k: 'day', n: 'Day range', live: 1, html: function (id) { var s = S[id]; return rangeHTML(s.dlo, s.dhi, I[id].p); } },
    { k: 'y52', n: '52-week range', live: 1, html: function (id) { var s = S[id]; return rangeHTML(s.lo52, s.hi52, I[id].p); } },
    { k: 'cap', n: 'Market cap', live: 1, html: function (id) { return CCY[I[id].c] + M.fbig(S[id].sh * 1e6 * I[id].p); } },
    { k: 'pe', n: 'P/E', live: 1, html: function (id) { return (I[id].p / S[id].eps).toFixed(1); } },
    { k: 'vol', n: 'Volume', html: function (id) { return M.fbig(S[id].vol); } },
    { k: 'earn', n: 'Next earnings', html: function (id) { return S[id].earn; } }
  ];
  var hidden = { day: 1, vol: 1, earn: 1 };
  var GRIP = '<svg viewBox="0 0 12 16" aria-hidden="true"><circle cx="3.5" cy="3" r="1.3"/><circle cx="8.5" cy="3" r="1.3"/><circle cx="3.5" cy="8" r="1.3"/><circle cx="8.5" cy="8" r="1.3"/><circle cx="3.5" cy="13" r="1.3"/><circle cx="8.5" cy="13" r="1.3"/></svg>';
  var table = $('#wl'), body = table.tBodies[0];
  table.tHead.innerHTML = '<tr><th scope="col" class="grip-c"><span class="sr">Reorder</span></th><th scope="col" class="l">Ticker</th><th scope="col" class="c">Today</th>' +
    COLS.map(function (c) { return '<th scope="col" data-c="' + c.k + '"' + (hidden[c.k] ? ' hidden' : '') + '>' + c.n + '</th>'; }).join('') + '<th scope="col" class="act"><span class="sr">Remove</span></th></tr>';
  function rowHTML(id) {
    return '<tr data-row="' + esc(id) + '" tabindex="' + (id === sel ? 0 : -1) + '"' + (id === sel ? ' class="is-sel" aria-current="true"' : '') + '>' +
      '<td class="grip-c"><button class="grip" type="button" tabindex="-1" title="Drag to reorder" aria-label="Drag to reorder ' + esc(id) + '. With the row focused, Alt and the up or down arrow also move it.">' + GRIP + '</button></td>' +
      '<td class="l">' + M.tk(id) + '</td><td class="c"><canvas aria-hidden="true"></canvas></td>' +
      COLS.map(function (c) { return '<td data-c="' + c.k + '"' + (hidden[c.k] ? ' hidden' : '') + '>' + c.html(id) + '</td>'; }).join('') +
      '<td class="act"><button class="rowbtn" type="button" data-rm title="Remove" aria-label="Remove ' + esc(id) + ' from this list">' + M.icon('x', 'ic-sm') + '</button></td></tr>';
  }
  function emptyRow() { return '<tr class="wl-empty"><td colspan="' + (COLS.length + 4) + '">This list is empty. Drop a ticker here, pick one from Recently viewed below, or type one into “Add a ticker”.</td></tr>'; }
  function rowOf(id) { return $('tr[data-row="' + id + '"]', body); }
  function rows() { return $$('tr[data-row]', body); }
  function drawSparks() { rows().forEach(function (tr) { var id = tr.dataset.row; M.spark($('canvas', tr), sparkOf(id), { w: 72, h: 24, base: I[id].pc }); }); }
  function paintRows() { body.innerHTML = cur.ids.map(rowHTML).join('') || emptyRow(); drawSparks(); }

  /* column chooser */
  function applyCols() { $$('[data-c]', table).forEach(function (n) { n.hidden = !!hidden[n.dataset.c]; }); }
  function paintColsMenu() {
    $('#cols-pop').innerHTML = '<div class="pop-h micro">Columns</div>' + COLS.map(function (c) { return '<label class="mi"><input type="checkbox" data-col="' + c.k + '"' + (hidden[c.k] ? '' : ' checked') + '><span>' + c.n + '</span></label>'; }).join('') + '<hr><button class="mi" type="button" data-cols="all">Show every column</button>';
  }
  paintColsMenu(); popover($('#cols-btn'), $('#cols-pop'));
  $('#cols-pop').addEventListener('change', function (e) { var c = e.target.closest('[data-col]'); if (!c) return; hidden[c.dataset.col] = !c.checked; applyCols(); });
  $('#cols-pop').addEventListener('click', function (e) { if (e.target.closest('[data-cols]')) { hidden = {}; paintColsMenu(); applyCols(); } });

  /* ---------- rail of lists ---------- */
  function avgOf(l) { return l.ids.length ? l.ids.reduce(function (s, id) { return s + M.pctOf(I[id]); }, 0) / l.ids.length : null; }
  function avgHTML(l) { var a = avgOf(l); return a == null ? '<span class="dim">Empty</span>' : '<span class="' + (a >= 0 ? 'up' : 'dn') + '">' + M.fpct(a) + ' <i aria-hidden="true">' + (a >= 0 ? '▲' : '▼') + '</i></span><span class="dim"> average today</span>'; }
  function paintLists() {
    $('#lists').innerHTML = LISTS.map(function (l) {
      return '<li><button type="button" class="wl-list' + (l === cur ? ' is-on' : '') + '" data-list="' + l.id + '"' + (l === cur ? ' aria-current="true"' : '') + '><span class="wl-list-n">' + esc(l.n) + '</span><span class="wl-list-c">' + l.ids.length + '</span><span class="wl-list-p" data-avg="' + l.id + '">' + avgHTML(l) + '</span></button></li>';
    }).join('');
  }
  function paintHead() {
    $('#wl-h').textContent = cur.n; $('#wl-n').textContent = cur.ids.length + (cur.ids.length === 1 ? ' ticker' : ' tickers');
    $('#list-del').hidden = LISTS.length < 2;
    $('#tray').innerHTML = RECENT.filter(function (id) { return cur.ids.indexOf(id) < 0; }).slice(0, 6).map(function (id) {
      return '<span class="wl-chip">' + M.tk(id, { name: false }) + '<button class="rowbtn" type="button" data-add-t="' + id + '" title="Add to this list" aria-label="Add ' + id + ' to ' + esc(cur.n) + '">' + M.icon('plus', 'ic-sm') + '</button></span>';
    }).join('') || '<span class="dim" style="font-size:12px">Everything you viewed recently is already in this list.</span>';
  }
  function showList(l) {
    cur = l; sel = cur.ids[0] || null;
    paintLists(); paintHead(); paintRows(); paintPanel();
  }
  $('#lists').addEventListener('click', function (e) {
    var b = e.target.closest('[data-list]'); if (!b) return;
    var l = LISTS.filter(function (x) { return x.id === b.dataset.list; })[0]; if (!l || l === cur) return;
    showList(l); var again = $('[data-list="' + l.id + '"]'); if (again) again.focus();
  });
  function addIdle() { $('#list-add').innerHTML = '<button class="btn btn-sm btn-quiet wl-add-b" type="button" data-new>' + M.icon('plus', 'ic-sm') + 'Add list</button>'; }
  addIdle();
  $('#list-add').addEventListener('click', function (e) {
    if (!e.target.closest('[data-new]')) return;
    $('#list-add').innerHTML = '<form><label class="sr" for="new-list">Name of the new list</label><input class="field" id="new-list" maxlength="28" placeholder="List name" autocomplete="off"><button class="btn btn-sm btn-primary" type="submit">Add</button></form>';
    $('#new-list').focus();
  });
  $('#list-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = $('#new-list').value.trim() || 'List ' + (LISTS.length + 1);
    if (LISTS.some(function (l) { return l.n.toLowerCase() === n.toLowerCase(); })) { M.toast('There is already a list called “' + n + '”.'); return; }
    var l = { id: 'l' + (++listSeq), n: n, ids: [] }; LISTS.push(l); addIdle(); showList(l);
    M.toast('Created the list “' + n + '”. Drop a ticker on the table to start it.'); $('#find-q').focus();
  });
  $('#list-add').addEventListener('keydown', function (e) { if (e.key === 'Escape' && e.target.id === 'new-list') { addIdle(); $('[data-new]').focus(); } });
  $('#list-del').addEventListener('click', function () {
    if (LISTS.length < 2) return; var gone = cur;
    LISTS.splice(LISTS.indexOf(gone), 1); showList(LISTS[0]);
    M.toast('Deleted the list “' + gone.n + '”' + (gone.ids.length ? ' and its ' + gone.ids.length + ' tickers.' : '.'));
  });

  /* ---------- selection and the linked panel ---------- */
  var chart = new M.AreaChart($('#p-chart'), { label: 'Price chart', fmt: function (v) { return fmt(v, v < 10 ? 2 : v < 1000 ? 1 : 0); } });
  var roll = new M.Roll($('#p-px'), ''), pRange = '1D', panelId = null;
  /* the same price paths the stock page draws */
  function path(it, seed, n, pts, vol) {
    var noise = M.bridge(seed, n, 1, 1, vol), out = [], i;
    for (i = 0; i < n; i++) {
      var t = i / (n - 1), j = 0; while (j < pts.length - 2 && t > pts[j + 1][0]) j++;
      var a = pts[j], b = pts[j + 1], u = (t - a[0]) / (b[0] - a[0]);
      out.push(it.p * (a[1] + (b[1] - a[1]) * u) * noise[i]);
    }
    out[n - 1] = it.p; return out;
  }
  function spanTip(days, month) { return function (f) { var d = new Date(NOW.getTime() - (1 - f) * days * 864e5); return month ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()]; }; }
  function rangeData(id, r) {
    var it = I[id];
    if (r === '1D') return { d: M.bridge(id + ':1d', 79, it.pc, it.p, 0.0016), base: it.pc, tip: function (f) { var m = 570 + Math.round(f * 390); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); } };
    if (r === '1M') return { d: path(it, id + ':1m', 150, [[0, 0.96], [0.5, 1.03], [1, 1]], 0.005), tip: spanTip(30) };
    if (r === '6M') return { d: path(it, id + ':6m', 180, [[0, 1.2], [0.24, 1.37], [0.6, 1.1], [1, 1]], 0.008), tip: spanTip(182) };
    return { d: path(it, id + ':1y', 252, [[0, 0.93], [0.45, 1.22], [0.62, 1.37], [0.8, 1.08], [1, 1]], 0.009), tip: spanTip(365, true) };
  }
  function setRange(r, mode) {
    pRange = r; if (!sel) return;
    var d = rangeData(sel, r), a = d.d[0], z = d.d[d.d.length - 1], c = CCY[I[sel].c];
    chart.set(d.d, { base: d.base, labels: [0, 0.5, 1].map(function (f) { return { f: f, t: d.tip(f) }; }), tip: d.tip, mode: mode });
    chart.cv.setAttribute('aria-label', sel + ' price over ' + { '1D': 'today', '1M': 'one month', '6M': 'six months', '1Y': 'one year' }[r] + ': from ' + c + fmt(a) + ' to ' + c + fmt(z) + ', ' + M.fpct((z / (d.base || a) - 1) * 100) + '. The figures are listed below the chart.');
  }
  function paintKv() {
    var id = sel, it = I[id], s = S[id], c = CCY[it.c];
    $('#p-kv').innerHTML = '<dt>Day range</dt><dd>' + rangeHTML(s.dlo, s.dhi, it.p) + '</dd><dt>52-week range</dt><dd>' + rangeHTML(s.lo52, s.hi52, it.p) + '</dd><dt>Previous close</dt><dd>' + c + fmt(it.pc) + '</dd>' +
      '<dt>Market cap</dt><dd>' + c + M.fbig(s.sh * 1e6 * it.p) + '</dd><dt>P/E (trailing)</dt><dd>' + (it.p / s.eps).toFixed(1) + '</dd><dt>Volume</dt><dd>' + M.fbig(s.vol) + '</dd><dt>Next earnings</dt><dd>' + s.earn + '</dd>';
  }
  function paintPanel() {
    var id = sel, panel = $('#panel');
    panel.classList.toggle('is-empty', !id); $('#p-empty').hidden = !!id;
    if (!id) return;
    var it = I[id], h = M.HOLD[id], first = panelId == null; panelId = id;
    $('#p-id').innerHTML = M.tk(id) + '';
    $('#p-held').hidden = !h; if (h) $('#p-held').textContent = 'Held · ' + fmt(h.q, 0) + ' shares';
    $('#p-ccy').textContent = CCY[it.c]; roll.set(fmt(it.p, it.dp), 0);
    $('#p-chg').innerHTML = M.chgHTML(id, { abs: true }) + '<span class="delay" title="Quotes from this source are delayed by about 15 minutes">' + M.icon('clock', 'ic-sm') + it.x + ' · delayed 15 min</span>';
    setRange(pRange, first ? 'draw' : null); paintKv();
    var q = encodeURIComponent(id);
    $('#p-act').innerHTML = '<a class="btn btn-sm btn-primary" href="stock.html?s=' + q + '">Open stock page</a><a class="btn btn-sm" href="portfolio.html?add=' + q + '">' + (h ? 'Add to holding' : 'Add holding') + '</a><a class="btn btn-sm" href="compare.html?s=' + q + '">Compare</a>';
  }
  function select(id) {
    if (id === sel && panelId === id) return;
    sel = id;
    rows().forEach(function (tr) { var on = tr.dataset.row === id; tr.classList.toggle('is-sel', on); tr.tabIndex = on ? 0 : -1; if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current'); });
    paintPanel(); if (id) say(id + ' selected. The panel shows ' + I[id].n + '.');
  }
  M.initSeg($('#p-range'), function (v) { setRange(v); });

  /* ---------- adding, removing, reordering ---------- */
  var flipT = 0;
  function flash(tr) { tr.classList.add('is-new'); setTimeout(function () { tr.classList.remove('is-new'); }, 1600); }
  /* a new row drops into place and the rows below make room */
  function dropRow(tr) {
    flash(tr); if (M.rm()) return;
    var h = tr.offsetHeight, below = [], n = tr.nextElementSibling;
    while (n) { below.push(n); n = n.nextElementSibling; }
    tr.classList.add('drop-new'); below.forEach(function (r) { r.style.setProperty('--dy', -h + 'px'); r.classList.add('drop-shift'); });
    void tr.offsetHeight;
    requestAnimationFrame(function () { tr.classList.add('drop-go'); below.forEach(function (r) { r.classList.add('drop-go'); r.style.setProperty('--dy', '0px'); }); });
    setTimeout(function () { [tr].concat(below).forEach(function (r) { r.classList.remove('drop-new', 'drop-shift', 'drop-go'); r.style.removeProperty('--dy'); }); }, M.SPRING.gentle.ms + 120);
  }
  /* rows glide from where they were to where the change put them */
  function settle(list) {
    clearTimeout(flipT);
    flipT = setTimeout(function () { body.classList.remove('flip', 'go'); list.forEach(function (r) { r.style.removeProperty('--ty'); }); }, M.SPRING.smooth.ms + 80);
  }
  function flip(mutate) {
    var list = rows(), tops = list.map(function (r) { return r.getBoundingClientRect().top; }), moved = false;
    clearTimeout(flipT); body.classList.remove('flip', 'go'); list.forEach(function (r) { r.style.removeProperty('--ty'); });
    mutate();
    if (M.rm()) return;
    list.forEach(function (r, i) { if (!r.parentNode) return; var d = tops[i] - r.getBoundingClientRect().top; if (Math.abs(d) > 0.5) { r.style.setProperty('--ty', d + 'px'); moved = true; } });
    if (!moved) return;
    body.classList.add('flip'); void body.offsetHeight; body.classList.add('go');
    list.forEach(function (r) { r.style.setProperty('--ty', '0px'); });
    settle(list);
  }
  function add(id, quiet) {
    if (!I[id] || I[id].kind !== 'stock') return false;
    var at = rowOf(id);
    if (cur.ids.indexOf(id) >= 0) { if (at) { flash(at); at.scrollIntoView({ block: 'nearest' }); } if (!quiet) M.toast(id + ' is already in ' + cur.n + '.'); return false; }
    var empty = $('.wl-empty', body); if (empty) empty.remove();
    cur.ids.unshift(id);
    body.insertAdjacentHTML('afterbegin', rowHTML(id)); var tr = body.firstElementChild;
    M.spark($('canvas', tr), sparkOf(id), { w: 72, h: 24, base: I[id].pc }); dropRow(tr);
    paintLists(); paintHead();
    if (!sel) select(id);
    if (!quiet) M.toast(id + ' added to ' + cur.n + '.');
    say(id + ' added to ' + cur.n + ' at position 1 of ' + cur.ids.length + '.');
    return true;
  }
  function remove(id) {
    var tr = rowOf(id); if (!tr) return;
    var list = rows(), i = list.indexOf(tr), next = list[i + 1] || list[i - 1], had = document.activeElement === tr || tr.contains(document.activeElement);
    cur.ids.splice(cur.ids.indexOf(id), 1);
    flip(function () { tr.remove(); });
    if (!cur.ids.length) body.innerHTML = emptyRow();
    if (RECENT.indexOf(id) >= 0) RECENT.splice(RECENT.indexOf(id), 1);
    RECENT.unshift(id);   /* so it can be put back from the tray */
    if (sel === id) { sel = null; select(next ? next.dataset.row : null); }
    if (had && next) next.focus();
    paintLists(); paintHead();
    M.toast(id + ' removed from ' + cur.n + '. It is in Recently viewed if you want it back.');
    say(id + ' removed. ' + cur.ids.length + ' left in ' + cur.n + '.');
  }
  function moveTo(from, to) {
    var list = rows(), tr = list[from];
    cur.ids.splice(to, 0, cur.ids.splice(from, 1)[0]);
    body.insertBefore(tr, to > from ? list[to].nextSibling : list[to]);
    say(tr.dataset.row + ' moved to position ' + (to + 1) + ' of ' + list.length + '.');
  }
  body.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-row]'); if (!tr) return;
    if (e.target.closest('[data-rm]')) { remove(tr.dataset.row); return; }
    if (e.target.closest('a, button')) return;
    select(tr.dataset.row);
  });
  body.addEventListener('keydown', function (e) {
    var tr = e.target.closest('tr[data-row]'); if (!tr || e.target !== tr) return;
    var list = rows(), i = list.indexOf(tr), step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0, n;
    if (step && e.altKey) {
      e.preventDefault(); if (i + step < 0 || i + step >= list.length) return;
      flip(function () { moveTo(i, i + step); }); tr.focus();
    } else if (step || e.key === 'Home' || e.key === 'End') {
      e.preventDefault(); n = step ? list[i + step] : list[e.key === 'Home' ? 0 : list.length - 1];
      if (n) { select(n.dataset.row); n.focus(); }
    } else if (e.key === 'Enter') location.href = 'stock.html?s=' + encodeURIComponent(tr.dataset.row);
    else if (e.key === ' ') { e.preventDefault(); select(tr.dataset.row); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(tr.dataset.row); }
  });
  /* drag a row by its handle: it follows the pointer and the others step aside */
  body.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.grip'); if (!g || e.button) return;
    e.preventDefault();
    var tr = g.closest('tr'), list = rows(), from = list.indexOf(tr), to = from, H = tr.offsetHeight, y0 = e.clientY, dy = 0;
    clearTimeout(flipT); list.forEach(function (r) { r.style.removeProperty('--ty'); });
    body.classList.add('flip', 'go'); tr.classList.add('lifting');
    try { g.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    function move(ev) {
      dy = Math.max(-from * H, Math.min((list.length - 1 - from) * H, ev.clientY - y0)); to = from + Math.round(dy / H);
      tr.style.setProperty('--ty', dy + 'px');
      list.forEach(function (r, i) { if (r !== tr) r.style.setProperty('--ty', (from < to && i > from && i <= to ? -H : from > to && i >= to && i < from ? H : 0) + 'px'); });
    }
    function end() {
      g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', end); g.removeEventListener('pointercancel', end);
      var rest = dy - (to - from) * H;
      body.classList.remove('flip', 'go'); tr.classList.remove('lifting'); list.forEach(function (r) { r.style.removeProperty('--ty'); });
      if (to !== from) moveTo(from, to);
      select(tr.dataset.row); tr.focus({ preventScroll: true });
      if (!rest || M.rm()) return;
      tr.style.setProperty('--ty', rest + 'px'); body.classList.add('flip'); void body.offsetHeight; body.classList.add('go'); tr.style.setProperty('--ty', '0px'); settle([tr]);
    }
    g.addEventListener('pointermove', move); g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  });
  /* a ticker dropped on the table, or sent from the right-click menu */
  document.addEventListener('ml:drop', function (e) { if (e.detail.zone === 'wl') add(e.detail.sym); });
  document.addEventListener('ml:watch', function (e) { add(e.detail, true); });
  $('#tray').addEventListener('click', function (e) { var b = e.target.closest('[data-add-t]'); if (b) add(b.dataset.addT); });

  /* add a ticker by typing */
  var fq = $('#find-q'), fpop = $('#find-pop'), hits = [], act = 0;
  function closeFind() { fpop.classList.remove('open'); fq.setAttribute('aria-expanded', 'false'); }
  function paintFind() {
    var s = fq.value.trim().toLowerCase();
    hits = s ? M.LIST.filter(function (it) { return it.id.toLowerCase().indexOf(s) === 0 || it.n.toLowerCase().indexOf(s) >= 0; }).sort(function (a, b) { return (b.id.toLowerCase().indexOf(s) === 0) - (a.id.toLowerCase().indexOf(s) === 0); }).slice(0, 6) : [];
    act = Math.max(0, Math.min(hits.length - 1, act));
    if (!s) { closeFind(); return; }
    fpop.innerHTML = hits.map(function (it, i) {
      return '<button type="button" class="mi' + (i === act ? ' is-active' : '') + '" role="option" tabindex="-1" data-id="' + it.id + '" aria-selected="' + (i === act) + '"><span class="mono" style="--h:' + it.h + '" aria-hidden="true">' + it.mono + '</span><span><b>' + it.id + '</b> <span class="dim">' + esc(it.n) + '</span></span>' + (cur.ids.indexOf(it.id) >= 0 ? '<span class="badge">In this list</span>' : '') + '</button>';
    }).join('') || '<div class="find-none">No ticker or company matches “' + esc(fq.value.trim()) + '” in the sample set.</div>';
    fpop.classList.add('open'); fq.setAttribute('aria-expanded', 'true');
  }
  function takeHit(id) { add(id); fq.value = ''; hits = []; closeFind(); }
  fq.addEventListener('input', function () { act = 0; paintFind(); });
  fq.addEventListener('focus', paintFind);
  fq.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' && hits.length) { act = Math.min(hits.length - 1, act + 1); paintFind(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && hits.length) { act = Math.max(0, act - 1); paintFind(); e.preventDefault(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[act]) takeHit(hits[act].id); }
    else if (e.key === 'Escape') closeFind();
  });
  fpop.addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) { takeHit(b.dataset.id); fq.focus(); } });
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('.wl-find')) closeFind(); });

  /* ---------- first paint ---------- */
  paintLists(); paintHead(); paintRows(); paintPanel();

  /* ---------- live ticks ---------- */
  M.onTick(function (it, prev) {
    var s = S[it.id]; if (!s) return;
    s.dlo = Math.min(s.dlo, it.p); s.dhi = Math.max(s.dhi, it.p); s.lo52 = Math.min(s.lo52, it.p); s.hi52 = Math.max(s.hi52, it.p);
    var sp = SP[it.id], tr = rowOf(it.id);
    if (sp) sp[sp.length - 1] = it.p;
    if (tr) {
      COLS.forEach(function (c) { if (!c.live) return; var td = $('td[data-c="' + c.k + '"]', tr); if (td) td.innerHTML = c.html(it.id); });
      M.spark($('canvas', tr), sparkOf(it.id), { w: 72, h: 24, base: it.pc });
    }
    LISTS.forEach(function (l) { if (l.ids.indexOf(it.id) < 0) return; var n = $('[data-avg="' + l.id + '"]'); if (n) n.innerHTML = avgHTML(l); });
    if (it.id !== sel) return;
    roll.set(fmt(it.p, it.dp), it.p > prev ? 1 : -1); paintKv();
    if (pRange === '1D') chart.nudge(it.p);
  });
  /* sparklines are canvases: redraw them when the colours change and when the window is resized */
  document.addEventListener('ml:paint', drawSparks);
  window.addEventListener('resize', drawSparks);
})();
