/* Market Lens mockup: event mind map, the dashboard around the map: the status line, layer tabs, the key and the More
   menu. It reads and steers the map through ML.mmCore and follows it through the mm:change event. All data is invented. */
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

  /* ---------- follow the map ---------- */
  document.addEventListener('mm:change', function (e) {
    if (e.detail === 'graph') { counts(); tabs.select('', false); }
    status();
  });
})();
