import { answerWithMock } from "@/lib/providers/mock";
import type {
  AnswerMode,
  SourceMode,
  Attachment,
  AnswerResponse,
} from "@/lib/types/answer";
import {
  extractCitationsFromOutput,
  extractTextFromOutput,
} from "@/lib/citations";
import OpenAI from "openai";

const MODES: AnswerMode[] = ["quick", "research", "learn"];
const SOURCES: SourceMode[] = ["web", "none"];

const MODE_INSTRUCTIONS: Record<AnswerMode, string> = {
  quick:
    "Answer directly in 3-6 short paragraphs. Include inline citations where possible.",
  research:
    "Write a structured report with headings, key takeaways, and citations. Be thorough.",
  learn:
    "Teach step-by-step with short checkpoints. Ask rhetorical questions and include citations.",
};

const SOURCE_INSTRUCTIONS: Record<SourceMode, string> = {
  web: "Use web sources when needed and provide citations.",
  none:
    "Do not browse the web or use external sources. Answer from general knowledge and say when uncertain.",
};

function sanitizeAttachments(attachments: Attachment[]) {
  return attachments.map((attachment) => ({
    ...attachment,
    text: null,
  }));
}

function formatAttachments(attachments: Attachment[]) {
  if (!attachments.length) return "";

  const usable = attachments
    .filter((attachment) => attachment.text && !attachment.error)
    .slice(0, 5);

  if (!usable.length) return "";

  const blocks = usable.map((attachment) => {
    const content = attachment.text?.slice(0, 4000) ?? "";
    return `Attachment: ${attachment.name}\n${content}`;
  });

  return `\n\nContext from attached files:\n${blocks.join("\n\n")}`;
}

function formatConversationContext(context?: string) {
  const trimmed = context?.trim();
  if (!trimmed) return "";
  return `\n\nConversation context:\n${trimmed.slice(0, 6000)}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question?: string;
    mode?: AnswerMode;
    sources?: SourceMode;
    model?: string;
    context?: string;
    attachments?: Attachment[];
    spaceInstructions?: string;
    spaceId?: string;
    spaceName?: string;
  };

  const question = body.question?.trim() ?? "";
  const mode = MODES.includes(body.mode ?? "quick")
    ? (body.mode as AnswerMode)
    : "quick";
  const sources = SOURCES.includes(body.sources ?? "web")
    ? (body.sources as SourceMode)
    : "web";
  const attachments = body.attachments ?? [];

  if (!question) {
    return new Response(JSON.stringify({ error: "Missing question" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const provider = process.env.PROVIDER ?? "auto";
  const openaiKey = process.env.OPENAI_API_KEY;
  const mockDelayMs = Number(process.env.MOCK_STREAM_DELAY_MS ?? "15") || 0;

  const stream = new ReadableStream({
    start: async (controller) => {
      const write = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        if (provider === "mock" || !openaiKey) {
          const response = await answerWithMock(
            question,
            mode,
            sources,
            body.model?.trim() || undefined,
            body.context?.trim() || undefined,
            attachments,
            body.spaceInstructions,
            { id: body.spaceId, name: body.spaceName }
          );

          const words = response.answer.split(" ");
          for (const word of words) {
            write({ type: "delta", text: `${word} ` });
            if (mockDelayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, mockDelayMs));
            }
          }

          const sanitized: AnswerResponse = {
            ...response,
            attachments: sanitizeAttachments(response.attachments),
          };

          write({ type: "done", payload: sanitized });
          controller.close();
          return;
        }

        const client = new OpenAI({
          apiKey: openaiKey,
          baseURL: process.env.OPENAI_BASE_URL || undefined,
        });
        const model = body.model?.trim() || process.env.OPENAI_MODEL || "gpt-4.1";

        const tools =
          sources === "web" ? [{ type: "web_search_preview" as const }] : [];

        const instructions = [
          MODE_INSTRUCTIONS[mode],
          SOURCE_INSTRUCTIONS[sources],
          body.spaceInstructions ?? "",
        ]
          .filter(Boolean)
          .join(" ");

        const streamResponse = await client.responses.create({
          model,
          input: `${question}${formatConversationContext(body.context)}${formatAttachments(attachments)}`,
          instructions,
          tools,
          tool_choice: tools.length ? "auto" : "none",
          stream: true,
        });

        let answerText = "";
        let finalOutput: Array<Record<string, unknown>> = [];
        const startedAt = Date.now();

        for await (const event of streamResponse) {
          if (event.type === "response.output_text.delta") {
            const delta = event.delta ?? "";
            answerText += delta;
            write({ type: "delta", text: delta });
          }

          if (event.type === "response.completed") {
            const responseOutput = (event.response as { output?: unknown })
              .output;
            finalOutput = Array.isArray(responseOutput)
              ? (responseOutput as Array<Record<string, unknown>>)
              : [];
          }
        }

        const extracted = finalOutput.length
          ? extractTextFromOutput(finalOutput)
          : answerText.trim();
        const citations = sources === "web"
          ? extractCitationsFromOutput(finalOutput)
          : [];

        const payload: AnswerResponse = {
          id: crypto.randomUUID(),
          question,
          answer: extracted || answerText || "No answer returned.",
          mode,
          sources,
          model,
          createdAt: new Date().toISOString(),
          citations,
          attachments: sanitizeAttachments(attachments),
          spaceId: body.spaceId ?? null,
          spaceName: body.spaceName ?? null,
          provider: "openai",
          latencyMs: Date.now() - startedAt,
        };

        write({ type: "done", payload });
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        write({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
