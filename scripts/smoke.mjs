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

async function readNdjsonUntilDone(response) {
  if (!response.body) throw new Error("Missing response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];

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
        const message =
          error instanceof Error ? error.message : "Unknown JSON parse error";
        throw new Error(`Failed to parse NDJSON event (${message}): ${trimmed}`);
      }
      events.push(event);
      if (event.type === "done") {
        return events;
      }
      if (event.type === "error") {
        throw new Error(`Stream returned error: ${event.message ?? "unknown"}`);
      }
    }
  }

  if (buffer.trim()) {
    throw new Error(`Stream ended with trailing partial line: ${buffer.trim()}`);
  }

  return events;
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
    const events = await readNdjsonUntilDone(streamResponse);
    const done = events.find((event) => event.type === "done");
    if (!done?.payload?.answer) {
      throw new Error("Streaming API did not produce a done payload with answer");
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
