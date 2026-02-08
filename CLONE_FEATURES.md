# Clone Feature Tracker

## Context Sources
- README and docs
- TODO/FIXME markers in code
- Test and build failures
- Gaps found during codebase exploration

## Candidate Features To Do
- Add timeline-aware sort in Unified Search so researchers can flip between recency and relevance per entity type.
- Support quick bulk actions directly from search results (pin, archive, assign space) to reduce library hopping.
- Persist and sync Notes/Threads beyond localStorage (browser storage quotas already near limits for larger research sets).

## Implemented
- 2026-02-08: Expanded library + unified search relevance to include answer text, citations, and notes with contextual snippets (src/components/chat-app.tsx, src/components/unified-search.tsx).

## Insights
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
- /Users/sarvesh/code/chat_with_llm/node_modules/@tybys/wasm-util/README.md:- [ ] ~~fd_advise~~
- /Users/sarvesh/code/chat_with_llm/node_modules/@tybys/wasm-util/README.md:- [ ] ~~fd_fdstat_set_flags~~
- /Users/sarvesh/code/chat_with_llm/node_modules/@tybys/wasm-util/README.md:- [ ] ~~proc_raise~~
- /Users/sarvesh/code/chat_with_llm/node_modules/@tybys/wasm-util/README.md:- [ ] ~~sock_recv~~
- /Users/sarvesh/code/chat_with_llm/node_modules/@tybys/wasm-util/README.md:- [ ] ~~sock_send~~
- /Users/sarvesh/code/chat_with_llm/node_modules/@tybys/wasm-util/README.md:- [ ] ~~sock_shutdown~~
- /Users/sarvesh/code/chat_with_llm/node_modules/unrs-resolver/README.md:- [ ] plugins.test.js
- /Users/sarvesh/code/chat_with_llm/node_modules/unrs-resolver/README.md:- [ ] pnp.test.js
- /Users/sarvesh/code/chat_with_llm/.github/PULL_REQUEST_TEMPLATE.md:- [ ] `npm test`
- /Users/sarvesh/code/chat_with_llm/.github/PULL_REQUEST_TEMPLATE.md:- [ ] `npm run lint`
- /Users/sarvesh/code/chat_with_llm/.github/PULL_REQUEST_TEMPLATE.md:- [ ] `npm run build`
