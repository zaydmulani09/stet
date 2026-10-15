import Link from 'next/link';
import { UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Essays' },
  { href: '/prompts', label: 'Prompts' },
  { href: '/method', label: 'How it works' },
];

export function TopBar({ children, active, signedIn }: { children?: ReactNode; active?: string; signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-2 border-b sm:gap-4 border-rule bg-desk/95 px-4 backdrop-blur-[2px] sm:px-5">
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
              className="whitespace-nowrap rounded-md px-2 py-1.5 text-ink-2 no-underline sm:px-2.5 hover:bg-desk-2 hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Link href="/account" className="btn btn-ghost btn-sm no-underline" aria-label={signedIn ? 'Account' : 'Save your work'}>
          <UserRound size={16} aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{signedIn ? 'Account' : 'Save your work'}</span>
        </Link>
      </div>
    </header>
  );
}
