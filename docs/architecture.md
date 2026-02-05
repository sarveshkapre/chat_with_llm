# Architecture

## Overview
Signal Search is a Next.js app with an API route that calls a provider layer. The provider returns an `AnswerResponse` containing text and citations. The UI renders modes, sources, spaces, tasks, and a local thread library.

## Key modules
- `src/app/api/answer/route.ts`: JSON response API.
- `src/app/api/answer/stream/route.ts`: NDJSON streaming API.
- `src/lib/providers`: Provider abstraction (OpenAI + mock).
- `src/lib/citations.ts`: Citation extraction helpers.
- `src/lib/attachments.ts`: Attachment parsing and stripping.
- `src/lib/file-search.ts`: Lightweight library search.
- `src/components/chat-app.tsx`: Main UI.

## Data flow
1. User submits a question with mode + source settings, optional attachments, and an optional Space.
2. API routes to provider (streamed or JSON).
3. Provider returns answer + citations.
4. UI renders answer and caches thread history in localStorage.

## Local automation
Tasks are stored in localStorage and run on-demand. Each run creates a thread in the library.

## File library
Files are stored in localStorage (text only). File search auto-attaches top matches into the request payload.
