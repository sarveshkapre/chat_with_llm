# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration

## Candidate Features To Do
### Cycle 8 (2026-02-10) Plan
- [x] P2: Unified Search saved searches (presets): save current query + filters (type/sort/time/limit), pin, rename, run, delete; persist in localStorage and show in UI. (Score: impact=high effort=med risk=low confidence=high)
- [x] P3: Unified Search negative operators: support `-tag:foo` and `-has:note` / `-has:citation`; add `spaceId:` exact match (keep `space:` as name-contains or id-exact for backwards compatibility). (Score: impact=med-high effort=med risk=low-med confidence=med-high)
- [x] P3: Unified Search query parsing hardening: handle unbalanced quotes safely (fallback tokenization) + basic escaped quotes; add regression tests for edge cases. (Score: impact=med effort=low-med risk=low confidence=high)
- [ ] P3: Unified Search “verbatim” toggle/operator: allow exact/phrase-only matching (no token fallback) to mirror baseline expectations in chat-history search. (Score: impact=med effort=med risk=low confidence=med)
- [ ] P3: Unified Search performance pass for large libraries: cache normalized fields per item (threads/spaces/collections/files/tasks) and avoid recomputing snippets/citation joins when query changes. (Score: impact=med effort=med-high risk=med confidence=med)
- [ ] P4: Unified Search saved searches export to Markdown (and include in existing export surfaces). (Score: impact=low-med effort=low risk=low confidence=high)
- [ ] P4: Unified Search operators: clarify semantics in inline help (`space:` contains vs `spaceId:` exact; negative operators) and add copy-to-clipboard examples. (Score: impact=low-med effort=low risk=low confidence=high)
- [ ] P4: Tests: add more coverage for cross-type operators (`space:` on tasks, `tag:` on spaces) and timeline+sort interactions. (Score: impact=low effort=low risk=low confidence=high)

### Cycle 7 (2026-02-10) Backlog
- [ ] P3: Unified Search: “Saved searches” (pin + rename + quick run) for queries/operators/sort/time window, persisted in localStorage. (Score: impact=med effort=med-high risk=low confidence=med)
- [ ] P3: Unified Search operators: add negative operators (`-tag:foo`, `-has:note`) and clarify matching semantics (`space:` contains vs `spaceId:` exact). (Score: impact=med effort=med risk=low confidence=med)
- [ ] P3: Unified Search: performance pass for large libraries (cache normalized fields + precompute scores per query + avoid recomputing snippets). (Score: impact=med effort=med-high risk=med confidence=med)
- [ ] P3: Tests: add quote/edge-case coverage for `parseUnifiedSearchQuery()` (unbalanced quotes, mixed operators). (Score: impact=low effort=low risk=low confidence=high)

