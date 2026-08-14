import Anthropic from "@anthropic-ai/sdk";
import { retrieve } from "@/lib/rag";
import { SYSTEM_PROMPT, SCHEMA } from "@/lib/prompt";
import type { ChatMessage, Patient } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL = process.env.NUTRITISCAN_MODEL || "claude-opus-5";

const lastUserText = (messages: ChatMessage[]) => {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].content;
  return "";
};

export async function GET() {
  return Response.json({ ok: true, model: MODEL, hasKey: !!process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: Request) {
  const { messages = [], patient = {} } = (await req.json()) as { messages: ChatMessage[]; patient: Patient };
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        if (!Array.isArray(messages) || !messages.length) { send("error", { message: "No messages provided." }); controller.close(); return; }
        if (!process.env.ANTHROPIC_API_KEY) { send("error", { message: "Server is missing ANTHROPIC_API_KEY. Set it in your Vercel project settings." }); controller.close(); return; }

        // 1) Retrieval-augmented grounding over medical literature.
        send("status", { label: "Searching medical research (PubMed + arXiv)…" });
        let evidenceBlock = "No retrieved evidence.";
        let citations: any[] = [];
        try {
          const r = await retrieve(lastUserText(messages), 5);
          citations = r.citations;
          if (citations.length) {
            evidenceBlock = citations
              .map((c, i) => `[${i + 1}] ${c.title} — ${c.source}${c.publication ? ", " + c.publication : ""}${c.year ? " (" + c.year + ")" : ""}${c.url ? " " + c.url : ""}`)
              .join("\n");
          }
        } catch { /* grounding is best-effort */ }

        // 2) Assemble request with patient context + retrieved evidence.
        send("status", { label: "Reviewing your symptoms…" });
        const patientCtx = Object.keys(patient || {}).length
          ? `PATIENT CONTEXT (user-provided, use with care):\n${JSON.stringify(patient)}`
          : "PATIENT CONTEXT: none provided.";
        const convo = messages.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }));
        convo.push({ role: "user", content: `${patientCtx}\n\nRETRIEVED EVIDENCE:\n${evidenceBlock}` });

        // 3) Claude — adaptive thinking + structured JSON output.
        const client = new Anthropic();
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          thinking: { type: "adaptive" },
          // structured outputs — model must return JSON matching SCHEMA
          output_config: { format: { type: "json_schema", schema: SCHEMA as any } } as any,
          messages: convo,
        } as any);

        anthropicStream.on("thinking", () => send("status", { label: "Considering possibilities…" }));

        const final = await anthropicStream.finalMessage();

        if ((final as any).stop_reason === "refusal") {
          send("final", {
            payload: {
              mode: "assess", triage: "amber", confidence: "insufficient",
              reply: "I'm not able to help safely with that here. Please consult a qualified clinician, and if this is an emergency, contact your local emergency services.",
              followups: [], causes: [], reasoning: [], next_steps: ["Contact a healthcare professional."],
              disclaimer: "NutritiScan cannot assess this safely.", evidence: [], emergency_flags: [],
              handoff: { concern: "See conversation", symptoms: [], history: "", questions: [], evaluation: "Clinical assessment" },
            },
            citations: [],
          });
          controller.close();
          return;
        }

        const text = final.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        let payload: any;
        try { payload = JSON.parse(text); }
        catch {
          payload = {
            mode: "assess", triage: "amber", confidence: "insufficient",
            reply: text || "I couldn't format a full assessment — please rephrase, and confirm anything important with a clinician.",
            followups: [], causes: [], reasoning: [], next_steps: [], disclaimer: "", evidence: [], emergency_flags: [],
            handoff: { concern: "", symptoms: [], history: "", questions: [], evaluation: "" },
          };
        }

        send("final", { payload, citations });
        controller.close();
      } catch (err: any) {
        try { send("error", { message: err?.message || "Something went wrong." }); } catch {}
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
