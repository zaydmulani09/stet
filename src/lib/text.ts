// Plain-text measurements shared by the editor, the server and the review engine.

export interface Span {
  start: number;
  end: number;
}

export interface Sentence extends Span {
  n: number; // 1-based, matches the [S#] markers the model sees
  text: string;
  paragraph: number; // 1-based
}

const WORD = /[\p{L}\p{N}]/u;

/** Whitespace-separated tokens that contain a letter or digit. A lone "—" or "&" is not a word. */
export function countWords(text: string): number {
  let n = 0;
  for (const tok of text.split(/\s+/)) if (WORD.test(tok)) n++;
  return n;
}

/** Characters including spaces, counted as code points (an emoji is one character). */
export function countChars(text: string): number {
  return [...text].length;
}

export interface LimitStatus {
  words: number;
  chars: number;
  over: boolean;
  under: boolean;
  message: string | null;
}

export function limitStatus(
  text: string,
  limits: { wordLimit?: number | null; charLimit?: number | null; minWords?: number | null },
): LimitStatus {
  const words = countWords(text);
  const chars = countChars(text);
  const { wordLimit, charLimit, minWords } = limits;
  if (wordLimit && words > wordLimit)
    return { words, chars, over: true, under: false, message: `${words - wordLimit} ${plural(words - wordLimit, 'word')} over the ${wordLimit}-word limit` };
  if (charLimit && chars > charLimit)
    return { words, chars, over: true, under: false, message: `${chars - charLimit} ${plural(chars - charLimit, 'character')} over the ${charLimit}-character limit` };
  if (minWords && words > 0 && words < minWords)
    return { words, chars, over: false, under: true, message: `${minWords - words} ${plural(minWords - words, 'word')} short of the ${minWords}-word minimum` };
  return { words, chars, over: false, under: false, message: null };
}

export function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/** Paragraph spans: runs of non-empty lines. A single line break starts a new paragraph, as in the Common App box. */
export function paragraphs(text: string): Span[] {
  const out: Span[] = [];
  const re = /[^\n]*\S[^\n]*/g;
  for (let m; (m = re.exec(text)); ) {
    const lead = m[0].length - m[0].trimStart().length;
    out.push({ start: m.index + lead, end: m.index + m[0].trimEnd().length });
  }
  return out;
}

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
// Intl.Segmenter ends a sentence after "Mrs." or "e.g."; these never end one in an essay.
const ABBREV = /(?:^|[\s(])(?:Mr|Mrs|Ms|Mx|Dr|Prof|St|Jr|Sr|Mt|Ave|vs|etc|approx|No|e\.g|i\.e|a\.m|p\.m|U\.S|U\.K)\.$/i;

export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  paragraphs(text).forEach((p, pi) => {
    const chunk = text.slice(p.start, p.end);
    let pending: { start: number; end: number } | null = null;
    for (const seg of segmenter.segment(chunk)) {
      const trimmed = seg.segment.trim();
      if (!trimmed) continue;
      const start = p.start + seg.index + (seg.segment.length - seg.segment.trimStart().length);
      const span: Span = { start: pending ? pending.start : start, end: start + trimmed.length };
      if (ABBREV.test(text.slice(span.start, span.end))) {
        pending = span;
        continue;
      }
      pending = null;
      out.push({ n: out.length + 1, ...span, text: text.slice(span.start, span.end), paragraph: pi + 1 });
    }
    if (pending) out.push({ n: out.length + 1, ...pending, text: text.slice(pending.start, pending.end), paragraph: pi + 1 });
  });
  return out;
}

/** Essay text with [S#] markers, one sentence per line, paragraphs separated by a blank line. */
export function numberedEssay(sents: Sentence[]): string {
  let out = '';
  let para = 0;
  for (const s of sents) {
    if (s.paragraph !== para) {
      if (para) out += '\n';
      para = s.paragraph;
    }
    out += `[S${s.n}] ${s.text}\n`;
  }
  return out.trimEnd();
}

export function wordsIn(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
}
