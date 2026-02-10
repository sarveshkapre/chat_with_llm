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
      const event = JSON.parse(trimmed);
      events.push(event);
      if (event.type === "done") {
        return events;
      }
      if (event.type === "error") {
        throw new Error(`Stream returned error: ${event.message ?? "unknown"}`);
      }
    }
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
  };

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
