import path from "node:path";

const VERIFICATION_HEADER = "## Verification Evidence";
const ENTRY_PREFIX = /^- \d{4}-\d{2}-\d{2} \|/;
const STATUS_PATTERN = /\|\s*(pass|fail)(?:\s*\([^)]*\))?\s*$/i;

export function checkProjectMemoryText({ filePath, text }) {
  const violations = [];
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex(
    (line) => line.trim() === VERIFICATION_HEADER
  );
  if (headerIndex === -1) {
    violations.push({
      filePath,
      line: 1,
      message: `Missing "${VERIFICATION_HEADER}" section.`,
    });
    return violations;
  }

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    const trimmed = line.trim();
    if (!ENTRY_PREFIX.test(trimmed)) continue;
    if (STATUS_PATTERN.test(trimmed)) continue;
    violations.push({
      filePath,
      line: index + 1,
      message:
        "Verification entries must end with an explicit status token (`pass` or `fail`).",
    });
  }

  return violations;
}

export function formatProjectMemoryViolations(
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
