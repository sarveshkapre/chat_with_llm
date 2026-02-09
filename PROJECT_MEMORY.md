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

## Mistakes And Fixes
- Template: YYYY-MM-DD | Issue | Root cause | Fix | Prevention rule | Commit | Confidence
- 2026-02-09 | Workflow policy check initially missed `- uses:` YAML step form | Regex only matched `uses:` when it started the line (ignoring list item form) | Updated matcher to accept `- uses:` and added a unit test | Add regression tests for policy rules so guardrails don't become false-negative | 0a9bbdf | high

## Known Risks

## Next Prioritized Tasks
- P2: Unified Search bulk favorite/unfavorite actions for parity with per-thread actions.
- P2: Add a documented “mock mode” smoke path that can be run on demand (local + optional CI).
- P3: Add localStorage corruption backup on JSON parse failures (preserve a copy before overwriting).

## Verification Evidence
- Template: YYYY-MM-DD | Command | Key output | Status (pass/fail)
- 2026-02-09 | `npm run check:workflows` | `Workflow policy OK (3 file(s) checked).` | pass
- 2026-02-09 | `npm run lint` | (no output) | pass
- 2026-02-09 | `npm test` | `Test Files 4 passed` | pass
- 2026-02-09 | `npm run build` | `Compiled successfully` (warning observed: `--localstorage-file` path invalid) | pass
- 2026-02-09 | `PORT=3020 nohup npm run start ... && curl -I http://localhost:3020/search` | `HTTP/1.1 200 OK` | pass

## Historical Summary
- Keep compact summaries of older entries here when file compaction runs.
