/* Event Map: the side panel (a bottom sheet on phones). It shows the selected event, or an overview when nothing is
   selected. Every related event in it is a button that selects that event and turns the view to it. */
import { CAT_KEYS } from './data.js';
import { neighbours } from './graph.js';
import { touched, sampleMove } from './holdings.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(ev) {
  const [y, m] = ev.date.split('-').map(Number);
  return (ev.day ? ev.day + ' ' : '') + MON[m - 1] + ' ' + y;
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
const MINUS = '−';
function pct(v) { return (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(1) + '%'; }

export function createPanel(el, { graph, store, onSelect, moves }) {
  const ML = window.ML;
  const catKey = (n) => CAT_KEYS[n.cat];

  function item(n, link) {
    return '<li><button class="em-rel" type="button" data-go="' + n.idx + '">' +
      '<i class="em-dot" data-k="' + catKey(n) + '" aria-hidden="true"></i>' +
      '<span class="em-rel-t">' + esc(n.title) + '</span>' +
      '<span class="em-rel-d">' + fmtDate(n) + '</span></button>' +
      '<p class="em-mech"><span class="em-type" data-type="' + link.type + '">' + (link.type === 'direct' ? 'Direct' : 'Contributing') + '</span>' + esc(link.mechanism) + '</p></li>';
  }

  function overview(s) {
    const shown = s.nodeVis.reduce((a, b) => a + b, 0), links = s.linkVis.reduce((a, b) => a + b, 0);
    const hubs = graph.nodes.filter((n) => s.nodeVis[n.idx]).sort((a, b) => b.degree - a.degree || a.t - b.t).slice(0, 6);
    const first = graph.nodes[0], last = graph.nodes[graph.nodes.length - 1];
    return '<div class="em-p-in">' +
      '<p class="micro">Event Map</p>' +
      '<h2 class="em-p-title">How one event set off the next</h2>' +
      '<p class="em-p-sum">' + graph.nodes.length + ' real events from ' + (first ? fmtDate(first) : '') + ' to ' + (last ? fmtDate(last) : '') + ', joined by ' + graph.links.length + ' cause-and-effect links. Earliest events sit near the top of the sphere, latest near the bottom; each colour is a category.</p>' +
      (shown < graph.nodes.length ? '<p class="em-p-note">Filters show ' + shown + ' events and ' + links + ' links.</p>' : '') +
      '<p class="em-p-hint">Choose an event to see what led to it (amber) and what it set off (cyan).</p>' +
      '<section><h3 class="em-h">Most connected</h3><ul class="em-rels">' +
      hubs.map((n) => '<li><button class="em-rel" type="button" data-go="' + n.idx + '"><i class="em-dot" data-k="' + catKey(n) + '" aria-hidden="true"></i><span class="em-rel-t">' + esc(n.title) + '</span><span class="em-rel-d">' + n.degree + ' links</span></button></li>').join('') +
      '</ul></section></div>';
  }

  function detail(s) {
    const n = graph.nodes[s.sel], nb = neighbours(graph, s.sel);
    const mr = n.market_reaction;
    const held = touched(n);
    const assets = (mr.assets || []).map((a) => '<li><span class="em-asset">' + esc(a.asset) + '</span>' +
      (a.move ? '<span class="em-move' + (/^[−-]/.test(a.move) ? ' dn' : /^\+/.test(a.move) ? ' up' : '') + '">' + esc(a.move) + '</span>' : '') +
      (a.window ? '<span class="em-win">' + esc(a.window) + '</span>' : '') + '</li>').join('');
    const pills = held.map((t) => {
      const v = sampleMove(moves, n.id, t);
      const it = ML && ML.I[t];
      const name = it && it.kind === 'stock' ? ML.tk(t, { name: false }) : '<span class="em-tkr">' + esc(t) + '</span>';
      return '<li class="em-pill">' + name + (v == null ? '<span class="em-move">n/a</span>'
        : '<span class="em-move ' + (v >= 0 ? 'up' : 'dn') + '">' + (v >= 0 ? '▲ ' : '▼ ') + pct(v) + '</span>') + '</li>';
    }).join('');
    const up = s.hl ? s.hl.up.size : 0, down = s.hl ? s.hl.down.size : 0;
    const hidden = (list) => list.filter((x) => !s.nodeVis[x.node.idx]).length;
    const rel = (title, list, empty) => '<section><h3 class="em-h">' + title + ' <span class="ct">' + list.length + '</span></h3>' +
      (list.length ? '<ul class="em-rels">' + list.map((x) => item(x.node, x.link)).join('') + '</ul>' : '<p class="em-empty">' + empty + '</p>') +
      (hidden(list) ? '<p class="em-p-note">' + hidden(list) + ' hidden by the filters.</p>' : '') + '</section>';
    return '<div class="em-p-in">' +
      '<div class="em-p-meta"><span class="em-catchip" data-k="' + catKey(n) + '"><i class="em-dot" data-k="' + catKey(n) + '" aria-hidden="true"></i>' + esc(n.category) + '</span>' +
      '<time datetime="' + n.date + (n.day ? '-' + String(n.day).padStart(2, '0') : '') + '">' + fmtDate(n) + '</time>' +
      '<span class="em-regions">' + n.regions.map(esc).join(' · ') + '</span></div>' +
      '<h2 class="em-p-title" id="em-p-title" tabindex="-1">' + esc(n.title) + '</h2>' +
      '<p class="em-p-sum">' + esc(n.summary) + '</p>' +
      '<p class="em-chain"><span class="em-up-k">' + up + ' upstream</span><span class="em-down-k">' + down + ' downstream</span></p>' +
      '<section><h3 class="em-h">Market reaction</h3><p class="em-mr">' + esc(mr.headline) + '</p>' + (assets ? '<ul class="em-assets">' + assets + '</ul>' : '') + '</section>' +
      (held.length ? '<section class="em-held"><h3 class="em-h">Your holdings touched <span class="badge badge-sample">Sample</span></h3><ul class="em-pills">' + pills + '</ul>' +
        '<p class="em-p-note">Moves over the event window are sample numbers, not real returns.</p></section>' : '') +
      rel('What led here', nb.causes, 'Nothing earlier on the map led here.') +
      rel('What it set off', nb.effects, 'Nothing later on the map follows from this yet.') +
      '<section><h3 class="em-h">Sources</h3><ul class="em-src">' +
      n.sources.map((u) => '<li><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(host(u)) + '</a></li>').join('') + '</ul></section>' +
      '</div>';
  }

  const body = el.querySelector('.em-p-body');
  const closeBtn = el.querySelector('.em-p-x');
  let lastSel = -2;
  function render(s, force) {
    if (!force && s.sel === lastSel) {
      /* filters changed: refresh counts without moving the scroll position */
      const top = body.scrollTop; body.innerHTML = s.sel >= 0 ? detail(s) : overview(s); body.scrollTop = top; return;
    }
    lastSel = s.sel;
    body.innerHTML = s.sel >= 0 ? detail(s) : overview(s);
    body.scrollTop = 0;
    closeBtn.hidden = s.sel < 0;
    el.dataset.state = s.sel >= 0 ? 'detail' : 'overview';
  }
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) onSelect(Number(b.dataset.go), { from: 'panel' });
  });
  closeBtn.addEventListener('click', () => onSelect(-1, { from: 'panel' }));

  return { render, el, body };
}

