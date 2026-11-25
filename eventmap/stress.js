/* Event Map: ?stress=1 replaces the data with a seeded, connected, invented graph of 200 events and 400 links, to check
   the frame rate. Nothing here is real; titles say so. */
import { CATEGORIES, REGIONS } from './data.js';
import { rng } from './layout.js';

export function stressData(nNodes = 200, nLinks = 400, seed = 7) {
  const r = rng(seed);
  const months = 2026 * 12 + 10 - (2020 * 12);   /* Jan 2020 to Nov 2026 */
  const events = [];
  for (let i = 0; i < nNodes; i++) {
    const m = Math.floor((i + r() * 0.9) / nNodes * months);
    const y = 2020 + Math.floor(m / 12), mo = (m % 12) + 1;
    const id = 'synthetic-' + String(i + 1).padStart(3, '0');
    events.push({
      id, title: 'Synthetic event ' + String(i + 1).padStart(3, '0'), date: y + '-' + String(mo).padStart(2, '0'),
      category: CATEGORIES[Math.floor(r() * CATEGORIES.length)], regions: [REGIONS[Math.floor(r() * REGIONS.length)]],
      summary: 'Invented event for the frame-rate test.', market_reaction: { headline: 'Invented', assets: [] },
      tickers: [], sources: ['https://example.org/' + id]
    });
  }
  /* events are in time order; a spanning tree from earlier to later keeps the graph connected, then random extra links */
  const links = [], seen = new Set();
  const add = (a, b, type) => {
    const k = a + ':' + b;
    if (a === b || seen.has(k)) return false;
    seen.add(k);
    links.push({ from: events[a].id, to: events[b].id, type, mechanism: 'Invented link for the frame-rate test.' });
    return true;
  };
  for (let i = 1; i < nNodes; i++) add(Math.max(0, i - 1 - Math.floor(r() * Math.min(i, 12))), i, r() < 0.6 ? 'direct' : 'contributing');
  let guard = 0;
  while (links.length < nLinks && guard++ < nLinks * 20) {
    const a = Math.floor(r() * (nNodes - 1)), b = a + 1 + Math.floor(r() * Math.min(40, nNodes - a - 1));
    add(a, b, r() < 0.5 ? 'direct' : 'contributing');
  }
  return { events, links };
}
