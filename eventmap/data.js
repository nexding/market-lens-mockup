/* Event Map: loading and checking the event data. Pure apart from load(), so node can test it. */

export const CATEGORIES = ['Geopolitical', 'Energy & Supply', 'Fiscal & Inflation', 'Monetary', 'Credit & Crypto', 'Tech'];
/* short keys for CSS tokens and data attributes, in the same order as CATEGORIES */
export const CAT_KEYS = ['geo', 'energy', 'fiscal', 'monetary', 'credit', 'tech'];
export const REGIONS = ['Global', 'United States', 'Europe', 'United Kingdom', 'China', 'Japan', 'Russia & Ukraine', 'Middle East', 'Asia-Pacific', 'Switzerland'];
export const LINK_TYPES = ['direct', 'contributing'];

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/* months since year 0, so dates compare as numbers; NaN for a malformed date */
export function monthIndex(date) {
  const m = DATE_RE.exec(date || '');
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN;
}

/* a finer position in time: the month plus the day as a fraction (mid-month when there is no day) */
export function timeValue(ev) {
  const mi = monthIndex(ev.date);
  const day = Number.isInteger(ev.day) ? ev.day : 16;
  return mi + (day - 1) / 31;
}

function isUrl(s) { return typeof s === 'string' && /^https?:\/\/[^\s]+$/.test(s); }

/* every problem as one readable line; an empty array means the data is clean */
export function validate(events, links) {
  const out = [];
  if (!Array.isArray(events)) return ['events.json is not an array'];
  if (!Array.isArray(links)) return ['links.json is not an array'];

  const byId = new Map();
  events.forEach((ev, i) => {
    const at = ev && ev.id ? `event "${ev.id}"` : `event #${i}`;
    if (!ev || typeof ev !== 'object') { out.push(`${at}: not an object`); return; }
    if (typeof ev.id !== 'string' || !ID_RE.test(ev.id)) out.push(`${at}: id must be lower-case words joined by hyphens`);
    else if (byId.has(ev.id)) out.push(`${at}: duplicate id`);
    else byId.set(ev.id, ev);
    if (typeof ev.title !== 'string' || !ev.title.trim()) out.push(`${at}: missing title`);
    if (Number.isNaN(monthIndex(ev.date))) out.push(`${at}: date "${ev.date}" is not YYYY-MM`);
    if (ev.day != null && !(Number.isInteger(ev.day) && ev.day >= 1 && ev.day <= 31)) out.push(`${at}: day must be a whole number from 1 to 31`);
    if (!CATEGORIES.includes(ev.category)) out.push(`${at}: unknown category "${ev.category}"`);
    if (!Array.isArray(ev.regions) || !ev.regions.length) out.push(`${at}: needs at least one region`);
    else ev.regions.forEach((r) => { if (!REGIONS.includes(r)) out.push(`${at}: unknown region "${r}"`); });
    if (typeof ev.summary !== 'string' || !ev.summary.trim()) out.push(`${at}: missing summary`);
    const mr = ev.market_reaction;
    if (!mr || typeof mr.headline !== 'string' || !mr.headline.trim()) out.push(`${at}: market_reaction needs a headline`);
    else if (mr.assets != null && !Array.isArray(mr.assets)) out.push(`${at}: market_reaction.assets must be an array`);
    else (mr.assets || []).forEach((a, j) => { if (!a || typeof a.asset !== 'string' || !a.asset.trim()) out.push(`${at}: market_reaction.assets[${j}] needs an asset name`); });
    if (!Array.isArray(ev.tickers)) out.push(`${at}: tickers must be an array`);
    if (!Array.isArray(ev.sources) || !ev.sources.length) out.push(`${at}: needs at least one source`);
    else ev.sources.forEach((s) => { if (!isUrl(s)) out.push(`${at}: source "${s}" is not an http(s) URL`); });
  });

  const seen = new Set();
  const deg = new Map();
  const good = [];
  links.forEach((l, i) => {
    const at = l && l.from && l.to ? `link ${l.from} → ${l.to}` : `link #${i}`;
    if (!l || typeof l !== 'object') { out.push(`${at}: not an object`); return; }
    const a = byId.get(l.from), b = byId.get(l.to);
    if (!a) out.push(`${at}: dangling id "${l.from}"`);
    if (!b) out.push(`${at}: dangling id "${l.to}"`);
    if (!LINK_TYPES.includes(l.type)) out.push(`${at}: type must be "direct" or "contributing"`);
    if (typeof l.mechanism !== 'string' || !l.mechanism.trim()) out.push(`${at}: missing mechanism`);
    if (l.from === l.to) { out.push(`${at}: links an event to itself`); return; }
    const key = l.from + '\u0000' + l.to;
    if (seen.has(key)) { out.push(`${at}: duplicate link`); return; }
    if (seen.has(l.to + '\u0000' + l.from)) out.push(`${at}: the reverse link also exists`);
    seen.add(key);
    if (!a || !b) return;
    const ma = monthIndex(a.date), mb = monthIndex(b.date);
    if (mb < ma || (mb === ma && Number.isInteger(a.day) && Number.isInteger(b.day) && b.day < a.day)) {
      out.push(`${at}: the effect (${b.date}${b.day ? '-' + b.day : ''}) is dated before its cause (${a.date}${a.day ? '-' + a.day : ''})`);
    }
    deg.set(a.id, (deg.get(a.id) || 0) + 1);
    deg.set(b.id, (deg.get(b.id) || 0) + 1);
    good.push([a.id, b.id]);
  });

  byId.forEach((ev, id) => { if (!deg.get(id)) out.push(`event "${id}": isolated (no links)`); });

  /* the map must be one connected web */
  const ids = [...byId.keys()];
  const comps = components(ids, good);
  if (comps.length > 1) {
    comps.sort((x, y) => y.length - x.length);
    out.push(`the graph has ${comps.length} separate parts (sizes ${comps.map((c) => c.length).join(', ')}); smaller parts: ` +
      comps.slice(1).map((c) => c.slice(0, 4).join(', ') + (c.length > 4 ? ', …' : '')).join(' | '));
  }
  return out;
}

