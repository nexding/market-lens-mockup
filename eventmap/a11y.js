/* Event Map: a list of every event in time order for keyboard and screen reader users. It stays visually hidden until
   it holds focus, mirrors the selection (aria-current) and the filters, and announces each selection politely. */
import { fmtDate } from './panel.js';

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

export function createEventList(nav, live, { graph, onSelect }) {
  const ol = nav.querySelector('ol');
  ol.innerHTML = graph.nodes.map((n) => '<li><button type="button" data-idx="' + n.idx + '" tabindex="-1">' +
    esc(n.title) + '<span class="em-list-sub">, ' + fmtDate(n) + ', ' + esc(n.category) + '. ' + n.ins.length + (n.ins.length === 1 ? ' cause' : ' causes') + ', ' + n.outs.length + (n.outs.length === 1 ? ' effect' : ' effects') + ' on the map.</span></button></li>').join('');
  const buttons = Array.from(ol.querySelectorAll('button'));
  let rovingIdx = 0;
  buttons[0] && (buttons[0].tabIndex = 0);

  function visible() { return buttons.filter((b) => !b.parentNode.hidden); }
  function moveTo(b) {
    buttons.forEach((x) => { x.tabIndex = -1; });
    b.tabIndex = 0; b.focus();
    rovingIdx = Number(b.dataset.idx);
  }
  ol.addEventListener('keydown', (e) => {
    const vis = visible(), i = vis.indexOf(document.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = Math.min(vis.length - 1, i + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = vis.length - 1;
    else if (e.key === 'Escape') { onSelect(-1, { from: 'list' }); return; }
    if (j >= 0) { e.preventDefault(); moveTo(vis[j]); }
  });
  ol.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-idx]');
    if (b) { moveTo(b); onSelect(Number(b.dataset.idx), { from: 'list' }); }
  });

  let lastSel = -1;
  function sync(s) {
    buttons.forEach((b, i) => {
      b.parentNode.hidden = !s.nodeVis[i];
      if (i === s.sel) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    /* keep one reachable button even when filters hide the current one */
    const vis = visible();
    if (vis.length && (buttons[rovingIdx] === undefined || buttons[rovingIdx].parentNode.hidden)) {
      buttons.forEach((x) => { x.tabIndex = -1; }); vis[0].tabIndex = 0; rovingIdx = Number(vis[0].dataset.idx);
    }
    if (s.sel >= 0 && buttons[s.sel] && !buttons[s.sel].parentNode.hidden && document.activeElement !== buttons[s.sel]) {
      buttons.forEach((x) => { x.tabIndex = -1; }); buttons[s.sel].tabIndex = 0; rovingIdx = s.sel;
    }
    if (s.sel !== lastSel) {
      lastSel = s.sel;
      if (s.sel >= 0) {
        const n = graph.nodes[s.sel];
        live.textContent = n.title + ', ' + fmtDate(n) + ', ' + n.category + '. ' + s.hl.up.size + ' events upstream, ' + s.hl.down.size + ' downstream.';
      } else live.textContent = 'Selection cleared.';
    }
  }
  return { sync };
}
