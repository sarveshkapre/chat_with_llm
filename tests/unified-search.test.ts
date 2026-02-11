import { describe, expect, it } from "vitest";
import {
  applyOperatorAutocomplete,
  applyBulkThreadUpdate,
  applyTimelineWindow,
  buildUnifiedSearchUrlParams,
  buildUnifiedSearchDiagnosticsRows,
  buildUnifiedSearchCsvExport,
  buildUnifiedSearchMarkdownExport,
  buildUnifiedSearchOperatorSummary,
  buildUnifiedSearchSavedSearchesMarkdownExport,
  escapeCsvCell,
  formatTimestampForDisplay,
  formatTimestampForExport,
  formatUtcOffset,
  getExportEnvironmentMeta,
  computeRelevanceScore,
  computeRelevanceScoreFromLowered,
  computeThreadMatchBadges,
  decodeUnifiedSearchRecentQueriesStorage,
  decodeUnifiedSearchCollectionsStorage,
  decodeUnifiedSearchFilesStorage,
  decodeUnifiedSearchNotesStorage,
  decodeUnifiedSearchSpaceTagsStorage,
  decodeUnifiedSearchSpacesStorage,
  decodeUnifiedSearchTasksStorage,
  decodeUnifiedSearchThreadsStorage,
  filterCollectionEntries,
  filterFileEntries,
  filterSpaceEntries,
  filterTaskEntries,
  filterThreadEntries,
  getOperatorAutocomplete,
  matchesLoweredText,
  matchesQuery,
  normalizeUnifiedSearchRecentQuery,
  normalizeQuery,
  parseUnifiedSearchUrlState,
  parseUnifiedSearchQuery,
  parseTimestampMs,
  pruneSelectedIds,
  resolveActiveSelectedIds,
  resolveThreadSpaceMeta,
  stripUnifiedSearchOperators,
  sortSearchResults,
  stepCircularIndex,
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

  it("uses absolute elapsed time across DST offset boundaries", () => {
    const nowAcrossDst = Date.parse("2026-03-09T01:15:00-07:00");
    expect(
      applyTimelineWindow("2026-03-08T01:30:00-08:00", "24h", nowAcrossDst)
    ).toBe(true);
    expect(
      applyTimelineWindow("2026-03-08T00:00:00-08:00", "24h", nowAcrossDst)
    ).toBe(false);
    expect(applyTimelineWindow("not-a-date", "24h", nowAcrossDst)).toBe(false);
  });
});

