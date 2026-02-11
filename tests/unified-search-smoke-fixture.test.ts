import { describe, expect, it } from "vitest";
import {
  decodeUnifiedSearchThreadsStorage,
  filterThreadEntries,
  parseUnifiedSearchQuery,
} from "@/lib/unified-search";
import {
  UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDE_BOOTSTRAP,
  UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDE_QUERY,
  UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDED_TITLE,
  UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDE_BOOTSTRAP,
  UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDE_QUERY,
  UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDED_TITLE,
  UNIFIED_SEARCH_SMOKE_BOOTSTRAP,
  UNIFIED_SEARCH_SMOKE_QUERY,
  UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP,
  UNIFIED_SEARCH_SMOKE_ROUNDTRIP_QUERY,
  UNIFIED_SEARCH_SMOKE_ROUNDTRIP_SAVED_ID,
  UNIFIED_SEARCH_SMOKE_STALE_SELECTION_BOOTSTRAP,
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

  it("defines a saved-search roundtrip fixture with persisted non-default controls", () => {
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.activeSavedSearchId).toBe(
      UNIFIED_SEARCH_SMOKE_ROUNDTRIP_SAVED_ID
    );
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.query).toContain(
      "placeholder query"
    );
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.filter).toBe("all");
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.sortBy).toBe("relevance");
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.timelineWindow).toBe("all");
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.resultLimit).toBe(50);
    expect(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.verbatim).toBe(false);

    const savedSearches = Array.isArray(
      UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.savedSearches
    )
      ? UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP.savedSearches
      : [];
    const roundtripSaved = savedSearches.find(
      (saved) =>
        typeof saved === "object" &&
        saved !== null &&
        "id" in saved &&
        (saved as { id?: unknown }).id === UNIFIED_SEARCH_SMOKE_ROUNDTRIP_SAVED_ID
    ) as
      | {
          query?: unknown;
          filter?: unknown;
          sortBy?: unknown;
          timelineWindow?: unknown;
          resultLimit?: unknown;
          verbatim?: unknown;
        }
      | undefined;

    expect(roundtripSaved).toBeDefined();
    expect(roundtripSaved?.query).toBe(UNIFIED_SEARCH_SMOKE_ROUNDTRIP_QUERY);
    expect(roundtripSaved?.filter).toBe("tasks");
    expect(roundtripSaved?.sortBy).toBe("oldest");
    expect(roundtripSaved?.timelineWindow).toBe("7d");
    expect(roundtripSaved?.resultLimit).toBe(10);
    expect(roundtripSaved?.verbatim).toBe(true);
  });

  it("defines stale-selection diagnostics fixture state for smoke assertions", () => {
    expect(UNIFIED_SEARCH_SMOKE_STALE_SELECTION_BOOTSTRAP.debugMode).toBe(true);
    expect(UNIFIED_SEARCH_SMOKE_STALE_SELECTION_BOOTSTRAP.filter).toBe("threads");
    expect(UNIFIED_SEARCH_SMOKE_STALE_SELECTION_BOOTSTRAP.selectedThreadIds).toEqual([
      "smoke-thread-match",
      "smoke-thread-missing",
    ]);
  });

  it("defines archive-operator fixtures for both include and exclude semantics", () => {
    const includeParsed = parseUnifiedSearchQuery(
      UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDE_QUERY
    );
    const includeNotes = UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDE_BOOTSTRAP.notes ?? {};
    const includeThreads = decodeUnifiedSearchThreadsStorage(
      UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDE_BOOTSTRAP.threads ?? []
    );
    const includePrepared = includeThreads.map((thread) => {
      const tags = thread.tags ?? [];
      const tagsText = tags.join(" ");
      const citationsText = (thread.citations ?? [])
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const noteTrimmed = (includeNotes[thread.id] ?? "").trim();
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
    const includeFiltered = filterThreadEntries(includePrepared, {
      query: includeParsed.query,
      operators: includeParsed.operators,
      timelineWindow: "all",
      nowMs: Date.parse("2026-02-11T12:00:00.000Z"),
    }).map((entry) => entry.thread.title);
    expect(includeFiltered).toContain(UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDED_TITLE);
    expect(includeFiltered).not.toContain(UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDED_TITLE);

    const excludeParsed = parseUnifiedSearchQuery(
      UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDE_QUERY
    );
    const excludeNotes = UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDE_BOOTSTRAP.notes ?? {};
    const excludeThreads = decodeUnifiedSearchThreadsStorage(
      UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDE_BOOTSTRAP.threads ?? []
    );
    const excludePrepared = excludeThreads.map((thread) => {
      const tags = thread.tags ?? [];
      const tagsText = tags.join(" ");
      const citationsText = (thread.citations ?? [])
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const noteTrimmed = (excludeNotes[thread.id] ?? "").trim();
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
    const excludeFiltered = filterThreadEntries(excludePrepared, {
      query: excludeParsed.query,
      operators: excludeParsed.operators,
      timelineWindow: "all",
      nowMs: Date.parse("2026-02-11T12:00:00.000Z"),
    }).map((entry) => entry.thread.title);
    expect(excludeFiltered).toContain(UNIFIED_SEARCH_SMOKE_ARCHIVE_EXCLUDED_TITLE);
    expect(excludeFiltered).not.toContain(UNIFIED_SEARCH_SMOKE_ARCHIVE_INCLUDED_TITLE);
  });
});
