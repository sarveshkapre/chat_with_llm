import { describe, expect, it } from "vitest";
import {
  createDeterministicUnifiedSearchDataset,
  splitDeterministicUnifiedSearchCounts,
} from "@/lib/unified-search-fixtures";

describe("unified search deterministic fixtures", () => {
  it("splits fixture counts deterministically and preserves total size", () => {
    const counts = splitDeterministicUnifiedSearchCounts(1000);
    expect(counts.threadCount).toBe(480);
    expect(counts.spaceCount).toBe(160);
    expect(counts.collectionCount).toBe(120);
    expect(counts.fileCount).toBe(120);
    expect(counts.taskCount).toBe(120);
    expect(
      counts.threadCount +
        counts.spaceCount +
        counts.collectionCount +
        counts.fileCount +
        counts.taskCount
    ).toBe(1000);
  });

  it("builds deterministic datasets for stable smoke/perf reuse", () => {
    const options = {
      totalItems: 48,
      nowMs: Date.parse("2026-02-11T12:00:00.000Z"),
      idPrefix: "fixture-smoke",
    };
    const first = createDeterministicUnifiedSearchDataset(options);
    const second = createDeterministicUnifiedSearchDataset(options);
    expect(second).toEqual(first);
  });

  it("includes mixed archived/non-archived threads and cross-type records", () => {
    const dataset = createDeterministicUnifiedSearchDataset({
      totalItems: 48,
      nowMs: Date.parse("2026-02-11T12:00:00.000Z"),
      idPrefix: "fixture-mixed",
    });
    const archivedCount = dataset.threads.filter(
      (thread) => thread.archived === true
    ).length;
    const activeCount = dataset.threads.filter(
      (thread) => thread.archived !== true
    ).length;
    expect(archivedCount).toBeGreaterThan(0);
    expect(activeCount).toBeGreaterThan(0);
    expect(dataset.spaces.length).toBeGreaterThan(0);
    expect(dataset.collections.length).toBeGreaterThan(0);
    expect(dataset.files.length).toBeGreaterThan(0);
    expect(dataset.tasks.length).toBeGreaterThan(0);
  });
});
