'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Copy, Undo2, X } from 'lucide-react';
import { ASSIST_ACTIONS, type AssistAction } from '@/lib/assist-actions';
import type { AssistResult } from '@/lib/ai/assist';
import { countWords } from '@/lib/text';
import { Section } from './shared';

export interface Target {
  from: number;
  to: number;
  text: string;
  noteId: string | null;
  noteTitle: string | null;
}

interface Props {
  target: Target | null;
  targetEdited: boolean;
  selection: { from: number; to: number; text: string } | null;
  onUseSelection: () => void;
  onClear: () => void;
  onRun: (action: AssistAction, message: string | null) => void;
  running: AssistAction | null;
  result: { action: AssistAction; data: AssistResult } | null;
  error: string | null;
  onApply: (text: string) => boolean;
  onUndo: () => void;
}

const GROUPS: Array<{ title: string; actions: AssistAction[] }> = [
  { title: 'Think it through', actions: ['explain', 'questions', 'brainstorm', 'reflect', 'context'] },
  { title: 'See options for this passage', actions: ['clarify', 'tighten', 'transition', 'alternatives'] },
  { title: 'Check', actions: ['check'] },
];

export function ReviseTab(p: Props) {
  const [message, setMessage] = useState('');
  const [applied, setApplied] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const t = p.target;

  return (
    <div>
      <Section title="Revision help">
        <p className="text-[14px] leading-relaxed text-ink-2">
          Select a passage in your essay, or choose <span className="font-semibold text-ink">Work on this</span> on a note. Options only replace the
          passage you pick, and Stet does not invent experiences: where a detail only you know is missing, it asks or leaves a [placeholder].
        </p>

        {t ? (
          <div className="mt-4 rounded-md border border-rule bg-desk p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12.5px] font-semibold text-ink-3">{t.noteTitle ? `Working on: ${t.noteTitle}` : 'Selected passage'}</p>
              <button type="button" className="text-ink-3 hover:text-ink" onClick={p.onClear} aria-label="Clear passage">
                <X size={15} />
              </button>
            </div>
            <p className="quote mt-1 max-h-40 overflow-auto">&ldquo;{t.text}&rdquo;</p>
            <p className="mt-1 text-[12.5px] text-ink-3">{countWords(t.text)} words</p>
            {p.targetEdited && <p className="mt-1 text-[12.5px] text-medium">You have edited this passage since selecting it. Select it again to work on the new text.</p>}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-rule-strong p-3 text-[14px] text-ink-2">
            {p.selection ? (
              <button type="button" className="btn btn-sm" onClick={p.onUseSelection}>
                Use the selected {countWords(p.selection.text)} words
              </button>
            ) : (
              'No passage selected yet.'
            )}
          </div>
        )}
        {t && p.selection && p.selection.text !== t.text && (
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={p.onUseSelection}>Switch to the current selection</button>
        )}
      </Section>

      <Section title="What would help?">
        <div className="grid gap-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink-3">{g.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.actions.map((a) => {
                  const def = ASSIST_ACTIONS[a];
                  const needsNote = def.needsNote && !t?.noteId;
                  return (
                    <button
                      key={a}
                      type="button"
                      className={`btn btn-sm ${p.running === a ? 'border-pencil bg-pencil-wash' : ''}`}
                      disabled={!t || p.targetEdited || needsNote || p.running !== null}
                      title={needsNote ? 'Choose "Work on this" on a note first' : undefined}
                      onClick={() => {
                        setApplied(null);
                        p.onRun(a, message.trim() || null);
                      }}
                    >
                      {p.running === a ? 'Thinking…' : def.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div>
            <label className="label" htmlFor="assist-msg">Anything the assistant should know? <span className="font-normal text-ink-3">(optional)</span></label>
            <input id="assist-msg" className="field" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. I want to keep the joke about the dryer" />
          </div>
        </div>
      </Section>

      {p.error && (
        <div className="border-t border-rule px-5 py-4">
          <p role="alert" className="text-[14px] text-high">{p.error}</p>
        </div>
      )}

      {p.result && (
        <Section title={ASSIST_ACTIONS[p.result.action].label}>
          {p.result.data.verdict !== 'not_applicable' && (
            <p className={`mb-2 font-semibold ${p.result.data.verdict === 'addresses' ? 'text-keep' : p.result.data.verdict === 'partly' ? 'text-medium' : 'text-high'}`}>
              {{ addresses: 'Your revision addresses this.', partly: 'Your revision partly addresses this.', does_not: 'Not addressed yet.' }[p.result.data.verdict]}
            </p>
          )}
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{p.result.data.reply}</p>
          {p.result.data.options.length > 0 && (
            <ul className="mt-4 grid gap-3">
              {p.result.data.options.map((o, i) => (
                <li key={i} className="rounded-md border border-rule p-3">
                  <p className="quote">{o.text}</p>
                  {o.note && <p className="mt-1.5 text-[13px] text-ink-2">{o.note}</p>}
                  {o.newDetails.length > 0 && (
                    <p className="mt-1.5 text-[13px] text-medium">Mentions something not in your essay ({o.newDetails.join(', ')}). Only use it if it is true.</p>
                  )}
                  {/\[[^\]]+\]/.test(o.text) && <p className="mt-1.5 text-[13px] text-ink-2">Replace the [bracketed] part with your own detail.</p>}
                  <div className="mt-2 flex gap-1.5">
                    {applied === i ? (
                      <>
                        <span className="self-center text-[13px] text-keep">Applied to your essay.</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { p.onUndo(); setApplied(null); }}>
                          <Undo2 size={14} aria-hidden /> Undo
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-sm" disabled={!t || p.targetEdited || applied !== null} onClick={() => p.onApply(o.text) && setApplied(i)}>
                        Replace passage
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigator.clipboard?.writeText(o.text).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1500); })}
                    >
                      <Copy size={14} aria-hidden /> {copied === i ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {p.result.data.questions.length > 0 && (
            <ul className="mt-4 grid list-disc gap-1.5 pl-5 text-[14px] leading-relaxed text-ink-2 marker:text-ink-3">
              {p.result.data.questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          )}
          <p className="mt-4 text-[12.5px] text-ink-3">From {p.result.data.model}. Suggestions are optional; there is no single correct version.</p>
        </Section>
      )}

      <p className="border-t border-rule px-5 py-4 text-[12.5px] leading-relaxed text-ink-3">
        The Common App and many colleges treat submitting AI-generated content as your own work as misrepresentation. Use options as a starting
        point and keep the final words yours. <Link href="/method#policy" className="text-ink-3">More on this</Link>
      </p>
    </div>
  );
}
