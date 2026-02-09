import fs from "node:fs/promises";
import path from "node:path";
import { checkWorkflowText, formatViolations } from "./workflow-policy.mjs";

async function main() {
  const repoRoot = process.cwd();
  const workflowsDir = path.join(repoRoot, ".github", "workflows");

  let entries;
  try {
    entries = await fs.readdir(workflowsDir, { withFileTypes: true });
  } catch (error) {
    console.error(`Unable to read workflows directory: ${workflowsDir}`);
    console.error(error);
    process.exit(2);
  }

  const workflowFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => path.join(workflowsDir, name))
    .sort();

  const allViolations = [];
  for (const filePath of workflowFiles) {
    const text = await fs.readFile(filePath, "utf8");
    const violations = checkWorkflowText({ filePath, text });
    allViolations.push(...violations);
  }

  if (allViolations.length) {
    console.error("Workflow policy violations found:");
    console.error(formatViolations(allViolations, { cwd: repoRoot }));
    process.exit(1);
  }

  console.log(`Workflow policy OK (${workflowFiles.length} file(s) checked).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});

