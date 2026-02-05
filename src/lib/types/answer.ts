export type AnswerMode = "quick" | "research" | "learn";
export type SourceMode = "web" | "none";

export type Citation = {
  title: string;
  url: string;
};

export type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  text?: string | null;
  error?: string | null;
};

export type Answer = {
  id: string;
  question: string;
  answer: string;
  mode: AnswerMode;
  sources: SourceMode;
  createdAt: string;
  citations: Citation[];
  attachments: Attachment[];
  spaceId?: string | null;
  spaceName?: string | null;
};

export type AnswerRequest = {
  question: string;
  mode: AnswerMode;
  sources: SourceMode;
  attachments?: Attachment[];
  spaceInstructions?: string;
  spaceId?: string;
  spaceName?: string;
};

export type AnswerResponse = Answer & {
  provider: string;
  latencyMs: number;
};
