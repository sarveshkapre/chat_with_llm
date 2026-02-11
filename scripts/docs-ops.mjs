import path from "node:path";
import { fileURLToPath } from "node:url";

export const OPS_COMMANDS = [
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
];

export function buildDocsOpsOutput() {
  return [
    "# Signal Search Ops Commands",
    "",
    "Canonical local verification sequence:",
    ...OPS_COMMANDS.map((command, index) => `${index + 1}. \`${command}\``),
    "",
    "Tip: run `npm run smoke:mock` for build+mock smoke in one command.",
  ].join("\n");
}

async function main() {
  console.log(buildDocsOpsOutput());
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
