# Progress log

## 2026-10-15: first build

### Implemented and verified
| Area | How it was verified |
|---|---|
| Review engine (rubric, grounding, fabrication guard, plan, questions, caveats) | Unit tests on finalize/grounding; live runs on the sample essay with gpt-oss-120b: 0 ungrounded quotes kept, 5-9 notes, ratings across the scale |
| Voice and pattern read | Live run with qwen3.8-27b; quotes verified; unquotable style-shift claim dropped (unit test) |
| Deterministic pattern detectors | Unit tests for every detector and offsets |
| Anchoring and re-anchoring, repeated phrases, overlapping marks, edits inside marks, undo | Unit tests (`text-anchor`, `ann-map`) and in-browser check (typing inside a flagged sentence marked the note edited; undo restored it) |
| Autosave with revision conflicts, local backup, retry | API tests (409 with server copy); in-browser "Saved just now" |
| Versions: checkpoints, named, restore (keeps a pre-restore copy) | API tests; History tab in browser |
| Compare: diff, measured deltas, passage status, AI revision check | Browser: diff and measured table; live check rated a condensed list "partly addressed" |
| Revision assistant (10 actions), apply/undo, invented-detail flags | API tests; live explain (3 s) and tighten (1 s) in browser; applied option autosaved |
| Accounts: guest, claim, sign in with essay merge, sign out, export, delete | API tests; guest-to-account in browser |
| Ownership and authorization | API tests: cross-user read, write, delete, review, version and item-status attempts all 404; no session 401; malformed ids 404 |
| Input validation, cross-site refusal, rate limits | API tests (400/413/415/403/429 with Retry-After) |
| Provider failures: rate limit, malformed JSON, schema-invalid, timeout, cancel, too long, unconfigured | `provider.test.ts` with mock models |
| Prompt library (68 prompts, official wording) | Copied from official pages on 2026-10-15; sources in RESEARCH.md |
| UI at 1440x900 and 390x844, light and dark | Headless Chrome screenshots of dashboard, first visit, workspace (all tabs), compare, new essay, prompts, method |
| Database exposure | Supabase REST with the publishable key cannot reach schema `stet` (PGRST106) |
| No secrets in client bundle | Scan of `.next/static` for the Groq key, DB password and pooler host |

### Deployment
- Production: https://stet-essay.vercel.app (Vercel project stet-essay, auto-deploys from main of github.com/zaydmulani09/stet). Env vars DATABASE_URL and GROQ_API_KEY are set for Production only (encrypted); preview deployments have none.
- `node scripts/smoke.mjs https://stet-essay.vercel.app`: 22/22 checks passed (health, pages, guest creation, ownership refusal, cross-site refusal, autosave and 409, live review in ~6 s with gpt-oss-120b + qwen3.8-27b, item status, assistant, revision check, versions, compare, export, account deletion).
- Headless Chrome against production: no client exceptions on the workspace or compare pages after fixing a timezone hydration mismatch (server UTC vs browser local time) that only appeared in production.
- Daily cron hits /api/health to keep the free Supabase project active and prune expired sessions and rate-limit rows.
- Test data created during verification was deleted; the production database was empty at handoff.

### Known limits
- Free Groq tier: 8,000 tokens/minute per model, 1,000 requests/day; a full review uses two models. Busy periods return a clear wait message.
- AI Gateway (Claude Haiku 5.5) is wired but off: the Vercel team needs a card on file before its free monthly credit works.
- No password reset (no email provider). Guests lose access if they clear cookies before adding an email.
- Review consistency: ratings and severities can vary between runs (temperature 0.2). Each review names its model.
- Deterministic thresholds (rhythm CV < 0.35, density cut-offs) are rules of thumb, labelled as such in the UI.

### Next
- Enable Groq zero data retention in the Groq console (Data Controls) for stronger privacy.
- Optional AI Gateway model for higher quality once a card is on file.
- Password reset via an email provider (Resend free tier) if accounts become important.