## Implemented
- 2026-02-10: Unified Search now indexes Space tags (`signal-space-tags-v1`), supports `tag:` operator filtering for Spaces, and boosts relevance when the free-text query matches tags (`src/components/unified-search.tsx`, `tests/unified-search.test.ts`). (commit `285d9c8`)
- 2026-02-10: Unified Search “why this matched” micro-badges on result cards (Title/Tags/Space/Note/Citations/Answer) to improve trust + scanability without changing ranking (`src/components/unified-search.tsx`, `src/lib/unified-search.ts`, `tests/unified-search.test.ts`) (commit `e64f5ae`).
- 2026-02-10: Cross-surface search shortcuts in Library/Spaces/Collections (consistent `/` focus + `Esc` clear) (`src/components/chat-app.tsx`, `src/components/spaces-view.tsx`, `src/components/collections-view.tsx`) (commit `a9ed305`).
- 2026-02-10: Unified Search query operators (`type:`, `space:`, `tag:`, `has:`) with inline help, operator chips, and a "clear operators" affordance (`src/lib/unified-search.ts`, `src/components/unified-search.tsx`, `tests/unified-search.test.ts`) (commit `d1c8aab`).
- 2026-02-10: Unified Search now supports multi-word matching (phrase OR all-tokens across fields), field-weighted relevance scoring (title/question > tags/space > notes/citations > body) with precomputed scores, plus `/` focus + `Esc` clear + `Enter` commit recent query and deferred query evaluation (`src/components/unified-search.tsx`, `src/lib/unified-search.ts`, `tests/unified-search.test.ts`) (commit `590f05c`).
- 2026-02-10: Added unified search match highlighting for query/tokens across titles + snippets (`src/components/unified-search.tsx`, `src/lib/highlight.ts`) (commit `ce3429c`).
- 2026-02-09: Added repo maintainer contract + memory tracking files (`AGENTS.md`, `PROJECT_MEMORY.md`, `INCIDENTS.md`) (commit `5a36bd8`).
- 2026-02-09: Enforced workflow policy checks (pinned action SHAs + explicit `permissions:`) via `npm run check:workflows` and CI step, with regression tests (`scripts/check-workflows.mjs`, `scripts/workflow-policy.mjs`, `tests/workflow-policy.test.ts`, `.github/workflows/ci.yml`) (commit `0a9bbdf`).
- 2026-02-09: Migrated SARIF upload to CodeQL action v4 (`.github/workflows/scorecard.yml`) (commit `0a9bbdf`).
- 2026-02-09: Added Undo affordance for Unified Search bulk thread actions (`src/components/unified-search.tsx`) (commit `0a9bbdf`).
- 2026-02-08: Hardened Actions workflows by pinning action SHAs and tightening token permissions in CI/Scorecard (`.github/workflows/ci.yml`, `.github/workflows/scorecard.yml`).
- 2026-02-08: Stabilized Release Please by removing invalid input and gating automation behind explicit enablement (`.github/workflows/release-please.yml`).
- 2026-02-08: Remediated moderate dependency advisories by upgrading the `vitest` toolchain to v4 (`package.json`, `package-lock.json`, `npm audit --json` now shows 0 vulnerabilities).
- 2026-02-08: Added Unified Search timeline filtering and in-place thread quick/bulk actions (favorite/pin/archive/space assignment) (`src/components/unified-search.tsx`, `src/lib/unified-search.ts`).
- 2026-02-08: Added regression tests for timeline and bulk-action helper logic (`tests/unified-search.test.ts`).
- 2026-02-08: Expanded library + unified search relevance to include answer text, citations, and notes with contextual snippets (src/components/chat-app.tsx, src/components/unified-search.tsx).
- 2026-02-10: Unified Search bulk favorite/unfavorite actions (`src/components/unified-search.tsx`) (commit `2c94219`).
- 2026-02-10: Hardened Unified Search bulk selection against stale/missing thread ids and made bulk toolbar counts/toasts reflect active selection (`src/components/unified-search.tsx`, `src/lib/unified-search.ts`, `tests/unified-search.test.ts`) (commit `3a7dff9`).
- 2026-02-10: Local storage corruption backups on JSON parse failures + regression tests (`src/lib/storage.ts`, `src/lib/unified-search.ts`, `src/components/chat-app.tsx`, `src/components/spaces-view.tsx`, `src/components/collections-view.tsx`, `src/components/report-view.tsx`, `tests/storage.test.ts`) (commit `716763b`).
- 2026-02-10: Mock smoke verification path + on-demand CI workflow (`scripts/smoke.mjs`, `.github/workflows/smoke.yml`, `package.json`, `PROJECT.md`) (commit `fe19614`).
- 2026-02-10: Added integration-style tests for `/api/answer` and `/api/answer/stream` (mock provider), configurable mock stream delay, and stricter NDJSON smoke framing checks (`tests/api-answer.test.ts`, `tests/api-answer-stream.test.ts`, `src/app/api/answer/stream/route.ts`, `scripts/smoke.mjs`) (commit `f278cd6`).
- 2026-02-10: Added Library "Data tools" panel (export raw `signal-*` localStorage + export-gated reset) and a `signal-*` localStorage usage indicator (`src/components/chat-app.tsx`, `src/lib/signal-storage.ts`) (commit `e42bb68`).
- 2026-02-10: Documented local-first data export/reset and corruption recovery steps (`docs/data-recovery.md`, `README.md`) (commit `3fac87f`).
- 2026-02-10: Library bulk undo toast for archive/delete actions, with unit-tested restore logic that doesn't drop newly created threads (`src/components/chat-app.tsx`, `src/lib/library-undo.ts`, `tests/library-undo.test.ts`) (commit `661ff10`).
- 2026-02-10: Library data health warning (corrupt localStorage backups) + diagnostics bundle downloads (full + redacted) + docs updates (`src/components/chat-app.tsx`, `next.config.ts`, `docs/data-recovery.md`) (commit `50055b4`).
- 2026-02-10: Removed Next build warning from Node WebStorage by lazy-loading `docx` and tightening browser guards in localStorage helpers (`src/components/chat-app.tsx`, `src/lib/storage.ts`, `src/lib/signal-storage.ts`, `src/lib/local-data.ts`, `tests/storage.test.ts`) (commit `30a28ca`).

