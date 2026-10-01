import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ProviderError } from "./fal";

export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function authClient() {
  if (!authConfigured()) throw new ProviderError("Account sign-in is being connected. Please try again later.", 503);
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => store.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" })),
    },
  });
}

export async function currentUser() {
  if (!authConfigured()) return null;
  const { data: { user } } = await (await authClient()).auth.getUser();
  return user;
}

export async function requireAccount() {
  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_GUEST_GENERATION === "true") return;
  if (!await currentUser()) throw new ProviderError("Sign in to create videos and save your library.", 401);
}
