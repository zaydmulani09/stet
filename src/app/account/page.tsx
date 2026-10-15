import type { Metadata } from 'next';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { AccountForms } from '@/components/AccountForms';
import { currentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Account', robots: { index: false } };

export default async function AccountPage() {
  const user = await currentUser();
  return (
    <>
      <TopBar signedIn={Boolean(user?.email)} />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <h1 className="font-serif text-[28px] font-semibold">Account</h1>
        {user?.email ? (
          <p className="mt-2 text-ink-2">Signed in as <span className="font-semibold text-ink">{user.email}</span>.</p>
        ) : user ? (
          <p className="mt-2 text-ink-2">
            You are writing as a guest. Your essays are saved to this browser&rsquo;s session. Add an email and password to open them on another device
            or after clearing cookies.
          </p>
        ) : (
          <p className="mt-2 text-ink-2">Sign in to see your essays, or just <Link href="/new">start writing</Link>; an account is optional until you want your work on another device.</p>
        )}
        <AccountForms state={user?.email ? 'member' : user ? 'guest' : 'anonymous'} />
        <p className="mt-10 text-[13px] leading-relaxed text-ink-3">
          Stet cannot send email, so there is no password reset: keep your password somewhere safe, and use Export to keep your own copy.
          See <Link href="/method#privacy" className="text-ink-3">what Stet stores</Link>.
        </p>
      </main>
    </>
  );
}
