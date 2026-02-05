import { NextResponse } from "next/server";
import { answerWithProvider } from "@/lib/providers";
import type {
  AnswerMode,
  SourceMode,
  Attachment,
} from "@/lib/types/answer";

const MODES: AnswerMode[] = ["quick", "research", "learn"];
const SOURCES: SourceMode[] = ["web", "none"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      mode?: AnswerMode;
      sources?: SourceMode;
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

    if (!question) {
      return NextResponse.json(
        { error: "Missing question" },
        { status: 400 }
      );
    }

    const response = await answerWithProvider(
      question,
      mode,
      sources,
      body.attachments ?? [],
      body.spaceInstructions,
      { id: body.spaceId, name: body.spaceName }
    );
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
