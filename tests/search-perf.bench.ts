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
import { createDeterministicUnifiedSearchDataset } from "@/lib/unified-search-fixtures";

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

function relevanceFields(parts: string[]): WeightedLoweredField[] {
  return parts
    .filter(Boolean)
    .map((part, index) => ({
      loweredText: part.toLowerCase(),
      weight: Math.max(1, 8 - index * 2),
    }));
}

function buildDataset(totalItems: number): SearchPerfDataset {
  const fixture = createDeterministicUnifiedSearchDataset({
    totalItems,
    nowMs: NOW_MS,
    idPrefix: `perf-${totalItems}`,
  });
  const notes = fixture.notes;
  const spaceTags = fixture.spaceTags;

  const threads: ThreadPerfEntry[] = fixture.threads.map((thread) => {
    const tags = thread.tags ?? [];
    const tagsText = tags.join(" ");
    const citationsText = (thread.citations ?? [])
      .map((citation) => `${citation.title} ${citation.url}`)
      .join(" ");
    const noteTrimmed = (notes[thread.id] ?? "").trim();
    const title = thread.title ?? thread.question;
    return {
      thread: {
        id: thread.id,
        createdAt: thread.createdAt,
        favorite: thread.favorite === true,
        pinned: thread.pinned === true,
        archived: thread.archived === true,
      },
      createdMs: Date.parse(thread.createdAt),
      combinedLower: [
        title,
        thread.question,
        thread.answer,
        thread.spaceName ?? "",
        tagsText,
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
      relevanceFields: relevanceFields([
        title,
        thread.question,
        thread.answer,
        thread.spaceName ?? "",
        tagsText,
      ]),
    };
  });

  const spaces: SpacePerfEntry[] = fixture.spaces.map((space) => {
    const tags = spaceTags[space.id] ?? [];
    return {
      space: { id: space.id, createdAt: space.createdAt },
      createdMs: Date.parse(space.createdAt),
      combinedLower: [space.name, space.instructions, tags.join(" ")]
        .filter(Boolean)
        .join("\n")
        .toLowerCase(),
      spaceNameLower: space.name.toLowerCase(),
      spaceIdLower: space.id.toLowerCase(),
      tagSetLower: new Set(tags.map((tag) => tag.toLowerCase())),
      relevanceFields: relevanceFields([
        space.name,
        space.instructions,
        tags.join(" "),
      ]),
    };
  });

  const collections: CollectionPerfEntry[] = fixture.collections.map((collection) => {
    return {
      collection: { id: collection.id, createdAt: collection.createdAt },
      createdMs: Date.parse(collection.createdAt),
      combinedLower: `${collection.name} citation workflow`.toLowerCase(),
      relevanceFields: relevanceFields([collection.name, "citation workflow"]),
    };
  });

  const files: FilePerfEntry[] = fixture.files.map((file) => {
    return {
      file: { id: file.id, addedAt: file.addedAt },
      createdMs: Date.parse(file.addedAt),
      combinedLower: [file.name, file.text].join("\n").toLowerCase(),
      relevanceFields: relevanceFields([file.name, file.text]),
    };
  });

  const tasks: TaskPerfEntry[] = fixture.tasks.map((task) => {
    return {
      task: { id: task.id, createdAt: task.createdAt },
      createdMs: Date.parse(task.createdAt),
      combinedLower: [task.name, task.prompt, task.spaceName ?? ""]
        .filter(Boolean)
        .join("\n")
        .toLowerCase(),
      spaceNameLower: (task.spaceName ?? "").toLowerCase(),
      spaceIdLower: (task.spaceId ?? "").toLowerCase(),
      relevanceFields: relevanceFields([
        task.name,
        task.prompt,
        task.spaceName ?? "",
      ]),
    };
  });

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
