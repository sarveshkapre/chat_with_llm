import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as postAnswerStream } from "@/app/api/answer/stream/route";

function snapshotEnv() {
  return { ...process.env };
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }
}

async function readNdjsonUntilDone(response: Response) {
  if (!response.body) throw new Error("Missing response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      events.push(JSON.parse(trimmed));
      if (events.at(-1)?.type === "done") return { events, trailing: buffer };
      if (events.at(-1)?.type === "error") {
        throw new Error(
          `Stream returned error: ${events.at(-1)?.message ?? "unknown"}`
        );
      }
    }
  }

  return { events, trailing: buffer };
}

describe("/api/answer/stream (route handler)", () => {
  const envSnapshot = snapshotEnv();

  beforeEach(() => {
    process.env.PROVIDER = "mock";
    process.env.MOCK_STREAM_DELAY_MS = "0";
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it("returns 400 for missing question", async () => {
    const request = new Request("http://localhost/api/answer/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "" }),
    });

    const response = await postAnswerStream(request);
    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Missing question" });
  });

  it("streams NDJSON deltas and a final done payload (mock provider)", async () => {
    const request = new Request("http://localhost/api/answer/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What is Signal Search?",
        mode: "quick",
        sources: "web",
        attachments: [
          {
            id: "a1",
            name: "note.txt",
            text: "hello",
            error: null,
          },
        ],
      }),
    });

    const response = await postAnswerStream(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");

    const { events, trailing } = await readNdjsonUntilDone(response);
    expect(trailing.trim()).toBe("");

    const deltaCount = events.filter((event) => event.type === "delta").length;
    expect(deltaCount).toBeGreaterThan(0);

    const done = events.find((event) => event.type === "done");
    expect(done?.payload?.answer).toBeTruthy();
    expect(done?.payload?.provider).toBe("mock");

    // Attachments are returned with text stripped for UI safety.
    expect(done?.payload?.attachments?.[0]?.text).toBeNull();
  });
});

