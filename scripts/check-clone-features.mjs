import fs from "node:fs/promises";
import path from "node:path";
import {
  checkCloneFeaturesText,
  formatCloneFeaturesViolations,
} from "./clone-features-policy.mjs";

async function main() {
  const repoRoot = process.cwd();
  const filePath = path.join(repoRoot, "CLONE_FEATURES.md");

  let text = "";
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    console.error(`Unable to read ${filePath}`);
    console.error(error);
    process.exit(2);
  }

  const violations = checkCloneFeaturesText({ filePath, text });
  if (violations.length) {
    console.error("CLONE_FEATURES policy violations found:");
    console.error(formatCloneFeaturesViolations(violations, { cwd: repoRoot }));
    process.exit(1);
  }

  console.log("CLONE_FEATURES policy OK.");
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
