import type { AnswerMode, SourceMode } from "@/lib/types/answer";

export type TaskCadence = "daily" | "weekly" | "weekday";

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
  dayOfWeek?: number | null;
  spaceId?: string | null;
  spaceName?: string | null;
};
