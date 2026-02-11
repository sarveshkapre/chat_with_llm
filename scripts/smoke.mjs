import { spawn } from "node:child_process";
import net from "node:net";

function pickArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function exec(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function spawnServer(command, args, options) {
  const child = spawn(command, args, {
    stdio: "inherit",
    ...options,
  });
  return child;
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to pick a free port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOk(url, timeoutMs) {
  const started = Date.now();
  while (true) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) return;
    } catch {
      // keep trying
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await sleep(250);
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return { response, text };
}

async function readNdjsonUntilDone(response, options = {}) {
  if (!response.body) throw new Error("Missing response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  let malformedLineCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event;
      try {
        event = JSON.parse(trimmed);
      } catch (error) {
        if (options.allowMalformedLines) {
          malformedLineCount += 1;
          continue;
        }
        const message =
          error instanceof Error ? error.message : "Unknown JSON parse error";
        throw new Error(`Failed to parse NDJSON event (${message}): ${trimmed}`);
      }
      events.push(event);
      if (event.type === "done") {
        return { events, malformedLineCount };
      }
      if (event.type === "error") {
        throw new Error(`Stream returned error: ${event.message ?? "unknown"}`);
      }
    }
  }

  if (buffer.trim()) {
    throw new Error(`Stream ended with trailing partial line: ${buffer.trim()}`);
  }

  return { events, malformedLineCount };
}

function parseNumericAttr(tag, attrName) {
  const match = tag.match(new RegExp(`${attrName}="(\\d+)"`));
  if (!match) return null;
  return Number(match[1]);
}

function parseDiagnosticsRowsFromHtml(html) {
  const rowMatches = [...html.matchAll(/<div[^>]*data-diagnostics-row="[^"]+"[^>]*>/g)];
  return rowMatches
    .map((match) => {
      const tag = match[0];
      const typeMatch = tag.match(/data-diagnostics-row="([^"]+)"/);
      if (!typeMatch) return null;
      const loaded = parseNumericAttr(tag, "data-row-loaded");
      const matched = parseNumericAttr(tag, "data-row-matched");
      const visible = parseNumericAttr(tag, "data-row-visible");
      if (
        !Number.isFinite(loaded) ||
        !Number.isFinite(matched) ||
        !Number.isFinite(visible)
      ) {
        return null;
      }
      return {
        type: typeMatch[1],
        loaded,
        matched,
        visible,
      };
    })
    .filter(Boolean);
}

function parseDiagnosticsTotalsFromHtml(html) {
  const totalsMatch = html.match(
    /<p[^>]*data-diagnostics-totals="true"[^>]*>/
  );
  if (!totalsMatch) return null;
  const tag = totalsMatch[0];
  const loaded = parseNumericAttr(tag, "data-total-loaded");
  const matched = parseNumericAttr(tag, "data-total-matched");
  const visible = parseNumericAttr(tag, "data-total-visible");
  if (
    !Number.isFinite(loaded) ||
    !Number.isFinite(matched) ||
    !Number.isFinite(visible)
  ) {
    return null;
  }
  return { loaded, matched, visible };
}

function stripScriptsFromHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

