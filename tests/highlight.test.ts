import { describe, expect, it } from "vitest";
import { buildHighlightParts } from "@/lib/highlight";

function partsToDebug(parts: { text: string; highlighted: boolean }[]) {
  return parts.map((part) => `${part.highlighted ? "[" : ""}${part.text}${part.highlighted ? "]" : ""}`).join("");
}

describe("buildHighlightParts", () => {
  it("returns unhighlighted text when query is empty", () => {
    expect(buildHighlightParts("Hello world", "", [])).toEqual([
      { text: "Hello world", highlighted: false },
    ]);
  });

  it("highlights case-insensitive full query matches", () => {
    const parts = buildHighlightParts("Hello World", "world", ["world"]);
    expect(partsToDebug(parts)).toBe("Hello [World]");
  });

  it("highlights multiple token matches", () => {
    const parts = buildHighlightParts("alpha beta gamma", "beta gamma", ["beta", "gamma"]);
    // Full query match should win and highlight the whole phrase.
    expect(partsToDebug(parts)).toBe("alpha [beta gamma]");
  });

  it("merges overlapping ranges (prefer longer combined highlights)", () => {
    const parts = buildHighlightParts("foobar", "foo", ["foo", "oob"]);
    // "foo" and "oob" overlap; merged highlight should cover "foob".
    expect(partsToDebug(parts)).toBe("[foob]ar");
  });

  it("does not highlight 1-character tokens when the full query is longer", () => {
    const parts = buildHighlightParts("a b c", "alpha", ["a", "b", "c"]);
    expect(partsToDebug(parts)).toBe("a b c");
  });

  it("still highlights a 1-character query (explicit intent)", () => {
    const parts = buildHighlightParts("a b c", "b", ["b"]);
    expect(partsToDebug(parts)).toBe("a [b] c");
  });
});
