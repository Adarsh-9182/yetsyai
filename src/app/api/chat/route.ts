import { NextResponse } from "next/server";
import { z } from "zod";
import { runCompanion } from "@/lib/ai/orchestrator";

export const runtime = "nodejs";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(6000),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please send a valid conversation." },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The AI isn't configured yet. Add ANTHROPIC_API_KEY to your .env file (see .env.example).",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runCompanion(parsed.data.messages);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Companion error:", err);
    return NextResponse.json(
      { error: "NutritiScan couldn't complete that just now. Please try again." },
      { status: 500 },
    );
  }
}
