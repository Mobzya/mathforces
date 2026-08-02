export async function readRequestBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<{ bytes: Uint8Array; exceeded: false } | { bytes?: never; exceeded: true }> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { exceeded: true };
  }

  if (!request.body) {
    return { bytes: new Uint8Array(), exceeded: false };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("REQUEST_BODY_TOO_LARGE").catch(() => undefined);
        return { exceeded: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, exceeded: false };
}
