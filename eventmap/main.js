/* Event Map: start-up and wiring. Loads and checks the data, lays it out, keeps one store of the selection and filters,
   and mounts either the sphere or the timeline (disposing the other). The sphere module, and through it three.js, is
   imported only when the sphere is shown, so a blocked CDN or missing WebGL falls back to the timeline. */
import { load, normalise, validate, CATEGORIES, CAT_KEYS } from './data.js';
import { buildGraph, nodeMask, linkMask, highlight } from './graph.js';
import { layout } from './layout.js';
import { createStore } from './store.js';
import { createPanel, initSheet, fmtDate } from './panel.js';
import { createControls } from './controls.js';
import { createEventList } from './a11y.js';
import { loadSampleMoves } from './holdings.js';
import { stressData } from './stress.js';

const ML = window.ML;
ML.shell('Event Map');
const foot = document.querySelector('.foot span:last-child');
if (foot) foot.textContent = 'Event Map: events, dates, market moves and sources are real and cited. "Your holdings touched" moves are sample numbers, as is everything else in this mockup.';

const params = new URLSearchParams(location.search);
const STRESS = params.get('stress') === '1';
const DEBUG = params.get('debug') === '1' || STRESS;
const $ = (s) => document.querySelector(s);
const stage = $('#em-stage'), mapHost = $('#em-map'), note = $('#em-note'), tipEl = $('#em-tip');

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function showNote(html) { note.innerHTML = html; note.hidden = false; }

function colors() {
  const cs = getComputedStyle(stage), v = (k) => cs.getPropertyValue('--em-' + k).trim();
  return {
    cats: CAT_KEYS.map((k) => v('cat-' + k)), up: v('up'), down: v('down'), grid: v('grid'), divider: v('divider'),
    body: v('body'), rim: v('rim'), edge: v('edge'), text: v('text')
  };
}

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

