import { describe, expect, it } from "vitest";
import { decodeBootstrapSelectedThreadIds } from "@/lib/unified-search-bootstrap";

describe("decodeBootstrapSelectedThreadIds", () => {
  it("returns empty array for non-array values", () => {
    expect(decodeBootstrapSelectedThreadIds(null)).toEqual([]);
    expect(decodeBootstrapSelectedThreadIds("thread-1")).toEqual([]);
    expect(decodeBootstrapSelectedThreadIds({ id: "thread-1" })).toEqual([]);
  });

  it("trims, dedupes, and drops invalid entries", () => {
    expect(
      decodeBootstrapSelectedThreadIds([
        " thread-1 ",
        "thread-1",
        "",
        "   ",
        123,
        null,
        "thread-2",
        "thread-2",
      ])
    ).toEqual(["thread-1", "thread-2"]);
  });
});
