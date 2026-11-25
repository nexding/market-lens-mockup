/* Event Map: the portfolio hook. Holdings come from ML.HOLD in mock.js, the same object every page uses; this is the
   one place to change when holdings move to real storage. The moves are sample numbers, labelled as such. */

export function heldTickers() {
  const H = (window.ML && window.ML.HOLD) || {};
  return Object.keys(H);
}

/* tickers of an event that are also held, in the event's order */
export function touched(ev, held = heldTickers()) {
  const set = new Set(held);
  return (ev.tickers || []).filter((t) => set.has(t));
}

/* sample % move for a held ticker over an event's window, or null when the sample file has none */
export function sampleMove(moves, eventId, ticker) {
  const row = moves && moves[eventId];
  const v = row ? row[ticker] : undefined;
  return typeof v === 'number' && isFinite(v) ? v : null;
}

export async function loadSampleMoves(url = 'data/holding-moves.sample.json') {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return {};
    const j = await r.json();
    return (j && j.moves) || {};
  } catch (e) { return {}; }
}