describe("Unified Search preload storage decoders", () => {
  it("sanitizes malformed thread payloads and preserves valid entries", () => {
    const decoded = decodeUnifiedSearchThreadsStorage([
      null,
      { id: "" },
      {
        id: "thread-1",
        title: "Q1 notes",
        question: "What changed?",
        answer: "Shipped.",
        mode: "invalid-mode",
        sources: "invalid-source",
        createdAt: "2026-02-08T10:00:00.000Z",
        provider: "mock",
        latencyMs: 42,
        model: "gpt-4.1",
        citations: [
          { title: "Spec", url: "https://example.com/spec" },
          { title: "Missing URL" },
        ],
        attachments: [
          { id: "a1", name: "notes.txt", type: "text/plain", size: 10 },
          { id: "a2", name: "bad" },
        ],
        tags: ["ops", 1, "ship"],
        spaceId: "space-1",
        spaceName: "Ops",
        pinned: true,
        favorite: "yes",
        archived: false,
      },
      {
        id: "thread-2",
        question: 99,
        answer: null,
        createdAt: null,
      },
    ]);

    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toEqual({
      id: "thread-1",
      title: "Q1 notes",
      question: "What changed?",
      answer: "Shipped.",
      mode: "quick",
      sources: "none",
      model: "gpt-4.1",
      provider: "mock",
      latencyMs: 42,
      createdAt: "2026-02-08T10:00:00.000Z",
      citations: [{ title: "Spec", url: "https://example.com/spec" }],
      attachments: [
        { id: "a1", name: "notes.txt", type: "text/plain", size: 10, text: null, error: null },
      ],
      spaceId: "space-1",
      spaceName: "Ops",
      tags: ["ops", "ship"],
      pinned: true,
      favorite: undefined,
      archived: false,
    });
    expect(decoded[1]).toMatchObject({
      id: "thread-2",
      question: "",
      answer: "",
      mode: "quick",
      sources: "none",
      provider: "unknown",
      latencyMs: 0,
      citations: [],
      attachments: [],
      tags: [],
    });
    expect(decoded[1].createdAt).toBe(new Date(0).toISOString());
  });

  it("sanitizes malformed space payloads and prunes entries missing ids", () => {
    const decoded = decodeUnifiedSearchSpacesStorage([
      "bad",
      { id: "", name: "skip" },
      {
        id: "space-1",
        name: "Research",
        instructions: "Look up docs",
        preferredModel: "gpt-4.1",
        sourcePolicy: "invalid",
        createdAt: "2026-02-08T10:00:00.000Z",
      },
      { id: "space-2", name: 99, instructions: null, sourcePolicy: "web" },
    ]);

    expect(decoded).toEqual([
      {
        id: "space-1",
        name: "Research",
        instructions: "Look up docs",
        preferredModel: "gpt-4.1",
        sourcePolicy: undefined,
        createdAt: "2026-02-08T10:00:00.000Z",
      },
      {
        id: "space-2",
        name: "Untitled space",
        instructions: "",
        preferredModel: null,
        sourcePolicy: "web",
        createdAt: new Date(0).toISOString(),
      },
    ]);
  });

  it("sanitizes malformed task payloads and normalizes unsupported enums", () => {
    const decoded = decodeUnifiedSearchTasksStorage([
      { id: "" },
      {
        id: "task-1",
        name: "Weekly summary",
        prompt: "Summarize",
        cadence: "invalid",
        time: 99,
        mode: "invalid",
        sources: "invalid",
        createdAt: "2026-02-08T10:00:00.000Z",
        nextRun: "",
        dayOfWeek: "2",
        dayOfMonth: 10,
        monthOfYear: 6,
      },
      { id: "task-2", name: 42, prompt: null, cadence: "daily", sources: "web" },
    ]);

    expect(decoded).toEqual([
      {
        id: "task-1",
        name: "Weekly summary",
        prompt: "Summarize",
        cadence: "once",
        time: "09:00",
        mode: "quick",
        sources: "none",
        createdAt: "2026-02-08T10:00:00.000Z",
        nextRun: "2026-02-08T10:00:00.000Z",
        lastRun: null,
        lastThreadId: null,
        dayOfWeek: null,
        dayOfMonth: 10,
        monthOfYear: 6,
        spaceId: null,
        spaceName: null,
      },
      {
        id: "task-2",
        name: "Untitled task",
        prompt: "",
        cadence: "daily",
        time: "09:00",
        mode: "quick",
        sources: "web",
        createdAt: new Date(0).toISOString(),
        nextRun: new Date(0).toISOString(),
        lastRun: null,
        lastThreadId: null,
        dayOfWeek: null,
        dayOfMonth: null,
        monthOfYear: null,
        spaceId: null,
        spaceName: null,
      },
    ]);
  });

  it("sanitizes malformed collection payloads and prunes entries missing ids", () => {
    const decoded = decodeUnifiedSearchCollectionsStorage([
      null,
      { id: "" },
      {
        id: "collection-1",
        name: "Postmortems",
        createdAt: "2026-02-10T10:00:00.000Z",
      },
      {
        id: "collection-2",
        name: 42,
        createdAt: "",
      },
    ]);

    expect(decoded).toEqual([
      {
        id: "collection-1",
        name: "Postmortems",
        createdAt: "2026-02-10T10:00:00.000Z",
      },
      {
        id: "collection-2",
        name: "Untitled collection",
        createdAt: new Date(0).toISOString(),
      },
    ]);
  });

  it("sanitizes malformed file payloads and keeps safe defaults", () => {
    const decoded = decodeUnifiedSearchFilesStorage([
      "bad",
      { id: "" },
      {
        id: "file-1",
        name: "incident.md",
        size: 1024,
        type: "text/markdown",
        text: "postmortem notes",
        addedAt: "2026-02-10T09:00:00.000Z",
      },
      {
        id: "file-2",
        name: null,
        size: -20,
        type: 42,
        text: 9,
        addedAt: "",
      },
    ]);

    expect(decoded).toEqual([
      {
        id: "file-1",
        name: "incident.md",
        size: 1024,
        type: "text/markdown",
        text: "postmortem notes",
        addedAt: "2026-02-10T09:00:00.000Z",
      },
      {
        id: "file-2",
        name: "Untitled file",
        size: 0,
        type: "text/plain",
        text: "",
        addedAt: new Date(0).toISOString(),
      },
    ]);
  });

  it("sanitizes malformed space-tag payloads with trim + dedupe behavior", () => {
    const decoded = decodeUnifiedSearchSpaceTagsStorage({
      " space-1 ": [" alpha ", "Alpha", "", 42, "beta"],
      "": ["ignored"],
      "space-2": "bad",
      "space-3": [null, "  "],
      "space-4": ["release", "ops"],
    });

    expect(decoded).toEqual({
      "space-1": ["alpha", "beta"],
      "space-4": ["release", "ops"],
    });
  });

  it("sanitizes malformed notes payloads and trims thread ids", () => {
    const decoded = decodeUnifiedSearchNotesStorage({
      " thread-1 ": "Keep exact spacing  ",
      "": "skip",
      "thread-2": 42,
      "thread-3": "",
      "thread-4": "ops handoff",
    });

    expect(decoded).toEqual({
      "thread-1": "Keep exact spacing  ",
      "thread-3": "",
      "thread-4": "ops handoff",
    });
  });
});

