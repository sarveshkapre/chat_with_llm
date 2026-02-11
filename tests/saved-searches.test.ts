import { describe, expect, it } from "vitest";
import {
  decodeSavedSearchStorage,
  defaultSavedSearchName,
  deleteSavedSearch,
  encodeSavedSearchStorage,
  findDuplicateSavedSearch,
  fingerprintSavedSearch,
  renameSavedSearch,
  SAVED_SEARCH_STORAGE_VERSION,
  sortSavedSearches,
  togglePinSavedSearch,
  upsertSavedSearch,
  type UnifiedSavedSearch,
} from "@/lib/saved-searches";

function makeSaved(overrides: Partial<UnifiedSavedSearch>): UnifiedSavedSearch {
  return {
    id: overrides.id ?? "id",
    name: overrides.name ?? "Name",
    query: overrides.query ?? "foo",
    filter: overrides.filter ?? "all",
    sortBy: overrides.sortBy ?? "relevance",
    timelineWindow: overrides.timelineWindow ?? "all",
    resultLimit: overrides.resultLimit ?? 20,
    verbatim: overrides.verbatim ?? false,
    pinned: overrides.pinned ?? false,
    createdAt: overrides.createdAt ?? "2026-02-10T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-02-10T00:00:00.000Z",
  };
}

describe("fingerprintSavedSearch", () => {
  it("is stable for equivalent specs (trimmed query)", () => {
    expect(
      fingerprintSavedSearch({
        query: "  hello ",
        filter: "threads",
        sortBy: "newest",
        timelineWindow: "7d",
        resultLimit: 50,
        verbatim: false,
      })
    ).toBe(
      fingerprintSavedSearch({
        query: "hello",
        filter: "threads",
        sortBy: "newest",
        timelineWindow: "7d",
        resultLimit: 50,
        verbatim: false,
      })
    );
  });
});

describe("findDuplicateSavedSearch", () => {
  it("finds a matching preset by spec", () => {
    const searches = [
      makeSaved({ id: "a", query: "one", filter: "threads" }),
      makeSaved({ id: "b", query: "two", filter: "spaces" }),
    ];
    expect(
      findDuplicateSavedSearch(searches, {
        query: "two",
        filter: "spaces",
        sortBy: "relevance",
        timelineWindow: "all",
        resultLimit: 20,
        verbatim: false,
      })?.id
    ).toBe("b");
  });
});

describe("sortSavedSearches", () => {
  it("sorts pinned first and then by updatedAt desc", () => {
    const searches = [
      makeSaved({ id: "a", pinned: false, updatedAt: "2026-02-10T00:00:00Z" }),
      makeSaved({ id: "b", pinned: true, updatedAt: "2026-02-09T00:00:00Z" }),
      makeSaved({ id: "c", pinned: true, updatedAt: "2026-02-11T00:00:00Z" }),
    ];
    expect(sortSavedSearches(searches).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });
});

describe("upsertSavedSearch", () => {
  it("adds when the id is new and updates in-place when existing", () => {
    const base = [makeSaved({ id: "a", name: "A" })];
    const added = upsertSavedSearch(base, makeSaved({ id: "b", name: "B" }));
    expect(added.map((s) => s.id)).toEqual(["b", "a"]);
    const updated = upsertSavedSearch(added, makeSaved({ id: "a", name: "A2" }));
    expect(updated.find((s) => s.id === "a")?.name).toBe("A2");
  });
});

describe("renameSavedSearch", () => {
  it("normalizes whitespace and bumps updatedAt", () => {
    const before = [makeSaved({ id: "a", name: "Old", updatedAt: "t0" })];
    const after = renameSavedSearch(before, "a", "  New   Name  ", "t1");
    expect(after[0].name).toBe("New Name");
    expect(after[0].updatedAt).toBe("t1");
  });
});

describe("togglePinSavedSearch", () => {
  it("toggles pinned and bumps updatedAt", () => {
    const before = [makeSaved({ id: "a", pinned: false, updatedAt: "t0" })];
    const after = togglePinSavedSearch(before, "a", "t1");
    expect(after[0].pinned).toBe(true);
    expect(after[0].updatedAt).toBe("t1");
  });
});

describe("deleteSavedSearch", () => {
  it("removes a saved search by id", () => {
    const before = [makeSaved({ id: "a" }), makeSaved({ id: "b" })];
    const after = deleteSavedSearch(before, "a");
    expect(after.map((s) => s.id)).toEqual(["b"]);
  });
});

describe("defaultSavedSearchName", () => {
  it("uses query when present and otherwise uses a compact spec summary", () => {
    expect(
      defaultSavedSearchName({
        query: "hello world",
        filter: "all",
        sortBy: "relevance",
        timelineWindow: "all",
        resultLimit: 20,
        verbatim: false,
      })
    ).toBe("hello world");
    expect(
      defaultSavedSearchName({
        query: "",
        filter: "threads",
        sortBy: "newest",
        timelineWindow: "7d",
        resultLimit: 20,
        verbatim: true,
      })
    ).toBe("threads · 7d · newest · verbatim");
  });
});

describe("decodeSavedSearchStorage", () => {
  it("migrates legacy array payloads and normalizes invalid fields", () => {
    const decoded = decodeSavedSearchStorage([
      {
        id: "a",
        name: "  Weekly   review  ",
        query: "  roadmap ",
        filter: "unknown",
        sortBy: "newest",
        timelineWindow: "bad-window",
        resultLimit: 999,
        verbatim: 1,
        pinned: "yes",
        createdAt: "invalid-date",
        updatedAt: "2026-02-10T01:00:00.000Z",
      },
    ]);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toMatchObject({
      id: "a",
      name: "Weekly review",
      query: "roadmap",
      filter: "all",
      sortBy: "newest",
      timelineWindow: "all",
      resultLimit: 20,
      verbatim: true,
      pinned: true,
      updatedAt: "2026-02-10T01:00:00.000Z",
    });
  });

  it("accepts versioned envelope payloads and drops malformed/duplicate rows", () => {
    const decoded = decodeSavedSearchStorage({
      version: SAVED_SEARCH_STORAGE_VERSION,
      searches: [
        makeSaved({ id: "a", name: "A" }),
        { id: "", name: "bad" },
        makeSaved({ id: "a", name: "duplicate-id" }),
      ],
    });
    expect(decoded.map((item) => item.id)).toEqual(["a"]);
    expect(decoded[0].name).toBe("A");
  });

  it("returns empty list for unknown envelope versions", () => {
    const decoded = decodeSavedSearchStorage({
      version: 999,
      searches: [makeSaved({ id: "a" })],
    });
    expect(decoded).toEqual([]);
  });
});

describe("encodeSavedSearchStorage", () => {
  it("wraps searches with schema version", () => {
    const encoded = encodeSavedSearchStorage([makeSaved({ id: "a" })]);
    expect(encoded.version).toBe(SAVED_SEARCH_STORAGE_VERSION);
    expect(encoded.searches).toHaveLength(1);
    expect(encoded.searches[0].id).toBe("a");
  });
});
