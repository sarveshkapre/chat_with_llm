import fs from "node:fs/promises";
import path from "node:path";
import {
  checkProjectMemoryText,
  formatProjectMemoryViolations,
} from "./project-memory-policy.mjs";

async function main() {
  const repoRoot = process.cwd();
  const filePath = path.join(repoRoot, "PROJECT_MEMORY.md");

  let text = "";
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    console.error(`Unable to read ${filePath}`);
    console.error(error);
    process.exit(2);
  }

  const violations = checkProjectMemoryText({ filePath, text });
  if (violations.length) {
    console.error("PROJECT_MEMORY policy violations found:");
    console.error(formatProjectMemoryViolations(violations, { cwd: repoRoot }));
    process.exit(1);
  }

  console.log("PROJECT_MEMORY policy OK.");
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
