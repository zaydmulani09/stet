import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Essays' },
  { href: '/prompts', label: 'Prompts' },
  { href: '/method', label: 'How it works' },
];

export function TopBar({ children, active, signedIn }: { children?: ReactNode; active?: string; signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-4 border-b border-rule bg-desk/95 px-4 backdrop-blur-[2px] sm:px-5">
      <Link href="/" className="wordmark text-ink" aria-label="Stet home">
        stet
      </Link>
      {children ?? (
        <nav className="flex min-w-0 items-center gap-1 text-[14px]" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active === n.href ? 'page' : undefined}
              className="rounded-md px-2.5 py-1.5 text-ink-2 no-underline hover:bg-desk-2 hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link href="/account" className="btn btn-ghost btn-sm no-underline">
          {signedIn ? 'Account' : 'Save your work'}
        </Link>
      </div>
    </header>
  );
}
