# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration

## Candidate Features To Do
- [ ] P0 (Selected): Track maintainer contract + memory files in git (`AGENTS.md`, `PROJECT_MEMORY.md`, `INCIDENTS.md`) and keep them current each cycle.
- [ ] P0 (Selected): CI: Migrate `github/codeql-action/upload-sarif` to v4 (pinned SHA) to avoid v3 deprecation drift.
- [ ] P0 (Selected): CI: Add workflow policy checks (pinned `uses:` SHAs + explicit least-privilege `permissions:`) and run them in CI.
- [ ] P1 (Selected): Unified Search: Add undo affordance for bulk thread actions to reduce accidental archive/space reassignments.
- [ ] P2: Unified Search: Add bulk favorite/unfavorite actions to match per-thread quick actions.
- [ ] P2: Add a documented smoke verification path (mock mode) that can be run locally and in CI on demand.
- [ ] P2: Follow up on server-backed persistence planning for notes/threads beyond localStorage.
- [ ] P3: Add a lightweight “data corruption backup” mechanism when localStorage JSON parsing fails (preserve a copy before overwriting).

## Implemented
- 2026-02-08: Hardened Actions workflows by pinning action SHAs and tightening token permissions in CI/Scorecard (`.github/workflows/ci.yml`, `.github/workflows/scorecard.yml`).
- 2026-02-08: Stabilized Release Please by removing invalid input and gating automation behind explicit enablement (`.github/workflows/release-please.yml`).
- 2026-02-08: Remediated moderate dependency advisories by upgrading the `vitest` toolchain to v4 (`package.json`, `package-lock.json`, `npm audit --json` now shows 0 vulnerabilities).
- 2026-02-08: Added Unified Search timeline filtering and in-place thread quick/bulk actions (favorite/pin/archive/space assignment) (`src/components/unified-search.tsx`, `src/lib/unified-search.ts`).
- 2026-02-08: Added regression tests for timeline and bulk-action helper logic (`tests/unified-search.test.ts`).
- 2026-02-08: Expanded library + unified search relevance to include answer text, citations, and notes with contextual snippets (src/components/chat-app.tsx, src/components/unified-search.tsx).

## Insights
- Scorecard failures were not from scan results; they were caused by workflow policy validation when `publish_results: true` was combined with write-level permissions.
- Release automation can hard-fail in repos where GitHub Actions cannot open PRs; explicit gating keeps `main` green while preserving manual release capability.
- Signal Search usability improves when actions happen in the search surface itself; forcing users back into Library for pin/archive/space edits adds unnecessary friction.
- Users rely on notes and citations during follow-ups, so search must index those fields; otherwise “Signal Search” fails to find high-signal content.
- LocalStorage remains the single source of truth; until server sync exists we need light-weight resiliency features (like snippets plus filtering) to avoid data lock-in.

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
