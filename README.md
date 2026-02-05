# Signal Search

A free-tier answer engine with real-time web research, citations, and learning-friendly explanations.

![Signal Search UI](docs/preview.svg)

## Quickstart
```bash
npm install && npm run dev
```

## Features
- Web-grounded answers with citations
- Quick, Research, and Learn modes with research progress states
- Source toggle (web or offline)
- Streaming responses (NDJSON)
- Thread library with search, filters, and share links
- Research report view with export + print
- Bulk thread actions (delete, assign to space)
- Thread renaming + compact library view
- Export answers to Markdown, DOCX, and PDF
- Favorites, pinned threads, and collections
- Collection filter pills + thread notes
- Collections dashboard + tag filters
- Bulk tag assignment + tag-based sorting
- Saved search presets + collection export to Markdown
- Spaces with custom instructions (local-only)
- Local file attachments for context (text formats)
- File library with lightweight full-text search
- Tasks scheduler (local-only) with Run Now
- Pluggable provider interface (OpenAI now, OSS models next)

## Configuration
Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to enable live search.

## Notes
- Vibe coding + LLM workflow notes live in `docs/vibe-coding.md`.

## Deploy
This is a standard Next.js app. Deploy on your platform of choice and supply the same env vars.
