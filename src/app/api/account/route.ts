import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient, authConfigured, currentUser } from "@/lib/video/auth";
import { apiError, boundedJson } from "@/lib/video/http";
import { isSameOrigin } from "@/lib/video/session";
import { ProviderError } from "@/lib/video/fal";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ configured: authConfigured(), user: user ? { email: user.email } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
const input = z.object({ action: z.enum(["signin", "signup", "signout", "reset", "update"]), email: z.string().email().max(254).optional(), password: z.string().min(10).max(128).optional() });
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Use your studio to manage your account.", 403);
    const data = input.parse(await boundedJson(request, 2048));
    const client = await authClient();
    if (data.action === "signout") {
      const { error } = await client.auth.signOut();
      if (error) throw new ProviderError("Couldn't sign out. Please retry.", 503);
      return NextResponse.json({ message: "Signed out." });
    }
    if (data.action === "update") {
      if (!await currentUser() || !data.password) throw new ProviderError("Open your password reset link and enter a password of at least 10 characters.", 401);
      const { error } = await client.auth.updateUser({ password: data.password });
      if (error) throw new ProviderError("Couldn't update your password. Request another reset email.", 400);
      return NextResponse.json({ message: "Password updated. You can return to your studio." });
    }
    if (!data.email) throw new ProviderError("Enter your email address.", 400);
    if (data.action === "reset") {
      // The reset page exchanges the one-time code before accepting a new password.
      const { error } = await client.auth.resetPasswordForEmail(data.email, { redirectTo: `${new URL(request.url).origin}/account/confirm?next=/account/reset` });
      if (error) throw new ProviderError("Couldn't send a reset email. Please try again later.", 429);
      return NextResponse.json({ message: "If this account exists, a reset link has been sent." });
    }
    if (!data.password) throw new ProviderError("Use a password with at least 10 characters.", 400);
    const result = data.action === "signup"
      ? await client.auth.signUp({ email: data.email, password: data.password, options: { emailRedirectTo: `${new URL(request.url).origin}/account/confirm` } })
      : await client.auth.signInWithPassword({ email: data.email, password: data.password });
    if (result.error) throw new ProviderError(data.action === "signin" ? "Sign-in failed. Check your email, password and email confirmation." : "Couldn't create the account. Try again later or sign in.", 400);
    return NextResponse.json({ message: result.data.session ? "You're signed in." : "Check your email to confirm your account." });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid email and a password of at least 10 characters." }, { status: 400 });
    return apiError(error);
  }
}
