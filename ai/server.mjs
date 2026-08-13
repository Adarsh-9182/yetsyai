/* ═══════════════════════════════════════════════════════════════
   NutritiScan — AI Doctor backend
   Claude (claude-opus-5) + medical/safety system prompt + RAG.

   This is the REAL "AI doctor brain": a frontier model that already
   holds broad medical knowledge, wrapped in (1) a rigorous clinical
   & safety system prompt and (2) retrieval-augmented grounding over
   open-access literature (Europe PMC / PubMed, arXiv). It returns a
   structured JSON assessment that the NutritiScan UI renders with its
   triage / possible-causes / reasoning / next-steps components.

   Run:
     cd ai && npm install && ANTHROPIC_API_KEY=sk-... node server.mjs
   Then open http://localhost:8787
   ═══════════════════════════════════════════════════════════════ */

import Anthropic from "@anthropic-ai/sdk";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { retrieve } from "./rag.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SITE_ROOT = join(__dirname, "..");        // serve the NutritiScan static site
const PORT = process.env.PORT || 8787;
const MODEL = process.env.NUTRITISCAN_MODEL || "claude-opus-5";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)

/* ───────────────────────── SYSTEM PROMPT ───────────────────────── */
const SYSTEM_PROMPT = `You are NutritiScan, an AI doctor and personal health-intelligence assistant. You help people understand symptoms, conditions, medications, lab reports and test results through a calm, trustworthy conversation.

CORE STANCE
- You are NOT a doctor and you do NOT diagnose. You explain what might be happening and what to do next, always with appropriate uncertainty.
- Prioritize safety over engagement. Never optimize for keeping the user chatting. Optimize for helping them make a safer, better-informed decision.
- Be warm, clear and concise. Write for someone with no medical training. Avoid jargon; when you must use a term, explain it in a few words.

CONVERSATION FLOW (Listen → Understand → Assess → Explain → Guide → Escalate)
- Ask ONLY the follow-up questions that materially change the assessment. Never present a long questionnaire. Prefer 1-2 focused questions per turn, each with a few tap-able options.
- Once you have enough to give useful guidance, produce an assessment rather than asking more.

TRIAGE (choose exactly one when giving an assessment)
- "green" LOW CONCERN: no obvious emergency warning signs.
- "amber" NEEDS MEDICAL REVIEW: should be evaluated by a clinician.
- "red"/EMERGENCY: symptoms that can indicate a medical emergency.

EMERGENCY DETECTION — set mode="emergency" (not a normal assessment) when the described symptoms could reflect a life-threatening condition, including but not limited to: chest pain with breathlessness/sweating/radiation to arm or jaw; signs of stroke (face droop, arm weakness, speech difficulty); severe difficulty breathing; anaphylaxis; severe uncontrolled bleeding; suicidal intent or self-harm; overdose; severe dehydration in infants; pregnancy with heavy bleeding or severe abdominal pain; stiff neck with fever and rash. In emergency mode, give a short, unmissable instruction to seek urgent care now and list the specific red-flag features you detected.

UNCERTAINTY & EVIDENCE
- Communicate confidence honestly: "high", "moderate", or "insufficient information". Never invent fake probabilities (no "87% chance of X").
- You may be given RETRIEVED EVIDENCE (titles from Europe PMC / PubMed and arXiv). Use it to ground general statements and cite it in the "evidence" field when relevant. Do not overstate what a title supports. If no evidence is provided or it is not relevant, leave evidence empty — do not fabricate citations, PMIDs, or URLs.

SAFETY RULES
- Never tell a user to start, stop, or change a prescription medication without professional guidance. You may explain what a medicine is and general considerations.
- Be especially cautious with children, pregnancy, the elderly, drug interactions, and mental-health crises. For mental-health emergencies, encourage contacting local crisis services.
- Always make clear that important decisions should be confirmed with a qualified clinician.

OUTPUT
- Respond ONLY with the JSON object defined by the response schema. Put the natural-language message the user reads in "reply".
- Keep "reply" focused and brief — a few sentences. Lead with what matters. Do not pad.`;

/* ───────────────────────── RESPONSE SCHEMA ───────────────────────── */
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["ask", "assess", "emergency"], description: "ask = need follow-ups; assess = give assessment; emergency = urgent safety interface" },
    reply: { type: "string", description: "The message shown to the user (a few sentences)." },
    triage: { type: "string", enum: ["none", "green", "amber", "red"] },
    confidence: { type: "string", enum: ["high", "moderate", "insufficient"] },
    followups: {
      type: "array",
      description: "Only when mode='ask'. 1-2 focused questions.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          question: { type: "string" },
          multi: { type: "boolean", description: "true if multiple options can be selected" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["question", "multi", "options"],
      },
    },
    causes: {
      type: "array",
      description: "Only when mode='assess'. Possible explanations, not diagnoses.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          group: { type: "string", enum: ["common", "important"] },
          name: { type: "string" },
          likelihood: { type: "integer", description: "relative plausibility 1 (low) to 3 (higher)" },
        },
        required: ["group", "name", "likelihood"],
      },
    },
    reasoning: {
      type: "array",
      description: "Concise factors considered (transparency, not raw chain-of-thought).",
      items: {
        type: "object", additionalProperties: false,
        properties: { factor: { type: "string" }, value: { type: "string" } },
        required: ["factor", "value"],
      },
    },
    next_steps: { type: "array", items: { type: "string" } },
    disclaimer: { type: "string" },
    evidence: {
      type: "array",
      description: "Citations grounding the response. Use ONLY items from the retrieved evidence provided; leave empty otherwise.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          title: { type: "string" },
          source: { type: "string" },
          detail: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "source", "detail", "url"],
      },
    },
    emergency_flags: { type: "array", items: { type: "string" }, description: "Only when mode='emergency'." },
    handoff: {
      type: "object", additionalProperties: false,
      description: "A concise clinician handoff summary when an assessment or emergency is produced.",
      properties: {
        concern: { type: "string" },
        symptoms: { type: "array", items: { type: "string" } },
        history: { type: "string" },
        questions: { type: "array", items: { type: "string" } },
        evaluation: { type: "string" },
      },
      required: ["concern", "symptoms", "history", "questions", "evaluation"],
    },
  },
  required: ["mode", "reply", "triage", "confidence", "followups", "causes", "reasoning", "next_steps", "disclaimer", "evidence", "emergency_flags", "handoff"],
};

