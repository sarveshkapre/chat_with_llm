import { describe, expect, it } from "vitest";
import { decodeNdjsonChunk, hasNdjsonTrailingData } from "@/lib/ndjson";

describe("decodeNdjsonChunk", () => {
  it("parses valid lines and preserves trailing partial buffer", () => {
    const decoded = decodeNdjsonChunk<{ type: string; value: number }>(
      '{"type":"delta","value":1}\n{"type":"delta","value":2',
      ""
    );
    expect(decoded.events).toEqual([{ type: "delta", value: 1 }]);
    expect(decoded.trailingBuffer).toBe('{"type":"delta","value":2');
    expect(decoded.malformedLineCount).toBe(0);
  });

  it("skips malformed lines and continues parsing subsequent lines", () => {
    const decoded = decodeNdjsonChunk<{ type: string }>(
      '{"type":"delta"}\n{bad-json\n{"type":"done"}\n',
      ""
    );
    expect(decoded.events).toEqual([{ type: "delta" }, { type: "done" }]);
    expect(decoded.malformedLineCount).toBe(1);
    expect(decoded.trailingBuffer).toBe("");
  });
});

describe("hasNdjsonTrailingData", () => {
  it("returns true only when non-whitespace trailing data is present", () => {
    expect(hasNdjsonTrailingData("")).toBe(false);
    expect(hasNdjsonTrailingData("   ")).toBe(false);
    expect(hasNdjsonTrailingData("{partial")).toBe(true);
  });
});
