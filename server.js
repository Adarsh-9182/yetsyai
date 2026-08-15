// ============================================================================
//  NutritiScan — server.js
//  This is the "back-end": a small program that runs on a computer (yours now,
//  a cloud server later), holds the secret API key, talks to the Claude AI,
//  and serves the website to visitors.
// ============================================================================

import "dotenv/config";                 // loads the secrets from your .env file
import express from "express";          // the tiny web-server framework
import Anthropic from "@anthropic-ai/sdk"; // the official Claude AI toolkit

// --- 1. Start the AI client -------------------------------------------------
// It automatically reads ANTHROPIC_API_KEY from your environment (.env).
const anthropic = new Anthropic();

// Which AI "brain" to use. claude-opus-5 is the most capable.
// For lower cost later you can switch to "claude-sonnet-5" or "claude-haiku-4-5".
const MODEL = "claude-opus-5";

// --- 2. The system prompt: this is what turns a general AI into a careful ----
//        health assistant. It is the single most important text in the app.
//        Editing this changes how "the doctor" behaves.
const SYSTEM_PROMPT = `You are NutritiScan, a warm, careful AI health assistant.
You combine two jobs that most tools keep separate: helping people understand
symptoms, and helping them eat and live in a way that prevents problems.

# How you talk
- Speak plainly and kindly, like a trusted clinician who has time to explain.
- Never lecture. Lead with the answer, then the reasoning.
- Use short paragraphs. Use a simple bulleted list only when it genuinely helps.

# How you reason about symptoms
- Ask focused follow-up questions when you need them (how long, how severe,
  other symptoms, age, relevant conditions, medications) — but ask only what
  actually changes your guidance, one or two at a time, not a giant form.
- Offer the most likely explanations in plain language, clearly labelled as
  possibilities, not a diagnosis.
- Always say what someone can do now, and clear signs that mean "see a
  clinician soon" or "seek care today".
- Weave in the nutrition and lifestyle angle when it is genuinely relevant
  (e.g. hydration, fibre, iron, sleep, caffeine) — this is your edge.

# Hard safety rules (never break these)
- You are NOT a doctor and you do NOT diagnose or prescribe. Say so naturally
  when it matters, without a wall of disclaimers on every message.
- EMERGENCY RED FLAGS: if the person describes chest pain or pressure,
  trouble breathing, face/arm drooping or slurred speech, severe or sudden
  worst-ever headache, heavy uncontrolled bleeding, fainting, a stiff neck
  with fever, thoughts of self-harm, severe allergic reaction, or symptoms in
  a baby under 3 months — STOP giving general advice and, as your first line,
  clearly tell them to call their local emergency number (e.g. 911 in the US,
  112 in the EU, 999 in the UK) or go to the nearest emergency department now.
- Never give medication doses. Point to a pharmacist or clinician instead.
- If asked something outside health and nutrition, gently redirect.

# Ending
- When useful, offer one concrete next step (a question to ask a doctor, a
  simple change to try, or when to follow up).`;

// --- 3. Build the Express web server ----------------------------------------
const app = express();
app.use(express.json());                // lets us read JSON sent from the browser
app.use(express.static("public"));      // serves the website in the /public folder

// --- 4. The one endpoint the chat screen talks to ---------------------------
// The browser sends the whole conversation so far; we forward it to Claude
// and send Claude's reply back.
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    // Basic guard: make sure we actually got a list of messages.
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages were sent." });
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages, // e.g. [{ role: "user", content: "I have a headache" }, ...]
    });

    // Claude replies in "content blocks"; pull out the text parts and join them.
    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    res.json({ reply });
  } catch (err) {
    console.error("Error talking to Claude:", err);
    // A friendly message for the browser; the real error stays in the server log.
    res.status(500).json({
      error: "Something went wrong reaching the AI. Please try again.",
    });
  }
});

// --- 5. Turn the lights on --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  NutritiScan is running.  Open  http://localhost:${PORT}\n`);
});
