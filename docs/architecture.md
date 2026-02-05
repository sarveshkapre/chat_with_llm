# Architecture

## Overview
Signal Search is a Next.js app with an API route that calls a provider layer. The provider returns an `AnswerResponse` containing text and citations. The UI renders modes, answer, and a local thread library.

## Key modules
- `src/app/api/answer/route.ts`: API entry point.
- `src/lib/providers`: Provider abstraction (OpenAI + mock).
- `src/lib/citations.ts`: Citation extraction helpers.
- `src/components/chat-app.tsx`: Main UI.

## Data flow
1. User submits a question.
2. API routes to provider.
3. Provider returns answer + citations.
4. UI renders answer and caches thread history in localStorage.
