export type NdjsonChunkDecodeResult<T> = {
  events: T[];
  trailingBuffer: string;
  malformedLineCount: number;
};

export function decodeNdjsonChunk<T>(
  chunkText: string,
  previousBuffer: string
): NdjsonChunkDecodeResult<T> {
  const events: T[] = [];
  let malformedLineCount = 0;
  const lines = `${previousBuffer}${chunkText}`.split("\n");
  const trailingBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as T);
    } catch {
      malformedLineCount += 1;
    }
  }

  return { events, trailingBuffer, malformedLineCount };
}

export function hasNdjsonTrailingData(buffer: string): boolean {
  return buffer.trim().length > 0;
}
