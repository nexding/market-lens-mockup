/* Event Map: the toolbar. Search (a combobox with fuzzy title matching), category chips, the region list, the
   Sphere | Timeline switch and Reset. Changes go through the callbacks main.js passes in; nothing here draws. */
import { CATEGORIES, CAT_KEYS, REGIONS } from './data.js';
import { search } from './fuzzy.js';
import { fmtDate } from './panel.js';

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function createControls(root, { graph, store, onSelect, onFilter, onView, onReset }) {
  const $ = (sel) => root.querySelector(sel);

  /* ---------- search ---------- */
  const input = $('#em-q'), list = $('#em-q-list');
  let results = [], active = -1;
  function paint() {
    list.innerHTML = results.map((n, i) => '<li id="em-q-o' + i + '" role="option" class="em-q-o' + (i === active ? ' is-active' : '') + '" aria-selected="' + (i === active) + '" data-i="' + i + '">' +
      '<i class="em-dot" data-k="' + CAT_KEYS[n.cat] + '" aria-hidden="true"></i><span class="em-q-t">' + esc(n.title) + '</span><span class="em-q-d">' + fmtDate(n) + '</span></li>').join('') ||
      (input.value.trim() ? '<li class="em-q-none" role="option" aria-disabled="true">No event matches</li>' : '');
    const open = !!input.value.trim() && document.activeElement === input;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (active >= 0) input.setAttribute('aria-activedescendant', 'em-q-o' + active); else input.removeAttribute('aria-activedescendant');
  }
  function run() {
    const s = store.get();
    results = search(graph.nodes.filter((n) => s.nodeVis[n.idx]), input.value, (n) => n.title, 8);
    active = results.length ? 0 : -1;
    paint();
  }
  function choose(i) {
    const n = results[i];
    if (!n) return;
    input.value = '';
    results = []; active = -1; paint();
    onSelect(n.idx, { from: 'search' });
  }
  input.addEventListener('input', run);
  input.addEventListener('focus', run);
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      paint();
    } else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { input.value = ''; results = []; active = -1; paint(); }
  });
  list.addEventListener('mousedown', (e) => { const o = e.target.closest('[data-i]'); if (o) { e.preventDefault(); choose(Number(o.dataset.i)); } });

  /* ---------- category chips: each switches one category on or off ---------- */
  const chips = $('#em-cats');
  chips.innerHTML = CATEGORIES.map((c, k) => '<button class="chip em-chip" type="button" aria-pressed="true" data-cat="' + esc(c) + '"><i class="em-dot" data-k="' + CAT_KEYS[k] + '" aria-hidden="true"></i>' + esc(c) + '</button>').join('');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const cur = new Set(store.get().cats || CATEGORIES);
    if (cur.has(b.dataset.cat)) cur.delete(b.dataset.cat); else cur.add(b.dataset.cat);
    onFilter({ cats: cur.size === CATEGORIES.length ? null : cur });
  });

  /* ---------- region ---------- */
  const region = $('#em-region');
  const used = new Set();
  graph.nodes.forEach((n) => n.regions.forEach((r) => used.add(r)));
  region.innerHTML = '<option value="">All regions</option>' + REGIONS.filter((r) => used.has(r)).map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('');
  region.addEventListener('change', () => onFilter({ region: region.value }));

  /* ---------- view switch and reset ---------- */
  const seg = $('#em-view');
  seg.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) onView(b.dataset.v); });
  $('#em-reset').addEventListener('click', onReset);

  function sync(s) {
    chips.querySelectorAll('[data-cat]').forEach((b) => {
      const on = !s.cats || s.cats.has(b.dataset.cat);
      b.setAttribute('aria-pressed', String(on));
    });
    if (region.value !== (s.region || '')) region.value = s.region || '';
    seg.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.view)));
  }
  return { sync };
}