describe("Unified Search recent-query storage guards", () => {
  it("normalizes whitespace and rejects non-string/blank values", () => {
    expect(normalizeUnifiedSearchRecentQuery("  incident   review  ")).toBe(
      "incident review"
    );
    expect(normalizeUnifiedSearchRecentQuery("   ")).toBeNull();
    expect(normalizeUnifiedSearchRecentQuery(42)).toBeNull();
  });

  it("dedupes case-insensitively, caps results, and drops malformed entries", () => {
    const decoded = decodeUnifiedSearchRecentQueriesStorage([
      " incident review ",
      null,
      "Incident Review",
      "",
      "tag:alpha",
      "space:research",
      "type:threads",
      "has:citation",
      "verbatim:true",
      "extra-query-should-drop",
    ]);

    expect(decoded).toEqual([
      "incident review",
      "tag:alpha",
      "space:research",
      "type:threads",
      "has:citation",
    ]);
  });

  it("returns an empty list when storage payload is not an array", () => {
    expect(decodeUnifiedSearchRecentQueriesStorage({ bad: true })).toEqual([]);
  });
});

describe("Unified Search operator summary chips", () => {
  it("dedupes operators and keeps canonical summary order", () => {
    expect(
      buildUnifiedSearchOperatorSummary({
        type: "threads",
        space: "Research",
        spaceId: "space-1",
        tags: ["beta", "alpha", "Alpha"],
        notTags: ["archive", "Archive"],
        states: ["archived", "favorite", "favorite"],
        notStates: ["pinned", "pinned"],
        hasNote: true,
        notHasCitation: true,
        verbatim: false,
      })
    ).toEqual([
      "type:threads",
      'space:"Research"',
      "spaceId:space-1",
      "tag:alpha",
      "tag:beta",
      "-tag:archive",
      "is:favorite",
      "is:archived",
      "-is:pinned",
      "has:note",
      "-has:citation",
      "verbatim:false",
    ]);
  });
});

