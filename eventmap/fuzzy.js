/* Event Map: forgiving title search. Every word of the query must appear in the text, either as a substring or as
   letters in order; substrings, word starts and runs of consecutive letters score higher. Pure. */

function fold(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }

function isStart(text, i) { return i === 0 || /[^a-z0-9]/.test(text[i - 1]); }

/* score of one query word against folded text, or -Infinity when it does not match */
function wordScore(word, text) {
  const at = text.indexOf(word);
  if (at >= 0) return 100 + word.length * 4 + (isStart(text, at) ? 30 : 0) - at * 0.2;
  /* letters in order: first try jumping to word starts (scores better), then plain earliest matches */
  const s = inOrder(word, text, true);
  return s > -Infinity ? s : inOrder(word, text, false);
}

function inOrder(word, text, preferStarts) {
  let score = 0, ti = 0, prev = -2;
  for (let qi = 0; qi < word.length; qi++) {
    const ch = word[qi];
    let found = -1;
    for (let k = ti; k < text.length; k++) {
      if (text[k] !== ch) continue;
      if (found < 0) found = k;
      if (!preferStarts || k === prev + 1 || isStart(text, k)) { found = k; break; }
    }
    if (found < 0) return -Infinity;
    score += 2;
    if (found === prev + 1) score += 4;
    if (isStart(text, found)) score += 6;
    score -= Math.min(6, (found - ti) * 0.25);
    prev = found; ti = found + 1;
  }
  return score;
}

export function score(query, text) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return -Infinity;
  const t = fold(text);
  let total = 0;
  for (const w of words) {
    const s = wordScore(w, t);
    if (s === -Infinity) return -Infinity;
    total += s;
  }
  return total;
}

/* the best matches, highest first; ties keep the original order */
export function search(items, query, textOf, limit = 8) {
  const out = [];
  items.forEach((it, i) => { const s = score(query, textOf(it)); if (s > -Infinity) out.push({ it, s, i }); });
  out.sort((a, b) => b.s - a.s || a.i - b.i);
  return out.slice(0, limit).map((r) => r.it);
}
