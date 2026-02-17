# Signal Search

A free-tier answer engine with real-time web research, citations, and learning-friendly explanations.

![Signal Search UI](docs/preview.svg)

## Quickstart
```bash
npm install && npm run dev
```

## Features
- Web-grounded answers with citations
- Citation normalization strips tracking params for cleaner dedupe
- Quick, Research, and Learn modes with research progress states
- Research mode key findings panel while answers are still streaming
- Pre-research clarifying prompts for broad research queries
- Source toggle (web or offline)
- Streaming responses (NDJSON)
- Thread library with search, filters, and share links
- Thread visibility controls (private vs link) with share-state badges
- Guest and incognito retention windows with auto-expiry cleanup (14 days / 24 hours)
- Data tools diagnostics for corruption backups and recent localStorage write failures
- Conversational follow-ups with optional thread context toggle
- Thread-scoped follow-up lock for mode/source with one-click new-thread reset
- Rewrite current answer with a selected model + model visibility in answer details
- Research report view with export + print
- Bulk thread actions (delete, assign to space)
- Thread renaming + compact library view
- Export answers to Markdown, DOCX, and PDF
- Favorites, pinned threads, and collections
- Collection filter pills + thread notes
- Collections dashboard + tag filters
- Bulk tag assignment + tag-based sorting
- Saved search presets + collection export to Markdown
- Pinned saved searches + export filtered library
- Archive threads + recent filters history
- Recent filter pinning + header archive actions
- Archive filtered view + bump thread
- Unarchive filtered + duplicate thread
- Duplicate threads into spaces + bulk duplicate
- Bulk duplicate + bulk move/remove from space
- Move to active space + remove from all spaces
- Space stats + set active space from thread
- Edit spaces + export space to Markdown
- Duplicate space + archive/restore spaces
- Merge spaces + space tags
- Space filter in Library + Spaces dashboard
- Space tag editing in dashboard + clear filters button
- Space tag filters + export all spaces
- Space tag search + export filtered spaces
- Space dashboard thread preview
- Space dashboard sorting (name/activity)
- Unified search (threads + spaces)
- Unified search indexes Space tags (`tag:` works for Spaces)
- Unified search filters + export results
- Unified search recent queries + CSV export
- Unified search top results summary + clear recent
- Unified search now includes collections and files
- Unified search now includes tasks
- Unified search sort controls (relevance/newest/oldest) + per-section result limits
- Unified search timeline filter (all/24h/7d/30d) across threads/spaces/collections/files/tasks
- Unified search markdown exports now emit deterministic timestamps (ISO + locale) with invalid-date fallbacks
- Unified search exports include environment metadata (locale/timezone/UTC offset) for reproducible evidence sharing
- Unified search in-place thread actions + bulk operations (favorite/pin/archive/space assignment)
- Unified search bulk toolbar includes stale-selection recovery (`Prune stale`) when cross-tab changes invalidate selected ids
- Unified search keyboard result navigation (`ArrowUp/ArrowDown/Enter`) with active-row highlight
- Unified search operator autocomplete (`type:`, `space:`, `tag:`, `has:`, `is:`, `verbatim:`) with Enter/Tab accept and Esc dismiss
- Unified search operator summary chips dedupe repeated `tag:`/`is:` operators into canonical order
- Unified search diagnostics mode (`/search?debug=1`) with loaded/matched/visible counts and filtered-out reason buckets
- Unified search shareable URL state (`q`, `type`, `sort`, `time`, `limit`, `verbatim`) with back/forward sync
- Unified search zero-results recovery card with one-click resets (operators, type, timeline, verbatim)
- Spaces with custom instructions and preferred model routing (local-only)
- Space-level source policy enforcement (flexible, web-only, offline-only)
- Space templates gallery for one-click workspace setup
- Local file attachments for context (text formats)
- File library with lightweight full-text search and quoted phrase boosts
- Tasks scheduler (local-only) with once/daily/weekday/weekly/monthly/yearly cadences, explicit Space targeting, and last-result links
- Pluggable provider interface (OpenAI now, OSS models next)

## Configuration
Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to enable live search.

## Notes
- Vibe coding + LLM workflow notes live in `docs/vibe-coding.md`.
- External platform landscape snapshot lives in `docs/world-state-2026-02.md`.
- Product direction and prioritized feature plan live in `PRODUCT_GOALS.md`.
- Local-first data export/reset and corruption recovery steps live in `docs/data-recovery.md`.
- Unified Search operator reference and scope matrix live in `docs/unified-search-operators.md`.
- Unified Search benchmark workflow and baseline table live in `docs/search-performance.md`.
- Shared localStorage key contracts live in `src/lib/storage-keys.ts`.

## Deploy
This is a standard Next.js app. Deploy on your platform of choice and supply the same env vars.
