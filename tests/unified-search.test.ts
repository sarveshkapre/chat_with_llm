import { describe, expect, it } from "vitest";
import {
  applyBulkThreadUpdate,
  applyTimelineWindow,
  computeRelevanceScore,
  computeThreadMatchBadges,
  matchesQuery,
  normalizeQuery,
  parseUnifiedSearchQuery,
  pruneSelectedIds,
  resolveActiveSelectedIds,
  resolveThreadSpaceMeta,
  toggleVisibleSelection,
} from "@/lib/unified-search";

describe("applyTimelineWindow", () => {
  const now = Date.parse("2026-02-08T12:00:00.000Z");

  it("keeps all records when all-time window is selected", () => {
    expect(
      applyTimelineWindow("2025-01-01T00:00:00.000Z", "all", now)
    ).toBe(true);
  });

  it("filters records outside the selected window", () => {
    expect(
      applyTimelineWindow("2026-02-08T01:00:00.000Z", "24h", now)
    ).toBe(true);
    expect(
      applyTimelineWindow("2026-01-01T00:00:00.000Z", "7d", now)
    ).toBe(false);
  });

  it("rejects invalid timestamps for bounded windows", () => {
    expect(applyTimelineWindow("", "30d", now)).toBe(false);
  });
});

describe("applyBulkThreadUpdate", () => {
  it("updates only selected thread ids", () => {
    const input = [
      { id: "t1", pinned: false },
      { id: "t2", pinned: false },
    ];
    const updated = applyBulkThreadUpdate(input, ["t2"], (thread) => ({
      ...thread,
      pinned: true,
    }));
    expect(updated[0].pinned).toBe(false);
    expect(updated[1].pinned).toBe(true);
  });
});

describe("resolveThreadSpaceMeta", () => {
  const spaces = [
    { id: "space-1", name: "Research" },
    { id: "space-2", name: "Planning" },
  ];

  it("resolves known space ids", () => {
    expect(resolveThreadSpaceMeta("space-1", spaces)).toEqual({
      spaceId: "space-1",
      spaceName: "Research",
    });
  });

  it("returns null metadata when clearing assignment", () => {
    expect(resolveThreadSpaceMeta("", spaces)).toEqual({
      spaceId: null,
      spaceName: null,
    });
  });
});

describe("pruneSelectedIds", () => {
  it("drops ids that are no longer present", () => {
    const valid = new Set(["t1", "t3"]);
    expect(pruneSelectedIds(["t1", "t2", "t3"], valid)).toEqual(["t1", "t3"]);
  });

  it("returns the same array reference when no changes are needed", () => {
    const input = ["t1"];
    const valid = new Set(["t1", "t2"]);
    expect(pruneSelectedIds(input, valid)).toBe(input);
  });
});

describe("toggleVisibleSelection", () => {
  it("adds visible ids when enabling, preserving existing order", () => {
    expect(toggleVisibleSelection(["t1"], ["t2", "t3"], true)).toEqual([
      "t1",
      "t2",
      "t3",
    ]);
  });

  it("removes only visible ids when disabling", () => {
    expect(toggleVisibleSelection(["t1", "t2", "t3"], ["t2"], false)).toEqual([
      "t1",
      "t3",
    ]);
  });

  it("keeps selection intact when no visible ids exist", () => {
    const input = ["t1"];
    expect(toggleVisibleSelection(input, [], true)).toBe(input);
  });
});

describe("resolveActiveSelectedIds", () => {
  it("returns active ids in the original order and counts missing selections", () => {
    const items = [{ id: "t1" }, { id: "t3" }];
    expect(resolveActiveSelectedIds(["t3", "t2", "t1"], items)).toEqual({
      activeIds: ["t3", "t1"],
      missingCount: 1,
    });
  });
});

describe("normalizeQuery", () => {
  it("normalizes whitespace, lowercases, and de-dupes tokens", () => {
    expect(normalizeQuery("  Hello   WORLD  world ")).toEqual({
      normalized: "hello world world",
      tokens: ["hello", "world"],
    });
  });

  it("returns empty fields for empty input", () => {
    expect(normalizeQuery("   ")).toEqual({ normalized: "", tokens: [] });
  });
});

describe("matchesQuery", () => {
  it("matches phrase queries across combined fields", () => {
    const query = normalizeQuery("foo bar");
    expect(matchesQuery(["start foo bar end"], query)).toBe(true);
  });

  it("matches multi-word queries when all tokens exist across fields", () => {
    const query = normalizeQuery("foo bar");
    expect(matchesQuery(["has foo", "and bar"], query)).toBe(true);
  });

  it("rejects multi-word queries when a token is missing", () => {
    const query = normalizeQuery("foo bar");
    expect(matchesQuery(["only foo"], query)).toBe(false);
  });

  it("matches single token queries as substring match", () => {
    const query = normalizeQuery("needle");
    expect(matchesQuery(["haystack needle haystack"], query)).toBe(true);
  });
});

