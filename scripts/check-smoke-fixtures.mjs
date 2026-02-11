import fs from "node:fs/promises";
import path from "node:path";
import {
  checkSmokeFixtureCoverage,
  formatSmokeFixtureViolations,
} from "./smoke-fixtures-policy.mjs";

async function listSmokeFixtureFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return listSmokeFixtureFiles(entryPath);
      }
      return entry.name === "page.tsx" ? [entryPath] : [];
    })
  );
  return files.flat();
}

async function main() {
  const repoRoot = process.cwd();
  const smokeScriptPath = path.join(repoRoot, "scripts", "smoke.mjs");
  const fixtureRoot = path.join(repoRoot, "src", "app", "smoke-search");

  const [smokeScriptText, fixtureFiles] = await Promise.all([
    fs.readFile(smokeScriptPath, "utf8"),
    listSmokeFixtureFiles(fixtureRoot),
  ]);

  const violations = checkSmokeFixtureCoverage({
    fixtureFiles,
    smokeScriptPath,
    smokeScriptText,
  });
  if (violations.length) {
    console.error("Smoke fixture coverage policy violations found:");
    console.error(formatSmokeFixtureViolations(violations, { cwd: repoRoot }));
    process.exit(1);
  }

  console.log(
    `Smoke fixture coverage OK (${fixtureFiles.length} fixture route file(s)).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
