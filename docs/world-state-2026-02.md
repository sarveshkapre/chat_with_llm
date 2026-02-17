# State Of The World Snapshot (2026-02-17)

This snapshot captures external platform changes relevant to Signal Search and maps them to near-term engineering work.

## Verified external signals

- OpenAI has deprecated the Assistants API with a shutdown date of **August 26, 2026**; Responses + Conversations are the forward path.
  - Source: [Assistants migration guide](https://platform.openai.com/docs/assistants)
- OpenAI Responses now supports first-class hosted tools (web search, file search) plus remote MCP and long-running background mode.
  - Sources:
    - [Using tools](https://platform.openai.com/docs/guides/tools/file-search)
    - [File search tool](https://platform.openai.com/docs/guides/tools-file-search)
    - [Background mode](https://platform.openai.com/docs/guides/background)
- MCP protocol maturity increased: current protocol version listed as `2025-06-18`, with conformance test/tiering rollout in early 2026.
  - Sources:
    - [MCP specification versioning](https://modelcontextprotocol.io/specification/)
    - [MCP SDK tiers](https://modelcontextprotocol.io/community/sdk-tiers)
- Next.js 16 is available and the v16 upgrade docs were updated on **February 11, 2026**, including stronger MCP-assisted developer workflows.
  - Sources:
    - [Next.js 16 release post](https://nextjs.org/blog/next-16)
    - [Next.js v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

## Implications for this repo

1. Prioritize Responses-native architecture (avoid new Assistants-specific integrations).
2. Add a server-side async research job path (maps to OpenAI background mode and our existing research UX).
3. Build an MCP connector abstraction in the provider layer (local/remote tools with explicit confirmations).
4. Expand file retrieval from lightweight local text search to ingestion + vector retrieval.
5. Keep framework/tooling current on Next.js 16 migration requirements and async API boundaries.

## Suggested execution order

1. Implement server job state for long-running research with resumable polling.
2. Add provider-level tool registry (`web_search`, `file_search`, `mcp`) with clear policy controls.
3. Introduce ingestion/indexing pipeline for uploaded files and replace purely local text scan fallback.
4. Add migration plan notes for any remaining Assistants-era assumptions.
