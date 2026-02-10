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
- 2026-02-10 | Improve Unified Search matching + ranking (multi-word token matching across fields, field-weighted relevance scoring with precomputed scores, and `/` focus + `Esc` clear + `Enter` commit recent query; defer query evaluation) | Fix missing results for multi-word queries and make relevance behavior predictable/testable while reducing sort overhead for large libraries | `npm test` (`tests/unified-search.test.ts`) + `npm run lint` + `npm run build` + `npm run smoke:mock` | 590f05c | high | trusted
- 2026-02-10 | Add Unified Search query operators (`type:`, `space:`, `tag:`, `has:`) | Reduce friction for narrowing Unified Search results without adding new UI controls | `npm test` (`tests/unified-search.test.ts`) | d1c8aab | high | trusted
- 2026-02-10 | Add `/` focus + `Esc` clear shortcuts for search inputs across Library/Spaces/Collections | Improve UX parity and speed for keyboard-first navigation | `npm test` + `npm run lint` | a9ed305 | high | trusted
- 2026-02-10 | Add “why this matched” micro-badges in Unified Search thread results | Improve trust/scanability by making match surfaces explicit without changing ranking | `npm test` (`tests/unified-search.test.ts`) + `npm run build` | e64f5ae | high | trusted
- 2026-02-10 | Unified Search indexes Space tags + supports `tag:` operator filtering for Spaces | Make Space discovery consistent with Spaces dashboard and reduce “why can’t I find this space” friction | `npm test` + `npm run lint` + `npm run build` + `npm run smoke:mock` | 285d9c8 | high | trusted
- 2026-02-10 | Add Unified Search saved searches (presets) | Make power-user search workflows sticky by enabling “save/pin/run” without retyping operators and filters | `npm test` (`tests/saved-searches.test.ts`) + `npm run lint` + `npm run build` | 9bcfc13 | high | trusted
- 2026-02-10 | Add Unified Search negative operators and harden query parsing | Improve search expressiveness (`-tag:`, `-has:`) while avoiding brittle operator parsing from unbalanced quotes | `npm test` (`tests/unified-search.test.ts`) + `npm run lint` + `npm run build` | 1d2a19a | high | trusted
- 2026-02-10 | Add Unified Search verbatim toggle + `verbatim:true|false` operator | Support phrase-only matching (no token fallback) for parity with baseline chat-history search expectations, while preserving default behavior | `npm test` + `npm run lint` + `npm run build` + `npm run smoke:mock` | dbe007a | high | trusted
- 2026-02-10 | Sync Unified Search saved searches across tabs/focus and clarify operators help | Avoid cross-tab state drift for power-user workflows and make operator semantics clearer at the point of use | `npm test` + `npm run lint` | 5f82826 | high | trusted
- 2026-02-10 | Speed up Unified Search filtering/sorting by caching normalized combined text per item | Reduce per-keystroke allocations for large libraries and keep relevance work bounded when query is empty or sort is time-based | `npm test` + `npm run lint` + `npm run build` + `npm run smoke:mock` | 8627eef | high | trusted
- 2026-02-10 | Export saved searches to Markdown and include them in Unified Search export | Make saved query workflows portable and easier to back up/share (local-first) | `npm test` + `npm run lint` | 828639e | high | trusted
- 2026-02-10 | Refactor Unified Search filtering/sorting into pure helpers + add unit tests for cross-type operators and relevance/newest fallback | Reduce UI duplication and lock operator semantics in tests without changing behavior | `npm test` + `npm run lint` + `npm run build` + `node scripts/smoke.mjs --provider mock --skip-build` | 793f3e5 | high | trusted
- 2026-02-10 | Unified Search UI: top-k selection for display; full sort only on export | Reduce per-keystroke work for large local-first libraries while keeping exports complete and correctly ordered | `npm test` + `npm run lint` + `npm run build` + `node scripts/smoke.mjs --provider mock --skip-build` | ff0e16d | high | trusted

