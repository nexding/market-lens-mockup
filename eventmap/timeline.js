/* Event Map: the timeline view. x is time, y is one lane per category; events in the same lane that would overlap are
   staggered. Curved arrows run from cause to effect. D3 7.9.0 (UMD) is loaded the first time this view opens. */
import { CATEGORIES, CAT_KEYS } from './data.js';

const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js';
const D3_SRI = 'sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i';
let d3Promise = null;
export function loadD3() {
  if (window.d3 && window.d3.zoom) return Promise.resolve(window.d3);
  if (!d3Promise) {
    d3Promise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = D3_URL; s.integrity = D3_SRI; s.crossOrigin = 'anonymous';
      s.onload = () => (window.d3 ? resolve(window.d3) : reject(new Error('D3 did not start')));
      s.onerror = () => { d3Promise = null; s.remove(); reject(new Error('D3 could not be downloaded')); };
      document.head.appendChild(s);
    });
  }
  return d3Promise;
}

const S = { NORMAL: 0, DIM: 1, UP: 2, DOWN: 3, SEL: 4, HIDDEN: 5 };

/* ctx: { graph, colors, rm(), onSelect(idx), onHover(idx), tip } */
export async function mountTimeline(host, ctx) {
  const d3 = await loadD3();
  const { graph } = ctx;
  const N = graph.nodes.length;
  /* the bottom margin leaves room for the key that floats over the bottom left of the map */
  const phone = host.clientWidth <= 720;
  const M = { l: phone ? 112 : 156, r: phone ? 12 : 28, t: 34, b: phone ? 100 : 76 };
  const toDate = (n) => new Date(Number(n.date.slice(0, 4)), Number(n.date.slice(5, 7)) - 1, n.day || 15);
  const dates = graph.nodes.map(toDate);
  const ext = d3.extent(dates);
  const x0 = d3.scaleTime().domain([d3.timeMonth.offset(ext[0], -2), d3.timeMonth.offset(ext[1], 2)]);
  let x = x0.copy();

  const wrap = document.createElement('div');
  wrap.className = 'em-tl';
  host.appendChild(wrap);
  const svg = d3.select(wrap).append('svg').attr('class', 'em-tl-svg').attr('role', 'img')
    .attr('aria-label', 'Timeline of ' + N + ' events in six category lanes, with arrows from cause to effect. The event list and the side panel give the same information as text.');
  const defs = svg.append('defs');
  [['norm', ctx.colors.edge], ['up', ctx.colors.up], ['down', ctx.colors.down], ['dim', ctx.colors.edge]].forEach(([k, c]) => {
    defs.append('marker').attr('id', 'em-arrow-' + k).attr('viewBox', '0 -4 8 8').attr('refX', 7).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7).attr('markerUnits', 'userSpaceOnUse').attr('orient', 'auto')
      .append('path').attr('d', 'M0,-3.5L8,0L0,3.5Z').attr('fill', c).attr('opacity', k === 'dim' ? 0.2 : 1);
  });
  const clipId = 'em-tl-clip';
  const clipRect = defs.append('clipPath').attr('id', clipId).append('rect');
  const gLanes = svg.append('g').attr('class', 'em-tl-lanes');
  const gAxis = svg.append('g').attr('class', 'em-tl-axis');
  const plot = svg.append('g').attr('clip-path', 'url(#' + clipId + ')');
  const gEdges = plot.append('g').attr('class', 'em-tl-edges');
  const gHits = plot.append('g').attr('class', 'em-tl-hits');
  const gNodes = plot.append('g').attr('class', 'em-tl-nodes');
  const gLabels = plot.append('g').attr('class', 'em-tl-labels');

  const R = graph.nodes.map((n) => 4.5 + Math.min(4, Math.sqrt(n.degree) * 1.1));
  const px = new Float64Array(N), py = new Float64Array(N);
  let W = 0, H = 0, laneH = 0;
  let view = { nodeVis: new Uint8Array(N).fill(1), linkVis: new Uint8Array(graph.links.length).fill(1), sel: -1, hover: -1, hl: null };
  const nState = new Uint8Array(N), eState = new Uint8Array(graph.links.length);
  let hoverEdge = -1;

  const edgeSel = gEdges.selectAll('path').data(graph.links).join('path')
    .attr('class', (l) => 'em-tl-e ' + l.type)
    .attr('fill', 'none');
  const hitSel = gHits.selectAll('path').data(graph.links).join('path').attr('class', 'em-tl-hit').attr('fill', 'none');
  const nodeSel = gNodes.selectAll('circle').data(graph.nodes).join('circle')
    .attr('class', 'em-tl-n').attr('r', (n) => R[n.idx]);

  /* stagger: within a lane, take the first slot whose last event is far enough to the left */
  function layout() {
    const lanes = CATEGORIES.map(() => []);
    graph.nodes.forEach((n) => { px[n.idx] = x(dates[n.idx]); lanes[n.cat].push(n.idx); });
    const step = Math.min(13, laneH / 7);
    const order = [0, -1, 1, -2, 2, -3, 3];
    lanes.forEach((ids, k) => {
      const lastX = order.map(() => -Infinity);
      ids.sort((a, b) => px[a] - px[b]);
      ids.forEach((i) => {
        if (!view.nodeVis[i]) { py[i] = M.t + (k + 0.5) * laneH; return; }
        let slot = order.findIndex((o, j) => px[i] - lastX[j] > 2 * R[i] + 6);
        if (slot < 0) slot = order.reduce((best, o, j) => (lastX[j] < lastX[best] ? j : best), 0);
        lastX[slot] = px[i];
        py[i] = M.t + (k + 0.5) * laneH + order[slot] * step;
      });
    });
  }
  function edgePath(l) {
    const x1 = px[l.s], y1 = py[l.s], x2 = px[l.t], y2 = py[l.t];
    /* the curve leaves the cause heading right and arrives at the effect heading right, stopping at its circle */
    const ex = x2 - R[l.t] - 2;
    const dx = Math.max(24, Math.abs(ex - x1) * 0.5);
    return 'M' + x1 + ',' + y1 + 'C' + (x1 + dx) + ',' + y1 + ' ' + (ex - dx) + ',' + y2 + ' ' + ex + ',' + y2;
  }
  function draw() {
    layout();
    edgeSel.attr('d', edgePath);
    hitSel.attr('d', edgePath);
    nodeSel.attr('cx', (n) => px[n.idx]).attr('cy', (n) => py[n.idx]);
    gAxis.call(d3.axisTop(x).ticks(Math.max(3, Math.floor((W - M.l - M.r) / 90))).tickSizeOuter(0))
      .attr('transform', 'translate(0,' + (M.t - 6) + ')');
    labels();
  }
  function lanesDraw() {
    gLanes.selectAll('*').remove();
    CATEGORIES.forEach((c, k) => {
      const g = gLanes.append('g').attr('transform', 'translate(0,' + (M.t + k * laneH) + ')');
      g.append('rect').attr('x', M.l).attr('width', Math.max(0, W - M.l - M.r)).attr('height', laneH).attr('class', 'em-tl-lane' + (k % 2 ? ' odd' : ''));
      g.append('circle').attr('cx', 18).attr('cy', laneH / 2).attr('r', 4.5).attr('class', 'em-tl-lane-dot').attr('data-k', CAT_KEYS[k]);
      g.append('text').attr('x', 30).attr('y', laneH / 2).attr('dy', '0.35em').attr('class', 'em-tl-lane-t').text(c);
    });
  }
  function size() {
    W = Math.max(320, host.clientWidth); H = Math.max(240, host.clientHeight);
    laneH = (H - M.t - M.b) / CATEGORIES.length;
    svg.attr('width', W).attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H);
    clipRect.attr('x', M.l).attr('y', 0).attr('width', Math.max(0, W - M.l - M.r)).attr('height', H);
    x0.range([M.l + 12, W - M.r - 12]);
    zoom.extent([[M.l, 0], [W - M.r, H]]).translateExtent([[M.l, 0], [W - M.r, H]]);
    x = d3.zoomTransform(svg.node()).rescaleX(x0);
    lanesDraw();
    draw();
  }

  /* zoom and pan along time only */
  const zoom = d3.zoom().scaleExtent([1, 14]).on('zoom', (e) => { x = e.transform.rescaleX(x0); draw(); });
  svg.call(zoom).on('dblclick.zoom', null);

  function computeStates() {
    const { nodeVis, linkVis, sel, hl } = view;
    for (let i = 0; i < N; i++) nState[i] = !nodeVis[i] ? S.HIDDEN : sel < 0 ? S.NORMAL : i === sel ? S.SEL : hl.up.has(i) ? S.UP : hl.down.has(i) ? S.DOWN : S.DIM;
    graph.links.forEach((l, i) => {
      eState[i] = !linkVis[i] ? S.HIDDEN : sel < 0 ? S.NORMAL : hl.upLinks.has(i) ? S.UP : hl.downLinks.has(i) ? S.DOWN : S.DIM;
    });
  }
  function paint() {
    const key = (s) => (s === S.UP ? 'up' : s === S.DOWN ? 'down' : s === S.DIM ? 'dim' : 'norm');
    edgeSel.attr('data-s', (l) => (l.idx === hoverEdge && eState[l.idx] !== S.HIDDEN ? 'hover' : key(eState[l.idx])))
      .attr('display', (l) => (eState[l.idx] === S.HIDDEN ? 'none' : null))
      .attr('marker-end', (l) => 'url(#em-arrow-' + key(eState[l.idx]) + ')');
    hitSel.attr('display', (l) => (eState[l.idx] === S.HIDDEN || (eState[l.idx] === S.DIM && view.sel >= 0) ? 'none' : null));
    nodeSel.attr('display', (n) => (nState[n.idx] === S.HIDDEN ? 'none' : null))
      .attr('data-k', (n) => CAT_KEYS[n.cat])
      .attr('data-s', (n) => ['norm', 'dim', 'up', 'down', 'sel', 'hidden'][nState[n.idx]])
      .classed('is-hover', (n) => n.idx === view.hover)
      .attr('r', (n) => R[n.idx] * (nState[n.idx] === S.SEL ? 1.45 : n.idx === view.hover ? 1.25 : 1));
    gNodes.selectAll('circle').filter((n) => nState[n.idx] === S.SEL || n.idx === view.hover).raise();
    labels();
  }
  function labels() {
    const want = [];
    if (view.sel >= 0) {
      want.push(view.sel);
      for (let i = 0; i < N; i++) if (nState[i] === S.UP || nState[i] === S.DOWN) want.push(i);
    }
    if (view.hover >= 0 && !want.includes(view.hover) && nState[view.hover] !== S.HIDDEN) want.push(view.hover);
    /* greedy declutter, selected and hovered first */
    const boxes = [];
    const pri = (i) => (i === view.sel ? 3 : i === view.hover ? 2 : 1);
    const keep = want.sort((a, b) => pri(b) - pri(a)).filter((i) => {
      const w = 8 + graph.nodes[i].title.length * 6.3, bx = px[i] + R[i] + 4, by = py[i] - 8;
      const box = [bx, by, bx + w, by + 16];
      if (pri(i) < 2 && boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return false;
      boxes.push(box); return true;
    });
    gLabels.selectAll('text').data(keep, (i) => i).join('text')
      .attr('class', 'em-tl-l')
      .attr('data-s', (i) => ['norm', 'dim', 'up', 'down', 'sel', 'hidden'][nState[i]])
      .attr('x', (i) => px[i] + R[i] + 5).attr('y', (i) => py[i]).attr('dy', '0.35em')
      .text((i) => graph.nodes[i].title);
  }

  nodeSel.on('click', (e, n) => ctx.onSelect(n.idx))
    .on('pointerenter', (e, n) => ctx.onHover(n.idx))
    .on('pointerleave', () => ctx.onHover(-1));
  hitSel.on('pointerenter', (e, l) => { hoverEdge = l.idx; paint(); ctx.tip.show(l, e.clientX, e.clientY); })
    .on('pointermove', (e) => ctx.tip.move(e.clientX, e.clientY))
    .on('pointerleave', () => { hoverEdge = -1; paint(); ctx.tip.hide(); });
  svg.on('click', (e) => { if (e.target === svg.node() || (e.target.classList && e.target.classList.contains('em-tl-lane'))) ctx.onSelect(-1); });

  const ro = new ResizeObserver(() => size());
  ro.observe(host);
  size();
  computeStates(); paint();

  function focus(idx) {
    if (idx < 0) return;
    const xv = x(dates[idx]);
    if (xv > M.l + 40 && xv < W - M.r - 40) return;
    const t = d3.zoomTransform(svg.node());
    const target = d3.zoomIdentity.translate((M.l + W - M.r) / 2 - x0(dates[idx]) * t.k, 0).scale(t.k);
    (ctx.rm() ? svg : svg.transition().duration(500)).call(zoom.transform, target);
  }

  return {
    update(next) { view = { ...view, ...next }; computeStates(); if (next.nodeVis) draw(); paint(); },
    focus,
    home() { (ctx.rm() ? svg : svg.transition().duration(400)).call(zoom.transform, d3.zoomIdentity); },
    resize: size,
    stats() { return { nodes: gNodes.selectAll('circle:not([display="none"])').size(), edges: gEdges.selectAll('path:not([display="none"])').size() }; },
    unmount() {
      ro.disconnect();
      svg.on('.zoom', null).on('click', null);
      nodeSel.on('click', null).on('pointerenter', null).on('pointerleave', null);
      hitSel.on('pointerenter', null).on('pointermove', null).on('pointerleave', null);
      svg.interrupt();
      ctx.tip.hide();
      wrap.remove();
      return {};
    }
  };
}
