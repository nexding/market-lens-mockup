/* Event Map: one small store that both views, the panel, the controls and the hidden list read from.
   set() merges a patch and tells every subscriber what changed. */

export function createStore(initial) {
  let state = { ...initial };
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      const changed = new Set(Object.keys(patch).filter((k) => prev[k] !== state[k]));
      if (changed.size) subs.forEach((fn) => fn(state, prev, changed));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  };
}
