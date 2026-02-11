# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Initial scaffold for Signal Search.
- Added Unified Search benchmark harness (`scripts/search-perf.mjs` + `tests/search-perf.bench.ts`) with reproducible 1k/5k/10k local dataset timings.
- Unified Search now guards recent query preload (`signal-unified-recent-v1`) with schema validation, normalization, dedupe, and deterministic capping.
- Unified Search operator docs now include explicit export semantics and keyboard precedence behavior.
- Unified Search now decodes malformed thread/space/task localStorage payloads through schema guards before preload/focus refresh, preventing `/search` crashes from invalid cached shapes.
- Unified Search timeline regression coverage now includes DST-offset timestamp cases and invalid mixed timestamp handling for bounded windows.
- Unified Search export builders now run through shared pure helpers for markdown/saved-search/CSV generation.
- Unified Search CSV exports now use deterministic full-cell escaping for commas/newlines/quotes.
- Unified Search accessibility pass: action controls now expose explicit labels and toast updates are announced via polite live regions.
- Workflow policy now enforces that `.github/workflows/smoke.yml` executes `npm run smoke:mock`.
- Unified Search now supports timeline windows (all, 24h, 7d, 30d).
- Unified Search now supports direct and bulk thread actions (favorite, pin, archive, and space assignment).
- Unified Search relevance improved: multi-word queries match across fields (phrase or tokenized all-term match), with field-weighted ranking and precomputed scores.
- Unified Search supports query operators (`type:`, `space:`, `tag:`, `has:`) with inline help.
- Unified Search shows “why this matched” badges on thread results (title/tags/space/note/citations/answer).
- Unified Search performance: UI uses top-k selection per section (avoids sorting full result sets on every keystroke); full ordering is computed only on export.
- Unified Search exports now use deterministic timestamps (`ISO + locale`) with invalid-date fallback guardrails.
- Unified Search markdown exports now include environment metadata (`locale`, `timeZone`, and `utcOffset`) for reproducible cross-machine evidence.
- Unified Search bulk actions now expose a `Prune stale` recovery control when selected thread ids are no longer present.
- Unified Search parser regression coverage expanded with long/duplicate/quoted/unbalanced operator-heavy query tests.
- Added `/` focus and `Esc` clear shortcuts for Library/Spaces/Collections search inputs.
- GitHub Actions workflows hardened: pinned action SHAs, Scorecard permission-safe config, and gated Release Please automation.
- Upgraded `vitest` toolchain to remediate moderate dependency advisories.
