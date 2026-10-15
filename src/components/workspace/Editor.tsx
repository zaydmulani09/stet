'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, placeholder as cmPlaceholder, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands';
import { mapAnns, type Ann } from '@/lib/ann-map';

export type { Ann, AnnKind } from '@/lib/ann-map';

// Annotations live in editor state and are mapped through every edit. If the words an
// annotation covers change at all, it is marked edited and its highlight disappears, so
// feedback never drifts onto text it was not about.
//   anns     - review and voice items (anchored once, then mapped)
//   measures - deterministic findings, recomputed from the live text
//   target   - the passage the assistant is working on

interface AnnState {
  anns: Ann[];
  measures: Ann[];
  target: Ann | null;
  visible: Set<string>;
  active: string | null;
}

const setAnns = StateEffect.define<Ann[]>();
const setMeasures = StateEffect.define<Ann[]>();
const setTarget = StateEffect.define<Ann | null>();
const setVisible = StateEffect.define<Set<string>>();
const setActive = StateEffect.define<string | null>();

const annField = StateField.define<AnnState>({
  create: () => ({ anns: [], measures: [], target: null, visible: new Set(), active: null }),
  update(v, tr) {
    let next = v;
    if (tr.docChanged) {
      next = {
        ...v,
        anns: mapAnns(v.anns, tr.changes, tr.state.doc),
        measures: mapAnns(v.measures, tr.changes, tr.state.doc),
        target: v.target ? mapAnns([v.target], tr.changes, tr.state.doc)[0] : null,
      };
    }
    for (const e of tr.effects) {
      if (e.is(setAnns)) next = { ...next, anns: e.value };
      if (e.is(setMeasures)) next = { ...next, measures: e.value };
      if (e.is(setTarget)) next = { ...next, target: e.value };
      if (e.is(setVisible)) next = { ...next, visible: e.value };
      if (e.is(setActive)) next = { ...next, active: e.value };
    }
    return next;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (v): DecorationSet => {
      const shown = [...v.anns, ...v.measures].filter((a) => v.visible.has(a.id) && !a.edited && a.to > a.from);
      if (v.target && !v.target.edited) shown.push(v.target);
      return Decoration.set(
        shown.map((a) => Decoration.mark({ class: `ann ann-${a.kind}${a.id === v.active ? ' ann-active' : ''}` }).range(a.from, a.to)),
        true,
      );
    }),
});

export interface EditorHandle {
  setAnnotations(anns: Ann[]): void;
  setMeasures(anns: Ann[]): void;
  setTarget(a: Ann | null): void;
  setVisible(ids: Set<string>): void;
  setActive(id: string | null): void;
  focusAnn(id: string): boolean;
  current(id: string): Ann | null;
  replace(from: number, to: number, text: string): boolean;
  undo(): void;
  getText(): string;
  setText(text: string): void;
  focus(): void;
}

interface Props {
  initial: string;
  onChange: (text: string) => void;
  onSelection: (sel: { from: number; to: number; text: string } | null) => void;
  onAnnClick: (ids: string[]) => void;
  onEditedChange: (edited: Set<string>) => void;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor({ initial, onChange, onSelection, onAnnClick, onEditedChange }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ onChange, onSelection, onAnnClick, onEditedChange });
  useEffect(() => {
    cb.current = { onChange, onSelection, onAnnClick, onEditedChange };
  });

  useEffect(() => {
    let lastEdited = '';
    const exts: Extension[] = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      cmPlaceholder('Start writing, or paste your draft here.'),
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'sentences', 'aria-label': 'Essay text' }),
      annField,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          cb.current.onChange(u.state.doc.toString());
          const edited = u.state.field(annField).anns.filter((a) => a.edited).map((a) => a.id);
          const key = edited.join(',');
          if (key !== lastEdited) {
            lastEdited = key;
            cb.current.onEditedChange(new Set(edited));
          }
        }
        if (u.selectionSet || u.docChanged) {
          const r = u.state.selection.main;
          cb.current.onSelection(r.empty ? null : { from: r.from, to: r.to, text: u.state.sliceDoc(r.from, r.to) });
        }
      }),
      EditorView.domEventHandlers({
        click(e, v) {
          if (!v.state.selection.main.empty) return false;
          const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
          if (pos == null) return false;
          const st = v.state.field(annField);
          const hits = [...st.anns, ...st.measures]
            .filter((a) => st.visible.has(a.id) && !a.edited && a.from <= pos && pos <= a.to)
            .sort((a, b) => a.to - a.from - (b.to - b.from));
          if (hits.length) cb.current.onAnnClick(hits.map((h) => h.id));
          return false;
        },
      }),
    ];
    const v = new EditorView({ parent: host.current!, state: EditorState.create({ doc: initial, extensions: exts }) });
    view.current = v;
    return () => v.destroy();
    // The editor owns its document after mount; `initial` is only the starting text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => {
    const dispatch = (effects: StateEffect<unknown>[]) => view.current?.dispatch({ effects });
    const find = (id: string) => {
      const st = view.current?.state.field(annField);
      return [...(st?.anns ?? []), ...(st?.measures ?? [])].find((x) => x.id === id) ?? null;
    };
    return {
      setAnnotations: (anns) => dispatch([setAnns.of(anns)]),
      setMeasures: (anns) => dispatch([setMeasures.of(anns)]),
      setTarget: (a) => dispatch([setTarget.of(a)]),
      setVisible: (ids) => dispatch([setVisible.of(ids)]),
      setActive: (id) => dispatch([setActive.of(id)]),
      current: (id) => {
        if (id === 'target') return view.current?.state.field(annField).target ?? null;
        return find(id);
      },
      focusAnn(id) {
        const v = view.current;
        const a = find(id);
        if (!v || !a || a.edited) return false;
        v.dispatch({ effects: [setActive.of(id), EditorView.scrollIntoView(a.from, { y: 'center' })] });
        return true;
      },
      replace(from, to, text) {
        const v = view.current;
        if (!v || to > v.state.doc.length) return false;
        v.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, userEvent: 'input.stet', scrollIntoView: true });
        v.focus();
        return true;
      },
      undo() {
        if (view.current) undo(view.current);
      },
      getText: () => view.current?.state.doc.toString() ?? '',
      setText(text) {
        const v = view.current;
        if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
      },
      focus: () => view.current?.focus(),
    };
  }, []);

  return <div ref={host} className="min-h-[55vh]" />;
});
