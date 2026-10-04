import { NextResponse } from "next/server";
import { ProviderError } from "./fal";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  const requestId = randomUUID();
  const headers = { "Cache-Control": "private, no-store", "X-Request-Id": requestId };
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message, requestId }, { status: error.status, headers });
  if (error instanceof ZodError) return NextResponse.json({ error: "Check the request details and try again.", requestId }, { status: 400, headers });
  // Correlate failures without recording prompts, credentials or upstream bodies.
  console.error(JSON.stringify({ event: "studio.request_failed", requestId, kind: error instanceof Error ? error.name : "Unknown" }));
  return NextResponse.json({ error: "The studio couldn't complete this request. Please retry shortly.", requestId }, { status: 503, headers });
}

export async function boundedJson(request: Request, limit = 4 * 1024 * 1024 + 16384, sizeMessage = "Your reference image is too large. Use a JPG or PNG under 3 MB.") {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ProviderError("Send a JSON generation request.", 415);
  if (Number(request.headers.get("content-length")) > limit) throw new ProviderError(sizeMessage, 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ProviderError("The request body is empty.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new ProviderError(sizeMessage, 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ProviderError("The generation request isn't valid JSON.", 400); }
}
