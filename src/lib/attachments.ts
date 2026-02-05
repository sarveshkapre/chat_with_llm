import type { Attachment } from "@/lib/types/answer";

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];

export function canReadAsText(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  return TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

export async function readFileAsText(file: File): Promise<string> {
  return await file.text();
}

export function stripAttachmentText(attachment: Attachment): Attachment {
  if (!attachment.text) return attachment;
  return { ...attachment, text: null };
}
