import path from "node:path";

const SMOKE_ROUTE_ROOT = "/src/app/smoke-search/";
const SMOKE_PAGE_SUFFIX = "/page.tsx";

function normalizePathSeparators(filePath) {
  return filePath.replaceAll("\\", "/");
}

export function routeFromSmokeFixtureFile(filePath) {
  const normalizedPath = normalizePathSeparators(filePath);
  const routeIndex = normalizedPath.lastIndexOf(SMOKE_ROUTE_ROOT);
  if (routeIndex === -1 || !normalizedPath.endsWith(SMOKE_PAGE_SUFFIX)) {
    return null;
  }
  const relativeRoute = normalizedPath.slice(
    routeIndex + SMOKE_ROUTE_ROOT.length,
    -SMOKE_PAGE_SUFFIX.length
  );
  return relativeRoute ? `/smoke-search/${relativeRoute}` : "/smoke-search";
}

export function getExpectedSmokeFixtureRoutes(fixtureFiles) {
  return [...new Set(fixtureFiles.map(routeFromSmokeFixtureFile).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function checkSmokeFixtureCoverage({
  fixtureFiles,
  smokeScriptPath,
  smokeScriptText,
}) {
  const violations = [];
  const expectedRoutes = getExpectedSmokeFixtureRoutes(fixtureFiles);
  if (!expectedRoutes.length) {
    violations.push({
      filePath: smokeScriptPath,
      line: 1,
      message: "No smoke fixture routes found under src/app/smoke-search.",
    });
    return violations;
  }

  expectedRoutes.forEach((route) => {
    if (smokeScriptText.includes(route)) return;
    violations.push({
      filePath: smokeScriptPath,
      line: 1,
      message: `Missing smoke assertion coverage for route "${route}".`,
    });
  });

  return violations;
}

export function formatSmokeFixtureViolations(
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
