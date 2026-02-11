import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
  computeRelevanceScoreFromLowered,
  filterCollectionEntries,
  filterFileEntries,
  filterSpaceEntries,
  filterTaskEntries,
  filterThreadEntries,
  parseUnifiedSearchQuery,
  topKSearchResults,
  type WeightedLoweredField,
} from "@/lib/unified-search";

type ThreadPerfEntry = {
  thread: {
    id: string;
    createdAt: string;
    favorite: boolean;
    pinned: boolean;
    archived: boolean;
  };
  createdMs: number;
  combinedLower: string;
  spaceNameLower: string;
  spaceIdLower: string;
  tagSetLower: Set<string>;
  noteTrimmed: string;
  hasCitation: boolean;
  relevanceFields: WeightedLoweredField[];
};

type SpacePerfEntry = {
  space: { id: string; createdAt: string };
  createdMs: number;
  combinedLower: string;
  spaceNameLower: string;
  spaceIdLower: string;
  tagSetLower: Set<string>;
  relevanceFields: WeightedLoweredField[];
};

type CollectionPerfEntry = {
  collection: { id: string; createdAt: string };
  createdMs: number;
  combinedLower: string;
  relevanceFields: WeightedLoweredField[];
};

type FilePerfEntry = {
  file: { id: string; addedAt: string };
  createdMs: number;
  combinedLower: string;
  relevanceFields: WeightedLoweredField[];
};

type TaskPerfEntry = {
  task: { id: string; createdAt: string };
  createdMs: number;
  combinedLower: string;
  spaceNameLower: string;
  spaceIdLower: string;
  relevanceFields: WeightedLoweredField[];
};

type SearchPerfDataset = {
  totalItems: number;
  threads: ThreadPerfEntry[];
  spaces: SpacePerfEntry[];
  collections: CollectionPerfEntry[];
  files: FilePerfEntry[];
  tasks: TaskPerfEntry[];
};

type SearchPerfResult = {
  totalItems: number;
  warmup: number;
  iterations: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  meanMs: number;
  maxMs: number;
  checksum: number;
};

const DATASET_SIZES = [1000, 5000, 10000] as const;
const DEFAULT_WARMUP = Number(process.env.SEARCH_PERF_WARMUP ?? 3);
const DEFAULT_ITERATIONS = Number(process.env.SEARCH_PERF_ITERATIONS ?? 12);
const BENCH_QUERY =
  process.env.SEARCH_PERF_QUERY ??
  "incident research workflow citation keyboard";
const NOW_MS = Date.parse("2026-02-11T12:00:00.000Z");

function clampCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded < 1) return fallback;
  return rounded;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildTimestamp(rng: () => number): { createdAt: string; createdMs: number } {
  const ageMs = Math.floor(rng() * 45 * 24 * 60 * 60 * 1000);
  const createdMs = NOW_MS - ageMs;
  return { createdAt: new Date(createdMs).toISOString(), createdMs };
}

function relevanceFields(parts: string[]): WeightedLoweredField[] {
  return parts
    .filter(Boolean)
    .map((part, index) => ({ loweredText: part.toLowerCase(), weight: Math.max(1, 8 - index * 2) }));
}

function splitCounts(total: number): {
  threadCount: number;
  spaceCount: number;
  collectionCount: number;
  fileCount: number;
  taskCount: number;
} {
  const threadCount = Math.max(1, Math.floor(total * 0.48));
  const spaceCount = Math.max(1, Math.floor(total * 0.16));
  const collectionCount = Math.max(1, Math.floor(total * 0.12));
  const fileCount = Math.max(1, Math.floor(total * 0.12));
  const taskCount = Math.max(1, total - threadCount - spaceCount - collectionCount - fileCount);
  return {
    threadCount,
    spaceCount,
    collectionCount,
    fileCount,
    taskCount,
  };
}

