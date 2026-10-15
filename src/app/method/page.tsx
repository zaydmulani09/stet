import type { Metadata } from 'next';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { currentUser } from '@/lib/session';
import { DIMENSIONS, DIMENSIONS_FOR, ESSAY_TYPES, ESSAY_TYPE_KEYS, type DimensionKey } from '@/lib/rubric';

export const metadata: Metadata = {
  title: 'How Stet reviews',
  description: 'The rubric, how feedback is tied to your text, why there is no AI score, and what is stored.',
};

const TOC = [
  ['review', 'How a review works'],
  ['rubric', 'The rubric'],
  ['patterns', 'The pattern check, and why there is no AI score'],
  ['policy', 'Revision help and application rules'],
  ['privacy', 'What is stored and who processes it'],
  ['limits', 'Limits'],
] as const;

export default async function MethodPage() {
  const user = await currentUser();
  return (
    <>
      <TopBar active="/method" signedIn={Boolean(user?.email)} />
      <main className="mx-auto grid w-full max-w-[1080px] gap-10 px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-[76px] lg:self-start">
          <ul className="grid gap-1.5 text-[14px]">
            {TOC.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="text-ink-2 no-underline hover:text-ink hover:underline">{label}</a></li>
            ))}
          </ul>
        </nav>
        <article className="max-w-[70ch] text-[15.5px] leading-relaxed [&_h2]:mt-12 [&_h2]:scroll-mt-20 [&_h2]:font-serif [&_h2]:text-[24px] [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_p]:mt-3 [&_li]:mt-1.5">
          <h1 className="font-serif text-[32px] font-semibold leading-tight">How Stet reviews an essay</h1>
          <p className="text-ink-2">The short version: a language model reads your draft against your prompt and a written rubric, and code checks every passage it cites. Counts and patterns are measured by code. Nothing is rewritten without you choosing it.</p>

          <h2 id="review">How a review works</h2>
          <ol className="list-decimal pl-5">
            <li><strong>Your saved draft is split into numbered sentences</strong> and sent with the prompt, essay type, limits and anything you said you want a reader to understand.</li>
            <li><strong>Two reads run in parallel.</strong> An editorial review (overall assessment, prompt fit, rubric ratings, prioritized notes, revision plan, questions) and a voice read (what sounds like you, what reads as generic, stylistic patterns).</li>
            <li><strong>Every quote is verified.</strong> Each note must quote the essay word for word and name its sentence. Code finds the exact passage; if the words are not in your essay, the note is discarded and the review says how many were dropped. Suggested examples that introduce names, numbers or events your essay does not contain are removed.</li>
            <li><strong>Notes follow your edits.</strong> Highlights move as you type. When you change the words a note is about, the note is marked as edited instead of sticking to whatever text is there now.</li>
          </ol>
          <p>Models used: by default, open-weight models served by Groq (gpt-oss-120b for the review, Qwen 3.8 27B for the voice read, gpt-oss-20b for revision help), with automatic fallback between them. Each review shows which model produced it. Model output can be wrong or inconsistent between runs; treat it as one careful reader&rsquo;s opinion.</p>

          <h2 id="rubric">The rubric</h2>
          <p>Each dimension has a question and a description of each level. Ratings are qualitative on purpose: there is no validated way to turn essay scores into admission odds, so Stet does not show a number, a percentage, or an &ldquo;Ivy score&rdquo;. Which dimensions apply depends on the essay type; a short answer is not judged on pacing.</p>
          <div className="mt-5 overflow-x-auto rounded-[10px] border border-rule bg-paper">
            <table className="w-full min-w-[640px] text-left text-[13.5px] leading-snug">
              <thead className="bg-desk text-[12.5px] text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-semibold">Dimension</th>
                  <th className="px-3 py-2 font-semibold text-keep">Working</th>
                  <th className="px-3 py-2 font-semibold text-medium">Developing</th>
                  <th className="px-3 py-2 font-semibold text-high">Needs work</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(DIMENSIONS) as DimensionKey[]).map((k) => {
                  const d = DIMENSIONS[k];
                  return (
                    <tr key={k} className="border-t border-rule align-top">
                      <td className="px-3 py-2.5"><strong>{d.name}</strong><div className="mt-0.5 text-ink-3">{d.question}</div></td>
                      <td className="px-3 py-2.5 text-ink-2">{d.strong}</td>
                      <td className="px-3 py-2.5 text-ink-2">{d.developing}</td>
                      <td className="px-3 py-2.5 text-ink-2">{d.needs_work}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details className="mt-4 text-[14px]">
            <summary className="cursor-pointer font-semibold">Which dimensions apply to each essay type</summary>
            <ul className="mt-2 list-disc pl-5 text-ink-2">
              {ESSAY_TYPE_KEYS.map((t) => (
                <li key={t}><strong className="text-ink">{ESSAY_TYPES[t]}:</strong> {DIMENSIONS_FOR[t].map((k) => DIMENSIONS[k].name).join(', ')}</li>
              ))}
            </ul>
          </details>

          <h2 id="patterns">The pattern check, and why there is no AI score</h2>
          <p>AI-text detectors give a probability that text was machine-written. Independent research keeps finding that these scores are unreliable for student writing, especially short essays and writing by non-native English speakers:</p>
          <ul className="list-disc pl-5 text-ink-2">
            <li>Seven detectors flagged 61% of TOEFL essays by non-native writers as AI-generated on average (Liang et al., <em>Patterns</em>, 2023, <a href="https://arxiv.org/abs/2304.02819">arXiv:2304.02819</a>).</li>
            <li>A 2026 evaluation of 13 detectors on 280,000 student samples found systematic failures on short coursework and that light editing let 88% of AI text evade detection (Sun, Liao and Ma, <em>Computers &amp; Education</em>, 2026).</li>
            <li>University of Florida researchers concluded commercial detectors are &ldquo;poorly suited&rdquo; for high-stakes academic use (IEEE S&amp;P 2026; <a href="https://news.ufl.edu/2026/05/traynor-ai-detector-study/">UF News</a>).</li>
          </ul>
          <p>So Stet does not estimate who wrote anything. Instead it shows observable patterns that can make writing read as formulaic, each with the passage, the pattern, why it matters to a reader, and a fix. Some are measured by code (stock phrases, formal connectors, repeated sentence openings, sentence-length variation, and words that rose sharply in AI-assisted text after 2023 per Kobak et al., <em>Science Advances</em> 2025); others are a reader&rsquo;s observations from the model, always tied to a quote. Every one of these patterns appears in writing by people. Thresholds are rules of thumb, not validated cut-offs.</p>
          <p>Stet will not help an essay &ldquo;pass&rdquo; a detector. The goal is writing that sounds like you, which is also what admissions readers say they want.</p>

          <h2 id="policy">Revision help and application rules</h2>
          <p>The Common App&rsquo;s fraud policy, as quoted by several counseling organizations, covers submitting &ldquo;the substantive content or output of an artificial intelligence platform&rdquo; as your own work, and individual colleges set their own rules (Brown, for example, allows AI for spelling and grammar review only). Check the policy of each college you apply to.</p>
          <p>Stet&rsquo;s assistant is built around that line: it explains feedback, asks questions, and offers small optional rewrites of only the passage you select. It is instructed never to invent experiences, people, dialogue or feelings; it uses [placeholders] or questions instead, and Stet flags any rewrite that mentions a name or number not in your essay.</p>

          <h2 id="privacy">What is stored and who processes it</h2>
          <ul className="list-disc pl-5 text-ink-2">
            <li><strong className="text-ink">Stored by Stet</strong> (Postgres on Supabase, US East): your essays, their versions, reviews, and session records. If you add an email, the email and a scrypt hash of your password. Server logs do not include essay text.</li>
            <li><strong className="text-ink">Sent to the AI provider</strong> when you run a review, use the assistant or check a revision: the essay text, prompt and settings. Groq&rsquo;s documentation (checked 2026-10-15) says it does not retain inference inputs or outputs by default, but may log them for up to 30 days to troubleshoot reliability or investigate abuse unless zero data retention is enabled. Drafts are never sent anywhere just because you typed them.</li>
            <li><strong className="text-ink">In your browser</strong>: unsaved text is kept in local storage until it reaches the server, so a dropped connection does not lose work.</li>
            <li><strong className="text-ink">Your controls</strong>: <Link href="/account">export everything</Link> as JSON, or delete your account, which deletes every essay, version and review.</li>
          </ul>

          <h2 id="limits">Limits</h2>
          <ul className="list-disc pl-5 text-ink-2">
            <li>Stet runs on free tiers. Free model capacity is limited per minute and per day, so at busy times a review may ask you to wait.</li>
            <li>Reviews handle up to 1,300 words; the free models cap each request at about 8,000 tokens.</li>
            <li>Word counts follow the usual rule (whitespace-separated words); an application portal may differ by a word or two.</li>
            <li>No password reset (Stet sends no email). Guest essays live in this browser&rsquo;s session until you add an email.</li>
            <li>Prompts change between cycles. Library prompts show their source and the date they were checked.</li>
          </ul>
        </article>
      </main>
    </>
  );
}
