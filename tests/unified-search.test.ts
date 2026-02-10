import { describe, expect, it } from "vitest";
import {
  applyBulkThreadUpdate,
  applyTimelineWindow,
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