describe("Unified Search diagnostics rows", () => {
  it("computes filtered-out buckets for scope/query/limit", () => {
    const rows = buildUnifiedSearchDiagnosticsRows(
      {
        threads: { loaded: 10, matched: 6, visible: 4 },
        spaces: { loaded: 7, matched: 3, visible: 3 },
        collections: { loaded: 4, matched: 2, visible: 2 },
        files: { loaded: 5, matched: 0, visible: 0 },
        tasks: { loaded: 9, matched: 5, visible: 2 },
      },
      "threads"
    );

    const threads = rows.find((row) => row.type === "threads");
    const spaces = rows.find((row) => row.type === "spaces");
    expect(threads).toEqual({
      type: "threads",
      loaded: 10,
      matched: 6,
      visible: 4,
      filteredByTypeScope: 0,
      filteredByQueryOperatorTime: 4,
      filteredByResultLimit: 2,
    });
    expect(spaces).toEqual({
      type: "spaces",
      loaded: 7,
      matched: 3,
      visible: 0,
      filteredByTypeScope: 3,
      filteredByQueryOperatorTime: 4,
      filteredByResultLimit: 0,
    });
  });

  it("enforces loaded>=matched>=visible invariants across rows", () => {
    const rows = buildUnifiedSearchDiagnosticsRows(
      {
        threads: { loaded: 1, matched: 4, visible: 9 },
        spaces: { loaded: 5, matched: 2, visible: 7 },
        collections: { loaded: 0, matched: 3, visible: 1 },
        files: { loaded: 3, matched: 3, visible: 6 },
        tasks: { loaded: 8, matched: 1, visible: 0 },
      },
      "all"
    );

    rows.forEach((row) => {
      expect(row.loaded).toBeGreaterThanOrEqual(row.matched);
      expect(row.matched).toBeGreaterThanOrEqual(row.visible);
      expect(row.filteredByTypeScope).toBeGreaterThanOrEqual(0);
      expect(row.filteredByQueryOperatorTime).toBeGreaterThanOrEqual(0);
      expect(row.filteredByResultLimit).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Unified Search URL state helpers", () => {
  it("parses valid URL state keys and ignores invalid values", () => {
    const patch = parseUnifiedSearchUrlState(
      new URLSearchParams(
        "q=incident+digest&type=threads&sort=newest&time=7d&limit=50&verbatim=true&ignored=1&bad=2"
      )
    );

    expect(patch).toEqual({
      query: "incident digest",
      filter: "threads",
      sortBy: "newest",
      timelineWindow: "7d",
      resultLimit: 50,
      verbatim: true,
    });

    const invalid = parseUnifiedSearchUrlState(
      new URLSearchParams("type=invalid&sort=bad&time=2h&limit=77&verbatim=maybe")
    );
    expect(invalid).toEqual({});
  });

  it("builds canonical URL params and omits default state", () => {
    const defaults = buildUnifiedSearchUrlParams({
      query: " ",
      filter: "all",
      sortBy: "relevance",
      timelineWindow: "all",
      resultLimit: 20,
      verbatim: false,
    });
    expect(defaults.toString()).toBe("");

    const nonDefault = buildUnifiedSearchUrlParams({
      query: "  incident report ",
      filter: "tasks",
      sortBy: "oldest",
      timelineWindow: "30d",
      resultLimit: 10,
      verbatim: true,
    });
    expect(nonDefault.toString()).toBe(
      "q=incident+report&type=tasks&sort=oldest&time=30d&limit=10&verbatim=true"
    );
  });
});

describe("stripUnifiedSearchOperators", () => {
  it("removes recognized operators while preserving free-text and unknown tokens", () => {
    const stripped = stripUnifiedSearchOperators(
      'type:threads has:note status:open space:"Research" outage triage'
    );
    expect(stripped).toBe("status:open outage triage");
  });

  it("can strip only verbatim operators while preserving other filters", () => {
    const stripped = stripUnifiedSearchOperators(
      "type:threads verbatim:true exact:false incident postmortem",
      { drop: ["verbatim"] }
    );
    expect(stripped).toBe("type:threads incident postmortem");
  });

  it("preserves unknown operators and quoted colon tokens while stripping known ones", () => {
    const stripped = stripUnifiedSearchOperators(
      'foo:bar type:threads "literal type:threads" tag:"alpha team" -has:note'
    );
    expect(stripped).toBe("foo:bar literal type:threads");
  });
});

describe("timestamp helpers", () => {
  it("parses valid timestamps and returns fallback for invalid values", () => {
    expect(parseTimestampMs("2026-02-08T10:00:00.000Z")).toBe(
      Date.parse("2026-02-08T10:00:00.000Z")
    );
    expect(parseTimestampMs("not-a-date", 123)).toBe(123);
  });

  it("formats export timestamps as ISO with locale secondary text", () => {
    const formatted = formatTimestampForExport("2026-02-08T10:00:00.000Z");
    expect(formatted.startsWith("2026-02-08T10:00:00.000Z (")).toBe(true);
    expect(formatted.endsWith(")")).toBe(true);
  });

  it("returns fallback text for invalid export/display timestamps", () => {
    expect(formatTimestampForExport("bad", "Unknown")).toBe("Unknown");
    expect(formatTimestampForDisplay("bad", "Unknown")).toBe("Unknown");
  });

  it("formats UTC offsets for both positive and negative minute values", () => {
    expect(formatUtcOffset(330)).toBe("+05:30");
    expect(formatUtcOffset(-480)).toBe("-08:00");
  });

  it("returns export environment metadata with locale, timezone, and UTC offset", () => {
    const now = new Date("2026-02-08T10:00:00.000Z");
    const meta = getExportEnvironmentMeta(
      now,
      "en-US",
      "America/Los_Angeles"
    );
    expect(meta).toEqual({
      locale: "en-US",
      timeZone: "America/Los_Angeles",
      utcOffset: formatUtcOffset(-now.getTimezoneOffset()),
    });
  });
});

describe("export builders", () => {
  it("escapes CSV cells with quotes, commas, and newlines", () => {
    expect(escapeCsvCell('alpha, "beta"\nline')).toBe('"alpha, ""beta""\nline"');
  });

  it("builds CSV export with deterministic quoting for every field", () => {
    const csv = buildUnifiedSearchCsvExport([
      {
        type: "thread",
        title: 'Roadmap, "Q1"\nPlanning',
        space: "Research, Team",
        mode: "quick",
        createdAt: "2026-02-08T10:00:00.000Z",
      },
      {
        type: "task",
        title: "Weekly digest",
        space: null,
        mode: "learn",
        createdAt: null,
      },
    ]);

    expect(csv).toBe(
      [
        '"type","title","space","mode","created_at"',
        '"thread","Roadmap, ""Q1""\nPlanning","Research, Team","quick","2026-02-08T10:00:00.000Z"',
        '"task","Weekly digest","","learn",""',
      ].join("\n")
    );
  });

  it("builds unified markdown export with environment metadata and saved-search fallback", () => {
    const markdown = buildUnifiedSearchMarkdownExport({
      exportedAt: "2026-02-08T10:00:00.000Z",
      environment: {
        locale: "en-US",
        timeZone: "America/Los_Angeles",
        utcOffset: "-08:00",
      },
      query: "incident",
      filter: "all",
      sortBy: "relevance",
      resultLimit: 20,
      threads: [
        {
          title: "Incident review",
          spaceName: "Ops",
          mode: "research",
          createdAt: "2026-02-08T09:00:00.000Z",
        },
      ],
      spaces: [],
      collections: [],
      files: [],
      tasks: [],
      savedSearches: [],
    });

    expect(markdown).toContain(
      "Environment: locale=en-US timeZone=America/Los_Angeles utcOffset=-08:00"
    );
    expect(markdown).toContain("## Saved Searches\n(none)");
  });

  it("builds saved-search markdown export with created/updated timestamps", () => {
    const markdown = buildUnifiedSearchSavedSearchesMarkdownExport({
      exportedAt: "2026-02-08T10:00:00.000Z",
      environment: {
        locale: "en-US",
        timeZone: "America/Los_Angeles",
        utcOffset: "-08:00",
      },
      savedSearches: [
        {
          name: "Pinned incidents",
          pinned: true,
          query: "incident",
          filter: "threads",
          sortBy: "newest",
          timelineWindow: "7d",
          resultLimit: 20,
          verbatim: false,
          createdAt: "2026-02-08T08:00:00.000Z",
          updatedAt: "2026-02-08T09:00:00.000Z",
        },
      ],
    });

    expect(markdown).toContain("1. Pinned: Pinned incidents");
    expect(markdown).toContain("   - Created: 2026-02-08T08:00:00.000Z");
    expect(markdown).toContain("   - Updated: 2026-02-08T09:00:00.000Z");
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

  it("trims whitespace and resolves ids after normalization", () => {
    expect(resolveThreadSpaceMeta(" space-2 ", spaces)).toEqual({
      spaceId: "space-2",
      spaceName: "Planning",
    });
  });

  it("returns null metadata for stale or unknown ids", () => {
    expect(resolveThreadSpaceMeta("missing-space", spaces)).toEqual({
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

  it("keeps multi-operator combinations for downstream type-scoped filtering", () => {
    const parsed = parseUnifiedSearchQuery("type:tasks is:pinned -has:note weekly");
    expect(parsed.text).toBe("weekly");
    expect(parsed.operators.type).toBe("tasks");
    expect(parsed.operators.states).toEqual(["pinned"]);
    expect(parsed.operators.notHasNote).toBe(true);
  });

  it("keeps parser behavior stable for long duplicate operator-heavy inputs", () => {
    const raw = [
      "type:threads",
      "type:spaces",
      "tag:alpha",
      "tag:alpha",
      "-tag:beta",
      "is:pinned",
      "is:favorite",
      "-is:archived",
      "has:note",
      "-has:citation",
      'space:"Roadmap Team"',
      "spaceId:space-42",
      "verbatim:false",
      "incident",
      "postmortem",
    ].join(" ");
    const parsed = parseUnifiedSearchQuery(raw);
    expect(parsed.text).toBe("incident postmortem");
    expect(parsed.operators.type).toBe("spaces");
    expect(parsed.operators.tags).toEqual(["alpha", "alpha"]);
    expect(parsed.operators.notTags).toEqual(["beta"]);
    expect(parsed.operators.states).toEqual(["pinned", "favorite"]);
    expect(parsed.operators.notStates).toEqual(["archived"]);
    expect(parsed.operators.hasNote).toBe(true);
    expect(parsed.operators.notHasCitation).toBe(true);
    expect(parsed.operators.space).toBe("Roadmap Team");
    expect(parsed.operators.spaceId).toBe("space-42");
    expect(parsed.operators.verbatim).toBe(false);
  });

  it("handles quoted operator values with colons and escaped quotes", () => {
    const parsed = parseUnifiedSearchQuery(
      'tag:"release:v1" space:"Ops \\"Incident\\" Team" roadmap'
    );
    expect(parsed.text).toBe("roadmap");
    expect(parsed.operators.tags).toEqual(["release:v1"]);
    expect(parsed.operators.space).toBe('Ops "Incident" Team');
  });

  it("continues parsing valid operators after malformed operator tokens", () => {
    const parsed = parseUnifiedSearchQuery(
      'type:threads space:"Deep Work tag:alpha tag:beta -has:note follow up'
    );
    expect(parsed.operators.tags).toEqual(["alpha", "beta"]);
    expect(parsed.operators.notHasNote).toBe(true);
    expect(parsed.text).toContain("follow up");
  });
});

describe("operator autocomplete helpers", () => {
  it("suggests matching operators for partial tokens", () => {
    const match = getOperatorAutocomplete("ty");
    expect(match?.token).toBe("ty");
    expect(match?.suggestions).toContain("type:");
  });

  it("supports negated operator prefixes", () => {
    const match = getOperatorAutocomplete("incident -i");
    expect(match?.suggestions).toEqual(["-is:"]);
  });

  it("returns null when token is complete or value mode has started", () => {
    expect(getOperatorAutocomplete("type:threads")).toBeNull();
    expect(getOperatorAutocomplete("type:")).toBeNull();
    expect(getOperatorAutocomplete("tag:alpha ")).toBeNull();
  });

  it("replaces the active token when applying a suggestion", () => {
    expect(applyOperatorAutocomplete("incident ty", "type:")).toBe(
      "incident type:"
    );
  });

  it("appends suggestions when no active autocomplete token exists", () => {
    expect(applyOperatorAutocomplete("incident", "tag:")).toBe("incident tag:");
    expect(applyOperatorAutocomplete("", "space:")).toBe("space:");
  });
});

describe("stepCircularIndex", () => {
  it("returns -1 for empty lists", () => {
    expect(stepCircularIndex(0, -1, 1)).toBe(-1);
  });

  it("starts at the first/last index when current is invalid", () => {
    expect(stepCircularIndex(3, -1, 1)).toBe(0);
    expect(stepCircularIndex(3, -1, -1)).toBe(2);
  });

  it("wraps around while navigating forward/backward", () => {
    expect(stepCircularIndex(3, 2, 1)).toBe(0);
    expect(stepCircularIndex(3, 0, -1)).toBe(2);
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

  it("supports combined space/tag/state/has operators", () => {
    const entries = [
      makeEntry({
        thread: {
          createdAt: "2026-02-08T01:00:00.000Z",
          pinned: true,
          favorite: true,
          archived: false,
        },
        spaceNameLower: "research",
        spaceIdLower: "space-1",
        tagSetLower: new Set(["alpha", "beta"]),
        noteTrimmed: "weekly summary",
      }),
      makeEntry({
        thread: {
          createdAt: "2026-02-08T01:00:00.000Z",
          pinned: true,
          favorite: false,
          archived: false,
        },
        spaceNameLower: "research",
        spaceIdLower: "space-1",
        tagSetLower: new Set(["alpha"]),
        noteTrimmed: "",
      }),
    ];

    const filtered = filterThreadEntries(entries, {
      query: normalizeQuery(""),
      operators: {
        space: "research",
        tags: ["alpha"],
        states: ["pinned"],
        notStates: ["archived"],
        hasNote: true,
      },
      timelineWindow: "all",
      nowMs: now,
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.noteTrimmed).toBe("weekly summary");
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

  it("rejects task matches when incompatible operators are combined", () => {
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
        operators: { spaceId: "space-1", notHasNote: true },
        timelineWindow: "all",
        nowMs: now,
      })
    ).toHaveLength(0);
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

  it("keeps input order stable for exact relevance and timestamp ties", () => {
    const items = [
      { id: "first", createdMs: 0 },
      { id: "second", createdMs: 0 },
      { id: "third", createdMs: 0 },
    ];
    const query = normalizeQuery("incident");
    const sorted = sortSearchResults(items, "relevance", query, () => 1);
    expect(sorted.map((item) => item.id)).toEqual(["first", "second", "third"]);
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

  it("matches full sort slice for relevance ties with invalid-timestamp fallbacks", () => {
    const items = [
      { id: "a", createdMs: 0 },
      { id: "b", createdMs: 0 },
      { id: "c", createdMs: 200 },
      { id: "d", createdMs: 0 },
      { id: "e", createdMs: 200 },
      { id: "f", createdMs: 0 },
    ];
    const query = normalizeQuery("incident");
    const scoreOf = (item: { id: string }) =>
      item.id === "c" || item.id === "e" ? 5 : 2;
    const limit = 4;
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
