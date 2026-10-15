'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { History, Loader2, Settings2, X } from 'lucide-react';
import { Editor, type Ann, type EditorHandle } from './Editor';
import { useAutosave, type Backup } from './useAutosave';
import { ReviewTab } from './ReviewTab';
import { VoiceTab } from './VoiceTab';
import { PatternsTab, measureId } from './PatternsTab';
import { ReviseTab, type Target } from './ReviseTab';
import { HistoryTab } from './HistoryTab';
import { EssaySettings, type SettingsValue } from '../EssaySettings';
import type { ItemState } from './shared';
import { analyze } from '@/lib/analysis';
import { reanchor } from '@/lib/anchor';
import { api, ApiError, timeAgo } from '@/lib/client';
import { LIBRARY_BY_ID } from '@/lib/prompt-library';
import { ESSAY_TYPES, type EssayType } from '@/lib/rubric';
import { limitStatus } from '@/lib/text';
import type { Note, ReviewPayload } from '@/lib/types';
import type { AssistAction } from '@/lib/assist-actions';
import type { AssistResult } from '@/lib/ai/assist';
import type { CheckResult } from '@/lib/ai/compare';

export interface EssayDTO extends SettingsValue {
  id: string;
  content: string;
  rev: number;
  is_sample: boolean;
  updated_at: string;
}

type Tab = 'review' | 'voice' | 'patterns' | 'revise' | 'history';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'review', label: 'Review' },
  { id: 'voice', label: 'Voice' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'revise', label: 'Revise' },
  { id: 'history', label: 'History' },
];

/** Every passage-anchored item in a review, with the editor mark it gets and the tab it lives on. */
function reviewItems(r: ReviewPayload | null): Array<{ id: string; anchor: Note['anchor']; kind: Ann['kind']; tab: Tab }> {
  if (!r) return [];
  const out: Array<{ id: string; anchor: Note['anchor']; kind: Ann['kind']; tab: Tab }> = [];
  for (const n of r.result.review?.notes ?? []) out.push({ id: n.id, anchor: n.anchor, kind: n.severity, tab: 'review' });
  for (const s of r.result.review?.strengths ?? []) out.push({ id: s.id, anchor: s.anchor, kind: 'keep', tab: 'review' });
  for (const k of r.result.voice?.keep ?? []) out.push({ id: k.id, anchor: k.anchor, kind: 'keep', tab: 'voice' });
  for (const g of r.result.voice?.generic ?? []) out.push({ id: g.id, anchor: g.anchor, kind: 'pattern', tab: 'voice' });
  for (const x of r.result.voice?.patterns ?? []) out.push({ id: x.id, anchor: x.anchor, kind: 'pattern', tab: 'patterns' });
  if (r.result.voice?.shift.anchor) out.push({ id: 'shift', anchor: r.result.voice.shift.anchor, kind: 'pattern', tab: 'patterns' });
  return out;
}

/** Re-finds each review item in the given text; items whose passage is gone are reported as lost. */
function anchorReview(r: ReviewPayload | null, text: string): { anns: Ann[]; lost: Set<string> } {
  const anns: Ann[] = [];
  const lost = new Set<string>();
  for (const it of reviewItems(r)) {
    const a = reanchor(text, it.anchor);
    if (!a) lost.add(it.id);
    else anns.push({ id: it.id, from: a.start, to: a.end, quote: a.quote, kind: it.kind });
  }
  return { anns, lost };
}

const noSubscribe = () => () => {};
function readBackupRaw(id: string): string | null {
  try {
    return localStorage.getItem(`stet:draft:${id}`);
  } catch {
    return null;
  }
}

