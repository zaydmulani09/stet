import { createHash } from 'node:crypto';
import { locateQuote, type Anchor } from '../anchor';
import type { Sentence } from '../text';

// Grounding: turns model-cited (sentence, quote) pairs into verified anchors, or drops them.

export function stableId(prefix: string, ...parts: Array<string | number>): string {
  return `${prefix}_${createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 10)}`;
}

export function ground(text: string, sents: Sentence[], sentence: number | null, quote: string): Anchor | null {
  const s = sentence ? sents.find((x) => x.n === sentence) : undefined;
  return locateQuote(text, quote, s ? { within: s, near: s.start } : {});
}

/** Anchors each item; returns kept items and how many cited text that is not in the essay. */
export function groundAll<T extends { sentence: number | null; quote: string }>(
  text: string,
  sents: Sentence[],
  items: T[],
): { kept: Array<{ item: T; anchor: Anchor; index: number }>; dropped: number } {
  const kept: Array<{ item: T; anchor: Anchor; index: number }> = [];
  let dropped = 0;
  items.forEach((item, index) => {
    const anchor = ground(text, sents, item.sentence, item.quote);
    if (anchor) kept.push({ item, anchor, index });
    else dropped++;
  });
  return { kept, dropped };
}

export const QUOTE_RULE =
  'Every "quote" must be copied character-for-character from the essay: 3 to 25 consecutive words from a single sentence, no ellipses, no paraphrase, no added punctuation. Put that sentence\'s number in "sentence". If you cannot quote it, leave the point out.';
