# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Initial scaffold for Signal Search.
- Unified Search now supports timeline windows (all, 24h, 7d, 30d).
- Unified Search now supports direct and bulk thread actions (favorite, pin, archive, and space assignment).
- Unified Search relevance improved: multi-word queries match across fields (phrase or tokenized all-term match), with field-weighted ranking and precomputed scores.
- Unified Search supports query operators (`type:`, `space:`, `tag:`, `has:`) with inline help.
- Unified Search shows “why this matched” badges on thread results (title/tags/space/note/citations/answer).
- Added `/` focus and `Esc` clear shortcuts for Library/Spaces/Collections search inputs.
- GitHub Actions workflows hardened: pinned action SHAs, Scorecard permission-safe config, and gated Release Please automation.
- Upgraded `vitest` toolchain to remediate moderate dependency advisories.
