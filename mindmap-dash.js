/* Market Lens mockup: event mind map, the dashboard around the map: the status line, layer tabs, the key, the More menu
   and the sidebar. It reads and steers the map through ML.mmCore and follows it through the mm:change event. All data is
   invented. */
(function () {
  'use strict';
  var M = window.ML, $ = M.$, $$ = M.$$, core = M.mmCore;
  if (!core) return;
  var store = {
    get: function (k) { try { return localStorage.getItem('ml-mm-' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('ml-mm-' + k, v); } catch (e) { /* private window: not remembered */ } }
  };
  var phone = window.matchMedia('(max-width: 767px)');

  /* ---------- status line: how fresh the sample data is, what is on show, and whether the US market is open ---------- */
  var opened = Date.now(), FRESH = 3;   /* the sample data was last refreshed this many minutes before the page opened */
  /* New York Stock Exchange regular hours, 9:30 to 16:00 Monday to Friday in New York time. Holidays are not known here */
  function nyseOpen(d) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    var m = (+p.hour % 24) * 60 + (+p.minute);
    return p.weekday !== 'Sat' && p.weekday !== 'Sun' && m >= 570 && m < 960;
  }
  function onShow(n) { return n.al > 0.5 && n.dimT > 0.05; }
  var lastStatus = '';
  function status() {
    var ev = core.nodes.filter(function (n) { return n.type === 'event' && onShow(n); }).length, src = {};
    core.nodes.forEach(function (n) { if (n.sources && onShow(n)) n.sources.forEach(function (s) { src[s[0]] = 1; }); });
    var mins = FRESH + Math.floor((Date.now() - opened) / 60000), open = nyseOpen(new Date()), ns = Object.keys(src).length;
    var html = 'Updated ' + mins + ' min ago · ' + ev + (ev === 1 ? ' event' : ' events') + ' · ' + ns + (ns === 1 ? ' source' : ' sources') +
      ' · <span class="mk' + (open ? ' open' : '') + '"><i aria-hidden="true"></i>US market ' + (open ? 'open' : 'closed') + '</span>';
    if (html !== lastStatus) { $('#mm-status').innerHTML = lastStatus = html; }
  }
  setInterval(status, 1000); status();

  /* ---------- layer tabs ---------- */
  var tabBox = $('#mm-layers');
  function counts() {
    $$('.tab[data-v]', tabBox).forEach(function (t) {
      var v = t.dataset.v, n = v ? core.nodes.filter(function (x) { return x.layer.indexOf(v) >= 0; }).length : 0, c = $('.ct', t);
      if (!v) return;
      if (!c) c = t.appendChild(M.el('span', 'ct'));
      c.textContent = n; t.setAttribute('aria-label', t.firstChild.textContent + ', ' + n + (n === 1 ? ' node' : ' nodes'));
    });
  }
  counts();
  var tabs = M.initTabs(tabBox, function (v) { core.setLayer(v); });
  tabs.place(false);

  /* ---------- the key: open by default on a wide screen, folded on a phone, and remembered ---------- */
  var keyB = $('#mm-key-b'), keyList = $('#mm-legend');
  function setKey(open, save) {
    keyB.setAttribute('aria-expanded', open); keyList.hidden = !open; $('#mm-key').classList.toggle('closed', !open);
    if (save) store.set('key', open ? '1' : '0');
  }
  var savedKey = store.get('key');
  setKey(savedKey ? savedKey === '1' : !phone.matches, false);
  keyB.addEventListener('click', function () { setKey(keyB.getAttribute('aria-expanded') !== 'true', true); });

  /* ---------- More menu: the less used actions. A plain disclosure: Escape or a click elsewhere closes it ---------- */
  var more = $('#mm-more'), menu = $('#mm-menu');
  function place() { var r = more.getBoundingClientRect(); menu.style.top = Math.round(r.bottom + 8) + 'px'; menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px'; }
  function openMenu(on, focus) {
    menu.hidden = !on; more.setAttribute('aria-expanded', on);
    if (on) { place(); if (focus) { var f = $$('.btn', menu).filter(function (b) { return !b.hidden && !b.disabled; })[0]; if (f) f.focus(); } }
    else if (focus) more.focus();
  }
  more.addEventListener('click', function () { openMenu(menu.hidden, false); });
  more.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(true, true); } });
  menu.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); openMenu(false, true); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var bs = $$('.btn', menu).filter(function (b) { return !b.hidden && !b.disabled; }), i = bs.indexOf(document.activeElement);
    e.preventDefault(); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
  });
  /* an action closes the menu; a switch (it has aria-pressed) leaves it open so its new state can be seen */
  menu.addEventListener('click', function (e) { var b = e.target.closest('.btn'); if (b && !b.hasAttribute('aria-pressed')) openMenu(false, false); });
  document.addEventListener('pointerdown', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== more && !more.contains(e.target)) openMenu(false, false); });
  window.addEventListener('resize', function () { if (!menu.hidden) place(); });

  /* ---------- sidebar: what is moving now, and the events on the map ---------- */
  var esc = M.esc, side = $('#mm-side'), sideIn = $('#mm-side-in'), sideBtn = $('#mm-side-btn'), grip = $('#mm-grip'), stage = core.stage;
  var STATUS = [['developing', 'Developing'], ['active', 'Active'], ['fading', 'Fading'], ['priced', 'Priced in']];
  var F = { q: '', st: {}, sort: 'impact' };
  /* sample ages count on from when the page opened, like the status line */
  function since() { return Math.floor((Date.now() - opened) / 60000); }
  function newest(n) { return n.sources && n.sources.length ? n.sources.reduce(function (a, s) { return s[1] < a[1] ? s : a; }) : null; }
  function ago(m) { m += since(); return m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago'; }
  function outlets(n) { var st = core.STORY[n.id]; return st ? st[0][1] : (n.sources || []).length; }
  /* a rough region from where the node sits; factors and sectors float above the globe and count as global */
  function region(n) {
    var a = n.lat, o = n.lng;
    if (!isFinite(a)) return 'Global';
    if (a > 12 && a < 42 && o > 34 && o < 63) return 'Middle East';
    if (a > 34 && a < 72 && o > -25 && o < 45) return 'Europe';
    if (a > 14 && a < 72 && o > -170 && o < -50) return 'North America';
    if (a > -12 && a < 56 && o > 95 && o < 150) return 'Asia-Pacific';
    if (a > -50 && a < 14 && o > -90 && o < -30) return 'South America';
    return 'Global';
  }
  /* what the map shows: the timeline, folded nodes, the layer tab and the holding filter all count */
  function shown(n) { return n.day <= core.tl + 0.001 && !n.hideTo && n.dimT > 0.05; }
  function holdChips(hits) {
    return hits.length ? '<div class="mm-chips">' + hits.map(function (x) { var h = x.h; return '<button class="chip" type="button" data-id="' + h.id + '" aria-label="Open ' + esc(h.label) + '">' + esc(h.sym || h.label) + '</button>'; }).join('') + '</div>' : '';
  }
  function renderNow() {
    var list = core.nodes.filter(function (n) { return n.headline && shown(n); }).sort(function (a, b) { return newest(a)[1] - newest(b)[1]; }).slice(0, 6);
    $('#mm-now').innerHTML = list.length ? list.map(function (n) {
      var s = newest(n), o = outlets(n);
      return '<article class="mm-card"><button class="mm-hl" type="button" data-id="' + n.id + '">' + esc(n.headline) + '</button>' +
        '<div class="mm-meta">' + esc(s[0]) + ' · ' + ago(s[1]) + ' · ' + o + (o === 1 ? ' outlet' : ' outlets') + ' · ' + region(n) + '</div>' + holdChips(reach(n)) + '</article>';
    }).join('') : '<p class="mm-empty">Nothing on the map has fresh coverage. Try another layer or a later date.</p>';
  }
  /* the holdings a node reaches only change with the graph, so they are worked out once per graph */
  var rc = {};
  function reach(n) { return rc[n.id] || (rc[n.id] = core.reaches(n)); }
  function expo(n) { return reach(n).reduce(function (a, x) { return a + (x.h.w || 0); }, 0); }
  function matches(n) { var q = F.q; return !q || [n.label, n.place, n.headline].some(function (t) { return t && t.toLowerCase().indexOf(q) >= 0; }); }
  function renderEvents() {
    var base = core.nodes.filter(function (n) { return n.type === 'event' && shown(n) && matches(n); }), any = Object.keys(F.st).some(function (k) { return F.st[k]; });
    $('#mm-st').innerHTML = STATUS.map(function (s) {
      var c = base.filter(function (n) { return n.status === s[0]; }).length;
      return '<button class="chip st-' + s[0] + '" type="button" data-st="' + s[0] + '" aria-pressed="' + !!F.st[s[0]] + '">' + s[1] + ' <span class="ct">' + c + '</span></button>';
    }).join('');
    var list = base.filter(function (n) { return !any || F.st[n.status]; }).map(function (n) { return { n: n, x: expo(n), r: newest(n) ? newest(n)[1] : 1e9 }; });
    list.sort(F.sort === 'recent' ? function (a, b) { return a.r - b.r; } : F.sort === 'expo' ? function (a, b) { return b.x - a.x; } : function (a, b) { return (b.n.impact || 0) - (a.n.impact || 0); });
    $('#mm-ev-n').textContent = list.length;
    $('#mm-evs').innerHTML = list.length ? list.map(function (e) {
      var n = e.n, st = STATUS.filter(function (s) { return s[0] === n.status; })[0], imp = Math.round((n.impact || 0) * 100);
      return '<article class="mm-card mm-evc"><div class="mm-evc-1"><button class="mm-hl" type="button" data-id="' + n.id + '">' + esc(n.label) + '</button>' +
        (st ? '<span class="badge st-' + st[0] + '">' + st[1] + '</span>' : '') + '</div>' +
        '<div class="mm-meta">' + esc(n.place || 'Global') + ' · first seen ' + core.dateOf(n.day) + '</div>' +
        '<div class="mm-imp"><span>Impact</span><span class="meter" aria-hidden="true"><i style="--v:' + imp + '%"></i></span><b>' + imp + '</b></div>' +
        '<div class="mm-meta">Portfolio exposure ' + e.x.toFixed(1) + '%</div></article>';
    }).join('') : '<p class="mm-empty">No events match. Clear the search or the status filter.</p>';
  }
  var pending = 0;
  function renderSide() { if (pending) return; pending = requestAnimationFrame(function () { pending = 0; renderNow(); renderEvents(); }); }
  renderSide();
  /* a card or chip opens its node: the globe flies there and the details open over the lists */
  sideIn.addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (b) { core.choose(core.byId[b.dataset.id], true, b); return; }
    var c = e.target.closest('[data-st]'); if (c) { F.st[c.dataset.st] = !F.st[c.dataset.st]; renderEvents(); var f = $('[data-st="' + c.dataset.st + '"]', sideIn); if (f) f.focus(); }
  });
  $('#mm-q').addEventListener('input', function () { F.q = this.value.trim().toLowerCase(); renderEvents(); $('#mm-live').textContent = $('#mm-ev-n').textContent + ' events match.'; });
  $('#mm-sort').addEventListener('change', function () { F.sort = this.value; renderEvents(); });
  setInterval(renderNow, 60000);   /* ages move on */

  /* width: dragged by the grip or set with the arrow keys, kept between visits; hidden down to a slim rail */
  var MINW = 288, MAXW = 560;
  function setWidth(w, save) {
    w = Math.max(MINW, Math.min(MAXW, Math.round(w))); stage.style.setProperty('--side-w', w + 'px'); grip.setAttribute('aria-valuenow', w);
    if (save) store.set('side-w', w);
  }
  setWidth(+store.get('side-w') || 360, false);
  grip.addEventListener('pointerdown', function (e) {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); stage.classList.add('resizing');
    var x0 = e.clientX, w0 = side.getBoundingClientRect().width;
    function move(ev) { setWidth(w0 + x0 - ev.clientX, false); }
    function up(ev) { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); stage.classList.remove('resizing'); setWidth(w0 + x0 - ev.clientX, true); }
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('keydown', function (e) {
    var w = +grip.getAttribute('aria-valuenow'), d = e.key === 'ArrowLeft' ? 24 : e.key === 'ArrowRight' ? -24 : 0;
    if (e.key === 'Home') d = MAXW - w; else if (e.key === 'End') d = MINW - w;
    if (d) { e.preventDefault(); setWidth(w + d, true); }
  });
  /* on a wide screen the sidebar folds to a rail; on a phone it is a sheet that opens up from a peek bar */
  function isOpen() { return phone.matches ? stage.classList.contains('sheet-open') : !stage.classList.contains('side-closed'); }
  function setOpen(open, save) {
    if (phone.matches) stage.classList.toggle('sheet-open', open); else stage.classList.toggle('side-closed', !open);
    sideBtn.setAttribute('aria-expanded', open);
    sideBtn.setAttribute('aria-label', open ? (phone.matches ? 'Close news and events' : 'Hide the sidebar') : 'Show news and events');
    sideBtn.innerHTML = M.icon('right'); sideBtn.dataset.dir = phone.matches ? (open ? 'down' : 'up') : open ? 'right' : 'left';
    if (save && !phone.matches) store.set('side', open ? '1' : '0');
  }
  setOpen(phone.matches ? false : store.get('side') !== '0', false);
  sideBtn.addEventListener('click', function () { setOpen(!isOpen(), true); });
  if (phone.addEventListener) phone.addEventListener('change', function () { stage.classList.remove('sheet-open', 'side-closed'); setOpen(phone.matches ? false : store.get('side') !== '0', false); });

  /* ---------- follow the map ---------- */
  document.addEventListener('mm:change', function (e) {
    if (e.detail === 'graph') { rc = {}; counts(); tabs.select('', false); }
    /* a node's details open in the sidebar, so a hidden sidebar comes back for them */
    if (e.detail === 'sel' && core.sel && !phone.matches && !isOpen()) setOpen(true, false);
    if (e.detail !== 'sel') renderSide();
    status();
  });
})();
