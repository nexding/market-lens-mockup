/* Event Map: the graph both views share. Pure, so node can test it. */

/* nodes keep the event fields plus idx, ins, outs (link indexes) and degree */
export function buildGraph(events, links) {
  const byId = new Map();
  const nodes = events.map((ev, idx) => {
    const n = { ...ev, idx, ins: [], outs: [], degree: 0 };
    byId.set(ev.id, n);
    return n;
  });
  const lks = [];
  links.forEach((l) => {
    const s = byId.get(l.from), t = byId.get(l.to);
    if (!s || !t) return;
    const idx = lks.length;
    lks.push({ ...l, idx, s: s.idx, t: t.idx });
    s.outs.push(idx); t.ins.push(idx);
    s.degree++; t.degree++;
  });
  return { nodes, links: lks, byId };
}

/* which nodes the filters keep: cats is a Set of the category names shown (null for all), region '' for all */
export function nodeMask(graph, filters) {
  const cats = filters && filters.cats ? filters.cats : null;
  const region = (filters && filters.region) || '';
  const out = new Uint8Array(graph.nodes.length);
  graph.nodes.forEach((n, i) => {
    out[i] = (!cats || cats.has(n.category)) && (!region || n.regions.includes(region)) ? 1 : 0;
  });
  return out;
}

export function linkMask(graph, nodeVis) {
  const out = new Uint8Array(graph.links.length);
  graph.links.forEach((l, i) => { out[i] = nodeVis[l.s] && nodeVis[l.t] ? 1 : 0; });
  return out;
}

/* walk one way from a node over visible links; returns the set of node indexes reached (the start excluded) */
function walk(graph, start, nodeVis, dir) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop();
    const list = dir === 'up' ? graph.nodes[i].ins : graph.nodes[i].outs;
    for (const li of list) {
      const l = graph.links[li];
      const j = dir === 'up' ? l.s : l.t;
      if (!nodeVis[j] || j === start || seen.has(j)) continue;
      seen.add(j); stack.push(j);
    }
  }
  return seen;
}

export function ancestors(graph, idx, nodeVis) { return walk(graph, idx, nodeVis, 'up'); }
export function descendants(graph, idx, nodeVis) { return walk(graph, idx, nodeVis, 'down'); }

/* everything the views need to light a selection: upstream and downstream nodes and the links on those paths.
   A node that is both (only possible with a cycle) counts as upstream. */
export function highlight(graph, idx, nodeVis) {
  const up = ancestors(graph, idx, nodeVis);
  const down = descendants(graph, idx, nodeVis);
  up.forEach((i) => down.delete(i));
  const upLinks = new Set(), downLinks = new Set();
  graph.links.forEach((l, li) => {
    if (!nodeVis[l.s] || !nodeVis[l.t]) return;
    if (up.has(l.s) && (l.t === idx || up.has(l.t))) upLinks.add(li);
    else if (down.has(l.t) && (l.s === idx || down.has(l.s))) downLinks.add(li);
  });
  return { up, down, upLinks, downLinks };
}

/* direct causes and effects of one node, as {node, link} pairs, earliest first */
export function neighbours(graph, idx) {
  const n = graph.nodes[idx];
  const by = (a, b) => a.node.t - b.node.t;
  return {
    causes: n.ins.map((li) => ({ link: graph.links[li], node: graph.nodes[graph.links[li].s] })).sort(by),
    effects: n.outs.map((li) => ({ link: graph.links[li], node: graph.nodes[graph.links[li].t] })).sort(by)
  };
}