/* phones: the panel is a sheet that drags between three heights; tapping the handle steps through them */
export function initSheet(el, handle, mq, onChange) {
  const SNAP = ['peek', 'half', 'full'];
  let snap = 'peek', drag = null;
  const heights = () => {
    const H = (el.parentElement && el.parentElement.clientHeight) || window.innerHeight;
    return { peek: 92, half: Math.round(H * 0.55), full: Math.max(92, H - 8) };
  };
  function set(s) {
    snap = s;
    el.dataset.snap = s;
    el.style.height = mq.matches ? heights()[s] + 'px' : '';
    handle.setAttribute('aria-expanded', String(s !== 'peek'));
    handle.setAttribute('aria-label', s === 'peek' ? 'Expand the event details' : s === 'half' ? 'Expand the event details to full height' : 'Collapse the event details');
    if (onChange) onChange(s, mq.matches ? heights()[s] : 0);
  }
  handle.addEventListener('pointerdown', (e) => {
    if (!mq.matches) return;
    drag = { y: e.clientY, h: el.getBoundingClientRect().height, moved: false };
    handle.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 4) drag.moved = true;
    const hs = heights();
    el.style.height = Math.max(hs.peek, Math.min(hs.full, drag.h + dy)) + 'px';
  });
  const end = (e) => {
    if (!drag) return;
    el.classList.remove('dragging');
    const moved = drag.moved;
    drag = null;
    if (!moved) { set(SNAP[(SNAP.indexOf(snap) + 1) % 3]); return; }
    const h = el.getBoundingClientRect().height, hs = heights();
    set(SNAP.reduce((best, k) => (Math.abs(hs[k] - h) < Math.abs(hs[best] - h) ? k : best), 'peek'));
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(SNAP[(SNAP.indexOf(snap) + 1) % 3]); }
  });
  const onMq = () => set(snap);
  mq.addEventListener('change', onMq);
  window.addEventListener('resize', onMq);
  set('peek');
  return { set, get: () => snap };
}