/* connected parts, ignoring direction; ids is an array, edges an array of [idA, idB] */
export function components(ids, edges) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  edges.forEach(([a, b]) => { if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b)); });
  const groups = new Map();
  ids.forEach((id) => { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id); });
  return [...groups.values()];
}

/* keep what the renderers can use: events sorted by time, links whose ends exist and are not repeated */
export function normalise(events, links) {
  const byId = new Map();
  const evs = [];
  (Array.isArray(events) ? events : []).forEach((ev) => {
    if (!ev || typeof ev.id !== 'string' || byId.has(ev.id) || Number.isNaN(monthIndex(ev.date))) return;
    const e = {
      id: ev.id, title: String(ev.title || ev.id), date: ev.date, day: Number.isInteger(ev.day) ? ev.day : null,
      category: CATEGORIES.includes(ev.category) ? ev.category : CATEGORIES[0],
      regions: Array.isArray(ev.regions) ? ev.regions.slice() : [],
      summary: String(ev.summary || ''),
      market_reaction: { headline: String((ev.market_reaction && ev.market_reaction.headline) || ''), assets: ((ev.market_reaction && ev.market_reaction.assets) || []).filter((a) => a && a.asset) },
      tickers: Array.isArray(ev.tickers) ? ev.tickers.slice() : [],
      sources: Array.isArray(ev.sources) ? ev.sources.filter(isUrl) : []
    };
    e.t = timeValue(e);
    e.cat = CATEGORIES.indexOf(e.category);
    byId.set(e.id, e); evs.push(e);
  });
  evs.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  const seen = new Set();
  const lks = [];
  (Array.isArray(links) ? links : []).forEach((l) => {
    if (!l || !byId.has(l.from) || !byId.has(l.to) || l.from === l.to) return;
    const key = l.from + '\u0000' + l.to;
    if (seen.has(key)) return;
    seen.add(key);
    lks.push({ from: l.from, to: l.to, type: l.type === 'contributing' ? 'contributing' : 'direct', mechanism: String(l.mechanism || '') });
  });
  return { events: evs, links: lks };
}

/* fetch both files, warn in the console about every problem, return the usable data */
export async function load(base = 'data/') {
  const get = async (name) => {
    const r = await fetch(base + name, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return r.json();
  };
  const [events, links] = await Promise.all([get('events.json'), get('links.json')]);
  const warnings = validate(events, links);
  warnings.forEach((w) => console.warn('[event map data] ' + w));
  return { ...normalise(events, links), warnings };
}
