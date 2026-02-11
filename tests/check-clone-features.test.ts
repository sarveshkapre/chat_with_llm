import { describe, expect, test } from "vitest";

type Violation = { message: string };

async function loadPolicy() {
  return import("../scripts/clone-features-policy.mjs") as Promise<{
    checkCloneFeaturesText: (input: {
      filePath: string;
      text: string;
    }) => Violation[];
  }>;
}

describe("clone features policy", () => {
  test("accepts implemented entries with commit tokens", async () => {
    const { checkCloneFeaturesText } = await loadPolicy();
    const text = `
# Clone Feature Tracker

## Implemented
- 2026-02-11: Added smoke fixture route updates. (commit \`abc1234\`)

## Insights
- none
`;
    const violations = checkCloneFeaturesText({
      filePath: "/repo/CLONE_FEATURES.md",
      text,
    });
    expect(violations).toEqual([]);
  });

  test("rejects implemented entries missing commit tokens", async () => {
    const { checkCloneFeaturesText } = await loadPolicy();
    const text = `
# Clone Feature Tracker

## Implemented
- 2026-02-11: Added smoke fixture route updates.

## Insights
- none
`;
    const violations = checkCloneFeaturesText({
      filePath: "/repo/CLONE_FEATURES.md",
      text,
    });
    expect(
      violations.some((violation) => violation.message.includes("commit token"))
    ).toBe(true);
  });

  test("rejects missing implemented section", async () => {
    const { checkCloneFeaturesText } = await loadPolicy();
    const text = `
# Clone Feature Tracker

## Candidate Features To Do
- [ ] Placeholder.
`;
    const violations = checkCloneFeaturesText({
      filePath: "/repo/CLONE_FEATURES.md",
      text,
    });
    expect(
      violations.some((violation) => violation.message.includes("## Implemented"))
    ).toBe(true);
  });
});
