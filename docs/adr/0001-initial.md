# ADR 0001: Initial Stack

## Status
Accepted

## Context
We need a fast-to-iterate web app with a fullstack API layer and a strong UI foundation.

## Decision
Use Next.js App Router with TypeScript, Tailwind CSS, and a provider abstraction for LLM calls.

## Consequences
- Easy local development with one command.
- Straightforward migration to persistent storage and background jobs later.
