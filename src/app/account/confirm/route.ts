import { NextResponse } from "next/server";
import { authClient } from "@/lib/video/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const client = await authClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const result = code ? await client.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "email" || type === "recovery") ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
    : { error: true };
  const next = url.searchParams.get("next") === "/account/reset" || type === "recovery" ? "/account/reset" : "/";
  return NextResponse.redirect(new URL(result.error ? "/?account=expired" : next, url.origin));
}
