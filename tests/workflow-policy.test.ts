import { describe, expect, test } from "vitest";

type Violation = { message: string };

async function loadPolicy() {
  // Keep the policy in scripts/ so CI can execute it without a build step.
  return import("../scripts/workflow-policy.mjs") as Promise<{
    checkWorkflowText: (input: {
      filePath: string;
      text: string;
    }) => Violation[];
  }>;
}

describe("workflow policy", () => {
  test("accepts pinned actions + explicit top-level permissions", async () => {
    const { checkWorkflowText } = await loadPolicy();
    const text = `
name: CI
on: [push]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: ./.github/actions/local-action
`;
    const violations = checkWorkflowText({
      filePath: "/repo/.github/workflows/ci.yml",
      text,
    });
    expect(violations).toEqual([]);
  });

  test("rejects missing top-level permissions", async () => {
    const { checkWorkflowText } = await loadPolicy();
    const text = `
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
`;
    const violations = checkWorkflowText({
      filePath: "/repo/.github/workflows/ci.yml",
      text,
    });
    expect(
      violations.some((v) => v.message.includes("top-level permissions"))
    ).toBe(true);
  });

  test("rejects unpinned actions", async () => {
    const { checkWorkflowText } = await loadPolicy();
    const text = `
name: CI
on: [push]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`;
    const violations = checkWorkflowText({
      filePath: "/repo/.github/workflows/ci.yml",
      text,
    });
    expect(violations.some((v) => v.message.includes("40-char SHA"))).toBe(true);
  });
});
