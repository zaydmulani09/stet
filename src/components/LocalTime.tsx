'use client';

import { useSyncExternalStore } from 'react';
import { clockTime } from '@/lib/client';

// Local times depend on the reader's timezone, which the server does not know. Render a
// timezone-free date during server rendering and hydration, then the local time.

const noSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

export function localTime(date: string | Date, hydrated: boolean, format: 'clock' | 'date' = 'clock'): string {
  const d = new Date(date);
  if (!hydrated) return d.toISOString().slice(0, 10);
  return format === 'clock' ? clockTime(d) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function LocalTime({ date, format = 'clock' }: { date: string | Date; format?: 'clock' | 'date' }) {
  const hydrated = useHydrated();
  return <time dateTime={new Date(date).toISOString()}>{localTime(date, hydrated, format)}</time>;
}