async function main() {
  const provider = pickArg("--provider") ?? process.env.SMOKE_PROVIDER ?? "mock";
  const port =
    Number(pickArg("--port")) || (await getFreePort());
  const skipBuild = hasFlag("--skip-build") || process.env.SMOKE_SKIP_BUILD === "1";

  const env = {
    ...process.env,
    PROVIDER: provider,
    PORT: String(port),
    SMOKE_ENABLE_SEARCH_FIXTURE: "1",
    SMOKE_ENABLE_MALFORMED_NDJSON_FIXTURE: "1",
  };
  if (provider === "mock" && !env.MOCK_STREAM_DELAY_MS) {
    env.MOCK_STREAM_DELAY_MS = "0";
  }

  if (!skipBuild) {
    await exec(npmBin(), ["run", "build"], { env });
  }

  const server = spawnServer(npmBin(), ["run", "start"], { env });
  let killed = false;
  const kill = () => {
    if (killed) return;
    killed = true;
    server.kill("SIGTERM");
    setTimeout(() => server.kill("SIGKILL"), 5000).unref();
  };

  process.on("SIGINT", () => {
    kill();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    kill();
    process.exit(143);
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForOk(`${baseUrl}/`, 45_000);

    const html = await fetch(`${baseUrl}/`).then((r) => r.text());
    if (!html.includes("Signal Search")) {
      throw new Error("Home page did not contain expected title text");
    }

    const searchHtml = await fetch(`${baseUrl}/search`).then((r) => r.text());
    if (!searchHtml.includes("Unified Search") || !searchHtml.includes("Signal Search")) {
      throw new Error("/search page did not contain expected Unified Search content");
    }

    const operatorQuery = encodeURIComponent(
      "type:threads is:pinned has:citation tag:incident -has:note"
    );
    const searchOperatorResponse = await fetch(
      `${baseUrl}/search?q=${operatorQuery}`,
      { redirect: "manual" }
    );
    if (!searchOperatorResponse.ok) {
      throw new Error(`/search operator query path returned ${searchOperatorResponse.status}`);
    }
    const searchOperatorHtml = await searchOperatorResponse.text();
    if (
      !searchOperatorHtml.includes("Unified Search") ||
      !searchOperatorHtml.includes("is:favorite|pinned|archived")
    ) {
      throw new Error(
        "/search operator query path did not contain expected operator help content"
      );
    }

    const smokeSearchResponse = await fetch(`${baseUrl}/smoke-search`, {
      redirect: "manual",
    });
    if (!smokeSearchResponse.ok) {
      throw new Error(
        `/smoke-search fixture path returned ${smokeSearchResponse.status}`
      );
    }
    const smokeSearchHtml = await smokeSearchResponse.text();
    if (
      !smokeSearchHtml.includes("Smoke Incident Thread") ||
      smokeSearchHtml.includes("No matching threads.")
    ) {
      throw new Error(
        "/smoke-search did not render expected operator-filtered fixture results"
      );
    }

    const smokeSavedRoundtripResponse = await fetch(
      `${baseUrl}/smoke-search/saved-roundtrip`,
      { redirect: "manual" }
    );
    if (!smokeSavedRoundtripResponse.ok) {
      throw new Error(
        `/smoke-search/saved-roundtrip fixture path returned ${smokeSavedRoundtripResponse.status}`
      );
    }
    const smokeSavedRoundtripHtml = await smokeSavedRoundtripResponse.text();
    if (
      !smokeSavedRoundtripHtml.includes("Roundtrip task digest") ||
      !smokeSavedRoundtripHtml.includes("Weekly incident digest") ||
      !/verbatim:(?:<!-- -->)?true/.test(smokeSavedRoundtripHtml)
    ) {
      throw new Error(
        "/smoke-search/saved-roundtrip did not render expected saved-search fixture content"
      );
    }
    if (
      !/<button[^>]*border-signal-accent[^>]*>Tasks only<\/button>/.test(
        smokeSavedRoundtripHtml
      ) ||
      !/<option[^>]*value="oldest"[^>]*selected/.test(smokeSavedRoundtripHtml) ||
      !/<option[^>]*value="7d"[^>]*selected/.test(smokeSavedRoundtripHtml) ||
      !/<option[^>]*value="10"[^>]*selected/.test(smokeSavedRoundtripHtml) ||
      !/type="checkbox"[^>]*checked/.test(smokeSavedRoundtripHtml)
    ) {
      throw new Error(
        "/smoke-search/saved-roundtrip controls did not preserve saved-search filter/sort/timeline/limit/verbatim state"
      );
    }

    const smokeStaleSelectionResponse = await fetch(
      `${baseUrl}/smoke-search/stale-selection`,
      { redirect: "manual" }
    );
    if (!smokeStaleSelectionResponse.ok) {
      throw new Error(
        `/smoke-search/stale-selection fixture path returned ${smokeStaleSelectionResponse.status}`
      );
    }
    const smokeStaleSelectionHtml = await smokeStaleSelectionResponse.text();
    if (!/Prune stale\s*\((?:<!-- -->)?1(?:<!-- -->)?\)/.test(smokeStaleSelectionHtml)) {
      throw new Error(
        "/smoke-search/stale-selection did not expose expected stale-selection recovery control"
      );
    }
    const diagnosticsRows = parseDiagnosticsRowsFromHtml(smokeStaleSelectionHtml);
    if (diagnosticsRows.length !== 5) {
      throw new Error(
        `/smoke-search/stale-selection expected 5 diagnostics rows, found ${diagnosticsRows.length}`
      );
    }
    const expectedTypes = new Set([
      "threads",
      "spaces",
      "collections",
      "files",
      "tasks",
    ]);
    diagnosticsRows.forEach((row) => {
      expectedTypes.delete(row.type);
      if (row.loaded < row.matched || row.matched < row.visible) {
        throw new Error(
          `/smoke-search/stale-selection diagnostics invariant failed for ${row.type}: loaded=${row.loaded} matched=${row.matched} visible=${row.visible}`
        );
      }
    });
    if (expectedTypes.size > 0) {
      throw new Error(
        `/smoke-search/stale-selection diagnostics rows missing expected types: ${[
          ...expectedTypes,
        ].join(", ")}`
      );
    }
    const diagnosticsTotals = parseDiagnosticsTotalsFromHtml(smokeStaleSelectionHtml);
    if (!diagnosticsTotals) {
      throw new Error(
        "/smoke-search/stale-selection diagnostics totals were missing from fixture output"
      );
    }
    if (
      diagnosticsTotals.loaded < diagnosticsTotals.matched ||
      diagnosticsTotals.matched < diagnosticsTotals.visible
    ) {
      throw new Error(
        `/smoke-search/stale-selection diagnostics totals invariant failed: loaded=${diagnosticsTotals.loaded} matched=${diagnosticsTotals.matched} visible=${diagnosticsTotals.visible}`
      );
    }
    const rowTotals = diagnosticsRows.reduce(
      (sum, row) => ({
        loaded: sum.loaded + row.loaded,
        matched: sum.matched + row.matched,
        visible: sum.visible + row.visible,
      }),
      { loaded: 0, matched: 0, visible: 0 }
    );
    if (
      diagnosticsTotals.loaded !== rowTotals.loaded ||
      diagnosticsTotals.matched !== rowTotals.matched ||
      diagnosticsTotals.visible !== rowTotals.visible
    ) {
      throw new Error(
        `/smoke-search/stale-selection diagnostics totals mismatch: totals=(${diagnosticsTotals.loaded},${diagnosticsTotals.matched},${diagnosticsTotals.visible}) rows=(${rowTotals.loaded},${rowTotals.matched},${rowTotals.visible})`
      );
    }

    const archiveOnlyResponse = await fetch(`${baseUrl}/smoke-search/archive-only`, {
      redirect: "manual",
    });
    if (!archiveOnlyResponse.ok) {
      throw new Error(
        `/smoke-search/archive-only fixture path returned ${archiveOnlyResponse.status}`
      );
    }
    const archiveOnlyHtml = stripScriptsFromHtml(await archiveOnlyResponse.text());
    if (
      !archiveOnlyHtml.includes("Smoke Archived Thread") ||
      archiveOnlyHtml.includes("Smoke Active Thread")
    ) {
      throw new Error(
        "/smoke-search/archive-only did not enforce expected is:archived filtering"
      );
    }

    const archiveExcludeResponse = await fetch(
      `${baseUrl}/smoke-search/archive-exclude`,
      { redirect: "manual" }
    );
    if (!archiveExcludeResponse.ok) {
      throw new Error(
        `/smoke-search/archive-exclude fixture path returned ${archiveExcludeResponse.status}`
      );
    }
    const archiveExcludeHtml = stripScriptsFromHtml(
      await archiveExcludeResponse.text()
    );
    if (
      !archiveExcludeHtml.includes("Smoke Active Thread") ||
      archiveExcludeHtml.includes("Smoke Archived Thread")
    ) {
      throw new Error(
        "/smoke-search/archive-exclude did not enforce expected -is:archived filtering"
      );
    }

    const answerBody = {
      question: "Smoke test: what is Signal Search?",
      mode: "quick",
      sources: "web",
      context: "",
      attachments: [],
    };

    const { response: apiResponse, text: apiText } = await postJson(
      `${baseUrl}/api/answer`,
      answerBody
    );
    if (!apiResponse.ok) {
      throw new Error(`/api/answer returned ${apiResponse.status}: ${apiText}`);
    }
    const apiJson = JSON.parse(apiText);
    if (!apiJson.answer || apiJson.provider !== provider) {
      throw new Error(`/api/answer returned unexpected payload: ${apiText}`);
    }

    const streamResponse = await fetch(`${baseUrl}/api/answer/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answerBody),
    });
    if (!streamResponse.ok) {
      throw new Error(
        `/api/answer/stream returned ${streamResponse.status}: ${await streamResponse.text()}`
      );
    }
    const { events } = await readNdjsonUntilDone(streamResponse);
    const done = events.find((event) => event.type === "done");
    if (!done?.payload?.answer) {
      throw new Error("Streaming API did not produce a done payload with answer");
    }

    const malformedFixtureResponse = await fetch(`${baseUrl}/api/answer/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...answerBody,
        debugInjectMalformedChunk: true,
      }),
    });
    if (!malformedFixtureResponse.ok) {
      throw new Error(
        `/api/answer/stream malformed fixture returned ${malformedFixtureResponse.status}: ${await malformedFixtureResponse.text()}`
      );
    }
    const malformedFixture = await readNdjsonUntilDone(malformedFixtureResponse, {
      allowMalformedLines: true,
    });
    if (malformedFixture.malformedLineCount < 1) {
      throw new Error(
        "Streaming malformed NDJSON fixture did not emit the expected corrupt line"
      );
    }
    const malformedDone = malformedFixture.events.find((event) => event.type === "done");
    if (!malformedDone?.payload?.answer) {
      throw new Error(
        "Streaming malformed NDJSON fixture did not complete with done payload"
      );
    }

    console.log(
      `Smoke OK: provider=${provider} port=${port} deltaEvents=${events.filter((e) => e.type === "delta").length}`
    );
  } finally {
    kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
