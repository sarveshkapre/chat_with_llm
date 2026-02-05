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
- Thread library with search, filters, and share links
- Spaces with custom instructions (local-only)
- Local file attachments for context (text formats)
- Tasks scheduler (local-only) with Run Now
- Pluggable provider interface (OpenAI now, OSS models next)

## Configuration
Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to enable live search.

## Notes
- Vibe coding + LLM workflow notes live in `docs/vibe-coding.md`.

## Deploy
This is a standard Next.js app. Deploy on your platform of choice and supply the same env vars.
