// Ties feedback to exact passages. A quote either maps to a real span of the
// essay or it is rejected; nothing is attached to "roughly the right place".

import type { Span } from './text';

export interface Anchor extends Span {
  quote: string; // exact text of the essay at [start, end) when the anchor was made
  prefix: string; // up to CONTEXT chars before, for re-finding the passage after edits
  suffix: string;
}

const CONTEXT = 32;

/** Lowercase, straight quotes, plain hyphens, single spaces. Keeps a map back to original offsets. */
function normalize(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (/\s/.test(c)) {
      if (lastSpace) continue;
      c = ' ';
      lastSpace = true;
    } else {
      lastSpace = false;
      if (c === '‘' || c === '’' || c === '`' || c === 'ʼ') c = "'";
      else if (c === '“' || c === '”') c = '"';
      else if (c === '–' || c === '—' || c === '‑') c = '-';
      else if (c === '…') {
        norm += '..';
        map.push(i, i);
        c = '.';
      } else c = c.toLowerCase();
    }
    norm += c;
    map.push(i);
  }
  return { norm, map };
}

function cleanQuote(q: string): string {
  return q
    .trim()
    .replace(/^\[S\d+\]\s*/, '')
    .replace(/^["“'‘]+|["”'’]+$/g, '')
    .trim();
}

function occurrences(hay: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) out.push(i);
  return out;
}

export function makeAnchor(text: string, start: number, end: number): Anchor {
  return {
    start,
    end,
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  };
}

export interface LocateOptions {
  /** Preferred region (e.g. the sentence the model cited). Used to pick among repeats. */
  within?: Span;
  /** Original offset hint, for nearest-match tie-breaking. */
  near?: number;
}

/**
 * Find a model-supplied quote in the essay. Tolerates whitespace, curly-quote, dash and case
 * differences only. A quote with an ellipsis matches when its first and last parts are both found
 * inside one sentence-sized window. Returns null when the words are not in the essay.
 */
export function locateQuote(text: string, rawQuote: string, opts: LocateOptions = {}): Anchor | null {
  const quote = cleanQuote(rawQuote);
  if (quote.length < 3) return null;
  const { norm, map } = normalize(text);
  const toSpan = (ns: number, ne: number): Anchor => makeAnchor(text, map[ns], map[ne - 1] + 1);

  const pick = (starts: number[]): number | null => {
    if (!starts.length) return null;
    const inside = opts.within
      ? starts.filter((s) => map[s] >= opts.within!.start && map[s] < opts.within!.end)
      : [];
    const pool = inside.length ? inside : starts;
    if (opts.near === undefined) return pool[0];
    return pool.reduce((best, s) => (Math.abs(map[s] - opts.near!) < Math.abs(map[best] - opts.near!) ? s : best));
  };

  const nq = normalize(quote).norm;
  const direct = pick(occurrences(norm, nq));
  if (direct !== null) return toSpan(direct, direct + nq.length);

  // "first words ... last words"
  const parts = nq.split(/\s*(?:\.\.\.|\.\.)\s*/).filter((p) => p.length >= 3);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    const ends = new Map<number, number>();
    for (const s of occurrences(norm, first)) {
      const e = norm.indexOf(last, s + first.length);
      if (e !== -1 && e + last.length - s <= 400) ends.set(s, e + last.length);
    }
    const s = pick([...ends.keys()]);
    if (s !== null) return toSpan(s, ends.get(s)!);
  }
  return null;
}

function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Re-find an anchor in edited text. Exact quote text is required; context decides between repeats.
 * Returns null when the passage itself was changed, so stale feedback is never shown on the wrong words.
 */
export function reanchor(text: string, a: Anchor): Anchor | null {
  if (text.slice(a.start, a.end) === a.quote) return makeAnchor(text, a.start, a.end);
  const hits = occurrences(text, a.quote);
  if (!hits.length) return null;
  let best = -1;
  let bestScore = -Infinity;
  for (const s of hits) {
    const ctx =
      commonSuffixLen(text.slice(Math.max(0, s - a.prefix.length), s), a.prefix) +
      commonPrefixLen(text.slice(s + a.quote.length, s + a.quote.length + a.suffix.length), a.suffix);
    const score = ctx * 10 - Math.abs(s - a.start) / 100;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  // With several identical passages, demand some surrounding context to agree.
  if (hits.length > 1) {
    const ctx = Math.floor((bestScore + Math.abs(best - a.start) / 100) / 10);
    if (ctx < 8) return null;
  }
  return makeAnchor(text, best, best + a.quote.length);
}
