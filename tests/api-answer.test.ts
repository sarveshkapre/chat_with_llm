import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as postAnswer } from "@/app/api/answer/route";

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

describe("/api/answer (route handler)", () => {
  const envSnapshot = snapshotEnv();

  beforeEach(() => {
    process.env.PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it("returns 400 for missing question", async () => {
    const request = new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "   " }),
    });

    const response = await postAnswer(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing question" });
  });

  it("defaults invalid mode/sources to quick/web", async () => {
    const request = new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What is this?",
        mode: "bogus",
        sources: "bogus",
      }),
    });

    const response = await postAnswer(request);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.mode).toBe("quick");
    expect(payload.sources).toBe("web");
    expect(payload.provider).toBe("mock");
    expect(typeof payload.answer).toBe("string");
  });

  it("returns citations when sources=web (mock provider)", async () => {
    const request = new Request("http://localhost/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "What is Signal Search?",
        mode: "quick",
        sources: "web",
        attachments: [],
      }),
    });

    const response = await postAnswer(request);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { citations?: unknown };
    expect(Array.isArray(payload.citations)).toBe(true);
    expect((payload.citations as unknown[]).length).toBeGreaterThan(0);
  });
});

