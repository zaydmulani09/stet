# Research notes

Accessed 2026-10-15 unless noted. Where a claim comes from a secondary source it says so.

## Official prompts (verified on the institution's own page)

| Source | Cycle label on page | Notes |
|---|---|---|
| [Common App essay prompts](https://www.commonapp.org/apply/essay-prompts) and [announcement](https://www.commonapp.org/blog/announcing-2026-2027-common-app-essay-prompts) (Feb 27 2026) | "2026–2027" | Seven prompts unchanged from 2025–26. Announcement gives 2025–26 prompt-choice shares: topic of choice 28%, adversity 23%, growth 20%, background 18%, curiosity 5%, gratitude 3%, challenging an idea 3%. |
| [UC Personal insight questions](https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/personal-insight-questions.html) | none shown | 8 questions, answer 4, 350 words max each, all weighted equally. |
| [Yale essays](https://admissions.yale.edu/essays) | "2026-27" | 200-word short answer, three 200-*character* short takes, one 400-word essay from three prompts. |
| [Stanford application and essays](https://admission.stanford.edu/apply/first-year/apply.html) | page updated Jul 21 2026 | Five short questions (3–50 words), three short essays (100–250 words). |
| [MIT essays](https://mitadmissions.org/apply/firstyear/essays-activities-academics/) | "2026–2027" | Four essays (~100–200 words), four short responses (40–50 words). A search-engine summary said "three essays"; the page has four. |
| [Princeton-specific questions](https://admission.princeton.edu/apply/princeton-specific-questions) | none shown | A.B./B.S.E. 250, "Your Voice" 400–500 and 250, three 50-word answers. |
| [UChicago essay questions](https://collegeadmissions.uchicago.edu/apply/essay/) | "2026-2027" | Required "Why UChicago" plus one extended essay from six options. No hard limits on the page. |
| [Duke apply page](https://admissions.duke.edu/apply/) | "2026-27" | Two required 250-word essays, three optional (answer one). |
| [Columbia-specific questions](https://undergrad.admissions.columbia.edu/apply/process/columbia-questions) | "2026-2027", updated Jul 28 2026 | List question (100 words) and short answers (150 words). |
| [Harvard supplement FAQ](https://college.harvard.edu/resources/faq/what-included-harvard-supplement) | none shown | Five required short answers, 150 words each. |

Not verified on an official page, so not shipped as official: the Common App 250-word "Challenges and circumstances" question and the 300-word Additional Information limit (secondary sources such as ingeniusprep.com agree, but commonapp.org pages I could load did not state them). The Common App 250–650 word range is stated by every guide I found and matches the application's counter; it is shipped with that note.

## Policy context

- Common App's fraud policy (quoted by College Transitions, Empowerly and others; I could not load the policy page itself) treats submitting "the substantive content or output of an artificial intelligence platform" as one's own as fraud. Brown allows AI only for spelling and grammar. Stet therefore never writes essay content. Revision suggestions are scoped to a selected passage, keep the student's facts, and use bracketed placeholders where only the student knows the detail.
- Isley, Gaebler & Goel, "AI-written admissions essays are widespread but penalized" ([arXiv 2609.22549](https://arxiv.org/abs/2609.22549), Sep 2026): ~7,500 applications to one master's program; AI-written essays were common in 2025 and those applicants were admitted less often; admissions officers in an experiment often recognized AI writing and rated it lower. One program, graduate level, so it is context, not a rule for undergraduate admissions.

## AI-text detection: what the evidence supports

- Liang et al., "GPT detectors are biased against non-native English writers" ([arXiv 2304.02819](https://arxiv.org/abs/2304.02819), *Patterns* 2023): seven detectors flagged 61% of 91 TOEFL essays as AI on average. Turnitin disputed generality (small, short sample).
- Sun, Liao & Ma (*Computers & Education*, 2026, via ScienceDirect abstract): 13 detectors, 280k student samples; acceptable on long theses, systematic failures on short coursework; adversarial edits let 88% of AI text evade.
- Traynor et al. (University of Florida, IEEE S&P 2026, [UF news](https://news.ufl.edu/2026/05/traynor-ai-detector-study/)): commercial detectors "poorly suited" for high-stakes academic use.
- Jisc National Centre for AI ([2026-10 update](https://nationalcentreforai.jiscinvolve.org/wp/2026/10/15/ai-detection-and-assessment-an-update-for-2026/)): no detector they can recommend for small-scale use.
- Pangram has the strongest third-party results on long text (University of Chicago BFI 2025 study, reported FPR ~0.001) but worse behaviour on short or AI-edited text and is a paid API. Grammarly Authorship records the writing process rather than classifying text, which is a different (and more defensible) kind of evidence.
- Stylistic research that is actually measurable: Reinhart et al., "Do LLMs write like humans?" (PNAS 122(8), 2025, [arXiv 2410.16107](https://arxiv.org/abs/2410.16107)) found instruction-tuned LLMs differ systematically from humans on Biber features (denser, more nominal, more "academic" style); Kobak et al., excess vocabulary (Science Advances 11(27), 2025, [arXiv 2406.07016](https://arxiv.org/abs/2406.07016)) found words like "delves", "showcasing", "underscores" spiked after ChatGPT.

**Decision.** No probability, percentage or "AI score". The pattern checker reports observable features with the passage, the pattern, why it reads as formulaic, and a fix. Deterministic detectors (lexicon hits, sentence-length spread, repeated openers, transition density) are computed in code and labelled as measurements; the model adds judgement-based flags that must quote the essay. The UI states that human writing shows the same patterns and that none of this is evidence of authorship. Not adding Pangram (paid, and its weakest regime is exactly short admissions essays).

## Competitors (features verified where possible; prices are secondary-source)

| Product | What it does well | Gap Stet targets |
|---|---|---|
| College Essay Guy | Free CYOA brainstorming/writing guide, strong human coaching ($4,950+ packages per PrepScholar/PrepMaven roundups). States it does not advocate AI writing. | No instant, passage-level feedback. |
| CollegeVine | Free peer review; AI review scoring hook/specificity/authenticity/structure (per 2025 third-party guides). Peer quality varies. | Scores without passage-anchored evidence; no revision tracking. |
| Grammarly | Excellent surface polish; Authorship tracks process, not text. Premium ~$12–30/mo. | Does not judge voice, reflection or prompt fit. |
| QuillBot | Paraphraser plus AI detector with weak independent accuracy (arXiv 2403.05458: precision 75%). | Paraphrasing erodes voice; detector is a score, not guidance. |
| GPTZero / Turnitin / Pangram | Probability scores. Independent FPRs range from ~0.1% (Pangram, long text) to 16% (GPTZero on essays, arXiv 2506.23517). | A number with no actionable reason. |
| GradPilot, Esslo, Kolly, Princeton Review AI | Rubric scores, some AI detection; $5 per review up to $99/mo (GradPilot comparison, secondary). | Mostly opaque scores; few show the passage behind each critique or check whether a revision fixed it. |

Where Stet aims to be better: every critique is tied to a verified quote in the student's own draft; strengths are marked as clearly as problems; revisions are checked against the original issue; the AI-pattern view explains instead of scoring; nothing is rewritten wholesale.

## Review method (LLM evaluation practice)

- Quote-grounding and retraction: Anthropic's [reduce hallucinations guide](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations) recommends extracting direct quotes, allowing "not enough information", and retracting claims without a supporting quote. Stet enforces this in code: every quote is matched against the essay text and items whose quote is not found are dropped and counted.
- Sentence-indexed input lets the model cite a sentence number; the server uses it to disambiguate repeated phrases.
- Qualitative 4-level rubric with written descriptors per level instead of a numeric score (no defensible mapping from rubric scores to admissions outcomes exists).
- Structured output validated with Zod at runtime; schema failures surface as a retryable error, never as partially parsed text.

## Technical facts verified in this environment

- Next.js 16.4.2, React 19.3, AI SDK `ai` 7.0.142 (`generateText` + `Output.object`, top-level `reasoning`), `@ai-sdk/groq` 4.0.62, Zod 4.6, CodeMirror 6 (`@codemirror/state` 6.7, `view` 6.43), `postgres` 3.4.9, jsdiff 9.
- Groq free org limits read from live response headers: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` each 1,000 requests/day and 8,000 tokens/minute; the per-minute budget reserves `prompt + max_completion_tokens`. `flex` and `auto` service tiers are rejected for this org. Strict JSON-schema mode is supported on all three (Groq structured-outputs docs).
- Vercel AI Gateway (`anthropic/claude-haiku-5.5` at $0.10/$0.50 per M tokens) returned 403 `customer_verification_required`: the team must add a card before the $5/month free credit unlocks. Wired as an optional provider, off by default.
- Supabase project `stet` (us-east-1, free plan) reachable through the transaction pooler `aws-0-us-east-1.pooler.supabase.com:6543`.
