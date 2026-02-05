# Product Goals and Feature Plan

## What We Are
Signal Search is a free-tier, web-grounded answer engine with citations, multi-turn context, and project organization features (library, spaces, collections, files, tasks).  
The product direction is a Perplexity-style experience with our own branding and an OpenAI-first provider architecture that can expand to open-source models.

## Top Goals
1. Trustworthy answers: fast responses with citations users can verify.
2. Research workflow: support long-running inquiry across threads, exports, and workspace organization.
3. Local-first productivity: useful in one browser session without mandatory account setup.
4. Provider flexibility: keep model/provider abstraction so we can route across OpenAI and OSS models.
5. Production readiness: move from local-only storage/workflows to secure multi-user cloud architecture.

## Current State
### Implemented
- Answering: Quick/Research/Learn modes, web/offline sources, NDJSON streaming, citations.
- Threads: library, filters, tags, notes, archive/pin/favorite, duplicate/move, bulk actions.
- Exports: answer exports (Markdown/DOCX/PDF), report page, filtered library export.
- Knowledge: file attachments + local file library search (text files).
- Spaces/Collections: dashboards, filters, tags, merge/archive/duplicate/export flows.
- Search UX: unified search across threads/spaces/collections/files with Markdown/CSV export.
- Automation scaffold: local task scheduling and run-now generation of threads.
- Provider layer: OpenAI provider + mock provider behind shared interface.

### Working But Not Production-Grade
- Storage is localStorage-based (single browser, no cross-device sync).
- Access control and sharing are link-level UX only, not secure multi-user controls.
- Tasks are local and manual/on-demand, not durable server-side jobs.
- File handling is text-focused; advanced parsing/indexing is limited.

## Gaps To Reach Product Target
1. Multi-user platform: auth, accounts, orgs, permissions, durable DB.
2. Retrieval stack: robust indexing, chunking, embeddings, reranking, file-type coverage.
3. Deep research engine: clarifying questions, long-running jobs, richer progress telemetry.
4. Collaboration: true shared spaces/threads with role-based controls and auditability.
5. Reliability/ops: telemetry, error monitoring, tracing, rate limits, abuse protection.
6. Security/compliance: data retention controls, encryption strategy, admin controls.
7. Monetization controls: usage quotas, plan gating, billing/entitlements.

## Prioritized Feature List
## P0 (Core Platform)
- [ ] Auth and user accounts (email/SSO placeholder with secure sessions).
- [ ] Database migration for threads/spaces/collections/files/tasks.
- [ ] Server-side file ingestion pipeline (PDF/DOCX/PPTX/CSV minimum).
- [ ] Embeddings + retrieval API with citation grounding from indexed docs.
- [ ] Background job runner for research/tasks with persistent job state.
- [ ] Secure share model (private/link/org scopes with authorization checks).

## P1 (Research and Productivity)
- [ ] Research job orchestration with intermediate checkpoints and resumability.
- [ ] Follow-up while research is running (job continuation API).
- [ ] Space-level source controls and query policies.
- [ ] Better task scheduler (cron UI, timezone handling, notifications).
- [ ] Rich export engine (DOCX/PDF/HTML templates with citations and metadata).

## P2 (Model and Ecosystem)
- [ ] OSS model connector layer (vLLM/Ollama/hosted OSS providers).
- [ ] Auto-router policy (cost/latency/quality profile routing).
- [ ] Connector framework for external systems (Drive/Notion/GitHub baseline).
- [ ] Admin analytics dashboard and usage insights.

## Release Framing
- Milestone A: Multi-user foundation (P0 auth+DB).
- Milestone B: Reliable retrieval and research jobs (P0 retrieval+jobs).
- Milestone C: Collaboration and secure sharing (P0 sharing + P1 controls).
- Milestone D: Model routing and connectors (P2).
