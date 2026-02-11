import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function pickArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function parseResults(output) {
  const lines = output.split(/\r?\n/);
  const parsed = [];

  for (const line of lines) {
    const markerIndex = line.indexOf("PERF_RESULT ");
    if (markerIndex === -1) continue;
    const jsonText = line.slice(markerIndex + "PERF_RESULT ".length).trim();
    if (!jsonText) continue;
    try {
      parsed.push(JSON.parse(jsonText));
    } catch {
      // Ignore malformed lines from noisy logs.
    }
  }

  return parsed;
}

function parseThresholdSpec(rawValue, label) {
  const map = new Map();
  if (!rawValue) return map;
  const segments = rawValue
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const [sizeText, thresholdText] = segment.split(":").map((value) => value.trim());
    const size = Number(sizeText);
    const threshold = Number(thresholdText);
    if (
      !Number.isFinite(size) ||
      !Number.isFinite(threshold) ||
      size <= 0 ||
      threshold <= 0
    ) {
      throw new Error(
        `Invalid ${label} segment "${segment}". Use format like "1000:1.5,5000:2.0".`
      );
    }
    map.set(size, threshold);
  }

  return map;
}

function assertPerfThresholds(results, thresholds, key, label) {
  if (!thresholds.size) return;
  const failures = [];
  for (const result of results) {
    const limit = thresholds.get(result.totalItems);
    if (!Number.isFinite(limit)) continue;
    const value = result[key];
    if (!Number.isFinite(value)) {
      failures.push(
        `size=${result.totalItems} ${label}=NaN limit=${limit.toFixed(2)}ms`
      );
      continue;
    }
    if (value > limit) {
      failures.push(
        `size=${result.totalItems} ${label}=${value.toFixed(2)}ms limit=${limit.toFixed(2)}ms`
      );
    }
  }
  if (failures.length) {
    throw new Error(
      `${label} threshold check failed:\n- ${failures.join("\n- ")}`
    );
  }
}

function printSummary(results) {
  if (!results.length) {
    throw new Error("No PERF_RESULT rows were found in benchmark output.");
  }

  const rows = results.map((result) => ({
    totalItems: String(result.totalItems).padStart(5, " "),
    median: `${result.medianMs.toFixed(2)}ms`.padStart(10, " "),
    p95: `${result.p95Ms.toFixed(2)}ms`.padStart(10, " "),
    mean: `${result.meanMs.toFixed(2)}ms`.padStart(10, " "),
    max: `${result.maxMs.toFixed(2)}ms`.padStart(10, " "),
    checksum: String(result.checksum).padStart(7, " "),
  }));

  console.log("\nUnified Search perf summary");
  console.log("size   median       p95      mean       max  checksum");
  for (const row of rows) {
    console.log(
      `${row.totalItems} ${row.median} ${row.p95} ${row.mean} ${row.max} ${row.checksum}`
    );
  }
}

async function main() {
  const warmup = pickArg("--warmup") ?? process.env.SEARCH_PERF_WARMUP ?? "3";
  const iterations =
    pickArg("--iterations") ?? process.env.SEARCH_PERF_ITERATIONS ?? "12";
  const query =
    pickArg("--query") ??
    process.env.SEARCH_PERF_QUERY ??
    "incident research workflow citation keyboard";
  const jsonOutputPath =
    pickArg("--json") ?? process.env.SEARCH_PERF_JSON_OUTPUT ?? "";
  const medianThresholds = parseThresholdSpec(
    pickArg("--max-median-ms") ?? process.env.SEARCH_PERF_MAX_MEDIAN_MS ?? "",
    "--max-median-ms"
  );
  const p95Thresholds = parseThresholdSpec(
    pickArg("--max-p95-ms") ?? process.env.SEARCH_PERF_MAX_P95_MS ?? "",
    "--max-p95-ms"
  );

  const env = {
    ...process.env,
    SEARCH_PERF_WARMUP: String(warmup),
    SEARCH_PERF_ITERATIONS: String(iterations),
    SEARCH_PERF_QUERY: query,
  };

  const child = spawn(
    npmBin(),
    [
      "exec",
      "--",
      "vitest",
      "run",
      "--config",
      "vitest.perf.config.ts",
      "tests/search-perf.bench.ts",
      "--reporter=verbose",
    ],
    {
      env,
      stdio: ["inherit", "pipe", "pipe"],
    }
  );

  let output = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    process.exit(Number(exitCode) || 1);
  }

  const results = parseResults(output);
  printSummary(results);
  assertPerfThresholds(results, medianThresholds, "medianMs", "medianMs");
  assertPerfThresholds(results, p95Thresholds, "p95Ms", "p95Ms");

  if (jsonOutputPath) {
    const payload = {
      generatedAt: new Date().toISOString(),
      warmup: Number(warmup),
      iterations: Number(iterations),
      query,
      results,
    };
    await mkdir(dirname(jsonOutputPath), { recursive: true });
    await writeFile(`${jsonOutputPath}`, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote perf JSON artifact: ${jsonOutputPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
