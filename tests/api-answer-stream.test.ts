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
  const events: Array<{ type?: string; [key: string]: unknown }> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed) as { type?: string; [key: string]: unknown };
      events.push(parsed);
      if (parsed.type === "done") return { events, trailing: buffer };
      if (parsed.type === "error") {
        throw new Error(
          `Stream returned error: ${(parsed as { message?: unknown }).message ?? "unknown"}`
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
    expect(done).toBeTruthy();
    const payload = (done as { payload?: unknown }).payload;
    expect(payload && typeof payload === "object").toBe(true);
    const payloadObj = payload as Record<string, unknown>;
    expect(typeof payloadObj.answer).toBe("string");
    expect(payloadObj.provider).toBe("mock");

    // Attachments are returned with text stripped for UI safety.
    expect(Array.isArray(payloadObj.attachments)).toBe(true);
    const attachments = payloadObj.attachments as unknown[];
    const first = attachments[0] as Record<string, unknown> | undefined;
    expect(first?.text).toBeNull();
  });
});
