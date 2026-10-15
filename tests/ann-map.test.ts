import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { mapAnns, type Ann } from '@/lib/ann-map';

const doc = 'Alpha beta gamma. I learned a lot. Delta.';
const quote = 'I learned a lot';
const at = doc.indexOf(quote);
const base: Ann[] = [
  { id: 'n1', from: at, to: at + quote.length, quote, kind: 'high' },
  { id: 'k1', from: 0, to: 5, quote: 'Alpha', kind: 'keep' },
  // overlapping annotation on the same words
  { id: 'p1', from: at, to: at + 'I learned'.length, quote: 'I learned', kind: 'pattern' },
];

function apply(changes: { from: number; to?: number; insert?: string }) {
  const s = EditorState.create({ doc });
  const tr = s.update({ changes });
  return { anns: mapAnns(base, tr.changes, tr.state.doc), text: tr.state.doc.toString() };
}

describe('mapAnns', () => {
  it('shifts annotations when text is inserted before them', () => {
    const { anns, text } = apply({ from: 0, insert: 'New opening. ' });
    const n = anns.find((a) => a.id === 'n1')!;
    expect(n.edited).toBe(false);
    expect(text.slice(n.from, n.to)).toBe(quote);
  });

  it('keeps inserts at the edges outside the span', () => {
    const { anns, text } = apply({ from: at, insert: 'Honestly, ' });
    const n = anns.find((a) => a.id === 'n1')!;
    expect(n.edited).toBe(false);
    expect(text.slice(n.from, n.to)).toBe(quote);
  });

  it('marks an annotation edited when its words change, and leaves others alone', () => {
    const { anns } = apply({ from: at + 2, to: at + 9, insert: 'figured out' });
    expect(anns.find((a) => a.id === 'n1')!.edited).toBe(true);
    expect(anns.find((a) => a.id === 'p1')!.edited).toBe(true);
    expect(anns.find((a) => a.id === 'k1')!.edited).toBe(false);
  });

  it('marks an annotation edited when its passage is deleted', () => {
    const { anns } = apply({ from: at - 1, to: at + quote.length + 1 });
    expect(anns.find((a) => a.id === 'n1')!.edited).toBe(true);
  });

  it('never un-marks an edited annotation, even if the words are typed back', () => {
    const s0 = EditorState.create({ doc });
    const t1 = s0.update({ changes: { from: at, to: at + 1, insert: 'X' } });
    const a1 = mapAnns(base, t1.changes, t1.state.doc);
    const t2 = t1.state.update({ changes: { from: at, to: at + 1, insert: 'I' } });
    const a2 = mapAnns(a1, t2.changes, t2.state.doc);
    expect(a2.find((a) => a.id === 'n1')!.edited).toBe(true);
  });
});
