import { describe, expect, it } from "vitest";
import {
  applyBulkThreadUpdate,
  applyTimelineWindow,
  resolveThreadSpaceMeta,
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
