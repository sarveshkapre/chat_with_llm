import type { UnifiedSearchBootstrap } from "@/lib/unified-search-bootstrap";

const nowIso = new Date("2026-02-11T12:00:00.000Z").toISOString();

export const UNIFIED_SEARCH_SMOKE_QUERY =
  "type:threads is:pinned has:citation tag:incident -has:note";
export const UNIFIED_SEARCH_SMOKE_ROUNDTRIP_QUERY =
  'type:tasks space:"Incident Ops" weekly digest';
export const UNIFIED_SEARCH_SMOKE_ROUNDTRIP_SAVED_ID = "smoke-saved-roundtrip";

export const UNIFIED_SEARCH_SMOKE_BOOTSTRAP: UnifiedSearchBootstrap = {
  query: UNIFIED_SEARCH_SMOKE_QUERY,
  disableStorageSync: true,
  notes: {
    "smoke-thread-filtered-note":
      "Needs follow-up write-up after the retro is complete.",
  },
  threads: [
    {
      id: "smoke-thread-match",
      title: "Smoke Incident Thread",
      question: "What happened during the API outage?",
      answer: "Primary region overload triggered a failover and latency spike.",
      mode: "research",
      sources: "web",
      provider: "mock",
      latencyMs: 420,
      createdAt: nowIso,
      citations: [
        {
          title: "Incident timeline",
          url: "https://status.example.com/incidents/2026-02-11",
        },
      ],
      attachments: [],
      spaceId: "smoke-space-incident",
      spaceName: "Incident Ops",
      tags: ["incident", "postmortem"],
      pinned: true,
      favorite: false,
      archived: false,
    },
    {
      id: "smoke-thread-filtered-note",
      title: "Incident follow-up with note",
      question: "Did we capture mitigations?",
      answer: "Yes, but this item has a note and should be filtered out.",
      mode: "quick",
      sources: "none",
      provider: "mock",
      latencyMs: 120,
      createdAt: nowIso,
      citations: [
        {
          title: "Mitigation checklist",
          url: "https://example.com/checklist",
        },
      ],
      attachments: [],
      spaceId: "smoke-space-incident",
      spaceName: "Incident Ops",
      tags: ["incident"],
      pinned: true,
      favorite: true,
      archived: false,
    },
    {
      id: "smoke-thread-filtered-state",
      title: "Unpinned incident scratchpad",
      question: "Scratch notes",
      answer: "Unpinned record used to verify operator filtering.",
      mode: "quick",
      sources: "none",
      provider: "mock",
      latencyMs: 90,
      createdAt: nowIso,
      citations: [
        {
          title: "Scratch source",
          url: "https://example.com/scratch",
        },
      ],
      attachments: [],
      spaceId: "smoke-space-incident",
      spaceName: "Incident Ops",
      tags: ["incident"],
      pinned: false,
      favorite: false,
      archived: false,
    },
  ],
  spaces: [
    {
      id: "smoke-space-incident",
      name: "Incident Ops",
      instructions: "Track live incidents and postmortems.",
      preferredModel: "gpt-4.1",
      sourcePolicy: "web",
      createdAt: nowIso,
    },
  ],
  spaceTags: {
    "smoke-space-incident": ["incident", "ops"],
  },
  collections: [
    {
      id: "smoke-collection-1",
      name: "Incident Reviews",
      createdAt: nowIso,
    },
  ],
  files: [
    {
      id: "smoke-file-1",
      name: "incident-retro.md",
      size: 1536,
      type: "text/markdown",
      text: "Postmortem summary and remediation owners.",
      addedAt: nowIso,
    },
  ],
  tasks: [
    {
      id: "smoke-task-1",
      name: "Weekly incident digest",
      prompt: "Summarize high-severity incidents from the week.",
      cadence: "weekly",
      time: "09:00",
      mode: "research",
      sources: "web",
      createdAt: nowIso,
      nextRun: nowIso,
      lastRun: null,
      lastThreadId: null,
      dayOfWeek: 1,
      dayOfMonth: null,
      monthOfYear: null,
      spaceId: "smoke-space-incident",
      spaceName: "Incident Ops",
    },
  ],
  recentQueries: [UNIFIED_SEARCH_SMOKE_QUERY, "type:spaces tag:ops"],
  savedSearches: [
    {
      id: "smoke-saved-1",
      name: "Pinned incidents with citations",
      query: UNIFIED_SEARCH_SMOKE_QUERY,
      filter: "threads",
      sortBy: "relevance",
      timelineWindow: "all",
      resultLimit: 20,
      verbatim: false,
      pinned: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ],
  verbatim: false,
};

export const UNIFIED_SEARCH_SMOKE_ROUNDTRIP_BOOTSTRAP: UnifiedSearchBootstrap = {
  ...UNIFIED_SEARCH_SMOKE_BOOTSTRAP,
  query: "placeholder query overwritten by active saved search",
  filter: "all",
  sortBy: "relevance",
  timelineWindow: "all",
  resultLimit: 50,
  verbatim: false,
  activeSavedSearchId: UNIFIED_SEARCH_SMOKE_ROUNDTRIP_SAVED_ID,
  savedSearches: [
    ...(Array.isArray(UNIFIED_SEARCH_SMOKE_BOOTSTRAP.savedSearches)
      ? UNIFIED_SEARCH_SMOKE_BOOTSTRAP.savedSearches
      : []),
    {
      id: UNIFIED_SEARCH_SMOKE_ROUNDTRIP_SAVED_ID,
      name: "Roundtrip task digest",
      query: UNIFIED_SEARCH_SMOKE_ROUNDTRIP_QUERY,
      filter: "tasks",
      sortBy: "oldest",
      timelineWindow: "7d",
      resultLimit: 10,
      verbatim: true,
      pinned: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ],
};

export const UNIFIED_SEARCH_SMOKE_STALE_SELECTION_BOOTSTRAP: UnifiedSearchBootstrap = {
  ...UNIFIED_SEARCH_SMOKE_BOOTSTRAP,
  debugMode: true,
  filter: "threads",
  selectedThreadIds: ["smoke-thread-match", "smoke-thread-missing"],
};
