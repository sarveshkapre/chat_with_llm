import { describe, expect, it } from "vitest";
import {
  checkOperatorDocsConsistency,
  extractOperatorSuggestionTokens,
  findMissingOperatorDocTokens,
} from "../scripts/check-operator-docs.mjs";

describe("check-operator-docs script", () => {
  it("extracts suggestion tokens from source array", () => {
    const source = `
      export const UNIFIED_OPERATOR_SUGGESTIONS = [
        "type:",
        "space:",
        "verbatim:",
      ] as const;
    `;
    expect(extractOperatorSuggestionTokens(source)).toEqual([
      "type:",
      "space:",
      "verbatim:",
    ]);
  });

  it("detects missing tokens in docs content", () => {
    expect(
      findMissingOperatorDocTokens(
        ["type:", "space:", "verbatim:"],
        "Use `type:` and `space:` in search."
      )
    ).toEqual(["verbatim:"]);
  });

  it("passes against current repository docs and parser suggestions", async () => {
    const result = await checkOperatorDocsConsistency();
    expect(result.missing).toEqual([]);
    expect(result.tokens.length).toBeGreaterThan(0);
  });
});
