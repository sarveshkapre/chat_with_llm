import { spawn } from "node:child_process";

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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