describe("computeRelevanceScore", () => {
  it("weights title-like fields higher than body fields for the same match", () => {
    const query = normalizeQuery("alpha");
    const titleScore = computeRelevanceScore([{ text: "alpha", weight: 6 }], query);
    const bodyScore = computeRelevanceScore([{ text: "alpha", weight: 1 }], query);
    expect(titleScore).toBeGreaterThan(bodyScore);
  });

  it("rewards exact and prefix matches over plain includes", () => {
    const query = normalizeQuery("alpha");
    const exact = computeRelevanceScore([{ text: "alpha", weight: 1 }], query);
    const prefix = computeRelevanceScore([{ text: "alpha beta", weight: 1 }], query);
    const includes = computeRelevanceScore([{ text: "beta alpha gamma", weight: 1 }], query);
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(includes);
  });
});

describe("computeThreadMatchBadges", () => {
  it("returns badges for fields that contain the query (phrase or token hits)", () => {
    const query = normalizeQuery("deep work");
    const badges = computeThreadMatchBadges(
      {
        title: "Deep work notes",
        question: "ignored",
        answer: "This is about focused sessions.",
        tags: ["alpha", "work"],
        spaceName: "Personal",
        note: "Remember Deep Work chapter 2",
        citationsText: "Deep Work https://example.com",
      },
      query
    );
    expect(badges).toEqual(["title", "tag", "note", "citation"]);
  });

  it("falls back to question badge when there is no title", () => {
    const query = normalizeQuery("roadmap");
    const badges = computeThreadMatchBadges(
      {
        title: null,
        question: "Product roadmap review",
        answer: "",
        tags: [],
      },
      query
    );
    expect(badges).toEqual(["question"]);
  });

  it("returns an empty list for an empty query", () => {
    const badges = computeThreadMatchBadges(
      { title: "Hello", question: "Hello", answer: "Hello" },
      normalizeQuery("")
    );
    expect(badges).toEqual([]);
  });
});

describe("parseUnifiedSearchQuery", () => {
  it("strips known operators and normalizes the remaining text query", () => {
    const parsed = parseUnifiedSearchQuery(
      'type:threads space:"Deep Work" tag:alpha has:note foo bar'
    );
    expect(parsed.text).toBe("foo bar");
    expect(parsed.query).toEqual(normalizeQuery("foo bar"));
    expect(parsed.operators.type).toBe("threads");
    expect(parsed.operators.space).toBe("Deep Work");
    expect(parsed.operators.tags).toEqual(["alpha"]);
    expect(parsed.operators.hasNote).toBe(true);
  });

  it("supports quoted tag values containing whitespace", () => {
    const parsed = parseUnifiedSearchQuery('tag:"deep work" tag:alpha');
    expect(parsed.text).toBe("");
    expect(parsed.operators.tags).toEqual(["deep work", "alpha"]);
  });

  it("keeps unknown operators as part of the free-text query", () => {
    const parsed = parseUnifiedSearchQuery("unknown:thing hello");
    expect(parsed.text).toBe("unknown:thing hello");
    expect(parsed.operators).toEqual({});
  });

  it("supports type and has aliases", () => {
    const parsed = parseUnifiedSearchQuery("in:space has:sources roadmap");
    expect(parsed.operators.type).toBe("spaces");
    expect(parsed.operators.hasCitation).toBe(true);
    expect(parsed.text).toBe("roadmap");
  });

  it("supports negative tag and has operators", () => {
    const parsed = parseUnifiedSearchQuery("-tag:foo -has:note hello");
    expect(parsed.text).toBe("hello");
    expect(parsed.operators.notTags).toEqual(["foo"]);
    expect(parsed.operators.notHasNote).toBe(true);
  });

  it("supports spaceId exact match operator", () => {
    const parsed = parseUnifiedSearchQuery("spaceId:space-123 roadmap");
    expect(parsed.text).toBe("roadmap");
    expect(parsed.operators.spaceId).toBe("space-123");
  });

  it("falls back gracefully on unbalanced quotes", () => {
    const parsed = parseUnifiedSearchQuery('space:"Deep Work tag:alpha roadmap');
    // Unbalanced quotes: still parse later operators instead of swallowing them.
    expect(parsed.operators.tags).toEqual(["alpha"]);
    expect(parsed.text).toContain("roadmap");
  });

  it("supports escaped quotes inside quoted values", () => {
    const parsed = parseUnifiedSearchQuery("tag:\"deep \\\"work\\\"\"");
    expect(parsed.operators.tags).toEqual(['deep "work"']);
  });
});
