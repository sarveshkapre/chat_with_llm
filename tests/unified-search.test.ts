import { describe, expect, it } from "vitest";
import {
  applyBulkThreadUpdate,
  applyTimelineWindow,
  computeRelevanceScore,
  computeRelevanceScoreFromLowered,
  computeThreadMatchBadges,
  filterCollectionEntries,
  filterFileEntries,
  filterSpaceEntries,
  filterTaskEntries,
  filterThreadEntries,
  matchesLoweredText,
  matchesQuery,
  normalizeQuery,
  parseUnifiedSearchQuery,
  pruneSelectedIds,
  resolveActiveSelectedIds,
  resolveThreadSpaceMeta,
  sortSearchResults,
  topKSearchResults,
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

  it("treats token-less queries as phrase-only matches", () => {
    const verbatimQuery = { normalized: "foo bar", tokens: [] };
    expect(matchesQuery(["foo bar"], verbatimQuery)).toBe(true);
    expect(matchesQuery(["foo", "bar"], verbatimQuery)).toBe(false);
    expect(matchesQuery(["something else"], verbatimQuery)).toBe(false);
  });
});

describe("matchesLoweredText", () => {
  it("matches phrase queries against pre-lowered combined text", () => {
    const query = normalizeQuery("Foo Bar");
    expect(matchesLoweredText("start foo bar end", query)).toBe(true);
  });

  it("matches multi-word queries when all tokens exist", () => {
    const query = normalizeQuery("foo bar");
    expect(matchesLoweredText("has foo and bar", query)).toBe(true);
  });

  it("treats token-less queries as phrase-only matches", () => {
    const verbatimQuery = { normalized: "foo bar", tokens: [] };
    expect(matchesLoweredText("foo bar", verbatimQuery)).toBe(true);
    expect(matchesLoweredText("foo\nbar", verbatimQuery)).toBe(false);
  });

  it("matchesQuery and matchesLoweredText agree for equivalent inputs", () => {
    const query = normalizeQuery("Deep Work");
    const parts = ["Deep", "work session"];
    const lowered = parts.join("\n").toLowerCase();
    expect(matchesQuery(parts, query)).toBe(matchesLoweredText(lowered, query));
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

  it("matches the lowered-field scorer for equivalent inputs", () => {
    const query = normalizeQuery("alpha");
    const textFields = [
      { text: "Alpha", weight: 8 },
      { text: "beta alpha gamma", weight: 2 },
    ];
    const loweredFields = textFields.map((field) => ({
      loweredText: field.text.toLowerCase(),
      weight: field.weight,
    }));
    expect(computeRelevanceScore(textFields, query)).toBe(
      computeRelevanceScoreFromLowered(loweredFields, query)
    );
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

  it("supports is and -is thread-state operators", () => {
    const parsed = parseUnifiedSearchQuery("is:pinned -is:archived roadmap");
    expect(parsed.text).toBe("roadmap");
    expect(parsed.operators.states).toEqual(["pinned"]);
    expect(parsed.operators.notStates).toEqual(["archived"]);
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

  it("supports verbatim/exact operators for phrase-only matching", () => {
    const parsed = parseUnifiedSearchQuery("verbatim:true roadmap");
    expect(parsed.text).toBe("roadmap");
    expect(parsed.operators.verbatim).toBe(true);

    const negated = parseUnifiedSearchQuery("-exact:on roadmap");
    expect(negated.text).toBe("roadmap");
    expect(negated.operators.verbatim).toBe(false);
  });
});

describe("filterThreadEntries", () => {
  const now = Date.parse("2026-02-08T12:00:00.000Z");

  function makeEntry(overrides?: Partial<Parameters<typeof filterThreadEntries>[0][number]>) {
    return {
      thread: { createdAt: "2026-02-08T01:00:00.000Z" },
      combinedLower: "hello world",
      spaceNameLower: "research",
      spaceIdLower: "space-1",
      tagSetLower: new Set(["alpha", "beta"]),
      noteTrimmed: "",
      hasCitation: false,
      ...overrides,
    };
  }

  it("filters by timeline window", () => {
    const entries = [
      makeEntry({ thread: { createdAt: "2026-02-01T00:00:00.000Z" } }),
      makeEntry({ thread: { createdAt: "2026-02-08T10:00:00.000Z" } }),
    ];
    const filtered = filterThreadEntries(entries, {
      query: normalizeQuery(""),
      operators: {},
      timelineWindow: "24h",
      nowMs: now,
    });
    expect(filtered).toHaveLength(1);
  });

  it("treats space: as name-contains OR exact space id match", () => {
    const entries = [
      makeEntry({ spaceNameLower: "deep research", spaceIdLower: "space-1" }),
      makeEntry({ spaceNameLower: "planning", spaceIdLower: "deep-research" }),
    ];

    const byName = filterThreadEntries(entries, {
      query: normalizeQuery(""),
      operators: { space: "research" },
      timelineWindow: "all",
      nowMs: now,
    });
    expect(byName).toHaveLength(1);

    const byId = filterThreadEntries(entries, {
      query: normalizeQuery(""),
      operators: { space: "deep-research" },
      timelineWindow: "all",
      nowMs: now,
    });
    expect(byId).toHaveLength(1);
  });

  it("supports tag and -tag operators", () => {
    const entries = [makeEntry({ tagSetLower: new Set(["alpha"]) })];
    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { tags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { notTags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);
  });

  it("supports has:note / -has:note and has:citation / -has:citation", () => {
    const entries = [
      makeEntry({ noteTrimmed: "", hasCitation: false }),
      makeEntry({ noteTrimmed: "note", hasCitation: true }),
    ];

    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { hasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { notHasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { hasCitation: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { notHasCitation: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
  });

  it("supports is:* / -is:* thread-state operators", () => {
    const entries = [
      makeEntry({
        thread: {
          createdAt: "2026-02-08T01:00:00.000Z",
          pinned: true,
          favorite: true,
          archived: false,
        },
      }),
      makeEntry({
        thread: {
          createdAt: "2026-02-08T01:00:00.000Z",
          pinned: false,
          favorite: true,
          archived: true,
        },
      }),
    ];

    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { states: ["favorite", "pinned"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);

    expect(
      filterThreadEntries(entries, {
        query: normalizeQuery(""),
        operators: { notStates: ["archived"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
  });
});

describe("filterSpaceEntries", () => {
  const now = Date.parse("2026-02-08T12:00:00.000Z");

  it("supports tag and space operators but rejects has:* and is:* filters", () => {
    const entries = [
      {
        space: { id: "space-1", createdAt: "2026-02-08T01:00:00.000Z" },
        combinedLower: "deep work\nalpha",
        spaceNameLower: "deep work",
        spaceIdLower: "space-1",
        tagSetLower: new Set(["alpha"]),
      },
      {
        space: { id: "space-2", createdAt: "2026-02-08T01:00:00.000Z" },
        combinedLower: "planning",
        spaceNameLower: "planning",
        spaceIdLower: "space-2",
        tagSetLower: new Set(["ops"]),
      },
    ];

    expect(
      filterSpaceEntries(entries, {
        query: normalizeQuery(""),
        operators: { space: "deep" },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);

    expect(
      filterSpaceEntries(entries, {
        query: normalizeQuery(""),
        operators: { spaceId: "space-2" },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);

    expect(
      filterSpaceEntries(entries, {
        query: normalizeQuery("deep"),
        operators: { tags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);

    expect(
      filterSpaceEntries(entries, {
        query: normalizeQuery("deep"),
        operators: { hasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterSpaceEntries(entries, {
        query: normalizeQuery("deep"),
        operators: { notHasCitation: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterSpaceEntries(entries, {
        query: normalizeQuery("deep"),
        operators: { states: ["pinned"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);
  });
});

describe("filterCollectionEntries", () => {
  const now = Date.parse("2026-02-08T12:00:00.000Z");

  it("rejects collection results when thread/space-only operators are used", () => {
    const entries = [
      {
        collection: { createdAt: "2026-02-08T01:00:00.000Z" },
        combinedLower: "weekly notes",
      },
    ];

    expect(
      filterCollectionEntries(entries, {
        query: normalizeQuery("weekly"),
        operators: {},
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);

    expect(
      filterCollectionEntries(entries, {
        query: normalizeQuery(""),
        operators: { hasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterCollectionEntries(entries, {
        query: normalizeQuery(""),
        operators: { notTags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterCollectionEntries(entries, {
        query: normalizeQuery(""),
        operators: { space: "research" },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterCollectionEntries(entries, {
        query: normalizeQuery(""),
        operators: { notStates: ["archived"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);
  });
});

describe("filterFileEntries", () => {
  const now = Date.parse("2026-02-08T12:00:00.000Z");

  it("rejects file results when thread/space-only operators are used", () => {
    const entries = [
      {
        file: { addedAt: "2026-02-08T01:00:00.000Z" },
        combinedLower: "runbook incident response",
      },
    ];

    expect(
      filterFileEntries(entries, {
        query: normalizeQuery("incident"),
        operators: {},
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);

    expect(
      filterFileEntries(entries, {
        query: normalizeQuery(""),
        operators: { notHasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterFileEntries(entries, {
        query: normalizeQuery(""),
        operators: { tags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterFileEntries(entries, {
        query: normalizeQuery(""),
        operators: { spaceId: "space-1" },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterFileEntries(entries, {
        query: normalizeQuery(""),
        operators: { states: ["favorite"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);
  });
});

describe("filterTaskEntries", () => {
  const now = Date.parse("2026-02-08T12:00:00.000Z");

  it("rejects tag/has/is operators and supports space filters", () => {
    const entries = [
      {
        task: { createdAt: "2026-02-08T01:00:00.000Z" },
        combinedLower: "weekly review",
        spaceNameLower: "research",
        spaceIdLower: "space-1",
      },
    ];

    expect(
      filterTaskEntries(entries, {
        query: normalizeQuery(""),
        operators: { tags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterTaskEntries(entries, {
        query: normalizeQuery(""),
        operators: { notTags: ["alpha"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterTaskEntries(entries, {
        query: normalizeQuery(""),
        operators: { notHasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterTaskEntries(entries, {
        query: normalizeQuery(""),
        operators: { states: ["pinned"] },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);

    expect(
      filterTaskEntries(entries, {
        query: normalizeQuery(""),
        operators: { space: "research" },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(1);
  });
});

describe("sortSearchResults", () => {
  it("falls back to newest when sorting by relevance with an empty query", () => {
    const items = [
      { id: "a", createdMs: 1 },
      { id: "b", createdMs: 10 },
    ];
    const sorted = sortSearchResults(items, "relevance", normalizeQuery(""), () => 0);
    expect(sorted.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("sorts by score then by newest when sorting by relevance with a query", () => {
    const items = [
      { id: "a", createdMs: 5 },
      { id: "b", createdMs: 10 },
      { id: "c", createdMs: 7 },
    ];
    const query = normalizeQuery("needle");
    const scoreOf = (item: { id: string }) => (item.id === "a" ? 2 : item.id === "b" ? 2 : 1);
    const sorted = sortSearchResults(items, "relevance", query, scoreOf);
    expect(sorted.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });
});

describe("topKSearchResults", () => {
  it("returns empty list when limit is zero", () => {
    const items = [{ id: "a", createdMs: 1 }];
    expect(topKSearchResults(items, "newest", normalizeQuery(""), 0, () => 0)).toEqual([]);
  });

  it("matches full sort slice for newest/oldest", () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      id: `t-${index}`,
      createdMs: index % 2 === 0 ? index * 3 : index * 7,
    }));
    const limit = 7;

    const newestTop = topKSearchResults(items, "newest", normalizeQuery(""), limit, () => 0);
    const newestFull = sortSearchResults(items, "newest", normalizeQuery(""), () => 0).slice(
      0,
      limit
    );
    expect(newestTop.map((item) => item.id)).toEqual(newestFull.map((item) => item.id));

    const oldestTop = topKSearchResults(items, "oldest", normalizeQuery(""), limit, () => 0);
    const oldestFull = sortSearchResults(items, "oldest", normalizeQuery(""), () => 0).slice(
      0,
      limit
    );
    expect(oldestTop.map((item) => item.id)).toEqual(oldestFull.map((item) => item.id));
  });

  it("matches full sort slice for relevance (including newest tie-break)", () => {
    const items = [
      { id: "a", createdMs: 5 },
      { id: "b", createdMs: 10 },
      { id: "c", createdMs: 7 },
      { id: "d", createdMs: 12 },
      { id: "e", createdMs: 11 },
    ];
    const query = normalizeQuery("needle");
    const scoreOf = (item: { id: string }) => {
      if (item.id === "a") return 2;
      if (item.id === "b") return 2;
      if (item.id === "c") return 1;
      if (item.id === "d") return 3;
      return 3;
    };
    const limit = 3;
    const top = topKSearchResults(items, "relevance", query, limit, scoreOf);
    const full = sortSearchResults(items, "relevance", query, scoreOf).slice(0, limit);
    expect(top.map((item) => item.id)).toEqual(full.map((item) => item.id));
  });

  it("falls back to newest when sorting by relevance with an empty query", () => {
    const items = [
      { id: "a", createdMs: 1 },
      { id: "b", createdMs: 10 },
      { id: "c", createdMs: 7 },
    ];
    const limit = 2;
    const top = topKSearchResults(items, "relevance", normalizeQuery(""), limit, () => 0);
    expect(top.map((item) => item.id)).toEqual(["b", "c"]);
  });
});