async function start() {
  let data;
  try {
    if (STRESS) {
      const raw = stressData();
      const w = validate(raw.events, raw.links);
      w.forEach((x) => console.warn('[event map data] ' + x));
      data = { ...normalise(raw.events, raw.links), warnings: w };
    } else data = await load('data/');
  } catch (err) {
    $('#em-loading').textContent = 'The event data could not be loaded.';
    showNote('The event data could not be loaded (' + esc(err.message) + '). This page has to be opened through a web server, not straight from disk: see the README.');
    return;
  }
  const moves = STRESS ? {} : await loadSampleMoves();
  const graph = buildGraph(data.events, data.links);
  const lay = layout(graph.nodes);
  const all = new Uint8Array(graph.nodes.length).fill(1);
  const store = createStore({ sel: -1, hover: -1, cats: null, region: '', view: params.get('view') === 'timeline' ? 'timeline' : 'sphere', nodeVis: all, linkVis: linkMask(graph, all), hl: null });

  function update(patch) {
    const s = { ...store.get(), ...patch };
    if ('cats' in patch || 'region' in patch) {
      s.nodeVis = nodeMask(graph, s);
      s.linkVis = linkMask(graph, s.nodeVis);
      if (s.sel >= 0 && !s.nodeVis[s.sel]) s.sel = -1;
      if (s.hover >= 0 && !s.nodeVis[s.hover]) s.hover = -1;
    }
    if ('sel' in patch || 'cats' in patch || 'region' in patch) s.hl = s.sel >= 0 ? highlight(graph, s.sel, s.nodeVis) : null;
    store.set(s);
  }

  /* ---------- the edge tooltip, shared by both views ---------- */
  const tip = {
    show(l, x, y) {
      const a = graph.nodes[l.s], b = graph.nodes[l.t];
      tipEl.innerHTML = '<div class="em-tip-h"><span>' + esc(a.title) + '</span><span class="em-tip-arrow" aria-hidden="true">→</span><span>' + esc(b.title) + '</span></div>' +
        '<p><span class="em-type" data-type="' + l.type + '">' + (l.type === 'direct' ? 'Direct' : 'Contributing') + '</span>' + esc(l.mechanism) + '</p>';
      tipEl.hidden = false;
      this.move(x, y);
    },
    move(x, y) {
      const r = tipEl.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
      tipEl.style.left = Math.max(8, Math.min(W - r.width - 8, x + 14)) + 'px';
      tipEl.style.top = Math.max(8, Math.min(H - r.height - 8, y + 16)) + 'px';
    },
    hide() { tipEl.hidden = true; }
  };

  /* ---------- panel, sheet, controls, list ---------- */
  const mqPhone = window.matchMedia('(max-width: 720px)');
  const panel = createPanel($('#em-panel'), { graph, store, onSelect: (i, o) => select(i, o), moves });
  let view = null, viewName = '', token = 0, lastDisposal = null, sheetCover = 0;
  const sheet = initSheet($('#em-panel'), $('#em-grab'), mqPhone, (snap, px) => { sheetCover = snap === 'full' ? 0 : px; if (view && view.setInset) view.setInset(sheetCover); });
  const controls = createControls($('#em-toolbar'), { graph, store, onSelect: (i, o) => select(i, o), onFilter: (p) => update(p), onView: (v) => setView(v), onReset: reset });
  const list = createEventList($('#em-list'), $('#em-live'), { graph, onSelect: (i, o) => select(i, o) });

  /* ---------- views ---------- */
  const ctxBase = { graph, lay, categories: CATEGORIES, rm: () => ML.rm(), compact: () => ML.compact(), tip,
    onSelect: (i) => select(i, { from: 'view' }), onHover: (i) => { if (i !== store.get().hover) update({ hover: i }); } };
  const pick = (s) => ({ nodeVis: s.nodeVis, linkVis: s.linkVis, sel: s.sel, hover: s.hover, hl: s.hl });

  async function setView(v) {
    if (v === viewName && view) return;
    const my = ++token;
    if (view) { lastDisposal = { from: viewName, memory: view.unmount() }; view = null; }
    viewName = v;
    stage.dataset.view = v;
    store.set({ view: v });
    const url = new URL(location.href);
    if (v === 'timeline') url.searchParams.set('view', 'timeline'); else url.searchParams.delete('view');
    history.replaceState(null, '', url);
    $('#em-loading').classList.remove('off');
    try {
      let next;
      if (v === 'sphere') {
        if (!webgl()) throw Object.assign(new Error('no WebGL'), { code: 'webgl' });
        const mod = await import('./sphere.js').catch((e) => { throw Object.assign(new Error(e.message), { code: 'cdn' }); });
        if (my !== token) return;
        next = mod.mountSphere(mapHost, { ...ctxBase, colors: colors(), onTier, onFps, onLost: () => { showNote('The graphics context was lost, so the timeline is shown instead.'); setView('timeline'); } });
      } else {
        const mod = await import('./timeline.js');
        next = await mod.mountTimeline(mapHost, { ...ctxBase, colors: colors() });
        if (my !== token) { next.unmount(); return; }
      }
      view = next;
      view.update(pick(store.get()));
      if (view.setInset) view.setInset(sheetCover);
      if (store.get().sel >= 0) view.focus(store.get().sel, false);
      $('#em-loading').classList.add('off');
    } catch (err) {
      if (my !== token) return;
      $('#em-loading').classList.add('off');
      if (v === 'sphere') {
        showNote(err.code === 'webgl'
          ? 'The sphere needs WebGL, which this browser has switched off. In Brave, turn on Settings → System → "Use graphics acceleration when available" and check that Shields does not block fingerprinting for this site. Showing the timeline instead.'
          : 'The 3D library (three.js 0.160.0 from jsDelivr) could not be loaded, so the timeline is shown instead. Check the connection or any content blocker.');
        console.warn('[event map] sphere unavailable:', err.message);
        setView('timeline');
      } else {
        showNote('The timeline library (D3 7.9.0 from jsDelivr) could not be loaded. The event list and panel still work.');
        console.warn('[event map] timeline unavailable:', err.message);
      }
    }
  }

  function onTier(t, fps) {
    const q = $('#em-quality');
    q.hidden = t === 0;
    q.textContent = 'Lower detail (' + Math.round(fps) + ' fps)';
  }
  const fpsEl = $('#em-fps');
  function onFps(fps) { if (DEBUG) { fpsEl.hidden = false; fpsEl.textContent = Math.round(fps) + ' fps · ' + graph.nodes.length + ' events · ' + graph.links.length + ' links'; } }

  /* ---------- selection, hash, reset ---------- */
  function select(idx, o = {}) {
    if (idx >= 0 && !store.get().nodeVis[idx]) update({ cats: null, region: '' });
    update({ sel: idx });
    if (idx >= 0 && view) view.focus(idx, o.animate !== false);
    if (mqPhone.matches) {
      if (idx >= 0 && sheet.get() === 'peek') sheet.set('half');
      if (idx < 0) sheet.set('peek');
    }
    if (o.from === 'panel' || o.from === 'search') {
      const t = document.getElementById('em-p-title');
      if (t && o.from === 'panel') t.focus({ preventScroll: true });
    }
  }
  function reset() {
    update({ sel: -1, hover: -1, cats: null, region: '' });
    if (view) view.home(true);
  }
  function idxFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const n = id && graph.byId.get(id);
    return n ? n.idx : -1;
  }
  window.addEventListener('hashchange', () => { const i = idxFromHash(); if (i !== store.get().sel) select(i); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (store.get().sel >= 0) select(-1);
  });

  store.subscribe((s, prev, changed) => {
    if (view && ['nodeVis', 'linkVis', 'sel', 'hover', 'hl'].some((k) => changed.has(k))) view.update(pick(s));
    if (changed.has('sel') || changed.has('nodeVis')) panel.render(s, changed.has('sel'));
    if (changed.has('sel') || changed.has('nodeVis') || changed.has('hl')) list.sync(s);
    controls.sync(s);
    if (changed.has('sel')) {
      const url = new URL(location.href);
      url.hash = s.sel >= 0 ? graph.nodes[s.sel].id : '';
      history.replaceState(null, '', s.sel >= 0 ? url : url.pathname + url.search);
      document.title = (s.sel >= 0 ? graph.nodes[s.sel].title + ' · ' : '') + 'Event Map · Market Lens (mockup)';
    }
  });

  panel.render(store.get(), true);
  list.sync(store.get());
  controls.sync(store.get());
  $('#em-count').textContent = graph.nodes.length + ' events · ' + graph.links.length + ' links · ' + fmtDate(graph.nodes[0]) + ' to ' + fmtDate(graph.nodes[graph.nodes.length - 1]);
  if (data.warnings.length) $('#em-count').textContent += ' · ' + data.warnings.length + ' data warnings (see console)';
  await setView(store.get().view);
  const fromHash = idxFromHash();
  if (fromHash >= 0) select(fromHash);

  document.addEventListener('ml:pref', () => { if (view && viewName === 'sphere' && ML.rm()) view.update(pick(store.get())); });

  if (DEBUG) {
    window.__em = { store, graph, lay, update, select, setView, view: () => view, viewName: () => viewName, lastDisposal: () => lastDisposal, warnings: data.warnings };
  }
}

start();
