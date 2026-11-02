import { ProviderError } from "./fal";

export type SocialProvider = "google" | "github";
export type SocialProviders = Record<SocialProvider, boolean>;

function projectUrl() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !local) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    return url;
  } catch { throw new ProviderError("Social sign-in is currently unavailable.", 503); }
}

export async function socialProviders(): Promise<SocialProviders> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { google: false, github: false };
  try {
    const response = await fetch(new URL("/auth/v1/settings", projectUrl()), { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16384) throw new Error(); chunks.push(value); } }
    finally { await reader.cancel().catch(() => {}); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!data.external || typeof data.external !== "object" || Array.isArray(data.external)) throw new Error();
    return { google: data.external.google === true, github: data.external.github === true };
  } catch { throw new ProviderError("Couldn't check social sign-in. Please retry, or use email sign-in.", 503); }
}

export function checkedOAuthUrl(value: string, provider: SocialProvider, redirectTo: string) {
  try {
    const url = new URL(value);
    if (url.origin !== projectUrl().origin || url.pathname !== "/auth/v1/authorize" || url.username || url.password || url.hash
      || url.searchParams.get("provider") !== provider || url.searchParams.get("redirect_to") !== redirectTo
      || url.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256"
      || !/^[A-Za-z0-9_-]{43,128}$/.test(url.searchParams.get("code_challenge") || "")) throw new Error();
    return url.href;
  } catch { throw new ProviderError("Couldn't start secure sign-in. Please retry.", 503); }
}
