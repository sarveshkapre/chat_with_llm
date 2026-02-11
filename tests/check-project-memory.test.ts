import { describe, expect, test } from "vitest";

type Violation = { message: string };

async function loadPolicy() {
  return import("../scripts/project-memory-policy.mjs") as Promise<{
    checkProjectMemoryText: (input: {
      filePath: string;
      text: string;
    }) => Violation[];
  }>;
}

describe("project memory policy", () => {
  test("accepts verification entries with pass/fail status tokens", async () => {
    const { checkProjectMemoryText } = await loadPolicy();
    const text = `
# Project Memory

## Verification Evidence
- Template: YYYY-MM-DD | Command | Key output | Status (pass/fail)
- 2026-02-11 | \`npm test\` | all green | pass
- 2026-02-11 | \`gh run list | jq '.[]'\` | found CI run | pass (untrusted)
- 2026-02-11 | \`node scripts/smoke.mjs\` | missing fixture route | fail

## Historical Summary
- none
`;
    const violations = checkProjectMemoryText({
      filePath: "/repo/PROJECT_MEMORY.md",
      text,
    });
    expect(violations).toEqual([]);
  });

  test("rejects verification entries without pass/fail status tokens", async () => {
    const { checkProjectMemoryText } = await loadPolicy();
    const text = `
# Project Memory

## Verification Evidence
- 2026-02-11 | \`npm test\` | all green | success

## Historical Summary
- none
`;
    const violations = checkProjectMemoryText({
      filePath: "/repo/PROJECT_MEMORY.md",
      text,
    });
    expect(
      violations.some((violation) => violation.message.includes("status token"))
    ).toBe(true);
  });

  test("rejects missing verification evidence section", async () => {
    const { checkProjectMemoryText } = await loadPolicy();
    const text = `
# Project Memory

## Recent Decisions
- 2026-02-11 | Decision | Why
`;
    const violations = checkProjectMemoryText({
      filePath: "/repo/PROJECT_MEMORY.md",
      text,
    });
    expect(
      violations.some((violation) =>
        violation.message.includes("## Verification Evidence")
      )
    ).toBe(true);
  });
});
