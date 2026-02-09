import path from "node:path";

function stripYamlComment(value) {
  const hashIndex = value.indexOf("#");
  if (hashIndex === -1) return value.trim();
  return value.slice(0, hashIndex).trim();
}

function isLocalAction(ref) {
  const trimmed = ref.trim();
  return (
    trimmed.startsWith("./") ||
    trimmed.startsWith(".github/") ||
    trimmed.startsWith("docker://")
  );
}

function isPinnedSha(ref) {
  return /^[0-9a-f]{40}$/.test(ref);
}

export function checkWorkflowText({ filePath, text }) {
  const violations = [];
  const lines = text.split(/\r?\n/);

  let hasTopLevelPermissions = false;
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Only enforce top-level permissions (col 0) so we don't trip on job-level overrides.
    if (rawLine.startsWith("permissions:")) {
      hasTopLevelPermissions = true;
      const permissionValue = stripYamlComment(rawLine.slice("permissions:".length)).trim();
      if (permissionValue === "write-all") {
        violations.push({
          filePath,
          line: i + 1,
          message: "Top-level permissions must not be write-all.",
        });
      }
    }

    const usesMatch = rawLine.match(/^\s*(?:-\s*)?uses:\s*(.+)\s*$/);
    if (!usesMatch) continue;

    const usesValue = stripYamlComment(usesMatch[1]);
    if (!usesValue) continue;
    if (isLocalAction(usesValue)) continue;

    const atIndex = usesValue.lastIndexOf("@");
    if (atIndex === -1) {
      violations.push({
        filePath,
        line: i + 1,
        message: `Action reference must be pinned with @<sha>: "${usesValue}".`,
      });
      continue;
    }

    const ref = usesValue.slice(atIndex + 1).trim();
    if (!isPinnedSha(ref)) {
      violations.push({
        filePath,
        line: i + 1,
        message: `Action reference must be pinned to a 40-char SHA (found "${ref}"): "${usesValue}".`,
      });
    }
  }

  if (!hasTopLevelPermissions) {
    violations.push({
      filePath,
      line: 1,
      message:
        "Workflow must define top-level permissions (explicit least-privilege).",
    });
  }

  return violations;
}

export function formatViolations(violations, { cwd = process.cwd() } = {}) {
  if (!violations.length) return "";
  return violations
    .map((violation) => {
      const rel = path.relative(cwd, violation.filePath);
      return `${rel}:${violation.line}: ${violation.message}`;
    })
    .join("\n");
}
