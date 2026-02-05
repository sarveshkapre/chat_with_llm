import { NextResponse } from "next/server";
import { answerWithProvider } from "@/lib/providers";
import type { AnswerMode } from "@/lib/types/answer";

const MODES: AnswerMode[] = ["quick", "research", "learn"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string;
      mode?: AnswerMode;
    };

    const question = body.question?.trim() ?? "";
    const mode = MODES.includes(body.mode ?? "quick")
      ? (body.mode as AnswerMode)
      : "quick";

    if (!question) {
      return NextResponse.json(
        { error: "Missing question" },
        { status: 400 }
      );
    }

    const response = await answerWithProvider(question, mode);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
