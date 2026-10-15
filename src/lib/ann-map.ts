import type { ChangeDesc, Text } from '@codemirror/state';

export type AnnKind = 'high' | 'medium' | 'low' | 'keep' | 'pattern' | 'measure' | 'selection';

export interface Ann {
  id: string;
  from: number;
  to: number;
  quote: string;
  kind: AnnKind;
  edited?: boolean;
}

/**
 * Maps annotations through an editor change. Text inserted at either edge stays outside the
 * span; any change to the covered words marks the annotation edited (and it stays edited).
 */
export function mapAnns(anns: Ann[], changes: ChangeDesc, doc: Text): Ann[] {
  return anns.map((a) => {
    if (a.edited) return a;
    const from = changes.mapPos(a.from, 1);
    const to = changes.mapPos(a.to, -1);
    const edited = to <= from || doc.sliceString(from, to) !== a.quote;
    return { ...a, from, to, edited };
  });
}
