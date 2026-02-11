import path from "node:path";

const IMPLEMENTED_HEADER = "## Implemented";
const ENTRY_PREFIX = /^- \d{4}-\d{2}-\d{2}:/;
const COMMIT_TOKEN_PATTERN = /\(commit `([0-9a-f]{7,40})`\)/;

export function checkCloneFeaturesText({ filePath, text }) {
  const violations = [];
  const lines = text.split(/\r?\n/);
  const implementedIndex = lines.findIndex(
    (line) => line.trim() === IMPLEMENTED_HEADER
  );
  if (implementedIndex === -1) {
    violations.push({
      filePath,
      line: 1,
      message: `Missing "${IMPLEMENTED_HEADER}" section.`,
    });
    return violations;
  }

  let index = implementedIndex + 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    if (!ENTRY_PREFIX.test(line.trim())) continue;
    if (COMMIT_TOKEN_PATTERN.test(line)) continue;
    violations.push({
      filePath,
      line: index + 1,
      message:
        "Implemented entries must include a commit token formatted like `(commit `abc1234`)`.",
    });
  }

  return violations;
}

export function formatCloneFeaturesViolations(
  violations,
  { cwd = process.cwd() } = {}
) {
  if (!violations.length) return "";
  return violations
    .map((violation) => {
      const relativePath = path.relative(cwd, violation.filePath);
      return `${relativePath}:${violation.line}: ${violation.message}`;
    })
    .join("\n");
}
