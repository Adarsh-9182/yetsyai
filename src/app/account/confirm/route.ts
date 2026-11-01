import { NextResponse } from "next/server";
import { authClient } from "@/lib/video/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") === "/account/reset" || type === "recovery" ? "/account/reset" : "/";
  try {
    const client = await authClient();
    const result = code ? await client.auth.exchangeCodeForSession(code)
      : tokenHash && (type === "email" || type === "recovery") ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: true };
    const response = NextResponse.redirect(new URL(result.error ? "/?account=expired" : next, url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/?account=expired", url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
