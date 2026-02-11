import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function extractOperatorSuggestionTokens(sourceText) {
  const match = sourceText.match(
    /export const UNIFIED_OPERATOR_SUGGESTIONS = \[([\s\S]*?)\] as const;/
  );
  if (!match) {
    throw new Error(
      "Could not locate UNIFIED_OPERATOR_SUGGESTIONS in src/lib/unified-search.ts"
    );
  }
  const block = match[1];
  const tokenMatches = [...block.matchAll(/"([^"]+)"/g)];
  return tokenMatches
    .map((tokenMatch) => tokenMatch[1])
    .filter((token) => token.endsWith(":"));
}

export function findMissingOperatorDocTokens(tokens, docsText) {
  const lowerDocs = docsText.toLowerCase();
  return tokens.filter((token) => !lowerDocs.includes(token.toLowerCase()));
}

export async function checkOperatorDocsConsistency(paths = {}) {
  const sourcePath = paths.sourcePath ?? "src/lib/unified-search.ts";
  const docsPath = paths.docsPath ?? "docs/unified-search-operators.md";
  const sourceText = await readFile(sourcePath, "utf8");
  const docsText = await readFile(docsPath, "utf8");
  const tokens = extractOperatorSuggestionTokens(sourceText);
  const missing = findMissingOperatorDocTokens(tokens, docsText);
  if (missing.length) {
    throw new Error(
      [
        "Operator docs are missing parser suggestion tokens:",
        ...missing.map((token) => `- ${token}`),
        `Checked source=${sourcePath} docs=${docsPath}`,
      ].join("\n")
    );
  }
  return { sourcePath, docsPath, tokens, missing };
}

async function main() {
  const result = await checkOperatorDocsConsistency();
  console.log(
    `Operator docs OK (${result.tokens.length} token(s) matched): ${result.tokens.join(", ")}`
  );
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
