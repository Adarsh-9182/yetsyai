import { NextResponse } from "next/server";
import { ProviderError } from "./fal";

export function apiError(error: unknown) {
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Studio request failed", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "The studio couldn't complete this request. Check the database setup and try again." }, { status: 503 });
}

export async function boundedJson(request: Request) {
  const limit = 4 * 1024 * 1024 + 16384;
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ProviderError("Send a JSON generation request.", 415);
  if (Number(request.headers.get("content-length")) > limit) throw new ProviderError("Your reference image is too large. Use a JPG or PNG under 3 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ProviderError("The request body is empty.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new ProviderError("Your reference image is too large. Use a JPG or PNG under 3 MB.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ProviderError("The generation request isn't valid JSON.", 400); }
}