function buildDataset(totalItems: number): SearchPerfDataset {
  const counts = splitCounts(totalItems);
  const rng = createRng(totalItems * 17 + 97);

  const threads: ThreadPerfEntry[] = [];
  for (let i = 0; i < counts.threadCount; i += 1) {
    const { createdAt, createdMs } = buildTimestamp(rng);
    const incidentHeavy = i % 4 === 0;
    const title = incidentHeavy
      ? `Incident analysis ${i}`
      : `Research notes ${i}`;
    const question = incidentHeavy
      ? `How did workflow incident ${i} happen?`
      : `How to improve keyboard retrieval ${i}?`;
    const answer = incidentHeavy
      ? `Citation-backed incident remediation with research workflow ${i}`
      : `Keyboard-driven search workflow and citations guidance ${i}`;
    const spaceNameLower = i % 3 === 0 ? "research" : "planning";
    const spaceIdLower = i % 3 === 0 ? "space-research" : "space-planning";
    const tagSetLower = incidentHeavy
      ? new Set(["incident", "alpha", "workflow"])
      : new Set(["notes", "beta", "keyboard"]);
    const noteTrimmed = i % 5 === 0 ? "note with incident context" : "";
    const hasCitation = i % 2 === 0;
    const combinedLower = [
      title,
      question,
      answer,
      spaceNameLower,
      [...tagSetLower].join(" "),
      noteTrimmed,
    ]
      .join("\n")
      .toLowerCase();

    threads.push({
      thread: {
        id: `thread-${i}`,
        createdAt,
        favorite: i % 2 === 0,
        pinned: i % 3 === 0,
        archived: i % 11 === 0,
      },
      createdMs,
      combinedLower,
      spaceNameLower,
      spaceIdLower,
      tagSetLower,
      noteTrimmed,
      hasCitation,
      relevanceFields: relevanceFields([title, question, answer, spaceNameLower]),
    });
  }

  const spaces: SpacePerfEntry[] = [];
  for (let i = 0; i < counts.spaceCount; i += 1) {
    const { createdAt, createdMs } = buildTimestamp(rng);
    const name = i % 2 === 0 ? `Research ${i}` : `Planning ${i}`;
    const instructions = i % 2 === 0 ? "incident workflow citations" : "roadmap execution";
    const tags = i % 2 === 0 ? ["alpha", "incident"] : ["beta", "planning"];
    const combinedLower = [name, instructions, tags.join(" ")].join("\n").toLowerCase();
    spaces.push({
      space: { id: `space-${i}`, createdAt },
      createdMs,
      combinedLower,
      spaceNameLower: name.toLowerCase(),
      spaceIdLower: `space-${i}`,
      tagSetLower: new Set(tags.map((tag) => tag.toLowerCase())),
      relevanceFields: relevanceFields([name, instructions, tags.join(" ")]),
    });
  }

  const collections: CollectionPerfEntry[] = [];
  for (let i = 0; i < counts.collectionCount; i += 1) {
    const { createdAt, createdMs } = buildTimestamp(rng);
    const name = i % 2 === 0 ? `Incident collection ${i}` : `Research archive ${i}`;
    const combinedLower = `${name} citation workflow`.toLowerCase();
    collections.push({
      collection: { id: `collection-${i}`, createdAt },
      createdMs,
      combinedLower,
      relevanceFields: relevanceFields([name, "citation workflow"]),
    });
  }

  const files: FilePerfEntry[] = [];
  for (let i = 0; i < counts.fileCount; i += 1) {
    const { createdAt, createdMs } = buildTimestamp(rng);
    const name = i % 2 === 0 ? `incident-${i}.md` : `research-${i}.txt`;
    const body =
      i % 2 === 0
        ? "incident postmortem with citations and workflow timeline"
        : "research notes about keyboard search behavior";
    const combinedLower = `${name} ${body}`.toLowerCase();
    files.push({
      file: { id: `file-${i}`, addedAt: createdAt },
      createdMs,
      combinedLower,
      relevanceFields: relevanceFields([name, body]),
    });
  }

  const tasks: TaskPerfEntry[] = [];
  for (let i = 0; i < counts.taskCount; i += 1) {
    const { createdAt, createdMs } = buildTimestamp(rng);
    const name = i % 2 === 0 ? `Incident recap ${i}` : `Research digest ${i}`;
    const prompt =
      i % 2 === 0
        ? "Summarize latest incident with citations"
        : "Collect research updates and keyboard shortcuts";
    const spaceNameLower = i % 2 === 0 ? "research" : "operations";
    const spaceIdLower = i % 2 === 0 ? "space-research" : "space-operations";
    const combinedLower = [name, prompt, spaceNameLower].join("\n").toLowerCase();
    tasks.push({
      task: { id: `task-${i}`, createdAt },
      createdMs,
      combinedLower,
      spaceNameLower,
      spaceIdLower,
      relevanceFields: relevanceFields([name, prompt, spaceNameLower]),
    });
  }

  return {
    totalItems,
    threads,
    spaces,
    collections,
    files,
    tasks,
  };
}

