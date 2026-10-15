import { describe, expect, it } from 'vitest';
import { countChars, countWords, limitStatus, numberedEssay, paragraphs, sentences } from '@/lib/text';
import { locateQuote, makeAnchor, reanchor } from '@/lib/anchor';

describe('counts', () => {
  it('counts words like an application box', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords("I don't know — maybe.")).toBe(4); // lone dash is not a word
    expect(countWords('well-known U.S. 2026 essays\n\nnew paragraph')).toBe(6);
  });

  it('counts characters as code points', () => {
    expect(countChars('abc')).toBe(3);
    expect(countChars('café 🙂')).toBe(6);
  });

  it('reports limits', () => {
    const t = 'one two three four five';
    expect(limitStatus(t, { wordLimit: 5 }).over).toBe(false);
    const over = limitStatus(t, { wordLimit: 4 });
    expect(over.over).toBe(true);
    expect(over.message).toBe('1 word over the 4-word limit');
    expect(limitStatus(t, { charLimit: 10 }).message).toBe('13 characters over the 10-character limit');
    expect(limitStatus(t, { minWords: 10 }).message).toBe('5 words short of the 10-word minimum');
    expect(limitStatus('', { minWords: 10 }).under).toBe(false); // empty draft is not "short"
  });
});

describe('sentences and paragraphs', () => {
  const essay = 'First line here. Second one!\n\n  Third paragraph? Yes.\nFourth line';
  it('splits paragraphs on any line break', () => {
    expect(paragraphs(essay).map((p) => essay.slice(p.start, p.end))).toEqual([
      'First line here. Second one!',
      'Third paragraph? Yes.',
      'Fourth line',
    ]);
  });
  it('does not split after titles and common abbreviations', () => {
    const t = 'Mrs. Adeyemi waved. Dr. Lee and Mr. Ruiz left at 9 p.m. today, e.g. on time. Done.';
    const s = sentences(t);
    expect(s.map((x) => x.text)).toEqual(['Mrs. Adeyemi waved.', 'Dr. Lee and Mr. Ruiz left at 9 p.m. today, e.g. on time.', 'Done.']);
    for (const x of s) expect(t.slice(x.start, x.end)).toBe(x.text);
  });

  it('numbers sentences with offsets that point into the text', () => {
    const s = sentences(essay);
    expect(s.map((x) => x.text)).toEqual(['First line here.', 'Second one!', 'Third paragraph?', 'Yes.', 'Fourth line']);
    for (const x of s) expect(essay.slice(x.start, x.end)).toBe(x.text);
    expect(s.map((x) => x.paragraph)).toEqual([1, 1, 2, 2, 3]);
    expect(numberedEssay(s)).toBe('[S1] First line here.\n[S2] Second one!\n\n[S3] Third paragraph?\n[S4] Yes.\n\n[S5] Fourth line');
  });
});

describe('locateQuote', () => {
  const essay = 'My grandmother’s kitchen smelled like burnt cumin. I learned a lot.\nLater, I learned a lot again — differently.';

  it('finds exact quotes', () => {
    const a = locateQuote(essay, 'smelled like burnt cumin')!;
    expect(essay.slice(a.start, a.end)).toBe('smelled like burnt cumin');
  });

  it('tolerates straight vs curly quotes, case and spacing', () => {
    const a = locateQuote(essay, "\"my grandmother's   KITCHEN\"")!;
    expect(essay.slice(a.start, a.end)).toBe('My grandmother’s kitchen');
  });

  it('rejects invented quotes', () => {
    expect(locateQuote(essay, 'the smell of saffron')).toBeNull();
    expect(locateQuote(essay, 'ab')).toBeNull();
  });

  it('uses the cited sentence to choose among repeated phrases', () => {
    const second = essay.indexOf('Later');
    const a = locateQuote(essay, 'I learned a lot', { within: { start: second, end: essay.length } })!;
    expect(a.start).toBeGreaterThan(second);
    const b = locateQuote(essay, 'I learned a lot')!;
    expect(b.start).toBeLessThan(second);
  });

  it('matches first...last quotes inside a short window', () => {
    const a = locateQuote(essay, 'My grandmother’s kitchen ... burnt cumin')!;
    expect(essay.slice(a.start, a.end)).toBe('My grandmother’s kitchen smelled like burnt cumin');
  });

  it('matches em dash written as a hyphen', () => {
    const a = locateQuote(essay, 'again - differently')!;
    expect(essay.slice(a.start, a.end)).toBe('again — differently');
  });
});

describe('reanchor', () => {
  const v1 = 'Intro sentence. The bus was late every day. Ending.';
  const a = makeAnchor(v1, v1.indexOf('The bus'), v1.indexOf(' Ending'));

  it('keeps anchors when text before them changes', () => {
    const v2 = 'A brand new intro that is much longer. The bus was late every day. Ending.';
    const b = reanchor(v2, a)!;
    expect(v2.slice(b.start, b.end)).toBe('The bus was late every day.');
  });

  it('drops anchors whose passage was edited', () => {
    const v2 = 'Intro sentence. The bus was late most days. Ending.';
    expect(reanchor(v2, a)).toBeNull();
  });

  it('uses context to pick between duplicate passages, and refuses when context is gone', () => {
    const t = 'Alpha. Same words here. Beta. Same words here. Gamma.';
    const second = makeAnchor(t, t.lastIndexOf('Same'), t.lastIndexOf('Same') + 'Same words here.'.length);
    const edited = 'Alpha!! Same words here. Beta. Same words here. Gamma.';
    const r = reanchor(edited, second)!;
    expect(r.start).toBe(edited.lastIndexOf('Same'));
    const scrambled = 'Same words here. x Same words here. y';
    expect(reanchor(scrambled, second)).toBeNull();
  });
});
