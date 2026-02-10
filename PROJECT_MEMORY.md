# Project Memory

## Objective
- Keep chat_with_llm production-ready. Current focus: Signal Search. Find the highest-impact pending work, implement it, test it, and push to main.

## Architecture Snapshot

## Open Problems

## Recent Decisions
- Template: YYYY-MM-DD | Decision | Why | Evidence (tests/logs) | Commit | Confidence (high/medium/low) | Trust (trusted/untrusted)
- 2026-02-09 | Track maintainer contract + memory files in git (`AGENTS.md`, `PROJECT_MEMORY.md`, `INCIDENTS.md`) | Keep autonomous maintenance auditable and repeatable | `git ls-files AGENTS.md PROJECT_MEMORY.md INCIDENTS.md` | 5a36bd8 | high | trusted
- 2026-02-09 | Add workflow policy guardrail (`npm run check:workflows`) + enforce it in CI | Prevent drift to unpinned actions / missing least-privilege permissions before merge | `npm run check:workflows` + `npm test` | 0a9bbdf | high | trusted
- 2026-02-09 | Add Undo for Unified Search bulk thread actions | Reduce accidental bulk archive/space edits and make the search surface safer | Manual UI verification during local smoke, plus build/test green | 0a9bbdf | medium | trusted
- 2026-02-10 | Add Unified Search bulk favorite/unfavorite actions | Parity with per-thread quick actions; reduces friction for organizing many results | `npm test` + `npm run lint` | 2c94219 | high | trusted
- 2026-02-10 | Back up corrupt localStorage JSON blobs on parse failures | Prevent silent data loss when fallback state overwrites corrupted JSON | `npm test` (`tests/storage.test.ts`) + `npm run lint` | 716763b | high | trusted
- 2026-02-10 | Add mock smoke verification path + on-demand CI workflow | Make a reproducible end-to-end check for routes + provider plumbing without API keys | `npm run smoke:mock` + `npm run check:workflows` | fe19614 | high | trusted
- 2026-02-10 | Add integration-style tests for `/api/answer` and `/api/answer/stream` + configurable mock stream delay | Lock API shapes and keep NDJSON behavior stable while keeping tests fast | `npm test` + `npm run lint` | f278cd6 | high | trusted
- 2026-02-10 | Add Library data tools (export raw `signal-*` localStorage + export-gated reset) + storage usage indicator | Make local-first recovery practical and reduce “my data is stuck” failure modes | `npm run build` + `node scripts/smoke.mjs --provider mock --skip-build` | e42bb68 | high | trusted
- 2026-02-10 | Document local data export/reset + corruption recovery | Give users a clear recovery path for local-only storage | `docs/data-recovery.md` + README link | 3fac87f | high | trusted
- 2026-02-10 | Harden Unified Search bulk selection against stale/missing thread ids; make bulk counts/toasts reflect active selection | Prevent bulk actions from misreporting counts or acting on stale selection when threads are removed in another tab | `npm test` + `npm run lint` | 3a7dff9 | high | trusted
- 2026-02-10 | Sync Unified Search thread ref in `readAll()` | Ensure bulk actions compute against freshly loaded thread state during focus/storage reload cycles | `npm test` + `npm run lint` | 5ff22d3 | medium | trusted
- 2026-02-10 | Add Library bulk undo for archive/delete | Reduce fear of bulk actions and make local-first workflows safer | `npm test` (`tests/library-undo.test.ts`) + `npm run lint` | 661ff10 | high | trusted
- 2026-02-10 | Add Data health warning + diagnostics bundle (full + redacted) | Make corruption/quota issues diagnosable without developer tools; improve support workflows | `npm run build` + `npm run smoke:mock` | 50055b4 | high | trusted
- 2026-02-10 | Remove Next build warning from Node WebStorage by lazy-loading `docx` | Keep production builds clean and reduce baseline bundle weight; avoid SSR-side access to Node WebStorage globals | `npm run build` (no `--localstorage-file` warning) | 30a28ca | high | trusted
- 2026-02-10 | Add unified search match highlighting (query/token emphasis) | Improve scanability of search results without changing ranking logic | `npm test` + `npm run lint` + `npm run build` | ce3429c | high | trusted

## Mistakes And Fixes
- Template: YYYY-MM-DD | Issue | Root cause | Fix | Prevention rule | Commit | Confidence
- 2026-02-09 | Workflow policy check initially missed `- uses:` YAML step form | Regex only matched `uses:` when it started the line (ignoring list item form) | Updated matcher to accept `- uses:` and added a unit test | Add regression tests for policy rules so guardrails don't become false-negative | 0a9bbdf | high
- 2026-02-10 | `readStoredJson()` SSR guard update broke storage unit tests | Tests mocked `window` + `localStorage` but not `document` | Updated tests to define `document` for browser-mode cases | When hardening browser/SSR guards, update unit test environment shims in the same commit | 30a28ca | high

## Known Risks
- LocalStorage is still the single source of truth; until server sync exists, corruption/quota and multi-tab divergence remain key risk areas.

## Next Prioritized Tasks
- P3: Improve unified search relevance scoring and add regression tests.
- P3: Add keyboard shortcuts for search surfaces.
- P3: Add a debounced query input option for unified search.

## Verification Evidence
- Template: YYYY-MM-DD | Command | Key output | Status (pass/fail)
- 2026-02-09 | `npm run check:workflows` | `Workflow policy OK (3 file(s) checked).` | pass
- 2026-02-09 | `npm run lint` | (no output) | pass
- 2026-02-09 | `npm test` | `Test Files 4 passed` | pass
- 2026-02-09 | `npm run build` | `Compiled successfully` (warning observed: `--localstorage-file` path invalid) | pass
- 2026-02-09 | `PORT=3020 nohup npm run start ... && curl -I http://localhost:3020/search` | `HTTP/1.1 200 OK` | pass
- 2026-02-10 | `npm run check:workflows` | `Workflow policy OK (4 file(s) checked).` | pass
- 2026-02-10 | `npm test` | `Test Files 5 passed` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock ...` | pass
- 2026-02-10 | `npm test` | `Test Files 7 passed (7)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` (warning observed: `--localstorage-file` path invalid) | pass
- 2026-02-10 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock ...` | pass
- 2026-02-10 | `gh run list --limit 3 --branch main` | `CI ... completed success` | pass (untrusted)
- 2026-02-10 | `npm test` | `Test Files 7 passed (7)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` (warning observed: `--localstorage-file` path invalid) | pass
- 2026-02-10 | `npm test` | `Test Files 7 passed (7)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm test` | `Test Files 8 passed (8)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` (no `--localstorage-file` warning) | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock ...` | pass
- 2026-02-10 | `gh run list --limit 5 --branch main` | `CI/Scorecard in_progress for commit 30a28ca` | pass (untrusted)
- 2026-02-10 | `npm test` | `Test Files 9 passed (9)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm test` | `Test Files 9 passed (9)` (post-`2b5d2e7`) | pass
- 2026-02-10 | `npm run lint` | (no output) (post-`2b5d2e7`) | pass

## Historical Summary
- Keep compact summaries of older entries here when file compaction runs.
