# Vibe Coding Notes (2026)

- Start with a clear "definition of done" and list the 3-5 behaviors that prove it.
- Use tight prompts for scaffolding and broader prompts for ideation.
- Keep a provider abstraction so you can swap OpenAI and OSS models without rewiring UI or storage.
- Treat citations as data first. Render them in the UI only after you can parse and dedupe them.
- Prefer streaming for long answers, but persist the final response as a single canonical record.
- Store prompts and model settings alongside every answer so you can replay or re-run with a new model.
- Separate "search" from "synthesis" so you can replace the LLM without breaking retrieval quality.