/* ───────────────────────── HELPERS ───────────────────────── */
function sse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  return {
    send(event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); },
    end() { res.end(); },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const lastUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].content;
  return "";
};

/* ───────────────────────── /api/consult ───────────────────────── */
async function consult(req, res) {
  const stream = sse(res);
  try {
    const { messages = [], patient = {} } = await readBody(req);
    if (!Array.isArray(messages) || !messages.length) { stream.send("error", { message: "No messages provided." }); return stream.end(); }

    // 1) Retrieval-augmented grounding
    stream.send("status", { label: "Searching medical literature…" });
    let evidenceBlock = "No retrieved evidence.";
    let citations = [];
    try {
      const r = await retrieve(lastUserText(messages), { max: 5 });
      citations = r.citations;
      if (citations.length) {
        evidenceBlock = citations.map((c, i) =>
          `[${i + 1}] ${c.title} — ${c.source}${c.publication ? ", " + c.publication : ""}${c.year ? " (" + c.year + ")" : ""}${c.url ? " " + c.url : ""}`).join("\n");
      }
    } catch { /* grounding is best-effort */ }

    // 2) Assemble the request
    stream.send("status", { label: "Reviewing your symptoms…" });
    const patientCtx = Object.keys(patient).length
      ? `PATIENT CONTEXT (user-provided, use with care):\n${JSON.stringify(patient)}`
      : "PATIENT CONTEXT: none provided.";

    const convo = messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
    // Ground the newest turn with context + retrieved evidence.
    const grounding = `${patientCtx}\n\nRETRIEVED EVIDENCE:\n${evidenceBlock}`;
    convo.push({ role: "user", content: grounding });

    // 3) Call Claude — adaptive thinking + structured JSON output, streamed.
    const anthropicStream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: convo,
    });

    anthropicStream.on("thinking", () => stream.send("status", { label: "Considering possibilities…" }));

    const final = await anthropicStream.finalMessage();

    if (final.stop_reason === "refusal") {
      stream.send("final", {
        payload: {
          mode: "assess", triage: "amber", confidence: "insufficient",
          reply: "I'm not able to help safely with that here. Please consult a qualified clinician, and if this is an emergency, contact your local emergency services.",
          followups: [], causes: [], reasoning: [], next_steps: ["Contact a healthcare professional."],
          disclaimer: "NutritiScan cannot assess this safely.", evidence: [], emergency_flags: [],
          handoff: { concern: "See conversation", symptoms: [], history: "", questions: [], evaluation: "Clinical assessment" },
        },
        citations: [],
      });
      return stream.end();
    }

    const text = final.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = { mode: "assess", triage: "amber", confidence: "insufficient", reply: text || "I couldn't format a full assessment — please rephrase, and confirm anything important with a clinician.", followups: [], causes: [], reasoning: [], next_steps: [], disclaimer: "", evidence: [], emergency_flags: [], handoff: { concern: "", symptoms: [], history: "", questions: [], evaluation: "" } }; }

    stream.send("final", { payload, citations });
    stream.end();
  } catch (err) {
    stream.send("error", { message: (err && err.message) || "Something went wrong." });
    stream.end();
  }
}

/* ───────────────────────── STATIC FILES ───────────────────────── */
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
async function serveStatic(req, res) {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const full = normalize(join(SITE_ROOT, p));
  if (!full.startsWith(SITE_ROOT)) { res.writeHead(403).end("Forbidden"); return; }
  try {
    const data = await readFile(full);
    res.writeHead(200, { "Content-Type": MIME[extname(full)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404).end("Not found"); }
}

/* ───────────────────────── ROUTER ───────────────────────── */
createServer(async (req, res) => {
  const url = (req.url || "").split("?")[0];
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" }).end(); return; }
  if (url === "/api/health") { res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify({ ok: true, model: MODEL })); return; }
  if (url === "/api/consult" && req.method === "POST") return consult(req, res);
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`\n  NutritiScan AI Doctor  ·  model: ${MODEL}`);
  console.log(`  ▸ http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("  ⚠  ANTHROPIC_API_KEY is not set — /api/consult will fail until you set it (or run `ant auth login`).");
  console.log("");
});