## Mistakes And Fixes
- Template: YYYY-MM-DD | Issue | Root cause | Fix | Prevention rule | Commit | Confidence
- 2026-02-09 | Workflow policy check initially missed `- uses:` YAML step form | Regex only matched `uses:` when it started the line (ignoring list item form) | Updated matcher to accept `- uses:` and added a unit test | Add regression tests for policy rules so guardrails don't become false-negative | 0a9bbdf | high
- 2026-02-10 | `readStoredJson()` SSR guard update broke storage unit tests | Tests mocked `window` + `localStorage` but not `document` | Updated tests to define `document` for browser-mode cases | When hardening browser/SSR guards, update unit test environment shims in the same commit | 30a28ca | high
- 2026-02-10 | `npm run smoke:mock` failed with `.next/lock` | Ran `next build` in parallel with `scripts/smoke.mjs`, which also executes `next build` | Re-ran `npm run smoke:mock` sequentially after the standalone build completed | Avoid parallelizing verification commands when one command internally runs the other (build+smoke); run smoke sequentially or pass `--skip-build` | 8627eef | medium

## Known Risks
- LocalStorage is still the single source of truth; until server sync exists, corruption/quota and multi-tab divergence remain key risk areas.

## Next Prioritized Tasks
- P4: Unified Search performance: reduce relevance scoring overhead for large result sets (avoid repeated `toLowerCase()` and per-field allocations when scoring).

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
- 2026-02-10 | `npm test` | `Test Files 10 passed (10)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock port=63391 deltaEvents=15` | pass
- 2026-02-10 | `gh run watch 21873582273 --exit-status` | `main CI ... ✓ build` | pass (untrusted)
- 2026-02-10 | `npm test` | `Test Files 10 passed (10)` | pass
- 2026-02-10 | `gh run watch 21873684101 --exit-status` | `main CI ... ✓ build` | pass (untrusted)
- 2026-02-10 | `gh run watch 21873684098 --exit-status` | `Scorecard ... completed success` | pass (untrusted)
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
- 2026-02-10 | `npm test` | `Test Files 9 passed (9)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock ...` | pass
- 2026-02-10 | `gh run list --limit 5 --branch main` | `CI/Scorecard in_progress for commit 590f05c` | pass (untrusted)
- 2026-02-10 | `npm test` | `Test Files 9 passed (9)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock port=...` | pass
- 2026-02-10 | `gh run list --limit 8 --branch main` | `CI/Scorecard in_progress for commit e64f5ae` | pass (untrusted)
- 2026-02-10 | `npm test` | `Test Files 9 passed (9)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock ...` | pass
- 2026-02-10 | `npm run check:workflows` | `Workflow policy OK (4 file(s) checked).` | pass
- 2026-02-10 | `npm test` | `Test Files 10 passed (10)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock port=63686 deltaEvents=15` | pass
- 2026-02-10 | `npm test` | `Test Files 10 passed (10)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `npm run smoke:mock` | `.next/lock` acquisition failed (build running concurrently) | fail
- 2026-02-10 | `npm run smoke:mock` | `Smoke OK: provider=mock port=64199 deltaEvents=15` | pass
- 2026-02-10 | `gh run list --limit 10 --branch main` | `CI/Scorecard in_progress then success for pushed commits` | pass (untrusted)
- 2026-02-10 | `gh run watch 21875053555 --exit-status` | `main CI ... completed success` | pass (untrusted)
- 2026-02-10 | `gh run watch 21875053531 --exit-status` | `Scorecard ... completed success` | pass (untrusted)
- 2026-02-10 | `npm test` | `Tests 80 passed (80)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=64451 deltaEvents=15` | pass
- 2026-02-10 | `npm test` | `Test Files 10 passed (10)` | pass
- 2026-02-10 | `npm run lint` | (no output) | pass
- 2026-02-10 | `npm run build` | `Compiled successfully` | pass
- 2026-02-10 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=64882 deltaEvents=15` | pass

## Historical Summary
- Keep compact summaries of older entries here when file compaction runs.
