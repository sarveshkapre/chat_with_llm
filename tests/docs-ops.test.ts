import { describe, expect, test } from "vitest";

async function loadDocsOps() {
  return import("../scripts/docs-ops.mjs") as Promise<{
    OPS_COMMANDS: string[];
    buildDocsOpsOutput: () => string;
  }>;
}

describe("docs ops command list", () => {
  test("includes canonical verification commands", async () => {
    const { OPS_COMMANDS } = await loadDocsOps();
    expect(OPS_COMMANDS).toEqual([
      "npm run lint -- --max-warnings=0",
      "npm run check:workflows",
      "npm run check:operator-docs",
      "npm run check:smoke-fixtures",
      "npm run check:clone-features",
      "npm run check:project-memory",
      "npm test",
      "npm run build",
      "node scripts/smoke.mjs --provider mock --skip-build",
      "npm run perf:search",
    ]);
  });

  test("renders markdown output with ordered command list", async () => {
    const { buildDocsOpsOutput } = await loadDocsOps();
    const output = buildDocsOpsOutput();
    expect(output).toContain("# Signal Search Ops Commands");
    expect(output).toContain(
      "1. `npm run lint -- --max-warnings=0`"
    );
    expect(output).toContain(
      "10. `npm run perf:search`"
    );
    expect(output).toContain(
      "Tip: run `npm run smoke:mock` for build+mock smoke in one command."
    );
  });
});
