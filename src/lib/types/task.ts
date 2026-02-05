import type { AnswerMode, SourceMode } from "@/lib/types/answer";

export type TaskCadence =
  | "once"
  | "daily"
  | "weekday"
  | "weekly"
  | "monthly"
  | "yearly";

export type Task = {
  id: string;
  name: string;
  prompt: string;
  cadence: TaskCadence;
  time: string;
  mode: AnswerMode;
  sources: SourceMode;
  createdAt: string;
  nextRun: string;
  lastRun?: string | null;
  lastThreadId?: string | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  spaceId?: string | null;
  spaceName?: string | null;
};
