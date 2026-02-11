import { describe, expect, test } from "vitest";

type Violation = { message: string };

async function loadPolicy() {
  return import("../scripts/smoke-fixtures-policy.mjs") as Promise<{
    checkSmokeFixtureCoverage: (input: {
      fixtureFiles: string[];
      smokeScriptPath: string;
      smokeScriptText: string;
    }) => Violation[];
    getExpectedSmokeFixtureRoutes: (fixtureFiles: string[]) => string[];
    routeFromSmokeFixtureFile: (filePath: string) => string | null;
  }>;
}

describe("smoke fixtures policy", () => {
  test("maps fixture files to expected routes", async () => {
    const { getExpectedSmokeFixtureRoutes } = await loadPolicy();
    const routes = getExpectedSmokeFixtureRoutes([
      "/repo/src/app/smoke-search/page.tsx",
      "/repo/src/app/smoke-search/zero-results/page.tsx",
      "/repo/src/app/smoke-search/stale-selection/page.tsx",
    ]);
    expect(routes).toEqual([
      "/smoke-search",
      "/smoke-search/stale-selection",
      "/smoke-search/zero-results",
    ]);
  });

  test("supports Windows-style path separators", async () => {
    const { routeFromSmokeFixtureFile } = await loadPolicy();
    const route = routeFromSmokeFixtureFile(
      "C:\\repo\\src\\app\\smoke-search\\saved-roundtrip\\page.tsx"
    );
    expect(route).toBe("/smoke-search/saved-roundtrip");
  });

  test("rejects missing smoke-route coverage in smoke script", async () => {
    const { checkSmokeFixtureCoverage } = await loadPolicy();
    const violations = checkSmokeFixtureCoverage({
      fixtureFiles: [
        "/repo/src/app/smoke-search/page.tsx",
        "/repo/src/app/smoke-search/archive-only/page.tsx",
      ],
      smokeScriptPath: "/repo/scripts/smoke.mjs",
      smokeScriptText: `
        const x = "/smoke-search";
      `,
    });
    expect(
      violations.some((violation) =>
        violation.message.includes("/smoke-search/archive-only")
      )
    ).toBe(true);
  });

  test("accepts smoke script when all fixture routes are referenced", async () => {
    const { checkSmokeFixtureCoverage } = await loadPolicy();
    const violations = checkSmokeFixtureCoverage({
      fixtureFiles: [
        "/repo/src/app/smoke-search/page.tsx",
        "/repo/src/app/smoke-search/archive-only/page.tsx",
        "/repo/src/app/smoke-search/archive-exclude/page.tsx",
      ],
      smokeScriptPath: "/repo/scripts/smoke.mjs",
      smokeScriptText: `
        await fetch(\`\${baseUrl}/smoke-search\`);
        await fetch(\`\${baseUrl}/smoke-search/archive-only\`);
        await fetch(\`\${baseUrl}/smoke-search/archive-exclude\`);
      `,
    });
    expect(violations).toEqual([]);
  });
});