export function Workspace({ essay, initialReview, signedIn }: { essay: EssayDTO; initialReview: ReviewPayload | null; signedIn: boolean }) {
  const editor = useRef<EditorHandle>(null);
  const autosave = useAutosave(essay.id, essay.content, essay.rev);
  const [text, setText] = useState(essay.content);
  const deferredText = useDeferredValue(text);
  const [meta, setMeta] = useState<SettingsValue>(essay);
  const [metaState, setMetaState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showSettings, setShowSettings] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [review, setReview] = useState<ReviewPayload | null>(initialReview);
  const [itemStatus, setItemStatus] = useState<Record<string, string>>(initialReview?.itemStatus ?? {});
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [anchored, setAnchored] = useState(() => anchorReview(initialReview, essay.content));
  const stale = anchored.lost;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialReview ? 'review' : 'patterns');
  const [mobileView, setMobileView] = useState<'write' | 'panel'>('write');
  const [selection, setSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const [running, setRunning] = useState<{ started: number; ac: AbortController } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [check, setCheck] = useState<{ running: boolean; result: CheckResult | null; error: string | null }>({ running: false, result: null, error: null });
  const [target, setTarget] = useState<Target | null>(null);
  const [targetEdited, setTargetEdited] = useState(false);
  const [assist, setAssist] = useState<{ running: AssistAction | null; result: { action: AssistAction; data: AssistResult } | null; error: string | null }>({ running: null, result: null, error: null });
  // Text that never reached the server (crash, tab closed while offline) is offered back.
  const storedBackup = useSyncExternalStore(noSubscribe, () => readBackupRaw(essay.id), () => null);
  const [backupDismissed, setBackupDismissed] = useState(false);
  const backup = useMemo(() => {
    if (backupDismissed || !storedBackup) return null;
    const b = JSON.parse(storedBackup) as Backup;
    return b.content !== essay.content && b.at > new Date(essay.updated_at).getTime() - 5_000 ? b : null;
  }, [storedBackup, backupDismissed, essay.content, essay.updated_at]);

  const items = useMemo(() => reviewItems(review), [review]);
  const analysis = useMemo(() => analyze(deferredText), [deferredText]);
  const limits = limitStatus(text, { wordLimit: meta.word_limit, charLimit: meta.char_limit, minWords: meta.min_words });
  const draftChanged = review ? text !== review.reviewedText : false;

  // Hand the anchored review marks to the editor whenever a review is attached.
  useEffect(() => {
    editor.current?.setAnnotations(anchored.anns);
  }, [anchored]);

  // Live deterministic findings for the Patterns tab.
  useEffect(() => {
    editor.current?.setMeasures(
      analysis.groups.filter((g) => g.flagged).flatMap((g) => g.items.map((m) => ({ id: measureId(m.kind, m.start), from: m.start, to: m.end, quote: m.text, kind: 'measure' as const }))),
    );
  }, [analysis]);

  // Which marks show in the essay depends on the open tab.
  useEffect(() => {
    const closed = (id: string) => itemStatus[id] === 'dismissed' || itemStatus[id] === 'resolved';
    const ids = new Set<string>();
    for (const it of items) if (it.tab === tab && !closed(it.id)) ids.add(it.id);
    if (tab === 'patterns') for (const g of analysis.groups) if (g.flagged) for (const m of g.items) ids.add(measureId(m.kind, m.start));
    editor.current?.setVisible(ids);
  }, [tab, items, itemStatus, analysis]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - running.started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  // Metadata (prompt, limits, title) saves separately from the essay text.
  const metaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateMeta = (next: SettingsValue) => {
    setMeta(next);
    setMetaState('saving');
    clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      try {
        await api(`/api/essays/${essay.id}`, { method: 'PATCH', body: { fields: { ...next, title: next.title || null, prompt_text: next.prompt_id ? null : next.prompt_text } } });
        setMetaState('saved');
      } catch {
        setMetaState('error');
      }
    }, 600);
  };

  const stateOf = useCallback((id: string): ItemState => (stale.has(id) ? 'stale' : edited.has(id) ? 'edited' : 'ok'), [stale, edited]);

  const jump = (id: string) => {
    setActiveId(id);
    if (editor.current?.focusAnn(id)) setMobileView('write');
  };

  const onAnnClick = (ids: string[]) => {
    const id = ids[0];
    setActiveId(id);
    editor.current?.setActive(id);
    const it = items.find((x) => x.id === id);
    if (it) setTab(it.tab);
    else if (id.startsWith('m:')) setTab('patterns');
    requestAnimationFrame(() => document.getElementById(`item-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  const runReview = async () => {
    setRunError(null);
    let rev: number;
    try {
      rev = await autosave.flush();
    } catch (e) {
      setRunError((e as Error).message);
      return;
    }
    void rev;
    const ac = new AbortController();
    setElapsed(0);
    setRunning({ started: Date.now(), ac });
    try {
      const { review: r } = await api<{ review: ReviewPayload }>(`/api/essays/${essay.id}/reviews`, { body: {}, signal: ac.signal });
      // The student may have kept typing while the review ran; anchor to the text as it is now.
      setAnchored(anchorReview(r, editor.current?.getText() ?? r.reviewedText));
      setEdited(new Set());
      setReview(r);
      setItemStatus(r.itemStatus);
      setCheck({ running: false, result: null, error: null });
      setTab('review');
      setMobileView('panel');
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'cancelled')) {
        const err = e as ApiError;
        setRunError(err.extra?.retryAfter ? `${err.message} (retry in about ${err.extra.retryAfter} s)` : err.message);
      }
    } finally {
      setRunning(null);
    }
  };

  const setStatus = async (id: string, status: 'open' | 'dismissed' | 'resolved') => {
    if (!review) return;
    const prev = itemStatus;
    const next = { ...itemStatus };
    if (status === 'open') delete next[id];
    else next[id] = status;
    setItemStatus(next);
    try {
      const r = await api<{ itemStatus: Record<string, string> }>(`/api/essays/${essay.id}/reviews/${review.id}`, { method: 'PATCH', body: { itemId: id, status } });
      setItemStatus(r.itemStatus);
    } catch {
      setItemStatus(prev);
    }
  };

  const setAssistTarget = (t: Target | null) => {
    setTarget(t);
    setTargetEdited(false);
    setAssist({ running: null, result: null, error: null });
    editor.current?.setTarget(t ? { id: 'target', from: t.from, to: t.to, quote: t.text, kind: 'selection' } : null);
  };

  const askAbout = (n: Note) => {
    const cur = editor.current?.current(n.id);
    if (!cur || cur.edited) {
      setTab('revise');
      setAssist({ running: null, result: null, error: 'That passage has changed since the review, so select the new text in the essay to work on it.' });
      return;
    }
    setAssistTarget({ from: cur.from, to: cur.to, text: cur.quote, noteId: n.id, noteTitle: n.title });
    setTab('revise');
  };

  const runAssist = async (action: AssistAction, message: string | null) => {
    const cur = editor.current?.current('target');
    if (!target || !cur || cur.edited) {
      setTargetEdited(true);
      return;
    }
    setAssist({ running: action, result: null, error: null });
    try {
      const rev = await autosave.flush();
      const { result } = await api<{ result: AssistResult }>(`/api/essays/${essay.id}/assist`, {
        body: { action, start: cur.from, end: cur.to, text: cur.quote, rev, reviewId: target.noteId ? review?.id ?? null : null, noteId: target.noteId, message },
      });
      setAssist({ running: null, result: { action, data: result }, error: null });
    } catch (e) {
      setAssist({ running: null, result: null, error: e instanceof Error ? e.message : 'The assistant failed.' });
    }
  };

  const applyOption = (replacement: string): boolean => {
    const cur = editor.current?.current('target');
    if (!cur || cur.edited) {
      setTargetEdited(true);
      return false;
    }
    const ok = editor.current!.replace(cur.from, cur.to, replacement);
    if (ok) editor.current?.setTarget({ id: 'target', from: cur.from, to: cur.from + replacement.length, quote: replacement, kind: 'selection' });
    return ok;
  };

  const runCheck = async () => {
    if (!review) return;
    setCheck({ running: true, result: null, error: null });
    try {
      const rev = await autosave.flush();
      const { result } = await api<{ result: CheckResult }>(`/api/essays/${essay.id}/check`, { body: { reviewId: review.id, rev } });
      setCheck({ running: false, result, error: null });
    } catch (e) {
      setCheck({ running: false, result: null, error: e instanceof Error ? e.message : 'Check failed.' });
    }
  };

  const libPrompt = meta.prompt_id ? LIBRARY_BY_ID.get(meta.prompt_id) : null;
  const promptText = libPrompt?.text ?? meta.prompt_text;
  const saveLabel = {
    saved: autosave.savedAt ? `Saved ${timeAgo(autosave.savedAt)}` : 'Saved',
    pending: 'Editing…',
    saving: 'Saving…',
    offline: 'Offline: changes kept in this browser, retrying',
    conflict: 'Changed elsewhere',
    error: 'Not saved',
  }[autosave.state];
  const meterLimit = meta.word_limit ?? null;
  const meterPct = meterLimit ? Math.min(100, (limits.words / meterLimit) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Title row */}
      <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-rule bg-desk/95 px-3 backdrop-blur-[2px] sm:px-4">
        <Link href="/" className="wordmark shrink-0 text-ink" aria-label="All essays">stet</Link>
        <label className="sr-only" htmlFor="title">Essay title</label>
        <input
          id="title"
          className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-[15px] font-semibold hover:border-rule focus:border-rule-strong focus:bg-paper focus:outline-none"
          value={meta.title}
          maxLength={200}
          onChange={(e) => updateMeta({ ...meta, title: e.target.value })}
        />
        <span
          className={`hidden shrink-0 text-[12.5px] sm:inline ${autosave.state === 'offline' || autosave.state === 'error' || autosave.state === 'conflict' ? 'font-semibold text-high' : 'text-ink-3'}`}
          role="status"
          aria-live="polite"
        >
          {saveLabel}
          {metaState === 'error' && ' · settings not saved'}
        </span>
        <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => { setTab('history'); setMobileView('panel'); }}>
          <History size={15} aria-hidden /> <span className="hidden md:inline">History</span>
        </button>
        <Link href="/account" className="btn btn-ghost btn-sm hidden shrink-0 no-underline md:inline-flex">{signedIn ? 'Account' : 'Save your work'}</Link>
      </header>

      {/* Mobile view switch */}
      <div className="sticky top-[52px] z-20 flex border-b border-rule bg-desk lg:hidden" role="tablist" aria-label="View">
        {(['write', 'panel'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)} className="flex-1 py-2.5 text-[14px] text-ink-2 aria-selected:font-semibold aria-selected:text-ink aria-selected:shadow-[inset_0_-2px_0_var(--pencil)]">
            {v === 'write' ? 'Essay' : 'Feedback'}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        {/* Writing column */}
        <div className={`min-w-0 ${mobileView === 'write' ? 'block' : 'hidden'} lg:block`}>
          <div className="mx-auto max-w-[820px] px-3 pb-28 pt-5 sm:px-6 sm:pt-8">
            {autosave.conflict && (
              <Banner tone="high">
                <span>This essay was changed in another tab or device since you opened it.</span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-sm" onClick={async () => { const t = await autosave.resolve('theirs'); if (t !== null) { editor.current?.setText(t); } }}>Load that version</button>
                  <button type="button" className="btn btn-sm" onClick={() => void autosave.resolve('mine')}>Keep mine</button>
                </span>
              </Banner>
            )}
            {autosave.error && <Banner tone="high"><span>Saving failed: {autosave.error} Your text is kept in this browser.</span></Banner>}
            {backup && (
              <Banner tone="medium">
                <span>This browser has unsaved text for this essay from {timeAgo(new Date(backup.at))}.</span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-sm" onClick={() => { editor.current?.setText(backup.content); setBackupDismissed(true); }}>Restore it</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => { try { localStorage.removeItem(`stet:draft:${essay.id}`); } catch {} setBackupDismissed(true); }}>Discard</button>
                </span>
              </Banner>
            )}

            {/* Prompt */}
            <div className="mb-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-ink-3">
                    {libPrompt ? `${libPrompt.source}${libPrompt.cycle ? ` ${libPrompt.cycle}` : ''} · ${libPrompt.title}` : ESSAY_TYPES[meta.essay_type as EssayType]}
                    {meta.college && !libPrompt?.source.includes(meta.college) ? ` · ${meta.college}` : ''}
                    {essay.is_sample && ' · Sample essay (fictional, written for this demo)'}
                  </p>
                  {promptText ? (
                    <button type="button" onClick={() => setPromptOpen((o) => !o)} aria-expanded={promptOpen} className={'mt-1 w-full max-w-[68ch] text-left text-[14.5px] leading-relaxed text-ink-2 sm:pointer-events-none ' + (promptOpen ? '' : 'line-clamp-2 sm:line-clamp-none')}>{promptText}</button>
                  ) : (
                    <p className="mt-1 text-[14.5px] text-ink-2">No prompt set. Add one so the review can check that you answer it.</p>
                  )}
                </div>
                <button type="button" className="btn btn-ghost btn-sm shrink-0" aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
                  {showSettings ? <X size={15} aria-hidden /> : <Settings2 size={15} aria-hidden />} <span className={showSettings ? '' : 'sr-only sm:not-sr-only'}>{showSettings ? 'Close' : 'Prompt and limits'}</span>
                </button>
              </div>
              {showSettings && (
                <div className="mt-3 rounded-[10px] border border-rule bg-paper p-4">
                  <EssaySettings value={meta} onChange={updateMeta} showTitle={false} />
                </div>
              )}
            </div>

            {/* The page */}
            <div className="rounded-[10px] border border-rule bg-paper px-5 py-7 shadow-sheet sm:px-12 sm:py-10">
              <Editor
                ref={editor}
                initial={essay.content}
                onChange={(t) => {
                  setText(t);
                  autosave.change(t);
                  // Back to the exact reviewed text (e.g. after undo): every note applies again.
                  if (review && t === review.reviewedText && edited.size) {
                    setAnchored(anchorReview(review, t));
                    setEdited(new Set());
                  }
                }}
                onSelection={setSelection}
                onAnnClick={onAnnClick}
                onEditedChange={(ids) => {
                  setEdited(ids);
                  const tgt = editor.current?.current('target');
                  setTargetEdited(Boolean(tgt?.edited));
                }}
              />
            </div>
          </div>

          {/* Status bar */}
          <div className="sticky bottom-0 z-10 border-t border-rule bg-desk">
            <div className="mx-auto flex max-w-[820px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-6">
              <div className="min-w-[150px]">
                <p className={`text-[14px] ${limits.over ? 'font-semibold text-high' : ''}`} aria-live="polite">
                  {limits.words}
                  {meterLimit ? ` / ${meterLimit}` : ''} words
                  <span className="text-ink-3"> · {limits.chars}{meta.char_limit ? ` / ${meta.char_limit}` : ''} characters</span>
                </p>
                {meterLimit && (
                  <div className="mt-1 h-[3px] w-full max-w-[220px] overflow-hidden rounded bg-desk-2" aria-hidden>
                    <div className={`h-full ${limits.over ? 'bg-high' : 'bg-pencil'}`} style={{ width: `${meterPct}%` }} />
                  </div>
                )}
              </div>
              {limits.message && <p className={`text-[13px] ${limits.over ? 'text-high' : 'text-medium'}`}>{limits.message}</p>}
              <span className="text-[12.5px] text-ink-3 sm:hidden">{saveLabel}</span>
              <div className="ml-auto flex items-center gap-2">
                {running ? (
                  <>
                    <span className="flex items-center gap-1.5 text-[13px] text-ink-2"><Loader2 size={15} className="animate-spin" aria-hidden /> Reviewing… {elapsed}s</span>
                    <button type="button" className="btn btn-sm" onClick={() => running.ac.abort()}>Cancel</button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={runReview} disabled={limits.words < 25}>
                    {review ? (draftChanged ? 'Review this draft' : 'Review again') : 'Review draft'}
                  </button>
                )}
              </div>
            </div>
            {runError && <p role="alert" className="mx-auto max-w-[820px] px-3 pb-2.5 text-[13.5px] text-high sm:px-6">{runError}</p>}
          </div>
        </div>

        {/* Margin panel */}
        <aside className={`min-w-0 border-l border-rule bg-paper ${mobileView === 'panel' ? 'block' : 'hidden'} lg:block`} aria-label="Feedback">
          <div className="lg:sticky lg:top-[52px] lg:h-[calc(100dvh-52px)] lg:overflow-y-auto">
            <div className="sticky top-[93px] z-10 flex border-b border-rule bg-paper px-2 lg:top-0" role="tablist" aria-label="Feedback views">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className="px-3 py-3 text-[14px] text-ink-2 hover:text-ink aria-selected:font-semibold aria-selected:text-ink aria-selected:shadow-[inset_0_-2px_0_var(--pencil)]"
                >
                  {t.label}
                </button>
              ))}
            </div>

            {running && tab !== 'history' && tab !== 'revise' && (
              <div className="border-b border-rule px-5 py-4 text-[14px] text-ink-2" aria-live="polite">
                Reading your draft against the {review ? 'rubric' : 'prompt and rubric'}. Most reviews take 10 to 40 seconds.
              </div>
            )}

            {tab === 'review' &&
              (review ? (
                <ReviewTab
                  review={review}
                  itemStatus={itemStatus}
                  stateOf={stateOf}
                  activeId={activeId}
                  onJump={jump}
                  onStatus={setStatus}
                  onAsk={askAbout}
                  draftChanged={draftChanged}
                  check={check}
                  onCheck={runCheck}
                  essayId={essay.id}
                />
              ) : (
                <NoReview onRun={runReview} disabled={Boolean(running) || limits.words < 25} words={limits.words} />
              ))}
            {tab === 'voice' && (review ? <VoiceTab voice={review.result.voice} error={review.result.errors.voice} stateOf={stateOf} onJump={jump} activeId={activeId} /> : <NoReview onRun={runReview} disabled={Boolean(running) || limits.words < 25} words={limits.words} />)}
            {tab === 'patterns' && <PatternsTab analysis={analysis} voice={review?.result.voice ?? null} stateOf={stateOf} onJump={jump} activeId={activeId} />}
            {tab === 'revise' && (
              <ReviseTab
                target={target}
                targetEdited={targetEdited}
                selection={selection}
                onUseSelection={() => selection && setAssistTarget({ ...selection, noteId: null, noteTitle: null })}
                onClear={() => setAssistTarget(null)}
                onRun={runAssist}
                running={assist.running}
                result={assist.result}
                error={assist.error}
                onApply={applyOption}
                onUndo={() => editor.current?.undo()}
              />
            )}
            {tab === 'history' && (
              <HistoryTab
                essayId={essay.id}
                onBeforeAction={autosave.flush}
                onRestored={(content, rev) => {
                  autosave.adopt(content, rev);
                  editor.current?.setText(content);
                }}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'high' | 'medium'; children: React.ReactNode }) {
  return (
    <div role="alert" className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border px-4 py-3 text-[14px] ${tone === 'high' ? 'border-high/40 bg-high-wash' : 'border-medium/40 bg-medium-wash'}`}>
      {children}
    </div>
  );
}

function NoReview({ onRun, disabled, words }: { onRun: () => void; disabled: boolean; words: number }) {
  return (
    <div className="px-5 py-6">
      <h3 className="text-[15px] font-semibold">No review yet</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        A review reads the saved draft against your prompt and a written rubric: an overall assessment, a revision plan, notes tied to exact
        passages, what is working, and a read of your voice. It takes 10 to 40 seconds.
      </p>
      <button type="button" className="btn btn-primary mt-4" onClick={onRun} disabled={disabled}>Review draft</button>
      {words < 25 && <p className="mt-2 text-[13px] text-ink-3">Write at least 25 words first.</p>}
      <p className="mt-6 text-[13px] leading-relaxed text-ink-3">
        Your essay text is sent to the AI provider listed on each review to generate it. <Link href="/method#privacy" className="text-ink-3">What is stored and where</Link>
      </p>
    </div>
  );
}