## Insights
- Scorecard failures were not from scan results; they were caused by workflow policy validation when `publish_results: true` was combined with write-level permissions.
- Release automation can hard-fail in repos where GitHub Actions cannot open PRs; explicit gating keeps `main` green while preserving manual release capability.
- Signal Search usability improves when actions happen in the search surface itself; forcing users back into Library for pin/archive/space edits adds unnecessary friction.
- Users rely on notes and citations during follow-ups, so search must index those fields; otherwise “Signal Search” fails to find high-signal content.
- LocalStorage remains the single source of truth; until server sync exists we need light-weight resiliency features (like snippets plus filtering) to avoid data lock-in.
- Next.js static generation can execute transitive deps in SSR bundles; importing `docx` at module scope pulled in browserified Node stream polyfills that touch `localStorage` and emitted warnings. Lazy-loading large export deps keeps builds clean and reduces baseline bundle weight.
- Market scan (untrusted, links only): comparable products emphasize citations + “save/organize” workflows; keyboard shortcuts (search focus/clear) and structured filters/operators show up as baseline UX expectations.
- Sources: Perplexity (https://www.perplexity.ai) help: thread retention + recovery (https://www.perplexity.ai/help-center/en/articles/12637451-where-did-my-threads-go), thread context + web toggle constraints (https://www.perplexity.ai/help-center/en/articles/10354775-technical-capabilities-of-threads), Spaces overview (https://www.perplexity.ai/help-center/en/articles/10352961-what-are-spaces); Kagi Assistant docs (https://help.kagi.com/kagi/ai/assistant.html); Kagi filtering docs (verbatim + time windows) (https://help.kagi.com/kagi/features/filtering-results.html); Obsidian Tasks Presets (saved query presets pattern) (https://publish.obsidian.md/tasks/Queries/Presets); OpenAI Help Center: ChatGPT history search (exact match + Cmd/Ctrl+K) (https://help.openai.com/en/articles/10056348-how-do-i-search-my-chat-history-in-chatgpt%3F.midi); OpenAI Help Center: ChatGPT data export flow (https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data).
- Gap map (untrusted, synthesized):
- Missing: accounts/auth + database-backed storage + secure sharing model; robust file ingestion (PDF/DOCX/etc) + retrieval.
- Weak: durable background jobs (research/tasks) + notifications/timezones; user-facing recovery flows for local-only data.
- Parity: citations + web toggle, multi-turn threads, exports, “save/organize” surfaces (collections/spaces).
- Differentiator: local-first unified search with in-place bulk actions and workspace templates without forcing signup.

## Notes
- This file is maintained by the autonomous clone loop.

### Auto-discovered Open Checklist Items (2026-02-08)
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Auth and user accounts (email/SSO placeholder with secure sessions).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Database migration for threads/spaces/collections/files/tasks.
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Server-side file ingestion pipeline (PDF/DOCX/PPTX/CSV minimum).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Embeddings + retrieval API with citation grounding from indexed docs.
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Background job runner for research/tasks with persistent job state.
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Secure share model (private/link/org scopes with authorization checks).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Research job orchestration with intermediate checkpoints and resumability.
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Follow-up while research is running (job continuation API).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Space-level source controls and query policies.
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Better task scheduler (cron UI, timezone handling, notifications).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Rich export engine (DOCX/PDF/HTML templates with citations and metadata).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] OSS model connector layer (vLLM/Ollama/hosted OSS providers).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Auto-router policy (cost/latency/quality profile routing).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Connector framework for external systems (Drive/Notion/GitHub baseline).
- /Users/sarvesh/code/chat_with_llm/PRODUCT_GOALS.md:- [ ] Admin analytics dashboard and usage insights.
- /Users/sarvesh/code/chat_with_llm/.github/PULL_REQUEST_TEMPLATE.md:- [ ] `npm test`
- /Users/sarvesh/code/chat_with_llm/.github/PULL_REQUEST_TEMPLATE.md:- [ ] `npm run lint`
- /Users/sarvesh/code/chat_with_llm/.github/PULL_REQUEST_TEMPLATE.md:- [ ] `npm run build`
