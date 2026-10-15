import { describe, expect, it } from 'vitest';
import { analyze } from '@/lib/analysis';

const group = (t: string, k: string) => analyze(t).groups.find((g) => g.kind === k);

describe('analyze', () => {
  it('finds stock phrases with exact offsets', () => {
    const t = 'Ever since I was a child, I loved maps. It changed my life.';
    const g = group(t, 'stock_phrase')!;
    expect(g.flagged).toBe(true);
    expect(g.items.map((m) => t.slice(m.start, m.end))).toEqual(['Ever since I was a child', 'changed my life']);
  });

  it('handles curly apostrophes', () => {
    const t = 'In today’s society, phones rule.';
    expect(group(t, 'stock_phrase')!.items[0].text).toBe('In today’s society');
  });

  it('only flags AI-associated vocabulary when several distinct words appear', () => {
    expect(group('We will delve into it.', 'ai_vocab')!.flagged).toBe(false);
    expect(group('We delve into a rich tapestry of ideas.', 'ai_vocab')!.flagged).toBe(true);
  });

  it('does not match inside other words', () => {
    expect(group('The realmless kingdom fostering nothing.', 'ai_vocab')!.items.map((m) => m.text)).toEqual(['fostering']);
  });

  it('flags runs of three sentences with the same first word', () => {
    const t = 'I ran. I fell. I got up. Then I left.';
    const g = group(t, 'repeated_opener')!;
    expect(g.items).toHaveLength(3);
    expect(g.items.every((m) => t.slice(m.start, m.end) === 'I')).toBe(true);
  });

  it('flags formal connectors at sentence start only', () => {
    const t = 'Moreover, it rained. Furthermore, it snowed. Ultimately, we stayed. I said moreover once.';
    const g = group(t, 'transition')!;
    expect(g.count).toBe(3);
    expect(g.flagged).toBe(true);
  });

  it('detects formula openings and summary endings', () => {
    const t = 'Webster defines courage as bravery. I swam.\n\nIn conclusion, I learned a lot.';
    expect(group(t, 'opening_formula')!.flagged).toBe(true);
    expect(group(t, 'closing_formula')!.items[0].text).toBe('In conclusion');
  });

  it('reports rhythm statistics', () => {
    const even = Array.from({ length: 12 }, () => 'This sentence has exactly six words.').join(' ');
    const a = analyze(even);
    expect(a.sentenceCount).toBe(12);
    expect(a.sentenceLengthCv).toBe(0);
    expect(a.rhythmFlagged).toBe(true);
    expect(analyze('Short. ' + 'A much longer sentence that keeps going and going for a while. '.repeat(5)).rhythmFlagged).toBe(false);
  });

  it('handles empty input', () => {
    const a = analyze('');
    expect(a.words).toBe(0);
    expect(a.groups).toEqual([]);
    expect(a.longestSentence).toBeNull();
  });
});
