# Architecture

## Shape

One Next.js app. Pages are server components that read the session cookie and load data directly; interactive surfaces (editor, margin panel, compare, forms) are client components that call JSON route handlers under `src/app/api`. All model calls and all database access happen on the server.

```
browser ── route handlers (src/app/api/**) ── lib/essays.ts ── Postgres (schema "stet")
              │
              └── lib/service.ts ── lib/ai/{review,voice,assist,compare}.ts ── lib/ai/provider.ts ── Groq / AI Gateway
```

## Review pipeline

1. `sentences()` splits the saved draft into numbered sentences (Intl.Segmenter plus an abbreviation fix so "Mrs." does not end a sentence).
2. `analyze()` measures the draft in code: counts, sentence-length variation, and regex detectors (stock phrases, AI-associated vocabulary, formal connectors, contrast templates, repeated openings, growth statements, named emotions, intensifiers, em dashes, formula openings and endings). A short brief of these facts goes into both prompts.
3. Two model calls run in parallel on different models (separate per-model rate limits): the editorial review (`ReviewSchema`) and the voice read (`VoiceSchema`). Both use strict JSON-schema structured output and are validated with Zod.
4. `finalizeReview` / `finalizeVoice` ground every `(sentence, quote)` pair with `locateQuote` (exact match after normalising whitespace, quotes, dashes and case; the cited sentence breaks ties between repeats). Ungroundable items are dropped and counted. Examples introducing new names, numbers or mostly new content are removed (`fabrication.ts`). Item ids are stable hashes.
5. The result is stored with the exact version text it was made from.

If one call fails the other is still saved, with the failure shown; if both fail nothing is stored and the error is mapped to a clear HTTP status (`ai_busy` with Retry-After, `too_long`, `ai_unavailable`).

## Anchoring

- Stored anchors carry `quote`, `prefix`, `suffix` and offsets (W3C text-quote plus text-position selectors).
- Loading a review re-finds each anchor in the current text (`reanchor`): exact quote required, surrounding context picks among duplicates, and an anchor with ambiguous context is dropped rather than guessed.
- In the editor, anchors live in a CodeMirror state field and are mapped through every change (`ann-map.ts`). Inserts at an edge stay outside; any change inside the covered words marks the item edited and removes its highlight. Returning to the exact reviewed text (e.g. undo) restores all marks.

## Model provider

`generateStructured()` walks an ordered model list per task. Groq's free tier reserves `prompt + max_completion_tokens` against 8,000 tokens per minute per model, so each request is budgeted from a conservative token estimate and skipped on a model it cannot fit. 429, 413, 5xx, timeouts (per-attempt `AbortSignal.timeout`) and schema-invalid output move to the next model; caller cancellation (client disconnect) stops immediately. Temperature 0.2 on Groq models for consistency; omitted for gateway Claude models, which reject non-default sampling.

Default chains: review gpt-oss-120b → qwen3.8-27b → gpt-oss-20b; voice qwen3.8-27b first; assistant gpt-oss-20b first. `AI_GATEWAY_MODEL` prepends a gateway model (with `disallowPromptTraining`).

## Data model (`src/lib/schema.sql`)

`users` (guest rows have null email), `sessions` (sha256 of the cookie token), `essays` (text, settings, `rev` for optimistic concurrency), `versions` (manual, review, auto, restore), `reviews` (result JSON, per-item status), `rate_limits` (fixed windows). Everything is in schema `stet`, which Supabase's REST API does not expose; API roles have no grants.

## Security and privacy

- Every query that touches essay data is scoped by `user_id` in SQL (joins for versions and reviews). Malformed ids return 404 before reaching SQL. Tests cover cross-user read, write, delete, review, version and item-status attempts.
- Sessions: 32-byte random token in an httpOnly, SameSite=Lax, Secure (production) cookie; only its hash is stored. Passwords: scrypt (N=16384), constant-time compare, equal cost for unknown emails.
- Mutating requests are rejected when `Origin` or `Sec-Fetch-Site` shows a cross-site browser request. JSON bodies are size-limited and validated with strict Zod schemas.
- Rate limits per user and globally for reviews and the assistant, per IP for sign-in and creation, per user for saves.
- Server logs never include essay text; unexpected errors log a short tag returned to the user.
- Security headers: nosniff, frame denial, strict referrer policy, restricted permissions.

## Autosave

Edits are mirrored to localStorage, then saved 900 ms after typing stops with the revision they were based on. A stale revision returns 409 with the server copy; the user chooses which to keep, and "keep mine" first snapshots the other text. Network and 5xx errors retry with backoff while the UI says the text is kept in the browser. Actions that need the server copy (review, assistant, check, restore) flush first and refuse to run on unsaved text.

## Design

Editorial product UI. Literata for essay text, Atkinson Hyperlegible Next for the interface, one accent (blue pencil). Annotation colours carry meaning and are backed by shape for colour-blind readers: solid underline and tint for priority notes, dotted "stet" underline for passages to keep, dashed teal for writing patterns. Light and dark themes from the system setting. The essay page is the visual centre; the review lives in a margin panel; on phones the two become tabs.

## Alternatives considered

- **Claude via Vercel AI Gateway** as the default: best quality per cost, but the gateway returned 403 until a card is on file for the free credit. Kept as an optional first provider.
- **Neon via the Vercel Marketplace**: needs marketplace terms acceptance; Supabase was already set up on the account.
- **Tiptap/ProseMirror**: rich text is not used by application portals; CodeMirror 6 gives plain-text offsets and position mapping through edits directly.
- **AI-detector APIs (Pangram, GPTZero)**: paid, and weakest on short essays and non-native writing. See RESEARCH.md.
