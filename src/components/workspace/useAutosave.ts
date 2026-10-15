'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client';

// Autosave with no silent loss:
//  - every edit is mirrored to localStorage before it is sent
//  - saves carry the revision they were based on; a newer server copy returns 409 (conflict)
//  - network or server errors retry with backoff; the page warns before unload while unsaved

export type SaveState = 'saved' | 'pending' | 'saving' | 'offline' | 'conflict' | 'error';

export interface Backup {
  content: string;
  rev: number;
  at: number;
}

const key = (id: string) => `stet:draft:${id}`;

export function readBackup(id: string): Backup | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

function writeBackup(id: string, b: Backup | null) {
  try {
    if (b) localStorage.setItem(key(id), JSON.stringify(b));
    else localStorage.removeItem(key(id));
  } catch {
    /* private mode or quota: the server save still runs */
  }
}

export function useAutosave(id: string, initial: string, initialRev: number) {
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [conflict, setConflict] = useState<{ content: string; rev: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = useRef(initial);
  const saved = useRef(initial);
  const rev = useRef(initialRev);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const backoff = useRef(2000);
  const blocked = useRef(false); // conflict or permanent error: stop until the user decides
  const saveRef = useRef<() => Promise<boolean>>(async () => false); // lets retries call the latest save

  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) return inflight.current;
    if (blocked.current) return false;
    if (text.current === saved.current) {
      setState('saved');
      return true;
    }
    const sending = text.current;
    setState('saving');
    const run = (async () => {
      try {
        const { essay } = await api<{ essay: { rev: number } }>(`/api/essays/${id}`, { method: 'PATCH', body: { content: sending, rev: rev.current } });
        rev.current = essay.rev;
        saved.current = sending;
        backoff.current = 2000;
        setSavedAt(new Date());
        setError(null);
        if (text.current === sending) writeBackup(id, null);
        return true;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, 'offline', 'Offline');
        if (err.status === 409 && err.code === 'conflict') {
          blocked.current = true;
          setConflict({ content: String(err.extra.content ?? ''), rev: Number(err.extra.rev ?? 0) });
          setState('conflict');
        } else if (err.status === 0 || err.status >= 500 || err.status === 429) {
          setState('offline');
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void saveRef.current(), backoff.current);
          backoff.current = Math.min(backoff.current * 2, 30_000);
        } else {
          blocked.current = true;
          setError(err.message);
          setState('error');
        }
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    const ok = await run;
    if (ok) {
      if (text.current !== saved.current) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => void saveRef.current(), 300);
        setState('pending');
      } else setState('saved');
    }
    return ok;
  }, [id]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const change = useCallback(
    (t: string) => {
      text.current = t;
      if (t === saved.current) return;
      writeBackup(id, { content: t, rev: rev.current, at: Date.now() });
      if (!blocked.current) setState((s) => (s === 'offline' ? s : 'pending'));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void saveRef.current(), 900);
    },
    [id],
  );

  /** Waits until the current text is on the server; returns its revision or throws. */
  const flush = useCallback(async (): Promise<number> => {
    clearTimeout(timer.current);
    for (let i = 0; i < 5 && text.current !== saved.current; i++) {
      if (!(await save())) break;
    }
    if (inflight.current) await inflight.current;
    if (text.current !== saved.current) throw new ApiError(0, 'unsaved', 'Your latest changes are not saved yet, so this action would use an older draft. Check the save status and try again.');
    return rev.current;
  }, [save]);

  /** Conflict resolution. 'theirs' returns the server text for the editor to load. */
  const resolve = useCallback(
    async (choice: 'mine' | 'theirs'): Promise<string | null> => {
      if (!conflict) return null;
      rev.current = conflict.rev;
      blocked.current = false;
      setConflict(null);
      if (choice === 'theirs') {
        saved.current = conflict.content;
        text.current = conflict.content;
        writeBackup(id, null);
        setState('saved');
        return conflict.content;
      }
      // Keep a copy of the other text before overwriting it.
      await api(`/api/essays/${id}/versions`, { body: { label: 'Other tab, before overwrite' } }).catch(() => undefined);
      await save();
      return null;
    },
    [conflict, id, save],
  );

  /** After a restore from history the server already holds the new text and revision. */
  const adopt = useCallback((content: string, newRev: number) => {
    text.current = content;
    saved.current = content;
    rev.current = newRev;
    writeBackup(id, null);
    setState('saved');
    setSavedAt(new Date());
  }, [id]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (text.current !== saved.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timer.current);
    };
  }, []);

  return { state, savedAt, conflict, error, change, flush, resolve, adopt, rev: () => rev.current };
}
