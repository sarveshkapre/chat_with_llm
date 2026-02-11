import { describe, expect, it } from "vitest";
import {
  decodeUnifiedSearchThreadsStorage,
  filterThreadEntries,
  parseUnifiedSearchQuery,
} from "@/lib/unified-search";
import {
  UNIFIED_SEARCH_SMOKE_BOOTSTRAP,
  UNIFIED_SEARCH_SMOKE_QUERY,
} from "@/lib/unified-search-smoke-fixture";

describe("unified search smoke fixture", () => {
  it("contains fixture records for every major result type", () => {
    expect(Array.isArray(UNIFIED_SEARCH_SMOKE_BOOTSTRAP.threads)).toBe(true);
    expect(Array.isArray(UNIFIED_SEARCH_SMOKE_BOOTSTRAP.spaces)).toBe(true);
    expect(Array.isArray(UNIFIED_SEARCH_SMOKE_BOOTSTRAP.collections)).toBe(true);
    expect(Array.isArray(UNIFIED_SEARCH_SMOKE_BOOTSTRAP.files)).toBe(true);
    expect(Array.isArray(UNIFIED_SEARCH_SMOKE_BOOTSTRAP.tasks)).toBe(true);

    expect((UNIFIED_SEARCH_SMOKE_BOOTSTRAP.threads as unknown[]).length).toBeGreaterThan(0);
    expect((UNIFIED_SEARCH_SMOKE_BOOTSTRAP.spaces as unknown[]).length).toBeGreaterThan(0);
    expect((UNIFIED_SEARCH_SMOKE_BOOTSTRAP.collections as unknown[]).length).toBeGreaterThan(0);
    expect((UNIFIED_SEARCH_SMOKE_BOOTSTRAP.files as unknown[]).length).toBeGreaterThan(0);
    expect((UNIFIED_SEARCH_SMOKE_BOOTSTRAP.tasks as unknown[]).length).toBeGreaterThan(0);
  });

  it("has an operator-filtered thread hit for smoke query assertions", () => {
    const parsed = parseUnifiedSearchQuery(UNIFIED_SEARCH_SMOKE_QUERY);
    const notes = UNIFIED_SEARCH_SMOKE_BOOTSTRAP.notes ?? {};
    const threads = decodeUnifiedSearchThreadsStorage(
      UNIFIED_SEARCH_SMOKE_BOOTSTRAP.threads ?? []
    );

    const prepared = threads.map((thread) => {
      const tags = thread.tags ?? [];
      const tagsText = tags.join(" ");
      const citationsText = (thread.citations ?? [])
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const noteTrimmed = (notes[thread.id] ?? "").trim();
      return {
        thread,
        combinedLower: [
          thread.title ?? thread.question,
          thread.question,
          thread.answer,
          tagsText,
          thread.spaceName ?? "",
          citationsText,
          noteTrimmed,
        ]
          .filter(Boolean)
          .join("\n")
          .toLowerCase(),
        spaceNameLower: (thread.spaceName ?? "").toLowerCase(),
        spaceIdLower: (thread.spaceId ?? "").toLowerCase(),
        tagSetLower: new Set(tags.map((tag) => tag.toLowerCase())),
        noteTrimmed,
        hasCitation: Boolean(thread.citations?.length),
      };
    });

    const filtered = filterThreadEntries(prepared, {
      query: parsed.query,
      operators: parsed.operators,
      timelineWindow: "all",
      nowMs: Date.parse("2026-02-11T12:00:00.000Z"),
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.thread.title).toBe("Smoke Incident Thread");
  });
});
