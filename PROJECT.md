# Signal Search Project Guide

## Quickstart (one command)
```bash
npm install && npm run dev
```

## Commands
```bash
npm run dev      # Start the development server
npm run build    # Production build
npm run start    # Run production server
npm run lint     # Lint
npm test         # Run unit tests
```

## Environment variables
Create a `.env` file based on `.env.example`.

- `PROVIDER`: `auto` | `openai` | `mock`
- `OPENAI_API_KEY`: Required for OpenAI responses
- `OPENAI_MODEL`: Model name, default `gpt-4.1`
- `OPENAI_BASE_URL`: Optional base URL for OpenAI-compatible providers

## Notes
- Without an API key, the app runs in mock mode.
- The UI persists threads in localStorage until a database layer is added.
