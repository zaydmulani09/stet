'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, clockTime } from '@/lib/client';
import { Empty, Section } from './shared';

interface VersionRow {
  id: string;
  word_count: number;
  kind: 'manual' | 'review' | 'auto' | 'restore';
  label: string | null;
  created_at: string;
  has_review: boolean;
}

const KIND = { manual: 'Saved version', review: 'Reviewed draft', auto: 'Autosave checkpoint', restore: 'Restored' } as const;

export function HistoryTab({ essayId, onBeforeAction, onRestored }: { essayId: string; onBeforeAction: () => Promise<number>; onRestored: (content: string, rev: number) => void }) {
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await api<{ versions: VersionRow[] }>(`/api/essays/${essayId}/versions`)).versions);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load history.');
    }
  }, [essayId]);

  useEffect(() => {
    api<{ versions: VersionRow[] }>(`/api/essays/${essayId}/versions`)
      .then((r) => setRows(r.versions))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load history.'));
  }, [essayId]);

  return (
    <div>
      <Section title="Save this draft as a version">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!label.trim()) return;
            setBusy(true);
            setError(null);
            try {
              await onBeforeAction();
              await api(`/api/essays/${essayId}/versions`, { body: { label: label.trim() } });
              setLabel('');
              await load();
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Could not save the version.');
            }
            setBusy(false);
          }}
        >
          <label className="sr-only" htmlFor="v-label">Version name</label>
          <input id="v-label" className="field" placeholder="e.g. Before cutting to 650" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn" disabled={busy || !label.trim()}>Save</button>
        </form>
        <p className="mt-2 text-[12.5px] text-ink-3">Stet also keeps a checkpoint every 20 minutes of editing and a copy of every reviewed draft.</p>
      </Section>
      <Section title="Earlier drafts">
        {error && <p role="alert" className="mb-2 text-[14px] text-high">{error}</p>}
        {rows === null && !error && <Empty>Loading…</Empty>}
        {rows?.length === 0 && <Empty>No earlier drafts yet. They appear as you write and review.</Empty>}
        <ul className="grid">
          {rows?.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule py-2.5 text-[14px] last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{v.label ?? KIND[v.kind]}</p>
                <p className="text-[12.5px] text-ink-3">
                  {clockTime(v.created_at)} · {v.word_count} words{v.has_review ? ' · reviewed' : ''}
                </p>
              </div>
              <Link className="btn btn-ghost btn-sm no-underline" href={`/essays/${essayId}/compare?a=${v.id}`}>Compare</Link>
              {confirm === v.id ? (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const rev = await onBeforeAction();
                      const r = await api<{ rev: number; content: string }>(`/api/essays/${essayId}/versions`, { body: { restore: v.id, rev } });
                      onRestored(r.content, r.rev);
                      setConfirm(null);
                      await load();
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : 'Could not restore.');
                    }
                    setBusy(false);
                  }}
                >
                  Confirm restore
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(v.id)}>Restore</button>
              )}
            </li>
          ))}
        </ul>
        {confirm && <p className="mt-2 text-[12.5px] text-ink-3">Restoring keeps your current text as a version first, so you can switch back.</p>}
      </Section>
    </div>
  );
}