function summarize(samples: number[]): {
  minMs: number;
  medianMs: number;
  p95Ms: number;
  meanMs: number;
  maxMs: number;
} {
  const sorted = [...samples].sort((a, b) => a - b);
  const minMs = sorted[0] ?? 0;
  const maxMs = sorted[sorted.length - 1] ?? 0;
  const medianMs = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95Ms = sorted[p95Index] ?? 0;
  const meanMs = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);
  return { minMs, medianMs, p95Ms, meanMs, maxMs };
}

function runSearchPass(
  dataset: SearchPerfDataset,
  parsed: ReturnType<typeof parseUnifiedSearchQuery>
): number {
  const filteredThreads = filterThreadEntries(dataset.threads, {
    query: parsed.query,
    operators: parsed.operators,
    timelineWindow: "30d",
    nowMs: NOW_MS,
  });
  const filteredSpaces = filterSpaceEntries(dataset.spaces, {
    query: parsed.query,
    operators: parsed.operators,
    timelineWindow: "30d",
    nowMs: NOW_MS,
  });
  const filteredCollections = filterCollectionEntries(dataset.collections, {
    query: parsed.query,
    operators: parsed.operators,
    timelineWindow: "30d",
    nowMs: NOW_MS,
  });
  const filteredFiles = filterFileEntries(dataset.files, {
    query: parsed.query,
    operators: parsed.operators,
    timelineWindow: "30d",
    nowMs: NOW_MS,
  });
  const filteredTasks = filterTaskEntries(dataset.tasks, {
    query: parsed.query,
    operators: parsed.operators,
    timelineWindow: "30d",
    nowMs: NOW_MS,
  });

  const shownThreads = topKSearchResults(
    filteredThreads,
    "relevance",
    parsed.query,
    20,
    (entry) => computeRelevanceScoreFromLowered(entry.relevanceFields, parsed.query)
  );
  const shownSpaces = topKSearchResults(
    filteredSpaces,
    "relevance",
    parsed.query,
    20,
    (entry) => computeRelevanceScoreFromLowered(entry.relevanceFields, parsed.query)
  );
  const shownCollections = topKSearchResults(
    filteredCollections,
    "relevance",
    parsed.query,
    20,
    (entry) => computeRelevanceScoreFromLowered(entry.relevanceFields, parsed.query)
  );
  const shownFiles = topKSearchResults(
    filteredFiles,
    "relevance",
    parsed.query,
    20,
    (entry) => computeRelevanceScoreFromLowered(entry.relevanceFields, parsed.query)
  );
  const shownTasks = topKSearchResults(
    filteredTasks,
    "relevance",
    parsed.query,
    20,
    (entry) => computeRelevanceScoreFromLowered(entry.relevanceFields, parsed.query)
  );

  return (
    shownThreads.length +
    shownSpaces.length +
    shownCollections.length +
    shownFiles.length +
    shownTasks.length
  );
}

function benchmarkDataset(
  dataset: SearchPerfDataset,
  parsed: ReturnType<typeof parseUnifiedSearchQuery>,
  warmup: number,
  iterations: number
): SearchPerfResult {
  const samples: number[] = [];
  let checksum = 0;

  for (let i = 0; i < warmup + iterations; i += 1) {
    const startedAt = performance.now();
    checksum += runSearchPass(dataset, parsed);
    const elapsedMs = performance.now() - startedAt;
    if (i >= warmup) samples.push(elapsedMs);
  }

  const summary = summarize(samples);
  return {
    totalItems: dataset.totalItems,
    warmup,
    iterations,
    ...summary,
    checksum,
  };
}

describe("search performance harness", () => {
  it("reports deterministic baseline timings for 1k/5k/10k mixed datasets", () => {
    const warmup = clampCount(DEFAULT_WARMUP, 3);
    const iterations = clampCount(DEFAULT_ITERATIONS, 12);
    const parsed = parseUnifiedSearchQuery(BENCH_QUERY);

    const results = DATASET_SIZES.map((size) => {
      const dataset = buildDataset(size);
      return benchmarkDataset(dataset, parsed, warmup, iterations);
    });

    for (const result of results) {
      // Parsed by scripts/search-perf.mjs.
      console.log(`PERF_RESULT ${JSON.stringify(result)}`);
    }

    expect(results).toHaveLength(DATASET_SIZES.length);
    expect(results.every((result) => Number.isFinite(result.medianMs))).toBe(true);
    expect(results.every((result) => result.checksum > 0)).toBe(true);
  });
});
