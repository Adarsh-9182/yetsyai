import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient } from "@/lib/video/auth";
import { apiError, boundedJson } from "@/lib/video/http";
import { isSameOrigin } from "@/lib/video/session";
import { ProviderError } from "@/lib/video/fal";
import { checkedOAuthUrl, socialProviders } from "@/lib/video/oauth";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function GET() {
  try { return NextResponse.json({ providers: await socialProviders() }, { headers }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Start sign-in from your studio.", 403);
    const { provider } = z.object({ provider: z.enum(["google", "github"]) }).parse(await boundedJson(request, 1024));
    const available = await socialProviders();
    if (!available[provider]) throw new ProviderError(`${provider === "google" ? "Google" : "GitHub"} sign-in is currently unavailable. Please use email sign-in.`, 503);
    const redirectTo = `${new URL(request.url).origin}/account/confirm`;
    const client = await authClient();
    const { data, error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true, ...(provider === "github" ? { scopes: "user:email" } : {}) } });
    if (error || !data.url) throw new ProviderError("Couldn't start social sign-in. Please retry.", 503);
    return NextResponse.json({ url: checkedOAuthUrl(data.url, provider, redirectTo) }, { headers });
  } catch (error) { return apiError(error); }
}
