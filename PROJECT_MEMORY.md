# Project Memory

## Objective
- Keep chat_with_llm production-ready. Current focus: Signal Search. Find the highest-impact pending work, implement it, test it, and push to main.

## Architecture Snapshot

## Open Problems

## Recent Decisions
- Template: YYYY-MM-DD | Decision | Why | Evidence (tests/logs) | Commit | Confidence (high/medium/low) | Trust (trusted/untrusted)
- 2026-02-11 | Prioritize Cycle 4 reliability work on Unified Search timestamp/export correctness before new surface-area features | Bounded market scan still shows trust/verification expectations around searchable history and operator-driven narrowing; export evidence quality is currently higher leverage than adding net-new controls | OpenAI Help search docs + Perplexity thread capabilities + Kagi filtering docs (`https://help.openai.com/en/articles/11487644-search-in-chatgpt`, `https://help.openai.com/en/articles/10056348-how-do-i-search-my-chat-history-in-chatgpt`, `https://www.perplexity.ai/help-center/en/articles/10354775-technical-capabilities-of-threads`, `https://help.kagi.com/kagi/features/filtering-results.html`) | 72c24d7 | medium | untrusted
- 2026-02-11 | Add shared timestamp parse/format helpers and switch Unified Search export/render paths to deterministic formatting with invalid-date fallback | Prevents `Invalid Date` leakage in markdown exports/UI and makes exported timestamps comparable across locales by emitting `ISO + locale` strings | `npm test -- tests/unified-search.test.ts` (68 tests), `npm test` (107 tests), `npm run build`, `node scripts/smoke.mjs --provider mock --skip-build` | 72c24d7 | high | trusted
- 2026-02-11 | Extend smoke verification with an operator-heavy `/search` request path assertion | Keeps a route-level regression guard in the runnable smoke path for operator-focused search flows | `node scripts/smoke.mjs --provider mock --skip-build` (`Smoke OK ...`) + green CI/Scorecard for commit `72c24d7` | 72c24d7 | high | trusted
- 2026-02-11 | Prioritize keyboard-first Unified Search UX (result traversal + operator autocomplete) for Cycle 3 | Bounded market scan shows keyboard-driven retrieval and explicit narrowing as baseline expectations for high-velocity search workflows | OpenAI Help search docs + Kagi filtering docs + Linear command workflow references (`https://help.openai.com/en/articles/11487644-search-in-chatgpt`, `https://help.openai.com/en/articles/10056348-how-do-i-search-my-chat-history-in-chatgpt`, `https://help.kagi.com/kagi/features/filtering-results.html`, `https://linear.app/blog/introducing-command-k`) | 6e36936 | medium | untrusted
- 2026-02-11 | Add deterministic Unified Search keyboard navigation and operator autocomplete with reusable helper functions | Reduces query friction for power users and makes operator discovery/actionable narrowing available without leaving the input flow | `npm test` (104 tests), `npm run lint -- --max-warnings=0`, `npm run build`, `node scripts/smoke.mjs --provider mock --skip-build` | 6e36936 | high | trusted
- 2026-02-11 | Expand Unified Search regression coverage for autocomplete helpers and operator combinations | Prevent parser/filter drift as operator surface grows and preserve thread/task scope behavior under combined operators | `npm test -- tests/unified-search.test.ts` (65 tests), full `npm test` pass (104 tests) | 6e36936 | high | trusted
- 2026-02-11 | Prioritize Unified Search thread-state filters, operator scope clarity docs, and saved-search migration hardening for Cycle 2 | Bounded market scan shows baseline expectation for explicit search narrowing and trustworthy history/workspace retrieval semantics | Perplexity thread/spaces docs + OpenAI ChatGPT search docs + Kagi filtering docs (`https://www.perplexity.ai/help-center/en/articles/10354775-technical-capabilities-of-threads`, `https://www.perplexity.ai/help-center/en/articles/10352961-what-are-spaces`, `https://help.openai.com/en/articles/11487644-search-in-chatgpt`, `https://help.openai.com/en/articles/10056348-how-do-i-search-my-chat-history-in-chatgpt`, `https://help.kagi.com/kagi/features/filtering-results.html`) | 8041e0f | medium | untrusted
- 2026-02-11 | Add Unified Search `is:` / `-is:` operators and enforce thread-only scope | Thread state is a high-signal filter in local libraries; mixed-result trust improves when unsupported operators exclude non-applicable types | `npm test` (`tests/unified-search.test.ts` 54 tests), `npm run lint -- --max-warnings=0`, `npm run build` | 8041e0f | high | trusted
- 2026-02-11 | Version saved-search storage payloads and migrate legacy arrays with validation | Prevent malformed/local-corrupt entries from breaking presets while keeping backward compatibility | `npm test` (`tests/saved-searches.test.ts` 12 tests), manual `/search` saved-search read/write verification through smoke path | 8041e0f | high | trusted
- 2026-02-11 | Enforce per-type Unified Search operator scope and stop unsupported-operator leakage into collections/files/tasks | Operator tokens are stripped from free text; without type-aware filtering, mixed results become broader and less trustworthy | `npm test` (`tests/unified-search.test.ts` 52 tests) + manual operator-scope verification in `/search` | 57bf944 | high | trusted
- 2026-02-11 | Precompute lowered relevance fields and score from lowered text (`computeRelevanceScoreFromLowered`) | Reduce repeated per-keystroke `toLowerCase()`/array allocation overhead while preserving ranking semantics | `npm run build` + `npm test` parity assertion (`computeRelevanceScore` equals lowered scorer) | 57bf944 | high | trusted
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
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` failed during parallel verification | Smoke start was launched before `next build` finished, so `.next` was incomplete | Re-ran smoke sequentially after build completion and kept sequential build+smoke command | Never parallelize commands with build/start dependency edges; use `npm run build && node scripts/smoke.mjs --provider mock --skip-build` | 57bf944 | high
- 2026-02-09 | Workflow policy check initially missed `- uses:` YAML step form | Regex only matched `uses:` when it started the line (ignoring list item form) | Updated matcher to accept `- uses:` and added a unit test | Add regression tests for policy rules so guardrails don't become false-negative | 0a9bbdf | high
- 2026-02-10 | `readStoredJson()` SSR guard update broke storage unit tests | Tests mocked `window` + `localStorage` but not `document` | Updated tests to define `document` for browser-mode cases | When hardening browser/SSR guards, update unit test environment shims in the same commit | 30a28ca | high
- 2026-02-10 | `npm run smoke:mock` failed with `.next/lock` | Ran `next build` in parallel with `scripts/smoke.mjs`, which also executes `next build` | Re-ran `npm run smoke:mock` sequentially after the standalone build completed | Avoid parallelizing verification commands when one command internally runs the other (build+smoke); run smoke sequentially or pass `--skip-build` | 8627eef | medium

## Known Risks
- LocalStorage is still the single source of truth; until server sync exists, corruption/quota and multi-tab divergence remain key risk areas.

## Next Prioritized Tasks
- P2: Add a search performance harness (`scripts/search-perf.mjs`) for 1k/5k/10k local dataset baselines.
- P2: Add timezone + locale metadata header for Unified Search markdown exports to improve reproducibility across machines.
- P3: Extend smoke with fixture-backed localStorage preload so `/search` operator assertions validate non-empty filtered results.

## Verification Evidence
- Template: YYYY-MM-DD | Command | Key output | Status (pass/fail)
- 2026-02-11 | `gh issue list --state open --limit 100 --json number,title,author,labels,url` | `[]` (no owner/bot open issues) | pass (untrusted)
- 2026-02-11 | `gh run list --limit 30 --json databaseId,displayTitle,headSha,headBranch,status,conclusion,event,workflowName,url,createdAt` | Latest non-Release runs were successful before Cycle 4 code changes | pass (untrusted)
- 2026-02-11 | `npm test -- tests/unified-search.test.ts` | `tests/unified-search.test.ts (68 tests)` | pass
- 2026-02-11 | `npm run lint -- --max-warnings=0` | (no output) | pass
- 2026-02-11 | `npm run check:workflows` | `Workflow policy OK (4 file(s) checked).` | pass
- 2026-02-11 | `npm test` | `Test Files 10 passed (10), Tests 107 passed (107)` | pass
- 2026-02-11 | `npm run build` | `Compiled successfully` | pass
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=65427 deltaEvents=15` | pass
- 2026-02-11 | `gh run watch 21901477620 --exit-status` | `main CI ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21901477636 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
- 2026-02-11 | `gh issue list --state open --limit 100 --json number,title,author,labels,url` | `[]` (no owner/bot open issues) | pass (untrusted)
- 2026-02-11 | `gh run list --limit 30 --json databaseId,displayTitle,headSha,headBranch,status,conclusion,event,workflowName,url,createdAt | jq '[.[] | select(.workflowName!=\"Release Please\") | select(.conclusion==\"failure\" or .conclusion==\"cancelled\" or .status!=\"completed\")]'` | `[]` (no failing/in-progress non-release runs) | pass (untrusted)
- 2026-02-11 | `npm test -- tests/unified-search.test.ts` | `tests/unified-search.test.ts (65 tests)` | pass
- 2026-02-11 | `npm run lint -- --max-warnings=0` | (no output) | pass
- 2026-02-11 | `npm test` | `Test Files 10 passed (10), Tests 104 passed (104)` | pass
- 2026-02-11 | `npm run build` | `Compiled successfully` | pass
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=64810 deltaEvents=15` | pass
- 2026-02-11 | `gh run watch 21900503216 --exit-status` | `main CI ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21900503209 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21900554344 --exit-status` | `main CI ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21900554292 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
- 2026-02-11 | `gh issue list --state open --limit 100 --json number,title,author,labels,url` | `[]` (no owner/bot open issues) | pass (untrusted)
- 2026-02-11 | `gh run list --limit 20 --json databaseId,displayTitle,headSha,headBranch,status,conclusion,event,workflowName,url,createdAt` | Latest `CI` and `Scorecard supply-chain security` for `8041e0f` detected; `Release Please` skipped | pass (untrusted)
- 2026-02-11 | `npm test` | `Test Files 10 passed (10), Tests 93 passed (93)` | pass
- 2026-02-11 | `npm run lint -- --max-warnings=0` | (no output) | pass
- 2026-02-11 | `npm run build` | `Compiled successfully` | pass
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=64096 deltaEvents=15` | pass
- 2026-02-11 | `gh run watch 21899494301 --exit-status` | `main CI ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21899494332 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=64202 deltaEvents=15` | pass
- 2026-02-11 | `gh run watch 21899594036 --exit-status` | `main CI ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21899594002 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run list --limit 15 --json databaseId,displayTitle,headSha,headBranch,status,conclusion,event,workflowName,url,createdAt` | `CI` and `Scorecard supply-chain security` recent runs `success`; `Release Please` skipped | pass (untrusted)
- 2026-02-11 | `npm test` | `Test Files 10 passed (10), Tests 87 passed (87)` | pass
- 2026-02-11 | `npm run lint -- --max-warnings=0` | (no output) | pass
- 2026-02-11 | `npm run build` | `Compiled successfully` | pass
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` (run in parallel with build) | `Could not find a production build in the '.next' directory` | fail
- 2026-02-11 | `node scripts/smoke.mjs --provider mock --skip-build` | `Smoke OK: provider=mock port=63085 deltaEvents=15` | pass
- 2026-02-11 | `npm run build && node scripts/smoke.mjs --provider mock --skip-build` | `Compiled successfully` + `Smoke OK: provider=mock port=63140 deltaEvents=15` | pass
- 2026-02-11 | `gh run watch 21898768898 --exit-status` | `main CI ... ✓ build` | pass (untrusted)
- 2026-02-11 | `gh run watch 21898768911 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
- 2026-02-11 | `gh run watch 21898830338 --exit-status` | `main CI ... ✓ build` | pass (untrusted)
- 2026-02-11 | `gh run watch 21898830326 --exit-status` | `Scorecard supply-chain security ... completed success` | pass (untrusted)
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
