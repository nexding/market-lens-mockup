/* Market Lens mockup: My Portfolio page. All data is invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, I = M.I, HOLD = M.HOLD, FX = M.FX, CCY = M.CCY, esc = M.esc, fmt = M.fmt;
  M.shell('My Portfolio');

  /* ---------- helpers ---------- */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], TODAY = '2026-11-16', DAY = 864e5;
  var LIC = {
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  function lic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + LIC[n] + '</svg>'; }
  function ms(d) { var p = d.split('-'); return new Date(+p[0], p[1] - 1, +p[2]).getTime(); }
  function isoOf(y, m, d) { return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2); }
  function dstr(d) { var p = d.split('-'); return +p[2] + ' ' + MON[p[1] - 1] + ' ' + p[0]; }
  function qf(q) { return fmt(q, Math.abs(q - Math.round(q)) < 1e-6 ? 0 : 2); }
  function money(v, c, dp) { return (v < 0 ? '−' : '') + (c || '$') + fmt(Math.abs(v), dp == null ? 0 : dp); }
  function smoney(v, c, dp) { return (v > 0 ? '+' : v < 0 ? '−' : '') + (c || '$') + fmt(Math.abs(v), dp == null ? 0 : dp); }
  function arrow(v) { return '<i aria-hidden="true">' + (v >= 0 ? '▲' : '▼') + '</i>'; }
  function chip(v, txt, bare) { return '<span class="chg ' + (v >= 0 ? 'up' : 'dn') + (bare ? ' bare' : '') + '">' + txt + ' ' + arrow(v) + '</span>'; }
  function fld(label, control) { return '<label class="fld">' + label + control + '</label>'; }
  function download(name, rows) {
    var csv = rows.map(function (r) { return r.map(function (x) { x = String(x == null ? '' : x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','); }).join('\r\n');
    var a = M.el('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); M.toast('Downloaded ' + name + ' (sample data).');
  }
  function popover(btn, pop) {
    function set(on) { pop.classList.toggle('open', on); btn.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    btn.addEventListener('click', function () { set(!pop.classList.contains('open')); });
    document.addEventListener('pointerdown', function (e) { if (!pop.contains(e.target) && !btn.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop.classList.contains('open')) { set(false); btn.focus(); } });
  }

  /* ---------- the ledger: every figure on this page is rebuilt from these transactions ---------- */
  var ACCT = { USD: 'US brokerage', HKD: 'HK brokerage', GBP: 'UK brokerage' }, COMM = { USD: 4.95, HKD: 120, GBP: 8 };
  var TYPE = { buy: 'Buy', sell: 'Sell', div: 'Dividend', fee: 'Fee' };
  var TX = [], txSeq = 0;
  function addTx(o) {
    o.id = ++txSeq; o.ccy = o.ccy || I[o.sym].c; o.acct = o.acct || ACCT[o.ccy]; o.fees = o.fees || 0; o.tax = o.tax || 0; o.note = o.note || '';
    TX.push(o); return o;
  }
  /* what the transaction did to cash, in its own currency */
  function cash(t) { return t.type === 'buy' ? -(t.q * t.px + t.fees) : t.type === 'sell' ? t.q * t.px - t.fees : t.type === 'div' ? t.amt : -t.amt; }
  function byDate(a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : a.id - b.id; }
  function heldAt(sym, d) { var q = 0; TX.forEach(function (t) { if (t.del || t.sym !== sym || t.d >= d) return; if (t.type === 'buy') q += t.q; else if (t.type === 'sell') q -= t.q; }); return q; }
  function label(t) { return (t.sym || t.acct) + ' ' + TYPE[t.type].toLowerCase() + ', ' + dstr(t.d); }

  /* two buys per holding; the second price is solved so the average cost equals ML.HOLD, fees included */
  var LOTS = {
    'AAPL': ['2021-11-17', 80, 158.40, '2024-03-08'], 'MSFT': ['2021-11-17', 25, 336.20, '2026-02-03'], 'NVDA': ['2023-06-14', 100, 78.50, '2024-08-06'], 'COST': ['2024-01-18', 10, 742.00, '2026-04-09'],
    '0700.HK': ['2021-11-18', 300, 452.00, '2026-03-12'], '1299.HK': ['2021-11-18', 800, 74.50, '2023-10-24'], 'SHEL.L': ['2021-11-19', 500, 22.90, '2024-05-21'], 'HSBA.L': ['2021-11-19', 1000, 6.42, '2023-02-27']
  };
  Object.keys(LOTS).forEach(function (id) {
    var l = LOTS[id], h = HOLD[id], c = COMM[I[id].c], q2 = h.q - l[1];
    addTx({ d: l[0], type: 'buy', sym: id, q: l[1], px: l[2], fees: c });
    addTx({ d: l[3], type: 'buy', sym: id, q: q2, px: +((h.q * h.cost - l[1] * l[2] - 2 * c) / q2).toFixed(2), fees: c });
  });
  /* three positions that were opened and closed */
  [['INTC', 200, '2021-11-17', 41.20, '2024-08-12', 33.85], ['TSLA', 30, '2023-03-09', 248.50, '2025-01-21', 398.20], ['JPM', 50, '2024-02-14', 198.40, '2025-06-03', 291.10]].forEach(function (r) {
    addTx({ d: r[2], type: 'buy', sym: r[0], q: r[1], px: r[3], fees: 4.95 });
    addTx({ d: r[4], type: 'sell', sym: r[0], q: r[1], px: r[5], fees: 4.95 });
  });
  /* dividends on the shares held on each pay date: months, day, multiple of the quarterly rate, tax withheld */
  var PAY = { USD: [[1, 4, 7, 10], 14, 1, 0.3], GBP: [[2, 5, 8, 11], 20, 1, 0], HKD: [[5, 9], 5, 2, 0] };
  ['AAPL', 'MSFT', 'NVDA', 'COST', '0700.HK', '1299.HK', 'SHEL.L', 'HSBA.L', 'INTC', 'JPM'].forEach(function (id) {
    var it = I[id], p = PAY[it.c], y;
    function pay(m) {
      var d = isoOf(y, m, p[1]), q = d > TODAY ? 0 : heldAt(id, d); if (!q) return;
      var dps = +(it.p * 0.0045 * p[2] * (1 - 0.055 * (2026 - y))).toFixed(3), gross = +(q * dps).toFixed(2), tax = +(gross * p[3]).toFixed(2);
      addTx({ d: d, type: 'div', sym: id, q: q, px: dps, tax: tax, amt: +(gross - tax).toFixed(2) });
    }
    for (y = 2021; y <= 2026; y++) p[0].forEach(pay);
  });
  [2022, 2023, 2024, 2025, 2026].forEach(function (y) { addTx({ d: y + '-01-05', type: 'fee', sym: null, ccy: 'GBP', amt: 24, note: 'Custody fee for the year' }); });

  /* change history: every create, edit and delete */
  var REV = [
    { at: '12 Nov 2026, 09:14', kind: 'Edited', what: 'MSFT buy, 3 Feb 2026', detail: 'Price $438.98 → $483.98 (two digits were swapped when it was typed in)' },
    { at: '2 Oct 2026, 18:30', kind: 'Deleted', what: 'COST dividend, 14 Aug 2026', detail: 'Entered twice. The first entry remains.' },
    { at: '3 Jun 2026, 20:05', kind: 'Imported', what: 'Batch 3 · 4 rows', detail: 'broker-export-may.csv, committed as one batch' }
  ];
  function rev(kind, what, detail, tx) { REV.unshift({ at: 'Just now', kind: kind, what: what, detail: detail, tx: tx || 0 }); }

  /* lots are never stored: open quantity, average cost, realised gain and dividends are rebuilt from the ledger, oldest lot sold first */
  var SUM = { real: 0, divs: 0, tax: 0, closed: 0 };
  function rebuild(apply) {
    var lots = {}, sold = {};
    SUM.real = 0; SUM.divs = 0; SUM.tax = 0;
    TX.slice().sort(byDate).forEach(function (t) {
      if (t.del) return; var f = FX[t.ccy];
      if (t.type === 'buy') (lots[t.sym] = lots[t.sym] || []).push({ q: t.q, c: t.px + t.fees / t.q });
      else if (t.type === 'sell') {
        var L = lots[t.sym] || [], need = t.q, cost = 0;
        while (need > 1e-9 && L.length) { var take = Math.min(need, L[0].q); cost += take * L[0].c; L[0].q -= take; need -= take; if (L[0].q < 1e-9) L.shift(); }
        t.real = (t.q - need) * t.px - t.fees - cost; SUM.real += t.real * f; sold[t.sym] = 1;
      } else if (t.type === 'div') { SUM.divs += t.amt * f; SUM.tax += t.tax * f; }
    });
    SUM.closed = Object.keys(sold).filter(function (s) { return !(lots[s] && lots[s].length); }).length;
    if (!apply) return;
    Object.keys(HOLD).forEach(function (id) { if (!(lots[id] && lots[id].length)) delete HOLD[id]; });
    Object.keys(lots).forEach(function (id) {
      var q = 0, c = 0; lots[id].forEach(function (l) { q += l.q; c += l.q * l.c; });
      if (q < 1e-9) return;
      if (HOLD[id]) { HOLD[id].q = q; HOLD[id].cost = c / q; } else HOLD[id] = { q: q, cost: c / q };
    });
  }
  rebuild(false);
  function acctOf(id) { var a = {}; TX.forEach(function (t) { if (!t.del && t.type === 'buy' && t.sym === id) a[t.acct] = 1; }); a = Object.keys(a); return a.length === 1 ? a[0] : a.length + ' accounts'; }

  /* ---------- summary strip ---------- */
  var pf = M.portfolio(), PF0 = pf.total, active = 'holdings';
  var total = new M.Roll($('#total'), fmt(pf.total * 0.9, 2));
  M.tween(800, function (u) { total.set(fmt(pf.total * (0.9 + 0.1 * u), 2), 0); }, M.easeOut);
  $('#sum-delay').innerHTML = M.icon('clock', 'ic-sm') + 'Delayed 15 min · as of 16:00';
  $('#pf-note').innerHTML = lic('lock') + '<span>These are tracking figures, not tax computations. Your holdings stay on this computer: share counts, costs and account names are never sent to a data vendor or to a model.</span>';
  function big(v, pct) { return '<span class="' + (v >= 0 ? 'up' : 'dn') + '">' + smoney(v) + (pct == null ? '' : ' <small>(' + M.fpct(pct) + ')</small>') + ' ' + arrow(v) + '</span>'; }
  function paintSum() {
    var n = Object.keys(HOLD).length;
    $('#sum-h').textContent = 'Total value · ' + n + (n === 1 ? ' holding' : ' holdings') + ' · USD';
    $('#s-day').innerHTML = big(pf.total - pf.prev, pf.prev ? (pf.total / pf.prev - 1) * 100 : 0);
    $('#s-gain').innerHTML = big(pf.total - pf.cost, pf.cost ? (pf.total / pf.cost - 1) * 100 : 0);
    $('#s-gain-s').textContent = 'Unrealised, on a cost of ' + money(pf.cost);
    $('#s-real').innerHTML = big(SUM.real);
    $('#s-real-s').textContent = SUM.closed + ' closed positions · oldest lot sold first';
    $('#s-div').textContent = money(SUM.divs);
    $('#s-div-s').textContent = 'After ' + money(SUM.tax) + ' of tax withheld';
  }
  paintSum();

  /* ---------- holdings table ---------- */
  var table = $('#hold'), body = table.tBodies[0], hidden = window.innerWidth < 768 ? { val: 1, acct: 1 } : {}, SEL = {}, lastSel = null, pending = {};
  /* signals from the analysis modules, shown as small markers beside the ticker */
  var MARK = { dd: { 'MSFT': 1, 'COST': 1, '1299.HK': 1 }, news: { 'COST': 1, 'SHEL.L': 1 }, fil: { 'AAPL': 1, '0700.HK': 1 } };
  function hv(id) {
    var it = I[id], h = HOLD[id], f = FX[it.c], val = h.q * it.p;
    return { it: it, h: h, c: CCY[it.c], val: val, usd: val * f, day: h.q * (it.p - it.pc) * f, dayp: M.pctOf(it), gain: h.q * (it.p - h.cost) * f, gainp: (it.p / h.cost - 1) * 100 };
  }
  var COLS = [
    { k: 'q', n: 'Shares', ed: 'Shares', val: function (v) { return v.h.q; }, html: function (id, v) { return qf(v.h.q); } },
    { k: 'cost', n: 'Average cost', ed: 'Average cost', val: function (v) { return v.h.cost; }, html: function (id, v) { return v.c + fmt(v.h.cost); } },
    { k: 'px', n: 'Price', keep: 1, val: function (v) { return v.it.p; }, html: function (id, v) { return '<span class="dim">' + v.c + '</span>' + M.pxHTML(id); } },
    { k: 'val', n: 'Value', live: 1, val: function (v) { return v.usd; }, html: function (id, v) { return money(v.val, v.c); } },
    { k: 'usd', n: 'Value (USD)', live: 1, val: function (v) { return v.usd; }, html: function (id, v) { return money(v.usd); } },
    { k: 'day', n: 'Today', live: 1, val: function (v) { return v.day; }, html: function (id, v) { return chip(v.day, smoney(v.day) + ' (' + M.fpct(v.dayp) + ')', true); } },
    { k: 'gain', n: 'Gain', live: 1, val: function (v) { return v.gain; }, html: function (id, v) { return chip(v.gain, smoney(v.gain), true); } },
    { k: 'gainp', n: 'Gain %', live: 1, val: function (v) { return v.gainp; }, html: function (id, v) { return chip(v.gain, M.fpct(v.gainp), true); } },
    { k: 'w', n: 'Share of portfolio', h: '% of portfolio', live: 1, val: function (v) { return v.usd / pf.total; }, html: function (id, v) { var w = v.usd / pf.total; return '<span class="wcell">' + (w * 100).toFixed(1) + '%<span class="wbar" aria-hidden="true"><i style="--w:' + Math.min(1, w / 0.25).toFixed(3) + '"></i></span></span>'; } },
    { k: 'acct', n: 'Account', cls: 'l', text: 1, val: function (v, id) { return esc(acctOf(id)); }, html: function (id) { return esc(acctOf(id)); } }
  ];
  function edLabel(c, id, v) { return c.ed + ' for ' + id + ': ' + (c.k === 'q' ? qf(v.h.q) : fmt(v.h.cost)) + '. Press Enter to edit.'; }
  function marks(id) {
    var s = '', u = 'stock.html?s=' + encodeURIComponent(id);
    if (MARK.dd[id]) s += '<a class="mk mk-dd" href="' + u + '#drawdown" title="Down materially from its high. Open the drawdown check." aria-label="' + id + ' is down materially from its high. Open the drawdown check."><i></i></a>';
    if (MARK.news[id]) s += '<a class="mk mk-news" href="' + u + '#news" title="A major story touches this holding. Open news and mind map." aria-label="A major story touches ' + id + '. Open news and mind map.">' + M.icon('zap', 'ic-sm') + '</a>';
    if (MARK.fil[id]) s += '<a class="mk" href="' + u + '#deepdive" title="Three material changes in the latest annual filing. Open the deep-dive." aria-label="Three material filing changes for ' + id + '. Open the deep-dive.">' + M.icon('doc', 'ic-sm') + '</a>';
    return s ? '<span class="mks">' + s + '</span>' : '';
  }
  function rowHTML(id) {
    var v = hv(id);
    return '<tr data-row="' + esc(id) + '"' + (SEL[id] ? ' class="is-sel"' : '') + '><td class="c sel"><input type="checkbox" data-sel="' + esc(id) + '" aria-label="Select ' + esc(id) + '"' + (SEL[id] ? ' checked' : '') + '></td>' +
      '<td data-v="' + esc(id) + '"><div class="tkw">' + M.tk(id) + marks(id) + '</div></td>' +
      COLS.map(function (c) {
        return '<td data-c="' + c.k + '" class="' + (c.cls || '') + (c.ed ? ' ed' : '') + '"' + (c.ed ? ' data-ed="' + c.k + '" tabindex="0" aria-label="' + edLabel(c, id, v) + '"' : '') + ' data-v="' + c.val(v, id) + '"' + (hidden[c.k] ? ' hidden' : '') + '>' + c.html(id, v) + '</td>';
      }).join('') + '</tr>';
  }
  function rowOf(id) { return $('tr[data-row="' + id + '"]', body); }
  function paintRow(id, liveOnly) {
    var tr = rowOf(id); if (!tr || !HOLD[id]) return; var v = hv(id);
    COLS.forEach(function (c) {
      var td = $('td[data-c="' + c.k + '"]', tr); if (!td || td.classList.contains('editing')) return;
      td.dataset.v = c.val(v, id);
      if (c.keep || (liveOnly && !c.live)) return;
      td.innerHTML = c.html(id, v);
      if (c.ed) td.setAttribute('aria-label', edLabel(c, id, v));
    });
  }
  function paintFoot() {
    var d = pf.total - pf.prev, g = pf.total - pf.cost, a = {}, foot = table.tFoot;
    Object.keys(HOLD).forEach(function (id) { TX.forEach(function (t) { if (!t.del && t.type === 'buy' && t.sym === id) a[t.acct] = 1; }); });
    var cells = { q: '', cost: '', px: '', val: '<span class="dim">Mixed currencies</span>', usd: money(pf.total), day: chip(d, smoney(d) + ' (' + M.fpct(pf.prev ? (pf.total / pf.prev - 1) * 100 : 0) + ')', true),
      gain: chip(g, smoney(g), true), gainp: chip(g, M.fpct(pf.cost ? (pf.total / pf.cost - 1) * 100 : 0), true), w: '100%', acct: Object.keys(a).length + ' accounts' };
    if (!foot.rows.length) foot.innerHTML = '<tr><td class="sel"></td><td>Total in USD</td>' + COLS.map(function (c) { return '<td data-c="' + c.k + '" class="' + (c.cls || '') + '"' + (hidden[c.k] ? ' hidden' : '') + '></td>'; }).join('') + '</tr>';
    COLS.forEach(function (c) { $('td[data-c="' + c.k + '"]', foot).innerHTML = cells[c.k]; });
  }
  $('#pf-key').innerHTML = '<span><span class="dot"></span>Down materially: opens the drawdown check</span><span>' + M.icon('zap', 'ic-sm') + 'A major story touches it</span><span>' + M.icon('doc', 'ic-sm') + 'Filing changes</span><span>Double-click Shares or Average cost to edit, or press Enter or F2 on the cell</span>';
  table.tHead.innerHTML = '<tr><th scope="col" class="c sel"><input type="checkbox" id="sel-all" aria-label="Select all holdings"></th><th scope="col" data-sort="text" tabindex="0">Holding</th>' +
    COLS.map(function (c) { return '<th scope="col" data-c="' + c.k + '" data-sort="' + (c.text ? 'text' : 'num') + '" tabindex="0" class="' + (c.cls || '') + '"' + (hidden[c.k] ? ' hidden' : '') + '>' + (c.h || c.n) + '</th>'; }).join('') + '</tr>';
  body.innerHTML = Object.keys(HOLD).map(rowHTML).join('');
  paintFoot();
  M.sortable(table);
  table.tHead.addEventListener('keydown', function (e) { var th = e.target.closest('th[data-sort]'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.click(); } });

  /* column chooser */
  function applyCols() { $$('[data-c]', table).forEach(function (n) { n.hidden = !!hidden[n.dataset.c]; }); }
  function paintColsMenu() {
    $('#cols-pop').innerHTML = '<div class="pop-h micro">Columns</div>' + COLS.map(function (c) { return '<label class="mi"><input type="checkbox" data-col="' + c.k + '"' + (hidden[c.k] ? '' : ' checked') + '><span>' + c.n + '</span></label>'; }).join('') + '<hr><button class="mi" type="button" data-cols="all">Show every column</button>';
  }
  paintColsMenu(); popover($('#cols-btn'), $('#cols-pop'));
  $('#cols-pop').addEventListener('change', function (e) { var c = e.target.closest('[data-col]'); if (!c) return; hidden[c.dataset.col] = !c.checked; applyCols(); });
  $('#cols-pop').addEventListener('click', function (e) { if (e.target.closest('[data-cols]')) { hidden = {}; paintColsMenu(); applyCols(); } });

  /* a new row drops into place and the rows below make room */
  function flash(tr) { tr.classList.add('is-new'); setTimeout(function () { tr.classList.remove('is-new'); }, 1600); }
  function dropRow(tr) {
    flash(tr); if (M.rm()) return;
    var h = tr.offsetHeight, below = [], n = tr.nextElementSibling, foot = $('tfoot tr', tr.closest('table'));
    while (n) { below.push(n); n = n.nextElementSibling; }
    if (foot) below.push(foot);
    tr.classList.add('drop-new'); below.forEach(function (r) { r.style.setProperty('--dy', -h + 'px'); r.classList.add('drop-shift'); });
    void tr.offsetHeight;
    requestAnimationFrame(function () { tr.classList.add('drop-go'); below.forEach(function (r) { r.classList.add('drop-go'); r.style.setProperty('--dy', '0px'); }); });
    setTimeout(function () { [tr].concat(below).forEach(function (r) { r.classList.remove('drop-new', 'drop-shift', 'drop-go'); r.style.removeProperty('--dy'); }); }, M.SPRING.gentle.ms + 120);
  }
  function syncRows(drop) {
    $$('tr', body).forEach(function (tr) { if (!HOLD[tr.dataset.row]) { delete SEL[tr.dataset.row]; tr.remove(); } });
    Object.keys(HOLD).forEach(function (id) {
      var tr = rowOf(id), fresh = !tr;
      if (fresh) { body.insertAdjacentHTML('afterbegin', rowHTML(id)); tr = body.firstElementChild; } else paintRow(id);
      if (!fresh && drop !== id) return;
      if (active !== 'holdings') pending[id] = 1; else if (fresh) dropRow(tr); else flash(tr);
    });
  }

  /* selection and the bulk bar */
  function selIds() { return Object.keys(HOLD).filter(function (id) { return SEL[id]; }); }
  function paintBulk() {
    var ids = selIds(), v = 0; ids.forEach(function (id) { v += M.valueUSD(id); });
    $('#bulk').classList.toggle('open', ids.length > 0 && active === 'holdings');
    if (!ids.length) return;
    $('#bulk-n').textContent = ids.length + ' selected'; $('#bulk-v').textContent = money(v) + ' · ' + (v / pf.total * 100).toFixed(1) + '% of the portfolio';
    $('#bulk-cmp').href = 'compare.html?s=' + ids.map(function (id) { return encodeURIComponent(id); }).join(',');
  }
  function paintSel() {
    var ids = Object.keys(HOLD), n = 0;
    ids.forEach(function (id) { var tr = rowOf(id), on = !!SEL[id]; if (!tr) return; tr.classList.toggle('is-sel', on); $('[data-sel]', tr).checked = on; if (on) n++; });
    var all = $('#sel-all'); all.checked = n > 0 && n === ids.length; all.indeterminate = n > 0 && n < ids.length;
    paintBulk();
  }
  body.addEventListener('click', function (e) {
    var tr = e.target.closest('tr'), c = e.target.closest('[data-sel]'); if (!tr) return; var id = tr.dataset.row;
    if (c) {
      var from = e.shiftKey && lastSel ? rowOf(lastSel) : null;
      if (from) { var rows = $$('tr', body), a = rows.indexOf(from), b = rows.indexOf(tr); rows.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (r) { SEL[r.dataset.row] = c.checked; }); } else SEL[id] = c.checked;
      lastSel = id; paintSel();
    } else if ((e.ctrlKey || e.metaKey) && !e.target.closest('a, button, input')) { SEL[id] = !SEL[id]; lastSel = id; paintSel(); }
  });
  $('#sel-all').addEventListener('change', function () { var on = this.checked; Object.keys(HOLD).forEach(function (id) { SEL[id] = on; }); paintSel(); });
  $('#bulk').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bulk]'); if (!b) return; var ids = selIds(), a = b.dataset.bulk;
    if (a === 'clear') { SEL = {}; paintSel(); }
    else if (a === 'watch') { ids.forEach(function (id) { document.dispatchEvent(new CustomEvent('ml:watch', { detail: id })); }); M.toast(ids.join(', ') + ' added to Watchlist.'); }
    else if (a === 'csv') download('holdings-selected-sample.csv', holdingsCsv(ids));
    else M.toast('Alerts for ' + ids.length + ' holdings are not part of this mockup.');
  });
  function holdingsCsv(ids) {
    return [['Ticker', 'Name', 'Shares', 'Average cost', 'Currency', 'Price', 'Value', 'Value (USD)', 'Gain (USD)', 'Gain %', 'Share of portfolio %', 'Account']].concat(ids.map(function (id) {
      var v = hv(id); return [id, v.it.n, v.h.q, v.h.cost.toFixed(2), v.it.c, v.it.p.toFixed(2), v.val.toFixed(2), v.usd.toFixed(2), v.gain.toFixed(2), v.gainp.toFixed(2), (v.usd / pf.total * 100).toFixed(2), acctOf(id)];
    }));
  }

  /* inline edit: double-click, Enter or F2 opens a cell; Enter commits, Escape cancels, Tab commits and moves on.
     The edit is applied to the latest buy of that holding, so the ledger stays the only source of the numbers. */
  function lastBuy(id) { var b = null; TX.forEach(function (t) { if (!t.del && t.type === 'buy' && t.sym === id && (!b || byDate(b, t) < 0)) b = t; }); return b; }
  function editHolding(id, f, v) {
    var h = HOLD[id], b = lastBuy(id), c = CCY[I[id].c], was = f === 'q' ? h.q : h.cost;
    if (!b) return 'No buy is recorded for ' + id + '.';
    if (f === 'q') {
      var nq = b.q + (v - h.q);
      if (nq <= 0) return id + ' has ' + qf(h.q - b.q) + ' shares in earlier lots. To go below that, record a sale or edit the lots under Transactions.';
      rev('Edited', label(b), 'Quantity ' + qf(b.q) + ' → ' + qf(nq) + ' (holding edited in place: ' + qf(h.q) + ' → ' + qf(v) + ' shares)');
      b.q = nq;
    } else {
      var np = (v * h.q - (h.q * h.cost - b.q * b.px - b.fees) - b.fees) / b.q;
      if (!(np > 0)) return 'An average cost of ' + c + fmt(v) + ' cannot be reached by changing the latest buy alone. Edit the lots under Transactions.';
      rev('Edited', label(b), 'Price ' + c + fmt(b.px) + ' → ' + c + fmt(np) + ' (average cost edited in place: ' + c + fmt(h.cost) + ' → ' + c + fmt(v) + ')');
      b.px = np;
    }
    rebuild(true); refresh();
    M.toast(f === 'q' ? id + ': shares changed from ' + qf(was) + ' to ' + qf(v) + '. The buy of ' + dstr(b.d) + ' now has ' + qf(b.q) + ' shares and the average cost is ' + c + fmt(HOLD[id].cost) + '. The earlier values are in the history.'
      : id + ': average cost changed from ' + c + fmt(was) + ' to ' + c + fmt(v) + ' by repricing the buy of ' + dstr(b.d) + '. Totals are updated and the earlier values are in the history.');
    return null;
  }
  function openEd(td, fresh) {
    if (td.classList.contains('editing')) return;
    var id = td.parentNode.dataset.row, f = td.dataset.ed, h = HOLD[id], cur = f === 'q' ? h.q : h.cost, done = false;
    td.classList.add('editing');
    td.innerHTML = '<input class="ed-in" type="text" inputmode="decimal" autocomplete="off" aria-label="' + (f === 'q' ? 'Shares' : 'Average cost') + ' for ' + id + '">';
    var inp = td.firstChild; inp.value = fresh ? '' : String(+cur.toFixed(4)); inp.focus(); if (!fresh) inp.select();
    function close(commit, move, blurred) {
      if (done) return; done = true;
      var raw = inp.value.trim(), v = M.parseNum(raw), err = null;
      td.classList.remove('editing');
      if (commit && raw !== '') {
        if (!isFinite(v) || v <= 0) err = 'Enter a number above zero.';
        else if (Math.abs(v - cur) > 1e-9) err = editHolding(id, f, v);
      }
      paintRow(id);
      if (err) M.toast(err);
      if (blurred) return;
      var cells = $$('td.ed', body), next = move ? cells[cells.indexOf(td) + move] : null;
      if (next) { next.focus(); openEd(next); } else td.focus();
    }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); close(true, 0); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false, 0); }
      else if (e.key === 'Tab') { e.preventDefault(); close(true, e.shiftKey ? -1 : 1); }
    });
    inp.addEventListener('blur', function () { close(true, 0, true); });
  }
  body.addEventListener('dblclick', function (e) { var td = e.target.closest('td.ed'); if (td) openEd(td); });
  body.addEventListener('pointerup', function (e) { var td = e.target.closest('td.ed'); if (td && e.pointerType === 'touch' && document.activeElement === td) openEd(td); });
  body.addEventListener('keydown', function (e) {
    var td = e.target.closest('td.ed'); if (!td || e.target !== td) return;
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); openEd(td); }
    else if (/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) openEd(td, true);   /* typing a number starts a new value; the key lands in the input */
    else if (e.key.indexOf('Arrow') === 0 && !e.altKey) {
      var cells = $$('td.ed', body), n = cells[cells.indexOf(td) + { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key]];
      if (n) { n.focus(); e.preventDefault(); }
    }
  });

  /* ---------- add holding (side sheet) ---------- */
  function trapFocus(sh) {
    if (sh.dataset.trap) return; sh.dataset.trap = '1';
    sh.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button, input, select, textarea', sh).filter(function (n) { return !n.disabled && n.tabIndex >= 0 && n.offsetParent !== null; }); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); e.preventDefault(); }
    });
  }
  function openAdd(pre) {
    var html = '<form class="pf-form" id="ah" novalidate>' +
      '<div class="ah-box"><label class="fld" for="ah-q">Ticker or company<input class="field" id="ah-q" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="ah-list" aria-autocomplete="list" placeholder="Start typing, for example TSM or Taiwan"></label>' +
      '<div class="ah-list" id="ah-list" role="listbox" aria-label="Matching tickers"></div></div>' +
      '<div class="ah-picked" id="ah-picked" hidden></div>' +
      '<div class="two">' + fld('Shares', '<input class="field" id="ah-sh" inputmode="decimal" autocomplete="off">') + fld('Price per share', '<input class="field" id="ah-px" inputmode="decimal" autocomplete="off">') + '</div>' +
      '<div class="two">' + fld('Trade date', '<input class="field" id="ah-d" type="date" value="' + TODAY + '" max="' + TODAY + '">') + fld('Fees', '<input class="field" id="ah-fee" inputmode="decimal" autocomplete="off" value="0">') + '</div>' +
      '<div class="two">' + fld('Currency', '<select class="select" id="ah-ccy">' + Object.keys(CCY).map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') + '</select>') +
        fld('Account', '<select class="select" id="ah-acct">' + Object.keys(ACCT).map(function (c) { return '<option>' + ACCT[c] + '</option>'; }).join('') + '</select>') + '</div>' +
      fld('Note (optional)', '<input class="field" id="ah-note" maxlength="120" autocomplete="off">') +
      '<div class="ah-sum" id="ah-sum" aria-live="polite"></div><p class="pf-err" id="ah-err" role="alert"></p>' +
      '<p class="band">' + lic('lock') + '<span>These are tracking figures, not tax computations. Your holdings stay on this computer: only the ticker is sent to the price source, never share counts, costs or account names.</span></p>' +
      '<div class="sheet-f"><button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Add holding</button></div></form>';
    M.sheet('Add holding', html, function (sh) {
      trapFocus(sh);
      var q = $('#ah-q', sh), list = $('#ah-list', sh), box = $('#ah-picked', sh), picked = null, hits = [], act = 0;
      function num(sel) { return M.parseNum($(sel, sh).value); }
      function paintList() {
        var s = q.value.trim().toLowerCase(); hits = [];
        if (s && !picked) hits = M.LIST.filter(function (it) { return it.id.toLowerCase().indexOf(s) === 0 || it.n.toLowerCase().indexOf(s) >= 0; }).sort(function (a, b) { return (b.id.toLowerCase().indexOf(s) === 0) - (a.id.toLowerCase().indexOf(s) === 0); }).slice(0, 6);
        act = Math.max(0, Math.min(hits.length - 1, act));
        list.innerHTML = hits.map(function (it, i) {
          return '<button type="button" class="sr-row' + (i === act ? ' is-active' : '') + '" role="option" tabindex="-1" data-id="' + it.id + '" aria-selected="' + (i === act) + '"><span class="tk"><span class="mono" style="--h:' + it.h + '" aria-hidden="true">' + it.mono + '</span><span class="tk-t"><span class="tk-s">' + it.id + ' <span class="ex">' + it.x + '</span></span><span class="tk-n">' + esc(it.n) + '</span></span></span><span class="p">' + CCY[it.c] + fmt(it.p) + '</span>' + (HOLD[it.id] ? '<span class="badge badge-accent">Held</span>' : '<span></span>') + '</button>';
        }).join('') || (s && !picked ? '<div class="ah-none">No ticker or company matches “' + esc(q.value.trim()) + '” in the sample set.</div>' : '');
        q.setAttribute('aria-expanded', hits.length ? 'true' : 'false');
      }
      function paintCost() {
        var n = num('#ah-sh'), px = num('#ah-px'), fee = num('#ah-fee') || 0, ccy = $('#ah-ccy', sh).value, c = CCY[ccy], out = '';
        if (picked && n > 0 && px > 0) {
          var it = I[picked], h = HOLD[picked], cost = n * px + fee, loc = cost * FX[ccy] / FX[it.c];
          out = 'Cost: ' + qf(n) + ' × ' + c + fmt(px) + (fee > 0 ? ' + ' + c + fmt(fee) + ' fees' : '') + ' = <b>' + c + fmt(cost) + '</b>' + (ccy !== 'USD' ? ', about ' + money(cost * FX[ccy]) + ' in USD' : '') + '.' +
            (ccy !== it.c ? ' Recorded as ' + CCY[it.c] + fmt(loc) + ' at today’s rate, because ' + picked + ' trades in ' + it.c + '.' : '') +
            (h ? ' This adds a lot to the ' + qf(h.q) + ' shares you hold; the average cost becomes <b>' + CCY[it.c] + fmt((h.q * h.cost + loc) / (h.q + n)) + '</b>.' : '');
        }
        $('#ah-sum', sh).innerHTML = out;
      }
      function pick(id) {
        var it = I[id], h = HOLD[id]; picked = id; q.value = id; act = 0; paintList();
        box.hidden = false;
        box.innerHTML = M.tk(id) + '<span><b>' + CCY[it.c] + fmt(it.p) + '</b> ' + M.chgHTML(id, { bare: true }) + '</span>' + (h ? '<span class="badge badge-accent">Held · ' + qf(h.q) + ' shares</span>' : '<span class="badge">' + it.x + '</span>');
        $('#ah-ccy', sh).value = it.c; $('#ah-acct', sh).value = ACCT[it.c]; $('#ah-px', sh).value = it.p.toFixed(2);
        $('#ah-err', sh).textContent = ''; paintCost();
      }
      q.addEventListener('input', function () { picked = null; box.hidden = true; act = 0; paintList(); paintCost(); });
      q.addEventListener('keydown', function (e) {
        if (!hits.length) return;
        if (e.key === 'ArrowDown') { act = Math.min(hits.length - 1, act + 1); paintList(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); paintList(); e.preventDefault(); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(hits[act].id); $('#ah-sh', sh).focus(); }
        else if (e.key === 'Escape') { e.stopPropagation(); hits = []; list.innerHTML = ''; q.setAttribute('aria-expanded', 'false'); }
      });
      list.addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) { pick(b.dataset.id); $('#ah-sh', sh).focus(); } });
      $('#ah', sh).addEventListener('input', paintCost);
      $('#ah', sh).addEventListener('change', paintCost);
      $('#ah', sh).addEventListener('submit', function (e) {
        e.preventDefault();
        var n = num('#ah-sh'), px = num('#ah-px'), fee = $('#ah-fee', sh).value.trim() === '' ? 0 : num('#ah-fee'), d = $('#ah-d', sh).value || TODAY, ccy = $('#ah-ccy', sh).value;
        function fail(msg, sel) { $('#ah-err', sh).innerHTML = M.icon('warn', 'ic-sm') + '<span>' + msg + '</span>'; $(sel, sh).focus(); }
        if (!picked) return fail('Choose a ticker from the list.', '#ah-q');
        if (!(n > 0)) return fail('Enter how many shares you bought, above zero.', '#ah-sh');
        if (!(px > 0)) return fail('Enter the price you paid for each share.', '#ah-px');
        if (!(fee >= 0)) return fail('Fees must be zero or more.', '#ah-fee');
        if (d > TODAY) return fail('The trade date cannot be after today.', '#ah-d');
        var id = picked, it = I[id], k = FX[ccy] / FX[it.c], fresh = !HOLD[id];
        var t = addTx({ d: d, type: 'buy', sym: id, q: n, px: px * k, fees: fee * k, acct: $('#ah-acct', sh).value, note: $('#ah-note', sh).value.trim() });
        rev('Created', label(t), qf(n) + ' shares at ' + CCY[it.c] + fmt(t.px) + (t.fees ? ', fees ' + CCY[it.c] + fmt(t.fees) : ''));
        rebuild(true); M.closeSheet(); tabs.select('holdings', true); refresh({ drop: id });
        M.toast((fresh ? 'Added ' + qf(n) + ' shares of ' + id : 'Added a lot of ' + qf(n) + ' shares to ' + id) + ' at ' + CCY[it.c] + fmt(t.px) + '. Totals, allocation and performance are updated.');
      });
      if (pre && I[pre] && I[pre].kind === 'stock') { pick(pre); setTimeout(function () { $('#ah-sh', sh).focus(); }, 60); }
      else if (pre) { q.value = pre; paintList(); }
    });
  }
  $('#add-holding').innerHTML = M.icon('plus') + 'Add holding';
  $('#add-holding').addEventListener('click', function () { openAdd(); });

  /* ---------- tabs ---------- */
  var built = {}, dirty = {}, SEGS = {}, PAINT = { performance: paintPerf, breakdown: paintBreak, dividends: paintDiv, transactions: paintTx, import: paintImp };
  function go(v, dir) {
    active = v; M.showPanel($('#panels'), v, dir);
    if (PAINT[v] && (!built[v] || dirty[v])) { PAINT[v](!built[v]); built[v] = 1; dirty[v] = 0; }
    (SEGS[v] || []).forEach(function (s) { s.place(false); });
    if (v === 'holdings') { Object.keys(pending).forEach(function (id) { var tr = rowOf(id); if (tr) flash(tr); }); pending = {}; }
    paintBulk();
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* file:// */ }
  }
  var tabs = M.initTabs($('#ptabs'), go);
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto]'); if (!g) return;
    tabs.select(g.dataset.goto, true);
    window.scrollTo({ top: Math.max(0, $('#ptabs').getBoundingClientRect().top + window.scrollY - 112), behavior: M.rm() ? 'auto' : 'smooth' });
  });
  /* after any change to the ledger: totals, rows and whichever tab is open */
  function refresh(o) {
    var before = pf.total; pf = M.portfolio(); total.set(fmt(pf.total, 2), pf.total >= before ? 1 : -1);
    paintSum(); syncRows(o && o.drop); paintFoot(); paintSel();
    Object.keys(PAINT).forEach(function (k) { dirty[k] = 1; });
    if (PAINT[active] && built[active]) { PAINT[active](false); dirty[active] = 0; }
  }

  /* ---------- performance: daily value rebuilt from the ledger, against a benchmark ---------- */
  var T0 = ms('2021-11-19'), N = Math.round((ms(TODAY) - T0) / DAY);
  function dayIx(d) { return Math.max(0, Math.min(N, Math.round((ms(d) - T0) / DAY))); }
  function dateAt(i, long) { var d = new Date(T0 + Math.round(i) * DAY); return long ? MON[d.getMonth()] + ' ' + d.getFullYear() : d.getDate() + ' ' + MON[d.getMonth()] + (long === 0 ? ' ' + d.getFullYear() : ''); }
  /* money moving into the holdings each day, in USD: buys in, sells and dividends out */
  function flowArr() { var f = [], i; for (i = 0; i <= N; i++) f.push(0); TX.forEach(function (t) { if (!t.del && t.type !== 'fee') f[dayIx(t.d)] -= cash(t) * FX[t.ccy]; }); return f; }
  function cum(f) { var c = [], s = 0; f.forEach(function (x) { s += x; c.push(s); }); return c; }
  var RG = [['1M', 30, 0.958], ['6M', 184, 0.965], ['YTD', 319, 0.822], ['1Y', 365, 0.81], ['All', N, 0]];   /* the multiples are the start values Home uses for the same ranges */
  var F0 = cum(flowArr()), NOISE = (function () { var r = M.rng(M.hash('pf:daily')), a = [], i; for (i = 0; i <= N; i++) a.push(1 + (r() - 0.5) * 0.022); return a; })();
  function model() {
    var f = flowArr(), c = cum(f), v = [f[0]], g = [1], pts = [0, N - 365, N - 319, N - 184, N - 30, N], mult = [0, 0.81, 0.822, 0.965, 0.958, 0], k;
    function run(a, b, G, write) {
      var x = v[a], gi = g[a], d = Math.pow(G, 1 / (b - a)), i;
      for (i = a + 1; i <= b; i++) { x = x * d * NOISE[i] + f[i]; if (write) { v[i] = x; gi *= d * NOISE[i]; g[i] = gi; } }
      return x;
    }
    /* each stretch grows at the rate that lands on the known value at its end, given the cash that moved */
    for (k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k], target = k === pts.length - 1 ? pf.total : mult[k] * PF0 + (c[b] - F0[b]), lo = 0.3, hi = 4, n;
      for (n = 0; n < 48; n++) { var mid = (lo + hi) / 2; if (run(a, b, mid) < target) lo = mid; else hi = mid; }
      run(a, b, (lo + hi) / 2, true);
    }
    return { f: f, v: v, g: g };
  }
  var BENCH = { SPX: [0.021, 0.058, 0.124, 0.142, 0.74], HSI: [0.034, 0.081, 0.262, 0.297, 0.06], FTSE: [0.012, 0.049, 0.156, 0.172, 0.34] }, benchCache = {};
  function benchPath(key) {
    if (benchCache[key]) return benchCache[key];
    var r = BENCH[key], pts = [[0, 1 / (1 + r[4])], [N - 365, 1 / (1 + r[3])], [N - 319, 1 / (1 + r[2])], [N - 184, 1 / (1 + r[1])], [N - 30, 1 / (1 + r[0])], [N, 1]], b = [], k, i;
    for (k = 1; k < pts.length; k++) {
      var a = pts[k - 1], z = pts[k], n = z[0] - a[0], nz = M.bridge('bench:' + key + k, n + 1, 1, 1, 0.006);
      for (i = (k === 1 ? 0 : 1); i <= n; i++) b[a[0] + i] = a[1] * Math.pow(z[1] / a[1], i / n) * nz[i];
    }
    return (benchCache[key] = b);
  }
  /* returns for the stretch from day a to today; the benchmark is shown two ways */
  function stats(md, bp, a) {
    var len = N - a, yrs = len / 365, vb = md.v[a], hb = [vb], net = 0, i;
    for (i = a + 1; i <= N; i++) { vb = vb * bp[i] / bp[i - 1] + md.f[i]; hb.push(vb); net += md.f[i]; }
    function npv(r) { var s = -md.v[a] + md.v[N] * Math.pow(1 + r, -yrs), j; for (j = a + 1; j <= N; j++) if (md.f[j]) s -= md.f[j] * Math.pow(1 + r, -(j - a) / 365); return s; }
    var lo = -0.95, hi = 20;
    for (i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; }
    var irr = (lo + hi) / 2, long = yrs > 1.01;
    function per(x) { return long ? Math.pow(1 + x, 1 / yrs) - 1 : x; }   /* a year when the stretch is longer than a year */
    return { a: a, len: len, yrs: yrs, long: long, v0: md.v[a], v1: md.v[N], net: net, hb: hb, vb: vb, twrAll: md.g[N] / md.g[a] - 1, twr: per(md.g[N] / md.g[a] - 1), mwr: long ? irr : Math.pow(1 + irr, yrs) - 1, br: per(bp[N] / bp[a] - 1) };
  }
  var perfRange = '1Y', perfMode = 'value', benchKey = 'SPX', perfChart = null, perfOpt = { labels: [] }, perfCur = null, PM = null;
  function rgOf(r) { return RG.filter(function (x) { return x[0] === r; })[0]; }
  function pctTxt(x, long) { return M.fpct(x * 100, 1) + (long ? ' a year' : ''); }
  function perfLegend(i) {
    var c = perfCur, k = i == null ? c.len : i, val = perfMode === 'value', bn = I[benchKey].n, f = val ? function (x) { return money(x); } : function (x) { return M.fpct(x, 1); };
    $('#perf-lg').innerHTML = '<span><i style="background:var(--accent)"></i>' + (val ? 'My portfolio' : 'My portfolio, time-weighted') + ' <b>' + f(c.s1[k]) + '</b></span>' +
      '<span><i class="dash" style="color:var(--data-2)"></i>' + (val ? 'The same cash flows in the ' + bn : bn + ', its own return') + ' <b>' + f(c.s2[k]) + '</b></span><span class="dim">' + dateAt(c.a + k, 0) + '</span>';
  }
  function paintPerf(first) {
    PM = model();
    var bp = benchPath(benchKey), bn = I[benchKey].n, a = N - rgOf(perfRange)[1], st = stats(PM, bp, a), val = perfMode === 'value', s1, s2, host = $('#perf-plot');
    if (val) { s1 = PM.v.slice(a); s2 = st.hb; }
    else { s1 = PM.g.slice(a).map(function (x) { return (x / PM.g[a] - 1) * 100; }); s2 = bp.slice(a).map(function (x) { return (x / bp[a] - 1) * 100; }); }
    perfOpt.fmt = val ? function (x) { return '$' + fmt(x / 1000, 0) + 'k'; } : function (x) { return M.fpct(x, 0); };
    perfOpt.zero = !val;
    perfOpt.labels = [0, 0.25, 0.5, 0.75, 1].map(function (f) { return { f: f, t: dateAt(a + f * st.len, st.len > 400) }; });
    var series = [{ data: s1, color: 'accent', lw: 2, fill: true }, { data: s2, color: 'data-2', lw: 1.5, dash: [5, 4] }];
    if (!perfChart) perfChart = M.lines(host, series, perfOpt); else perfChart.set(series);
    perfCur = { a: a, len: st.len, s1: s1, s2: s2 };
    perfLegend(null);
    var since = dateAt(a, 0), diff = st.v1 - st.vb;
    host.setAttribute('aria-label', 'Portfolio value from ' + money(st.v0) + ' on ' + since + ' to ' + money(st.v1) + ' today. The same cash flows in the ' + bn + ' would be worth ' + money(st.vb) + '. Time-weighted return ' + pctTxt(st.twr, st.long) + '; the ' + bn + ' returned ' + pctTxt(st.br, st.long) + '. The table below has every period.');
    $('#perf-cap').textContent = 'Daily values rebuilt from the transactions, closing prices and exchange rates. ' + (val ? 'The dashed line starts at your value on ' + since + ' and then receives every deposit and withdrawal you made, invested in the ' + bn + '.' : 'Both lines start at zero on ' + since + '. Yours is time-weighted, so deposits and withdrawals do not move it.') + ' Prototype data.';
    function tile(lab, x, sub) { return '<section class="card pf-kpi"><div class="label">' + lab + '</div><div class="bignum ' + (x >= 0 ? 'up' : 'dn') + '">' + M.fpct(x * 100, 1) + arrow(x) + (st.long ? '<small>a year</small>' : '') + '</div><p>' + sub + '</p></section>'; }
    $('#perf-tiles').innerHTML =
      tile('Time-weighted return', st.twr, (st.long ? '<b>' + M.fpct(st.twrAll * 100, 1) + ' in total</b> since ' + since + '. ' : 'Since ' + since + '. ') + 'Ignores when you added or withdrew money, so it is the figure to compare with an index.') +
      tile('Money-weighted return', st.mwr, 'What your money earned, counting when each deposit went in. Net cash in over the period: <b>' + smoney(st.net) + '</b>.') +
      tile(bn + ', its own return', st.br, 'The index over the same dates, with nothing added or withdrawn. You are <b>' + Math.abs((st.twr - st.br) * 100).toFixed(1) + ' points ' + (st.twr >= st.br ? 'ahead' : 'behind') + '</b> on a time-weighted basis.') +
      '<section class="card pf-kpi"><div class="label">The same cash flows in the ' + bn + '</div><div class="bignum">' + money(st.vb) + '</div><p>What your deposits and withdrawals would be worth in the index. Your portfolio is <b class="' + (diff >= 0 ? 'up' : 'dn') + '">' + money(Math.abs(diff)) + ' ' + (diff >= 0 ? 'ahead' : 'behind') + '</b>.</p></section>';
    $('#perf-table').innerHTML = '<thead><tr><th scope="col">Period</th><th scope="col">Start value</th><th scope="col">Net cash in</th><th scope="col">End value</th><th scope="col">Time-weighted</th><th scope="col">Money-weighted</th><th scope="col">' + bn + ' return</th><th scope="col">Same cash flows in ' + bn + '</th><th scope="col">Difference</th></tr></thead><tbody>' +
      RG.map(function (r) {
        var s = r[0] === perfRange ? st : stats(PM, bp, N - r[1]), d = s.v1 - s.vb;
        return '<tr' + (r[0] === perfRange ? ' class="is-sel"' : '') + '><td>' + { '1M': 'One month', '6M': 'Six months', 'YTD': 'Year to date', '1Y': 'One year', 'All': 'Since 19 Nov 2021' }[r[0]] + '</td><td>' + money(s.v0) + '</td><td>' + smoney(s.net) + '</td><td>' + money(s.v1) + '</td><td>' + chip(s.twr, pctTxt(s.twr, s.long), true) + '</td><td>' + chip(s.mwr, pctTxt(s.mwr, s.long), true) + '</td><td>' + chip(s.br, pctTxt(s.br, s.long), true) + '</td><td>' + money(s.vb) + '</td><td>' + chip(d, smoney(d), true) + '</td></tr>';
      }).join('') + '</tbody>';
    if (!first) return;
    host.addEventListener('pointermove', function (e) {
      if (!perfCur) return; var r = host.getBoundingClientRect(), iw = r.width - 54, x = Math.max(0, Math.min(iw, e.clientX - r.left)), i = Math.round(x / iw * perfCur.len);
      host.classList.add('hov'); $('.pf-cross', host).style.transform = 'translateX(' + (i / perfCur.len * iw).toFixed(1) + 'px)'; perfLegend(i);
    });
    host.addEventListener('pointerleave', function () { host.classList.remove('hov'); perfLegend(null); });
  }
  SEGS.performance = [M.initSeg($('#perf-mode'), function (v) { perfMode = v; paintPerf(false); }), M.initSeg($('#perf-range'), function (v) { perfRange = v; paintPerf(false); })];
  $('#bench').addEventListener('change', function () { benchKey = this.value; paintPerf(false); });

  /* ---------- breakdown: ring, bars and limits ---------- */
  var RC = ['var(--data-1)', 'var(--data-4)', 'var(--data-3)', 'var(--data-2)', 'var(--data-5)', 'var(--data-6)', 'var(--text-3)', 'var(--hairline-strong)'];
  var ring = $('#ring'), CIRC = 2 * Math.PI * 51, allocBy = 'stock', LIM = { stock: 0.10, sector: 0.25, country: 0.60 }, firstRing = true;
  function alloc(by) {
    var g = {}, tot = 0;
    Object.keys(HOLD).forEach(function (id) { var k = by === 'stock' ? id : by === 'sector' ? I[id].sec : I[id].cty, v = M.valueUSD(id); g[k] = (g[k] || 0) + v; tot += v; });
    return Object.keys(g).map(function (k) { return { k: k, v: g[k], w: g[k] / tot }; }).sort(function (a, b) { return b.w - a.w; });
  }
  function drawRing(by) {
    allocBy = by;
    var data = alloc(by), segs = data.length > 8 ? data.slice(0, 7).concat([{ k: 'Other', v: data.slice(7).reduce(function (s, d) { return s + d.v; }, 0), w: data.slice(7).reduce(function (s, d) { return s + d.w; }, 0) }]) : data;
    var circles = $$('circle.seg', ring), start = 0;
    while (circles.length < segs.length) { var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', 'seg'); c.setAttribute('cx', 62); c.setAttribute('cy', 62); c.setAttribute('r', 51); c.style.strokeDasharray = '0 ' + CIRC; ring.appendChild(c); circles.push(c); }
    void ring.getBoundingClientRect();
    circles.forEach(function (c, i) {
      var s = segs[i];
      c.style.transitionDelay = firstRing && !M.rm() ? (i * 70) + 'ms' : '0ms';
      if (!s) { c.style.strokeDasharray = '0 ' + CIRC; return; }
      var len = Math.max(0, s.w * CIRC - 2.5);
      c.style.stroke = RC[i % RC.length]; c.style.strokeDasharray = len + ' ' + (CIRC - len); c.style.strokeDashoffset = -(start * CIRC); start += s.w;
    });
    firstRing = false;
    $('#legend').innerHTML = segs.map(function (s, i) { return '<li><i style="background:' + RC[i % RC.length] + '"></i><span>' + esc(s.k) + '</span><span class="w">' + (s.w * 100).toFixed(1) + '%</span><span class="u">' + money(s.v) + '</span></li>'; }).join('');
    $('#ring-n').textContent = data.length; $('#ring-l').textContent = by === 'stock' ? 'holdings' : by === 'sector' ? 'sectors' : 'countries';
    ring.setAttribute('aria-label', 'Portfolio allocation by ' + by + ': ' + segs.map(function (s) { return s.k + ' ' + (s.w * 100).toFixed(1) + '%'; }).join(', '));
    $$('#bars .pf-by').forEach(function (n) { n.classList.toggle('is-on', n.dataset.by === by); });
  }
  function paintLimits() {
    [['stock', 'holding', 'holdings'], ['sector', 'sector', 'sectors'], ['country', 'country', 'countries']].forEach(function (r) {
      var data = alloc(r[0]), over = data.filter(function (d) { return d.w > LIM[r[0]]; }), row = $('[data-lim-row="' + r[0] + '"]');
      row.classList.toggle('over', over.length > 0);
      $('.lim-ic', row).innerHTML = over.length ? M.icon('warn') : lic('check');
      $('p', row).textContent = !data.length ? '' : over.length ? (over.length === 1 ? 'One ' + r[1] + ' is' : over.length + ' ' + r[2] + ' are') + ' above the limit: ' + over.map(function (d) { return d.k + ' ' + (d.w * 100).toFixed(1) + '%'; }).join(', ') + '.'
        : 'Within the limit. The largest ' + r[1] + ' is ' + data[0].k + ' at ' + (data[0].w * 100).toFixed(1) + '%.';
    });
    var st = alloc('stock'), hh = st.reduce(function (s, d) { return s + d.w * d.w; }, 0), top3 = st.slice(0, 3).reduce(function (s, d) { return s + d.w; }, 0);
    $('#eff').innerHTML = '<dt title="One divided by the sum of squared weights. Equal positions would score the full count.">Effective number of holdings</dt><dd>' + (hh ? (1 / hh).toFixed(1) : '0') + ' of ' + st.length + '</dd><dt>Three largest holdings together</dt><dd>' + (top3 * 100).toFixed(1) + '%</dd>';
  }
  function paintBars(first) {
    $('#bars').innerHTML = [['stock', 'By stock'], ['sector', 'By sector'], ['country', 'By country']].map(function (r) {
      var data = alloc(r[0]), lim = LIM[r[0]], max = Math.max(data.length ? data[0].w : 0, lim) * 1.1;
      return '<section class="card pf-by' + (allocBy === r[0] ? ' is-on' : '') + '" data-by="' + r[0] + '" aria-label="' + r[1] + '"><header class="card-h"><h2>' + r[1] + '</h2><div class="card-a"><span class="label">Limit ' + Math.round(lim * 100) + '%</span></div></header><ul class="hbs' + (first ? ' pre' : '') + '">' +
        data.map(function (d, i) {
          var over = d.w > lim;
          return '<li class="hb' + (over ? ' over' : '') + '"><span class="hb-n">' + (r[0] === 'stock' ? M.tk(d.k, { name: false }) : esc(d.k)) + '</span><span class="hb-t" style="--lim:' + (lim / max * 100).toFixed(2) + '%" title="' + money(d.v) + '"><span class="hb-b"><i style="--w:' + (d.w / max).toFixed(4) + ';background:' + RC[i % RC.length] + '"></i></span></span>' +
            '<span class="hb-p">' + (over ? M.icon('warn', 'ic-sm') + '<span class="sr">Above the limit: </span>' : '') + (d.w * 100).toFixed(1) + '%</span></li>';
        }).join('') + '</ul><div class="hb-cap"><span>0%</span><span>The marker is your ' + Math.round(lim * 100) + '% limit</span><span>' + Math.round(max * 100) + '%</span></div></section>';
    }).join('');
    if (first) { void $('#bars').offsetWidth; requestAnimationFrame(function () { $$('#bars .hbs').forEach(function (u) { u.classList.remove('pre'); }); }); }
  }
  function paintBreak(first) {
    if (first) ring.innerHTML = '<circle class="track" cx="62" cy="62" r="51"></circle>';
    paintBars(first); drawRing(allocBy); paintLimits();
  }
  SEGS.breakdown = [M.initSeg($('#alloc-by'), function (v) { drawRing(v); })];
  $('#lims').addEventListener('input', function (e) {
    var n = e.target.closest('[data-lim]'); if (!n) return; var v = parseFloat(n.value); if (!(v >= 1 && v <= 100)) return;
    LIM[n.dataset.lim] = v / 100; paintBars(false); paintLimits();
  });

  /* ---------- dividends ---------- */
  var YEARS = ['2021', '2022', '2023', '2024', '2025', '2026'], divView = 'holding', divShown = 12, divChart = null;
  function divAgg() {
    var o = { byY: {}, byS: {}, list: [], ttm: 0 };
    TX.forEach(function (t) {
      if (t.del || t.type !== 'div') return;
      var f = FX[t.ccy], usd = t.amt * f, y = t.d.slice(0, 4), s = o.byS[t.sym] || (o.byS[t.sym] = { n: 0, gross: 0, tax: 0, net: 0, ttm: 0, last: '' });
      o.byY[y] = (o.byY[y] || 0) + usd; o.list.push(t);
      s.n++; s.net += usd; s.tax += t.tax * f; s.gross += (t.amt + t.tax) * f; if (t.d > '2025-11-16') { s.ttm += usd; o.ttm += usd; } if (t.d > s.last) s.last = t.d;
    });
    o.list.sort(function (a, b) { return -byDate(a, b); });
    return o;
  }
  function paintDiv(first) {
    var A = divAgg(), vals = YEARS.map(function (y) { return A.byY[y] || 0; }), syms = Object.keys(A.byS).sort(function (a, b) { return A.byS[b].net - A.byS[a].net; }), gross = 0;
    syms.forEach(function (s) { gross += A.byS[s].gross; });
    if (!divChart) divChart = M.bars($('#div-plot'), vals, { labels: YEARS.map(function (y) { return y === '2026' ? '2026 to date' : y; }), values: true, fmt: function (v) { return '$' + fmt(v, 0); }, colors: function (v, i) { return i === YEARS.length - 1 ? M.rgba(M.COL.accent, 0.5) : 'accent'; } });
    else divChart.set(vals);
    $('#div-plot').setAttribute('aria-label', 'Dividends received by year, in US dollars after tax withheld: ' + YEARS.map(function (y, i) { return y + ' ' + money(vals[i]); }).join('; ') + '. 2026 is the year to date.');
    $('#div-kv').innerHTML = '<dt>Received, all time</dt><dd>' + money(SUM.divs) + '</dd><dt>Last 12 months</dt><dd>' + money(A.ttm) + '</dd><dt>Yield on cost, last 12 months</dt><dd>' + (pf.cost ? (A.ttm / pf.cost * 100).toFixed(2) : '0.00') + '%</dd>' +
      '<dt>Before tax</dt><dd>' + money(gross) + '</dd><dt>Tax withheld at source</dt><dd>' + money(SUM.tax) + '</dd><dt>Payments recorded</dt><dd>' + A.list.length + '</dd>' + (syms.length ? '<dt>Largest payer</dt><dd>' + syms[0] + ' · ' + money(A.byS[syms[0]].net) + '</dd>' : '');
    if (divView === 'holding') {
      $('#div-table').innerHTML = '<thead><tr><th scope="col">Holding</th><th scope="col">Payments</th><th scope="col">Before tax</th><th scope="col">Tax withheld</th><th scope="col">Received</th><th scope="col">Last 12 months</th><th scope="col">Yield on cost</th><th scope="col">Last paid</th></tr></thead><tbody>' +
        syms.map(function (s) {
          var d = A.byS[s], h = HOLD[s];
          return '<tr><td>' + M.tk(s, h ? null : { sub: 'Position closed' }) + '</td><td>' + d.n + '</td><td>' + money(d.gross) + '</td><td>' + (d.tax ? money(d.tax) : '<span class="dim">None</span>') + '</td><td>' + money(d.net) + '</td><td>' + money(d.ttm) + '</td><td>' + (h ? (d.ttm / (h.q * h.cost * FX[I[s].c]) * 100).toFixed(2) + '%' : '<span class="dim">—</span>') + '</td><td>' + dstr(d.last) + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td>Total in USD</td><td>' + A.list.length + '</td><td>' + money(gross) + '</td><td>' + money(SUM.tax) + '</td><td>' + money(SUM.divs) + '</td><td>' + money(A.ttm) + '</td><td>' + (pf.cost ? (A.ttm / pf.cost * 100).toFixed(2) : '0.00') + '%</td><td></td></tr></tfoot>';
      $('#div-more').innerHTML = '<span>In US dollars at today’s exchange rates. Yield on cost divides the last 12 months of payments by what the open shares cost.</span>';
    } else {
      $('#div-table').innerHTML = '<thead><tr><th scope="col">Paid</th><th scope="col" class="l">Holding</th><th scope="col">Shares</th><th scope="col">Per share</th><th scope="col">Before tax</th><th scope="col">Tax withheld</th><th scope="col">Received</th><th scope="col">Received (USD)</th></tr></thead><tbody>' +
        A.list.slice(0, divShown).map(function (t) {
          var c = CCY[t.ccy];
          return '<tr><td>' + dstr(t.d) + '</td><td class="l">' + M.tk(t.sym, { name: false }) + '</td><td>' + qf(t.q) + '</td><td>' + c + fmt(t.px, 3) + '</td><td>' + c + fmt(t.amt + t.tax) + '</td><td>' + (t.tax ? c + fmt(t.tax) : '<span class="dim">None</span>') + '</td><td>' + c + fmt(t.amt) + '</td><td>' + money(t.amt * FX[t.ccy], '$', 2) + '</td></tr>';
        }).join('') + '</tbody>';
      $('#div-more').innerHTML = '<span>Showing ' + Math.min(divShown, A.list.length) + ' of ' + A.list.length + ' payments, newest first</span>' + (divShown < A.list.length ? '<button class="btn btn-sm" type="button" data-more>Show 25 more</button>' : '');
    }
    if (first) $('#div-more').addEventListener('click', function (e) { if (e.target.closest('[data-more]')) { divShown += 25; paintDiv(false); } });
  }
  SEGS.dividends = [M.initSeg($('#div-view'), function (v) { divView = v; paintDiv(false); })];

  /* ---------- transactions and their history ---------- */
  var txFilter = 'all', txShown = 15;
  function txById(id) { return TX.filter(function (t) { return t.id === +id; })[0]; }
  function paintTx(first) {
    var rows = TX.filter(function (t) { return !t.del && (txFilter === 'all' || t.type === txFilter); }).sort(function (a, b) { return -byDate(a, b); });
    $('#tx tbody').innerHTML = rows.slice(0, txShown).map(function (t) {
      var c = CCY[t.ccy], trade = t.type === 'buy' || t.type === 'sell', amt = cash(t);
      var note = t.note || (t.type === 'sell' ? 'Realised ' + smoney(t.real, c) + (t.real >= 0 ? ' gain' : ' loss') : t.type === 'div' && t.tax ? 'After ' + c + fmt(t.tax) + ' tax withheld' : t.batch ? 'Import batch ' + t.batch : '');
      return '<tr data-tx="' + t.id + '"><td data-v="' + t.d + '">' + dstr(t.d) + '</td><td class="l"><span class="badge badge-x">' + TYPE[t.type] + '</span></td><td class="l" data-v="' + (t.sym || '') + '">' + (t.sym ? M.tk(t.sym, { name: false }) : '<span class="dim">—</span>') + '</td><td class="l">' + esc(t.acct) + '</td>' +
        '<td data-v="' + (t.type === 'fee' ? 0 : t.q) + '">' + (t.type === 'fee' ? '<span class="dim">—</span>' : qf(t.q)) + '</td><td data-v="' + (t.type === 'fee' ? 0 : t.px) + '">' + (t.type === 'fee' ? '<span class="dim">—</span>' : c + fmt(t.px, t.type === 'div' ? 3 : 2)) + '</td>' +
        '<td>' + (trade ? (t.fees ? c + fmt(t.fees) : '<span class="dim">None</span>') : t.type === 'div' ? (t.tax ? c + fmt(t.tax) + ' tax' : '<span class="dim">None</span>') : '<span class="dim">—</span>') + '</td><td data-v="' + amt.toFixed(2) + '">' + smoney(amt, c, 2) + '</td><td class="l note" title="' + esc(note) + '">' + esc(note) + '</td>' +
        '<td class="act"><button class="rowbtn" type="button" data-edit aria-label="Edit ' + esc(label(t)) + '" title="Edit">' + lic('pencil', 'ic-sm') + '</button><button class="rowbtn" type="button" data-del aria-label="Delete ' + esc(label(t)) + '" title="Delete">' + lic('trash', 'ic-sm') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="10" class="l"><span class="dim">No transactions of this type.</span></td></tr>';
    $$('#tx thead th').forEach(function (th) { th.removeAttribute('aria-sort'); });
    $('#tx-hist').innerHTML = M.icon('clock', 'ic-sm') + '<span>Every create, edit and delete is kept in the history with its before and after values. Nothing is overwritten.</span><button class="linkish" type="button" id="tx-hist-btn">View history (' + REV.length + ' changes)</button>';
    $('#tx-more').innerHTML = '<span>Showing ' + Math.min(txShown, rows.length) + ' of ' + rows.length + ' transactions, newest first. Amounts are in the trade currency.</span>' + (txShown < rows.length ? '<button class="btn btn-sm" type="button" data-more>Show 25 more</button>' : '');
    if (!first) return;
    M.sortable($('#tx'));
    $('#tx-filter').addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return; txFilter = c.dataset.v; txShown = 15;
      $$('#tx-filter .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); }); paintTx(false);
    });
    $('#tx-more').addEventListener('click', function (e) { if (e.target.closest('[data-more]')) { txShown += 25; paintTx(false); } });
    $('#tx-hist').addEventListener('click', function (e) { if (e.target.closest('#tx-hist-btn')) openHist(); });
    $('#tx tbody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-tx]'); if (!tr) return; var t = txById(tr.dataset.tx);
      if (e.target.closest('[data-edit]')) editTx(t);
      else if (e.target.closest('[data-del]')) {
        t.del = true; rev('Deleted', label(t), TYPE[t.type] + ' of ' + smoney(cash(t), CCY[t.ccy], 2) + ' removed from the totals. It can be restored.', t.id);
        rebuild(true); refresh();
        M.toast('Deleted ' + label(t) + '. It stays in the history, where you can restore it.');
      }
    });
  }
  function editTx(t) {
    var c = CCY[t.ccy], F = t.type === 'buy' || t.type === 'sell' ? [['q', 'Quantity', 1, ''], ['px', 'Price (' + t.ccy + ')', 1, c], ['fees', 'Fees (' + t.ccy + ')', 0, c]] : t.type === 'div' ? [['amt', 'Received after tax (' + t.ccy + ')', 1, c], ['tax', 'Tax withheld (' + t.ccy + ')', 0, c]] : [['amt', 'Amount (' + t.ccy + ')', 1, c]];
    var html = '<form class="pf-form" id="tf" novalidate><p class="muted">' + TYPE[t.type] + (t.sym ? ' · ' + esc(t.sym) + ' · ' + esc(I[t.sym].n) : '') + ' · ' + esc(t.acct) + '</p>' +
      fld('Date', '<input class="field" id="tf-d" type="date" value="' + t.d + '" max="' + TODAY + '">') +
      '<div class="two">' + F.map(function (f) { return fld(f[1], '<input class="field" id="tf-' + f[0] + '" inputmode="decimal" autocomplete="off" value="' + (+t[f[0]].toFixed(4)) + '">'); }).join('') + '</div>' +
      fld('Note', '<input class="field" id="tf-note" maxlength="120" autocomplete="off" value="' + esc(t.note) + '">') +
      '<p class="pf-err" id="tf-err" role="alert"></p><p class="band">' + M.icon('clock') + '<span>Saving keeps the values shown now in the history, beside the new ones. Lots, gains and totals are rebuilt from the transactions.</span></p>' +
      '<div class="sheet-f"><button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save changes</button></div></form>';
    M.sheet('Edit transaction', html, function (sh) {
      trapFocus(sh);
      $('#tf', sh).addEventListener('submit', function (e) {
        e.preventDefault();
        var d = $('#tf-d', sh).value || t.d, note = $('#tf-note', sh).value.trim(), ch = [], next = {}, bad = null, was = label(t);
        F.forEach(function (f) { var v = M.parseNum($('#tf-' + f[0], sh).value); if (!isFinite(v) || (f[2] ? v <= 0 : v < 0)) bad = bad || f; next[f[0]] = v; if (Math.abs(v - t[f[0]]) > 1e-9) ch.push(f[1].replace(/ \(.*/, '') + ' ' + f[3] + fmt(t[f[0]]) + ' → ' + f[3] + fmt(v)); });
        if (bad) { $('#tf-err', sh).innerHTML = M.icon('warn', 'ic-sm') + '<span>' + bad[1].replace(/ \(.*/, '') + ' must be a number' + (bad[2] ? ' above zero.' : ', zero or more.') + '</span>'; $('#tf-' + bad[0], sh).focus(); return; }
        if (d > TODAY) { $('#tf-err', sh).innerHTML = M.icon('warn', 'ic-sm') + '<span>The date cannot be after today.</span>'; $('#tf-d', sh).focus(); return; }
        if (d !== t.d) ch.push('Date ' + dstr(t.d) + ' → ' + dstr(d));
        if (note !== t.note) ch.push('Note changed');
        M.closeSheet();
        if (!ch.length) return;
        F.forEach(function (f) { t[f[0]] = next[f[0]]; }); t.d = d; t.note = note; if (t.type === 'div' && t.q) t.px = (t.amt + t.tax) / t.q;
        rev('Edited', was, ch.join('; ')); rebuild(true); refresh();
        M.toast('Saved. The earlier values are in the history.');
      });
    });
  }
  function openHist() {
    M.sheet('Transaction history', '<p class="muted" style="font-size:13px;line-height:18px">Every create, edit and delete is kept with its before and after values. Nothing is overwritten, so any change can be traced or put back.</p><ul class="hist">' +
      REV.map(function (r) {
        var t = r.tx ? txById(r.tx) : null;
        return '<li><div class="top"><span><span class="badge badge-x">' + r.kind + '</span> <b>' + esc(r.what) + '</b></span><span class="when">' + r.at + '</span></div><div class="muted">' + esc(r.detail) + '</div>' + (t && t.del ? '<div><button class="btn btn-sm" type="button" data-restore="' + t.id + '">' + M.icon('replay', 'ic-sm') + 'Restore</button></div>' : '') + '</li>';
      }).join('') + '</ul>', trapFocus);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-restore]'); if (!b) return; var t = txById(b.dataset.restore); if (!t) return;
    t.del = false; rev('Restored', label(t), 'Put back from the history.'); rebuild(true); M.closeSheet(); refresh();
    M.toast('Restored ' + label(t) + '.');
  });

  /* ---------- import (five steps over a sample broker file) and export ---------- */
  var IMP_FILE = 'sample-broker-export.csv', STEPS = ['Upload', 'Preview', 'Map columns', 'Dry run', 'Commit'];
  var FIELDS = [['', 'Ignore this column'], ['date', 'Trade date'], ['type', 'Type'], ['sym', 'Ticker'], ['q', 'Quantity'], ['px', 'Price'], ['fees', 'Fees'], ['amt', 'Amount'], ['ccy', 'Currency'], ['acct', 'Account'], ['note', 'Note']], NEED = ['date', 'type', 'sym', 'q', 'px'];
  var CSV_HEAD = ['Trade Date', 'Action', 'Symbol', 'Description', 'Qty', 'Price', 'Commission', 'Net Amount', 'Ccy', 'Account'];
  function csvRow(d, act, sym, q, px, desc) {
    var it = I[sym], c = it ? it.c : 'USD', fee = COMM[c], p = d.split('-');
    return [p[2] + '/' + p[1] + '/' + p[0], act, sym, desc || it.n.toUpperCase(), String(q), px.toFixed(2), fee.toFixed(2), q === '' ? '' : ((act === 'BUY' ? -1 : 1) * q * px - fee).toFixed(2), c, ACCT[c]];
  }
  function csvOf(t) { return csvRow(t.d, t.type === 'sell' ? 'SELL' : 'BUY', t.sym, t.q, t.px); }
  var CSV_ROWS = [
    csvRow('2026-11-12', 'BUY', 'TSM', 10, 296.20), csvRow('2026-11-02', 'BUY', 'TSM', 20, 289.40), csvRow('2026-11-02', 'BUY', 'AAPL', 10, 224.10),
    csvRow('2026-10-30', 'BUY', 'XXXX', 100, 4.20, 'UNLISTED SECURITY'), csvRow('2026-10-20', 'SELL', 'NVDA', 20, 182.75), csvRow('2026-10-15', 'BUY', '1299.HK', 200, 76.90),
    csvRow('2026-09-23', 'SELL', 'HSBA.L', 500, 9.18), csvRow('2026-09-18', 'BUY', 'COST', '', 912.40), csvRow('2026-09-04', 'BUY', 'SHEL.L', 100, 26.40)
  ].concat(TX.filter(function (t) { return t.type === 'buy' && t.d > '2026-01-01'; }).sort(function (a, b) { return -byDate(a, b); }).map(csvOf));   /* the last three are already in the ledger */
  var imp = { step: 1, file: null, map: ['date', 'type', 'sym', '', 'q', 'px', 'fees', '', 'ccy', 'acct'], res: null, batch: 0, n: 0, next: 4 };
  function dry() {
    var ix = {}; imp.map.forEach(function (f, i) { if (f && ix[f] == null) ix[f] = i; });
    return CSV_ROWS.map(function (r, n) {
      function g(f) { return ix[f] == null ? '' : String(r[ix[f]]).trim(); }
      var o = { row: n + 2, raw: r, type: { BUY: 'buy', SELL: 'sell', DIVIDEND: 'div', FEE: 'fee' }[g('type').toUpperCase()], sym: g('sym').toUpperCase(), q: parseFloat(g('q')), px: parseFloat(g('px')), fees: parseFloat(g('fees')) || 0, amt: Math.abs(parseFloat(g('amt'))), ccy: g('ccy').toUpperCase(), acct: g('acct'), note: g('note') };
      var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(g('date')), it = I[o.sym], trade = o.type === 'buy' || o.type === 'sell';
      o.d = m ? m[3] + '-' + m[2] + '-' + m[1] : '';
      if (it && it.kind === 'stock') o.ccy = it.c;
      if (!o.acct) o.acct = ACCT[o.ccy];
      if (!o.d) o.err = 'The trade date is missing or is not day/month/year.';
      else if (o.d > TODAY) o.err = 'The trade date is after today.';
      else if (!o.type) o.err = 'The type “' + g('type') + '” is not buy, sell, dividend or fee.';
      else if (o.type !== 'fee' && !(it && it.kind === 'stock')) o.err = 'Ticker ' + (o.sym || '(blank)') + ' is not in the directory.';
      else if (trade && !(o.q > 0)) o.err = 'The quantity is missing.';
      else if (trade && !(o.px > 0)) o.err = 'The price is missing.';
      else if (!trade && !(o.amt > 0)) o.err = 'The amount is missing.';
      else if (!FX[o.ccy]) o.err = 'Currency ' + (o.ccy || '(blank)') + ' is not set up.';
      else o.dup = TX.filter(function (t) { return !t.del && t.type === o.type && t.d === o.d && (t.sym || '') === o.sym && (trade ? Math.abs(t.q - o.q) < 1e-6 && Math.abs(t.px - o.px) < 0.006 : Math.abs(t.amt - o.amt) < 0.006); })[0] || null;
      return o;
    });
  }
  function impCount() { var c = { fresh: 0, dup: 0, err: 0 }; (imp.res || []).forEach(function (o) { if (o.err) c.err++; else if (o.dup) c.dup++; else c.fresh++; }); return c; }
  function missing() { return NEED.filter(function (f) { return imp.map.indexOf(f) < 0; }).map(function (f) { return FIELDS.filter(function (x) { return x[0] === f; })[0][1]; }); }
  function rawTable(rows, cls) { return '<div class="dt-wrap"><table class="dt imp-raw ' + (cls || '') + '"><thead><tr><th scope="col">Row</th>' + CSV_HEAD.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r, i) { return '<tr><td>' + (i + 2) + '</td>' + r.map(function (x) { return '<td>' + (x === '' ? '<span class="dim">(blank)</span>' : esc(x)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  var STEP = {
    1: function () {
      return '<h3 tabindex="-1">Choose the file your broker exported</h3>' + (imp.file
        ? '<div class="imp-file">' + M.icon('doc') + '<div><b>' + esc(imp.file) + '</b><small>' + CSV_ROWS.length + ' rows · 1.1 KB · checksum 9f2c…41ab' + (imp.file !== IMP_FILE ? ' · the mockup reads its built-in sample rows whichever file you choose' : '') + '</small></div><button class="btn btn-sm btn-quiet" type="button" data-imp="clear">Remove</button></div>'
        : '<div class="dropzone" id="imp-drop">' + lic('upload') + '<p><b>Drop a CSV file here</b>The file is read on this computer and is not uploaded anywhere.</p><div class="dz-a"><label class="btn"><input class="sr" type="file" accept=".csv,text/csv" id="imp-pick">Choose a file</label><button class="btn btn-primary" type="button" data-imp="sample">Use the sample file</button></div></div>') +
        '<p>A CSV with one header row. The checksum stops the same file being imported twice by accident.</p>';
    },
    2: function () {
      return '<h3 tabindex="-1">Preview</h3><div class="imp-facts"><span class="badge">Comma separated</span><span class="badge">UTF-8</span><span class="badge">Header in row 1</span><span class="badge">Dates as day/month/year</span><span class="badge">' + CSV_ROWS.length + ' data rows</span></div>' +
        rawTable(CSV_ROWS.slice(0, 6)) + '<p>The first 6 of ' + CSV_ROWS.length + ' rows, exactly as they are in the file. Nothing has been interpreted yet.</p>';
    },
    3: function () {
      var miss = missing();
      return '<h3 tabindex="-1">Map the columns</h3><p>The header row matches the saved profile “Sample broker”, so the columns are filled in. Change any that are wrong.</p>' +
        '<div class="dt-wrap"><table class="dt imp-raw imp-map"><thead><tr><th scope="col">Column in the file</th><th scope="col">First value</th><th scope="col">Goes to</th></tr></thead><tbody>' +
        CSV_HEAD.map(function (h, i) { return '<tr><td><b>' + h + '</b></td><td class="muted">' + esc(CSV_ROWS[0][i]) + '</td><td><select class="select" data-map="' + i + '" aria-label="Field for the column ' + h + '">' + FIELDS.map(function (f) { return '<option value="' + f[0] + '"' + (imp.map[i] === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></td></tr>'; }).join('') + '</tbody></table></div>' +
        (miss.length ? '<div class="imp-need" role="alert">' + M.icon('warn', 'ic-sm') + '<span>Map these before the dry run: ' + miss.join(', ') + '.</span></div>' : '<p>Trade date, type, ticker, quantity and price are all mapped. Net Amount is ignored because it is recomputed from quantity, price and fees.</p>');
    },
    4: function () {
      var c = impCount();
      return '<h3 tabindex="-1">Dry run</h3><p>Every row was checked against the ledger. Nothing has been written yet.</p>' +
        '<div class="imp-counts"><div class="imp-count"><b>' + c.fresh + '</b><span>New rows to add</span></div><div class="imp-count"><b>' + c.dup + '</b><span>Duplicates, skipped</span></div><div class="imp-count"><b>' + c.err + '</b><span>Rows with errors, left out</span></div></div>' +
        '<div class="dt-wrap"><table class="dt imp-raw"><thead><tr><th scope="col">Row</th><th scope="col">Result</th><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Ticker</th><th scope="col">Quantity</th><th scope="col">Price</th><th scope="col">What will happen</th></tr></thead><tbody>' +
        imp.res.map(function (o) {
          var st = o.err ? '<span class="badge badge-warn">Error</span>' : o.dup ? '<span class="badge">Duplicate</span>' : '<span class="badge badge-accent">New</span>';
          var what = o.err ? o.err : o.dup ? 'Already recorded on ' + dstr(o.dup.d) + '. Skipped.' : o.type === 'buy' ? (HOLD[o.sym] ? 'Adds a lot to ' + o.sym + '.' : 'Opens a new holding in ' + o.sym + '.') : o.type === 'sell' ? 'Sells from the oldest lot of ' + o.sym + ' and books the realised gain.' : 'Adds a ' + TYPE[o.type].toLowerCase() + '.';
          return '<tr' + (o.err ? ' class="r-err"' : '') + '><td>' + o.row + '</td><td>' + st + '</td><td>' + (o.d ? dstr(o.d) : '<span class="dim">(blank)</span>') + '</td><td>' + (o.type ? TYPE[o.type] : '<span class="dim">?</span>') + '</td><td>' + esc(o.sym || '—') + '</td><td>' + (o.q > 0 ? qf(o.q) : '<span class="dim">(blank)</span>') + '</td><td>' + (o.px > 0 ? fmt(o.px) : '<span class="dim">(blank)</span>') + '</td><td>' + esc(what) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    },
    5: function () {
      var c = impCount(), fresh = imp.res.filter(function (o) { return !o.err && !o.dup; }), syms = {};
      fresh.forEach(function (o) { if (o.sym) syms[o.sym] = 1; });
      if (imp.batch) return '<h3 tabindex="-1">Batch ' + imp.batch + ' is committed</h3><div class="band accent">' + lic('check') + '<span><b>' + imp.n + ' transactions were added as one batch.</b> Holdings, totals, dividends and performance are rebuilt. Undo removes all ' + imp.n + ' again and nothing else.</span></div>' +
        '<p>Holdings touched: ' + Object.keys(syms).join(', ') + '. The import is in the history as a single entry.</p>';
      return '<h3 tabindex="-1">Commit as one batch</h3><p><b>' + c.fresh + ' new rows</b> will be added as batch ' + imp.next + '. ' + c.dup + ' duplicates are skipped and ' + c.err + ' rows with errors are left out: correct them in the file and import it again, and only they will be new.</p>' +
        '<dl class="kv"><dt>File</dt><dd>' + esc(imp.file) + '</dd><dt>Holdings touched</dt><dd>' + Object.keys(syms).join(', ') + '</dd><dt>Mapping profile</dt><dd>Sample broker, saved on commit</dd><dt>Can be undone</dt><dd>Yes, as a whole</dd></dl>';
    }
  };
  function paintImp(first, dir) {
    var host = $('#imp'), s = imp.step;
    if (s === 4 || (s === 5 && !imp.batch && !imp.res)) imp.res = dry();
    var c = impCount(), nav = '';
    if (s === 1) nav = '<button class="btn btn-primary" type="button" data-imp="next"' + (imp.file ? '' : ' disabled') + '>Preview</button>';
    else if (s === 2) nav = '<button class="btn" type="button" data-imp="back">Back</button><button class="btn btn-primary" type="button" data-imp="next">Map columns</button>';
    else if (s === 3) nav = '<button class="btn" type="button" data-imp="back">Back</button><button class="btn btn-primary" type="button" data-imp="next"' + (missing().length ? ' disabled' : '') + '>Run the dry run</button>';
    else if (s === 4) nav = '<button class="btn" type="button" data-imp="back">Back</button><button class="btn btn-primary" type="button" data-imp="next"' + (c.fresh ? '' : ' disabled') + '>Review and commit</button>';
    else if (!imp.batch) nav = '<button class="btn" type="button" data-imp="back">Back</button><button class="btn btn-primary" type="button" data-imp="commit">Commit ' + c.fresh + ' rows as one batch</button>';
    else nav = '<button class="btn" type="button" data-imp="undo">' + M.icon('replay', 'ic-sm') + 'Undo this batch</button><button class="btn" type="button" data-goto="holdings">See the holdings</button><button class="btn btn-primary" type="button" data-imp="again">Import another file</button>';
    host.innerHTML = '<ol class="steps" aria-label="Import steps">' + STEPS.map(function (n, i) { var done = i + 1 < s || (s === 5 && imp.batch); return '<li class="' + (done ? 'done' : i + 1 === s ? 'now' : '') + '"' + (i + 1 === s ? ' aria-current="step"' : '') + '><span class="st-n">' + (done ? lic('check', 'ic-sm') : i + 1) + '</span><span>' + n + '</span></li>'; }).join('') + '</ol>' +
      '<div class="imp-body">' + STEP[s]() + '</div><div class="imp-nav">' + nav + '</div>';
    if (dir) { var b = $('.imp-body', host), h = $('h3', b); b.classList.add(dir > 0 ? 'pre-r' : 'pre-l'); void b.offsetWidth; b.classList.remove('pre-r', 'pre-l'); if (h) h.focus({ preventScroll: true }); }
    if (!first) return;
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-imp]'); if (!b || b.disabled) return; var a = b.dataset.imp;
      if (a === 'sample') { imp.file = IMP_FILE; paintImp(false, 1); }
      else if (a === 'clear') { imp.file = null; paintImp(false); }
      else if (a === 'next') { imp.step++; if (imp.step === 4) imp.res = dry(); paintImp(false, 1); }
      else if (a === 'back') { imp.step--; paintImp(false, -1); }
      else if (a === 'again') { imp = { step: 1, file: null, map: imp.map, res: null, batch: 0, n: 0, next: imp.next }; paintImp(false, -1); }
      else if (a === 'commit') {
        var rows = imp.res.filter(function (o) { return !o.err && !o.dup; }), bt = imp.next++;
        rows.forEach(function (o) { addTx({ d: o.d, type: o.type, sym: o.sym || null, q: o.q, px: o.px, fees: o.fees, amt: o.amt, ccy: o.ccy, acct: o.acct, note: o.note, batch: bt }); });
        imp.batch = bt; imp.n = rows.length;
        rev('Imported', 'Batch ' + bt + ' · ' + rows.length + ' rows', imp.file + ', committed as one batch');
        rebuild(true); refresh();
        M.toast('Batch ' + bt + ' committed: ' + rows.length + ' transactions added. You can undo it as a whole.');
      } else if (a === 'undo') {
        var gone = imp.batch, cnt = imp.n;
        TX = TX.filter(function (t) { return t.batch !== gone; });
        rev('Undone', 'Batch ' + gone, cnt + ' imported rows removed again');
        imp.batch = 0; imp.n = 0; imp.step = 4; rebuild(true); refresh();
        M.toast('Batch ' + gone + ' undone: ' + cnt + ' transactions removed.');
      }
    });
    host.addEventListener('change', function (e) {
      var m = e.target.closest('[data-map]'), f = e.target.closest('#imp-pick');
      if (m) { imp.map[+m.dataset.map] = m.value; paintImp(false); var again = $('[data-map="' + m.dataset.map + '"]', host); if (again) again.focus(); }
      else if (f && f.files && f.files[0]) { imp.file = f.files[0].name; paintImp(false, 1); }
    });
    host.addEventListener('dragover', function (e) { var z = e.target.closest('.dropzone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
    host.addEventListener('dragleave', function (e) { var z = e.target.closest('.dropzone'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
    host.addEventListener('drop', function (e) { var z = e.target.closest('.dropzone'); if (!z) return; e.preventDefault(); var fl = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; imp.file = fl ? fl.name : IMP_FILE; paintImp(false, 1); });
  }
  $('#imp-note').innerHTML = lic('lock') + '<span>Files are read on this computer and are never uploaded. An import is one batch: it can be undone as a whole, and every row it adds appears in the history.</span>';
  var EXPORTS = [['holdings', 'Holdings', 'Open positions with cost, value and gain'], ['transactions', 'Transactions', 'The whole ledger, in the columns the import reads'], ['dividends', 'Dividends', 'Every payment with the tax withheld'], ['values', 'Daily values', 'Portfolio and benchmark for the last 30 days']];
  $('#exp').innerHTML = EXPORTS.map(function (x) { return '<li><div><b>' + x[1] + '</b><small>' + x[2] + '</small></div><button class="btn btn-sm" type="button" data-exp="' + x[0] + '" aria-label="Download ' + x[1].toLowerCase() + ' as CSV">' + M.icon('download', 'ic-sm') + 'CSV</button></li>'; }).join('');
  $('#exp').addEventListener('click', function (e) {
    var b = e.target.closest('[data-exp]'); if (!b) return; var k = b.dataset.exp, live = TX.filter(function (t) { return !t.del; }).sort(function (a, c) { return -byDate(a, c); });
    function dmy(d) { var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
    if (k === 'holdings') download('holdings-sample.csv', holdingsCsv(Object.keys(HOLD)));
    else if (k === 'transactions') download('transactions-sample.csv', [CSV_HEAD].concat(live.map(function (t) { return [dmy(t.d), { buy: 'BUY', sell: 'SELL', div: 'DIVIDEND', fee: 'FEE' }[t.type], t.sym || '', t.sym ? I[t.sym].n.toUpperCase() : t.note.toUpperCase(), t.type === 'fee' ? '' : t.q, t.type === 'fee' ? '' : t.px.toFixed(t.type === 'div' ? 3 : 2), t.fees.toFixed(2), cash(t).toFixed(2), t.ccy, t.acct]; })));
    else if (k === 'dividends') download('dividends-sample.csv', [['Paid', 'Ticker', 'Shares', 'Per share', 'Before tax', 'Tax withheld', 'Received', 'Currency']].concat(live.filter(function (t) { return t.type === 'div'; }).map(function (t) { return [dmy(t.d), t.sym, t.q, t.px.toFixed(3), (t.amt + t.tax).toFixed(2), t.tax.toFixed(2), t.amt.toFixed(2), t.ccy]; })));
    else {
      var md = PM || model(), bp = benchPath(benchKey), st = stats(md, bp, N - 30), rows = [['Date', 'Portfolio value (USD)', 'Same cash flows in ' + I[benchKey].n + ' (USD)', I[benchKey].n + ' (30 days ago = 100)']], i;
      for (i = 0; i <= 30; i++) rows.push([dateAt(N - 30 + i, 0), md.v[N - 30 + i].toFixed(2), st.hb[i].toFixed(2), (bp[N - 30 + i] / bp[N - 30] * 100).toFixed(2)]);
      download('daily-values-sample.csv', rows);
    }
  });

  /* ---------- live ticks ---------- */
  M.onTick(function (it) {
    if (!HOLD[it.id]) return;
    var before = pf.total; pf = M.portfolio();
    total.set(fmt(pf.total, 2), pf.total > before ? 1 : -1); paintSum();
    Object.keys(HOLD).forEach(function (id) { paintRow(id, true); });   /* every weight moves with the total */
    paintFoot(); paintBulk();
  });

  /* ---------- deep links: #tab and ?add=TICKER ---------- */
  var hash = location.hash.slice(1), add = new URLSearchParams(location.search).get('add');
  if (hash && (PAINT[hash] || hash === 'holdings')) tabs.select(hash, false);
  if (add != null) setTimeout(function () { openAdd(add.trim().toUpperCase()); }, 250);
})();
