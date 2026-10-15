# Stet

**Feedback on your college essay that points at the sentence.**

Live: https://stet-essay.vercel.app

Stet is a college-essay workspace. Paste a draft, pick the prompt, and get an editor's read: what is working, what to fix first, and where your own voice is strongest. Every comment is tied to the exact words it is about, and code verifies each quote against your draft before it is shown. Stet never rewrites your essay.

*Stet* is the proofreader's mark for "let it stand". In the editor, passages worth keeping get the stet mark: a row of dots under the words.

## What it does

- **Review against a written rubric.** An overall assessment, prompt fit, a "what a reader learns about you" line, a prioritized revision plan, notes with severity, why it matters, what to try and a question to help you find the missing detail, plus what is working. Up to 20 rubric dimensions with written level descriptors; which apply depends on the essay type. No numeric score, no admission odds.
- **Grounded feedback.** The model must quote the essay word for word and cite the sentence. Quotes that are not in the draft are discarded and counted. Examples that introduce names, numbers or events the essay does not contain are removed.
- **Notes that follow your edits.** Highlights move as you type. Change the words a note is about and the note says so, instead of drifting onto other text. Undo back to the reviewed text and the notes return.
- **Voice read.** What sounds like you (to protect while revising) and what reads as generic, with the signal, why it matters and a fix.
- **Writing-pattern check, not an AI detector.** Live, code-measured patterns (stock phrases, formal connectors, repeated openings, sentence-length variation, vocabulary that rose in AI-assisted text) plus a reader's observations and style-shift detection. No "AI probability", by design; see [How Stet reviews](src/app/method/page.tsx) for the research.
- **Revision help that keeps the words yours.** Explain feedback, ask me questions, brainstorm, strengthen reflection, find missing context, or see options for a selected passage (clearer, tighter, better transition, alternatives). Options replace only the selection, are undoable, and flag any name or number not in your essay.
- **Draft history and comparison.** Autosave with conflict detection, local backup, checkpoints every 20 minutes, named versions, restore. Word-level diff, measured changes, whether each earlier note's passage changed, and an AI check of whether revisions actually addressed the notes (labelled as an AI assessment).
- **2026–27 prompt library.** All seven Common App prompts, the eight UC PIQs, and supplements from Yale, Stanford, MIT, Princeton, UChicago, Duke, Columbia and Harvard, copied from official pages with source links and check dates. Any other prompt can be pasted.
- **Accounts.** Start writing as a guest; add an email and password to sign in elsewhere (guest essays move into the account). Export everything as JSON; delete the account and all data.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, CodeMirror 6 (editor and passage marks), Vercel AI SDK 7 with Groq (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`) and optional Vercel AI Gateway, Zod 4, Postgres (Supabase) via `postgres`, jsdiff, Vitest with PGlite for in-process Postgres tests.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions and [docs/RESEARCH.md](docs/RESEARCH.md) for sources.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and GROQ_API_KEY
node scripts/migrate.mjs     # creates the stet schema (idempotent)
npm run dev
```

## Checks

```bash
npm test              # unit + API integration tests (PGlite, mocked models)
npm run lint
npm run typecheck
npm run build
LIVE=1 npx vitest run tests/live   # real model calls (uses free-tier quota)
node scripts/smoke.mjs https://stet-essay.vercel.app   # end-to-end check of a deployment; cleans up after itself
```

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Supabase transaction pooler works; prepared statements are off). |
| `GROQ_API_KEY` | yes | Groq API key (free tier works). |
| `AI_GATEWAY_MODEL` | no | e.g. `anthropic/claude-haiku-5.5`. Tried first when set; needs AI Gateway enabled on the Vercel team. |
| `LIMIT_REVIEWS_PER_HOUR`, `LIMIT_REVIEWS_PER_DAY`, `LIMIT_REVIEWS_GLOBAL_DAY`, `LIMIT_ASSIST_PER_HOUR`, `LIMIT_ASSIST_GLOBAL_DAY` | no | Rate limits (defaults 8, 25, 60, 40, 1500). |

## Status

See [docs/PROGRESS.md](docs/PROGRESS.md) for what is implemented, verified, and still open.
