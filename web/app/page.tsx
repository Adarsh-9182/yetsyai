"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Icon } from "@/components/Icons";
import type { Assessment, Citation, ChatMessage, Followup } from "@/lib/types";

/* ───────────────────────── patient context (demo profile) ───────────────────────── */
const PATIENT = {
  age: 29, sex: "male",
  conditions: ["hypertension"], allergies: ["penicillin"],
  medications: ["Lisinopril 10mg", "Ibuprofen 200mg"],
  memory: ["You mentioned recurring headaches", "Takes medication for hypertension", "Penicillin allergy"],
};

const SUGGESTS = [
  "I've had a headache since yesterday",
  "I have chest pain since this morning",
  "I have stomach pain after eating",
  "I have a fever and a sore throat",
];

/* ───────────────────────── streaming client ───────────────────────── */
async function streamConsult(
  messages: ChatMessage[],
  cb: { onStatus: (s: string) => void; onFinal: (p: Assessment, c: Citation[]) => void; onError: (m: string) => void }
) {
  const res = await fetch("/api/consult", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, patient: PATIENT }),
  });
  if (!res.ok || !res.body) throw new Error("backend");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", got = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = (chunk.match(/^event: (.*)$/m) || [])[1];
      const dl = (chunk.match(/^data: (.*)$/m) || [])[1];
      if (!dl) continue;
      const data = JSON.parse(dl);
      if (ev === "status") cb.onStatus(data.label);
      else if (ev === "final") { got = true; cb.onFinal(data.payload, data.citations || []); }
      else if (ev === "error") { cb.onError(data.message); return; }
    }
  }
  if (!got) throw new Error("empty");
}

/* ───────────────────────── local demo engine (used before an API key is set) ───────────────────────── */
const RED = /(breath|breathless|short of breath|sweat|arm|jaw|spreading|worst headache|vision|slurred|weakness|numb|faint|passed out|blood in|severe|overdose|suicid)/i;

function detectIntent(t: string) {
  t = t.toLowerCase();
  if (/chest|heart/.test(t)) return "chest";
  if (/head ?ache|migraine/.test(t)) return "headache";
  if (/stomach|abdomen|belly|tummy|reflux|nausea/.test(t)) return "stomach";
  if (/fever|throat|cough|cold/.test(t)) return "fever";
  if (/dizz|lighthead|vertigo|balance/.test(t)) return "dizzy";
  return "generic";
}

const DEMO_FOLLOWUPS: Record<string, Followup[]> = {
  chest: [
    { question: "Where is the pain?", multi: false, options: ["Center of chest", "Left side", "Right side", "Other"] },
    { question: "Any of these?", multi: true, options: ["Shortness of breath", "Cold sweat", "Pain spreading to arm/jaw", "Nausea", "None of these"] },
  ],
  headache: [
    { question: "How long has it lasted?", multi: false, options: ["A few hours", "Since yesterday", "Several days"] },
    { question: "Any of these?", multi: true, options: ["Light sensitivity", "Nausea", "Fever", "Vision changes", "None of these"] },
  ],
  stomach: [{ question: "Is it related to eating?", multi: false, options: ["Worse after eating", "Better after eating", "No clear link"] }],
  fever: [{ question: "Any of these?", multi: true, options: ["Cough", "Difficulty breathing", "Difficulty swallowing", "None of these"] }],
  dizzy: [{ question: "When does it happen?", multi: false, options: ["On standing up", "All the time", "In episodes"] }],
};

const DEMO_ASSESS: Record<string, Partial<Assessment>> = {
  chest: {
    triage: "amber", confidence: "moderate",
    reply: "Thanks. There are no urgent red-flags in what you've shared, but chest pain should still be checked in person.",
    causes: [
      { group: "common", name: "Acid reflux", likelihood: 3 }, { group: "common", name: "Muscle strain", likelihood: 2 }, { group: "common", name: "Anxiety-related", likelihood: 2 },
      { group: "important", name: "Heart-related causes", likelihood: 1 }, { group: "important", name: "Lung-related causes", likelihood: 1 },
    ],
    next_steps: ["Contact a clinician today to have this evaluated.", "Seek urgent care if you develop breathlessness, sweating, or pain spreading to the arm or jaw."],
    handoff: { concern: "Chest pain since this morning", symptoms: ["Chest discomfort"], history: "On lisinopril for hypertension", questions: ["Is a cardiac cause reasonably excluded?", "Would an ECG be appropriate?"], evaluation: "In-person assessment ± ECG" },
  },
  headache: {
    triage: "green", confidence: "moderate",
    reply: "Based on what you've shared there are no obvious emergency warning signs. This looks most like a common headache pattern.",
    causes: [
      { group: "common", name: "Tension-type headache", likelihood: 3 }, { group: "common", name: "Dehydration or poor sleep", likelihood: 2 }, { group: "common", name: "Migraine", likelihood: 2 },
      { group: "important", name: "Medication-related headache", likelihood: 1 },
    ],
    next_steps: ["Rest, hydrate, and note what seems to trigger the headaches.", "See a clinician if they keep recurring.", "Seek urgent care for a sudden 'worst-ever' headache, vision changes, or weakness."],
    handoff: { concern: "Recurring headaches", symptoms: ["Headache", "Light sensitivity"], history: "No previous migraine diagnosis", questions: ["Could this represent migraine?"], evaluation: "Clinical assessment; symptom diary" },
  },
  stomach: {
    triage: "amber", confidence: "moderate",
    reply: "This is most often something benign like reflux, but worth reviewing if it persists.",
    causes: [{ group: "common", name: "Acid reflux / indigestion", likelihood: 3 }, { group: "common", name: "Gastritis", likelihood: 2 }, { group: "important", name: "Ulcer-related causes", likelihood: 1 }],
    next_steps: ["Try smaller, lighter meals and note triggers.", "Contact a clinician if it persists or worsens.", "Seek urgent care for severe constant pain or blood in vomit/stool."],
    handoff: { concern: "Stomach pain after eating", symptoms: ["Abdominal pain"], history: "Occasional ibuprofen use", questions: ["Could this be reflux or gastritis?"], evaluation: "Clinical assessment" },
  },
  fever: {
    triage: "green", confidence: "moderate",
    reply: "Fever with a sore throat is usually a self-limiting viral illness with no obvious emergency signs.",
    causes: [{ group: "common", name: "Viral pharyngitis", likelihood: 3 }, { group: "common", name: "Viral URI", likelihood: 2 }, { group: "important", name: "Strep throat", likelihood: 1 }],
    next_steps: ["Rest, fluids, and simple fever relief.", "See a clinician if the fever is high or lasts beyond 3 days.", "Seek urgent care for difficulty breathing or swallowing, or a stiff neck."],
    handoff: { concern: "Fever and sore throat", symptoms: ["Fever", "Sore throat"], history: "Penicillin allergy on record", questions: ["Is a throat swab warranted?"], evaluation: "Clinical assessment ± throat swab" },
  },
  generic: {
    triage: "green", confidence: "insufficient",
    reply: "Thanks for telling me. There are no obvious emergency signs; here's how I'd think about it.",
    causes: [{ group: "common", name: "Common, self-limiting causes", likelihood: 2 }, { group: "important", name: "Causes needing review if it persists", likelihood: 1 }],
    next_steps: ["Monitor your symptoms over the next day or two.", "Contact a clinician if it persists or worsens.", "Seek urgent care for severe pain, breathing difficulty, or fainting."],
    handoff: { concern: "General health concern", symptoms: ["See conversation"], history: "See profile", questions: ["Assessment of ongoing symptoms"], evaluation: "Clinical assessment" },
  },
};

function blank(): Assessment {
  return { mode: "assess", reply: "", triage: "none", confidence: "moderate", followups: [], causes: [], reasoning: [], next_steps: [], disclaimer: "This cannot be diagnosed from symptoms alone. Please confirm anything important with a qualified clinician.", evidence: [], emergency_flags: [], handoff: { concern: "", symptoms: [], history: "", questions: [], evaluation: "" } };
}

async function demoConsult(messages: ChatMessage[]): Promise<{ payload: Assessment; citations: Citation[] }> {
  await new Promise((r) => setTimeout(r, 700));
  const userMsgs = messages.filter((m) => m.role === "user");
  const intent = detectIntent(userMsgs[0]?.content || "");
  const allText = userMsgs.map((m) => m.content).join(" ");
  // first turn → ask follow-ups (if any defined)
  if (userMsgs.length === 1 && DEMO_FOLLOWUPS[intent]) {
    const p = blank();
    p.mode = "ask"; p.triage = "none";
    p.reply = intent === "chest" ? "Let's assess this carefully — chest pain can have many causes, some needing urgent evaluation. A couple of quick questions:" : "Let's understand this a little better. A couple of quick questions:";
    p.followups = DEMO_FOLLOWUPS[intent];
    p.handoff.symptoms = [userMsgs[0].content];
    return { payload: p, citations: [] };
  }
  // subsequent turn → emergency or assessment
  if (RED.test(allText)) {
    const p = blank();
    p.mode = "emergency"; p.triage = "red";
    p.reply = "Some of the symptoms you've described can be associated with serious conditions that cannot be safely evaluated through chat.";
    p.emergency_flags = allText.split(/[·,]/).map((s) => s.trim()).filter((s) => RED.test(s)).slice(0, 3);
    if (!p.emergency_flags.length) p.emergency_flags = ["Potential emergency features described"];
    p.emergency_flags.push("These features can indicate a medical emergency");
    p.handoff = { concern: userMsgs[0].content, symptoms: userMsgs, history: "See profile", questions: ["Urgent evaluation"], evaluation: "Emergency assessment" } as any;
    p.handoff.symptoms = userMsgs.map((m) => m.content);
    return { payload: p, citations: [] };
  }
  const p = { ...blank(), ...DEMO_ASSESS[intent] } as Assessment;
  p.mode = "assess";
  return { payload: p, citations: [] };
}

/* ───────────────────────── render helpers ───────────────────────── */
const CONF: Record<string, [string, number, string]> = { high: ["high", 4, "High confidence"], moderate: ["mod", 2, "Moderate confidence"], insufficient: ["low", 1, "Insufficient information"] };
const TRIAGE_META: Record<string, [string, string, string]> = {
  green: ["LOW CONCERN", "i-check-c", "Based on what you've shared, there are no obvious emergency warning signs."],
  amber: ["NEEDS MEDICAL REVIEW", "i-info", "Your symptoms should be evaluated by a healthcare professional."],
  red: ["URGENT", "i-alert", "These symptoms can indicate a medical emergency. Seek urgent care now."],
};

function Confidence({ level }: { level: string }) {
  const [cls, n, lbl] = CONF[level] || CONF.insufficient;
  return (
    <span className={`confidence ${cls}`}>
      <span className="bars">{[0, 1, 2, 3].map((k) => <i key={k} className={k < n ? "on" : ""} />)}</span>{lbl}
    </span>
  );
}

function Triage({ level }: { level: string }) {
  const m = TRIAGE_META[level]; if (!m) return null;
  return (
    <div className={`triage ${level}`}>
      <div className="tri-ic"><Icon name={m[1]} /></div>
      <div><div className="tri-t">{m[0]}</div><div className="tri-d">{m[2]}</div></div>
    </div>
  );
}

function Causes({ causes }: { causes: Assessment["causes"] }) {
  const groups = [
    { kind: "common", label: "Common possibilities", items: causes.filter((c) => c.group === "common") },
    { kind: "important", label: "Less common but important", items: causes.filter((c) => c.group === "important") },
  ].filter((g) => g.items.length);
  return (
    <div className="card">
      <div className="card-head"><Icon name="i-brain" /><h4>What could be causing this?</h4></div>
      <div className="card-body">
        {groups.map((g) => (
          <div className="cause-group" key={g.kind}>
            <div className="cg-label"><span className={`pip ${g.kind}`} />{g.label}</div>
            {g.items.map((c, i) => (
              <div className="cause" key={i}>
                <span className="c-name">{c.name}</span>
                <span className="likelihood">{[0, 1, 2].map((k) => <i key={k} className={k < Math.max(1, Math.min(3, c.likelihood)) ? "on" : ""} />)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Reasoning({ factors }: { factors: Assessment["reasoning"] }) {
  const [open, setOpen] = useState(false);
  if (!factors.length) return null;
  return (
    <details className="reasoning" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary><Icon name="i-brain" /> Why NutritiScan is suggesting this <span className="chev"><Icon name="i-chevron" /></span></summary>
      <div className="r-body">{factors.map((f, i) => (<div className="factor" key={i}><span className="k">{f.factor}</span><span>{f.value}</span></div>))}</div>
    </details>
  );
}

function Steps({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <div className="card">
      <div className="card-head"><Icon name="i-arrow" /><h4>Recommended next steps</h4></div>
      <div className="card-body"><div className="steps-list">{steps.map((s, i) => (<div className="step-item" key={i}><span className="num">{i + 1}</span><span>{s}</span></div>))}</div></div>
    </div>
  );
}

function Evidence({ evidence, citations }: { evidence: Assessment["evidence"]; citations: Citation[] }) {
  const items = evidence.length ? evidence.map((e) => ({ src: e.title, meta: e.source + (e.url ? " · " + e.url : ""), desc: e.detail }))
    : citations.slice(0, 3).map((c) => ({ src: c.title, meta: `${c.source}${c.year ? " · " + c.year : ""}`, desc: c.url || "" }));
  if (!items.length) return null;
  return (
    <details className="evidence">
      <summary><Icon name="i-book" /> Why am I seeing this? · Sources</summary>
      {items.map((e, i) => (<div className="ev-item" key={i}><div className="src">{e.src}</div><div className="meta">{e.meta}</div><div className="desc">{e.desc}</div></div>))}
    </details>
  );
}

function Followups({ followups, onAnswer }: { followups: Followup[]; onAnswer: (summary: string) => void }) {
  const [sel, setSel] = useState<string[][]>(followups.map(() => []));
  const [done, setDone] = useState(false);
  const ready = followups.every((_, i) => sel[i].length);
  const pick = (qi: number, opt: string, multi: boolean) => {
    setSel((prev) => prev.map((s, i) => {
      if (i !== qi) return s;
      if (!multi) return [opt];
      if (/none/i.test(opt)) return [opt];
      const without = s.filter((x) => !/none/i.test(x));
      return without.includes(opt) ? without.filter((x) => x !== opt) : [...without, opt];
    }));
  };
  if (done) return null;
  return (
    <div className="qcard">
      {followups.map((b, qi) => (
        <div className="qblock" key={qi}>
          <div className="q">{b.question}{b.multi && <span className="hint">Select all that apply</span>}</div>
          <div className="opts">
            {b.options.map((o) => (
              <button key={o} className={`opt ${sel[qi].includes(o) ? "sel" : ""}`} onClick={() => pick(qi, o, b.multi)}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="qcard-foot">
        <button className="btn btn-primary btn-sm" disabled={!ready} onClick={() => { setDone(true); onAnswer(sel.map((s) => s.join(", ")).filter(Boolean).join(" · ")); }}>
          Continue <Icon name="i-arrow" />
        </button>
        <span className="note">Answer only what's relevant.</span>
      </div>
    </div>
  );
}

/* ───────────────────────── main app ───────────────────────── */
type Turn =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "ai"; status?: string; payload?: Assessment; citations?: Citation[] };

let TID = 1;

export default function Page() {
  const [view, setView] = useState<"home" | "chat" | "history" | "trust">("home");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [emergency, setEmergency] = useState<Assessment | null>(null);
  const [live, setLive] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const apiMessages = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/consult").then((r) => r.json()).then((j) => { setLive(!!j.ok); setHasKey(!!j.hasKey); }).catch(() => {});
  }, []);

  useEffect(() => {
    const el = scrollRef.current; if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [turns, view]);

  const patch = (id: number, upd: Partial<Extract<Turn, { role: "ai" }>>) =>
    setTurns((ts) => ts.map((t) => (t.id === id && t.role === "ai" ? { ...t, ...upd } : t)));

  const runConsult = useCallback(async (aiId: number) => {
    const msgs = [...apiMessages.current];
    const onFinal = (p: Assessment, c: Citation[]) => {
      apiMessages.current.push({ role: "assistant", content: p.reply || "" });
      if (p.mode === "emergency") { patch(aiId, { status: undefined, payload: undefined }); setTurns((ts) => ts.filter((t) => t.id !== aiId)); setEmergency(p); return; }
      patch(aiId, { status: undefined, payload: p, citations: c });
    };
    if (hasKey) {
      try {
        await streamConsult(msgs, {
          onStatus: (s) => patch(aiId, { status: s }),
          onFinal,
          onError: () => demoConsult(msgs).then(({ payload, citations }) => onFinal(payload, citations)),
        });
        return;
      } catch { /* fall through to demo */ }
    }
    const { payload, citations } = await demoConsult(msgs);
    onFinal(payload, citations);
  }, [hasKey]);

  const submit = useCallback((text: string, fresh?: boolean) => {
    const t = text.trim(); if (!t) return;
    setView("chat"); setRailOpen(false); setEmergency(null);
    if (fresh) { apiMessages.current = []; setTurns([]); }
    apiMessages.current.push({ role: "user", content: t });
    const uid = TID++, aid = TID++;
    setTurns((ts) => [...ts, { id: uid, role: "user", text: t }, { id: aid, role: "ai", status: "Connecting to NutritiScan…" }]);
    setTimeout(() => runConsult(aid), 0);
  }, [runConsult]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const v = inputRef.current!.value; inputRef.current!.value = ""; submit(v); }
  };

  return (
    <div className={`app ${railOpen ? "rail-open" : ""}`} data-view={view} data-context={view === "chat" ? "on" : "off"}>
      <div className="rail-scrim" onClick={() => setRailOpen(false)} />
      {/* ── Rail ── */}
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark"><Icon name="i-logo" /></span>
          <div><div className="brand-name">Nutriti<b>Scan</b></div><div className="brand-sub">AI Doctor</div></div>
        </div>
        <button className="rail-new" onClick={() => { apiMessages.current = []; setTurns([]); setView("chat"); }}><Icon name="i-plus" /> New consultation</button>
        <button className={`nav-item accent ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}><Icon name="i-home" /> Home</button>
        <button className={`nav-item ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")}><Icon name="i-stethoscope" /> AI Doctor</button>
        <button className={`nav-item ${view === "history" ? "active" : ""}`} onClick={() => setView("history")}><Icon name="i-history" /> History</button>
        <button className={`nav-item ${view === "trust" ? "active" : ""}`} onClick={() => setView("trust")}><Icon name="i-shield" /> Trust &amp; Safety</button>
        <div className="rail-foot">
          <div className="userchip"><span className="avatar">AB</span><div><div className="nm">Adarsh B.</div><div className="em">Personal health context</div></div></div>
        </div>
      </aside>

      {/* ── Stage ── */}
      <main className="stage">
        {view === "home" && <Home onSubmit={submit} live={live} hasKey={hasKey} setRailOpen={setRailOpen} />}
        {view === "chat" && (
          <ChatView
            turns={turns} scrollRef={scrollRef} inputRef={inputRef} onKey={onKey}
            onSend={() => { const v = inputRef.current!.value; inputRef.current!.value = ""; submit(v); }}
            submit={submit} live={live} setRailOpen={setRailOpen}
            emergency={emergency} onDismissEmergency={() => setEmergency(null)}
            onHandoff={() => setView("history")}
          />
        )}
        {view === "history" && <SimplePage title="Conversation history" sub="Every consultation is saved privately." setRailOpen={setRailOpen}><HistoryList onOpen={submit} /></SimplePage>}
        {view === "trust" && <SimplePage title="Trust &amp; Safety" sub="How NutritiScan works, and its limits." setRailOpen={setRailOpen}><TrustContent /></SimplePage>}
      </main>

      {/* ── Context panel ── */}
      <aside className="context">
        <div className="ctx-title">Current context</div>
        <div className="ctx-card">
          <h4><Icon name="i-stethoscope" /> Symptoms</h4>
          <ContextSymptoms turns={turns} emergency={emergency} />
        </div>
        <div className="ctx-card"><h4><Icon name="i-pill" /> Medications</h4><div>{PATIENT.medications.map((m) => <span className="ctx-tag" key={m}>{m}</span>)}</div></div>
        <div className="ctx-card"><h4><Icon name="i-brain" /> Relevant history</h4><div><span className="ctx-tag">Hypertension</span><span className="ctx-tag">Penicillin allergy</span></div></div>
        <div className="ctx-card">
          <h4><Icon name="i-book" /> Grounding</h4>
          <div className="ctx-row"><span>Live agent</span><b style={{ color: live && hasKey ? "var(--green)" : "var(--ink-3)" }}>{live && hasKey ? "On" : "Demo"}</b></div>
          <div className="ctx-empty">PubMed / Europe PMC · arXiv</div>
        </div>
      </aside>

      {/* ── Mobile tab bar ── */}
      <nav className="tabbar">
        <button className={`tab ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}><Icon name="i-home" /> Home</button>
        <button className={`tab ${view === "history" ? "active" : ""}`} onClick={() => setView("history")}><Icon name="i-history" /> History</button>
        <button className="tab doctor" onClick={() => { apiMessages.current = []; setTurns([]); setView("chat"); }}><span className="tab-fab"><Icon name="i-stethoscope" /></span> Doctor</button>
        <button className={`tab ${view === "trust" ? "active" : ""}`} onClick={() => setView("trust")}><Icon name="i-shield" /> Trust</button>
        <button className={`tab ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")}><Icon name="i-stethoscope" /> Chat</button>
      </nav>
    </div>
  );
}

/* ───────────────────────── views ───────────────────────── */
function Home({ onSubmit, live, hasKey, setRailOpen }: { onSubmit: (t: string) => void; live: boolean; hasKey: boolean | null; setRailOpen: (b: boolean) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <div className="topbar">
        <button className="iconbtn menu-btn" onClick={() => setRailOpen(true)}><Icon name="i-menu" /></button>
        <h2>Home</h2>
      </div>
      <div className="scroll home-scroll">
        <div className="hero">
          <span className="hero-eyebrow"><span className="dot" /> {live && hasKey ? "Live AI · grounded in medical research" : "NutritiScan is ready"}</span>
          <h1 className="serif">How are you feeling today?</h1>
          <p className="lede">Tell me what's going on. I'll help you understand what might be happening and what to do next.</p>
          <div className="composer">
            <div className="composer-input">
              <textarea ref={ref} rows={1} placeholder="Describe your symptoms…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(ref.current!.value); ref.current!.value = ""; } }} />
              <button className="send-btn" onClick={() => { onSubmit(ref.current!.value); ref.current!.value = ""; }}><Icon name="i-send" /></button>
            </div>
            <div className="composer-actions">
              <button className="act-chip"><Icon name="i-mic" /> <span>Voice</span></button>
              <button className="act-chip"><Icon name="i-camera" /> <span>Image</span></button>
              <button className="act-chip"><Icon name="i-doc" /> <span>Medical report</span></button>
              <button className="act-chip"><Icon name="i-pill" /> <span>Medication</span></button>
            </div>
          </div>
          <div className="suggests">
            {SUGGESTS.map((s) => (<button className="suggest" key={s} onClick={() => onSubmit(s)}>{s}</button>))}
          </div>
          <div className="hero-safety"><Icon name="i-lock" /> Private by default · NutritiScan can make mistakes — confirm important decisions with a clinician.</div>
          {live && hasKey === false && (
            <div className="notice">Running in <b>demo mode</b>. Add <b>ANTHROPIC_API_KEY</b> in your Vercel project to enable the live, research-grounded medical agent.</div>
          )}
        </div>
        <div className="home-lower">
          <div className="home-lower-in">
            <div className="section-eyebrow">For you</div>
            <div className="proactive-grid">
              <button className="proactive" onClick={() => onSubmit("Can you explain my blood report? My hemoglobin is 11.2.")}>
                <span className="ic"><Icon name="i-doc" /></span>
                <div className="t">Blood report waiting to be reviewed</div>
                <div className="d">Hemoglobin flagged below range.</div>
                <div className="go">Analyze report <Icon name="i-arrow" /></div>
              </button>
              <button className="proactive" onClick={() => onSubmit("I've been getting recurring headaches recently.")}>
                <span className="ic"><Icon name="i-brain" /></span>
                <div className="t">You mentioned recurring headaches</div>
                <div className="d">Continue the assessment.</div>
                <div className="go">Continue <Icon name="i-arrow" /></div>
              </button>
              <button className="proactive" onClick={() => onSubmit("Can I take Ibuprofen and Lisinopril together?")}>
                <span className="ic"><Icon name="i-pill" /></span>
                <div className="t">Medication interaction question</div>
                <div className="d">Ibuprofen + Lisinopril.</div>
                <div className="go">Review <Icon name="i-arrow" /></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ChatView(props: any) {
  const { turns, scrollRef, inputRef, onKey, onSend, submit, live, setRailOpen, emergency, onDismissEmergency, onHandoff } = props;
  return (
    <>
      <div className="topbar">
        <button className="iconbtn menu-btn" onClick={() => setRailOpen(true)}><Icon name="i-menu" /></button>
        <span className="brand-mark" style={{ width: 32, height: 32 }}><Icon name="i-logo" /></span>
        <div><h2>AI Doctor</h2><div className="sub">{live ? "Grounded in medical research · confirm with a clinician" : "Not a substitute for emergency care"}</div></div>
      </div>
      <div className="scroll chat-scroll" ref={scrollRef}>
        <div className="chat-thread">
          {turns.length === 0 && (
            <div className="msg ai"><div className="msg-ava"><Icon name="i-logo" /></div>
              <div className="msg-body"><div className="msg-name">NutritiScan <Icon name="i-sparkles" /></div>
                <div className="ai-text"><p>Hi, I'm NutritiScan. Tell me what's going on and I'll help you understand what might be happening and what to do next.</p></div>
              </div></div>
          )}
          {turns.map((t: Turn) => t.role === "user" ? (
            <div className="msg user" key={t.id}><div className="msg-ava">AB</div><div className="msg-body"><div className="bubble-user">{t.text}</div></div></div>
          ) : (
            <div className="msg ai" key={t.id}>
              <div className="msg-ava"><Icon name="i-logo" /></div>
              <div className="msg-body">
                <div className="msg-name">NutritiScan <Icon name="i-sparkles" /></div>
                <AiTurn t={t} submit={submit} onHandoff={onHandoff} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="dock">
        <div className="dock-in">
          <div className="dock-composer">
            <button className="mini-act"><Icon name="i-camera" /></button>
            <button className="mini-act"><Icon name="i-doc" /></button>
            <textarea ref={inputRef} rows={1} placeholder="Describe your symptoms…" onKeyDown={onKey} />
            <button className="mini-act"><Icon name="i-mic" /></button>
            <button className="send-btn" onClick={onSend}><Icon name="i-send" /></button>
          </div>
          <div className="dock-disc">NutritiScan provides health information, not a diagnosis. In an emergency, call your local emergency number.</div>
        </div>
      </div>

      {emergency && (
        <div className="emergency on">
          <div className="em-inner">
            <div className="em-badge"><Icon name="i-alert" /></div>
            <h1 className="serif">This needs urgent medical attention</h1>
            <p>{emergency.reply}</p>
            <div className="em-actions">
              <button className="em-call" onClick={() => alert("This is a prototype — in a real emergency, call your local emergency number.")}><Icon name="i-phone" /> Get emergency help now</button>
              <button className="btn btn-ghost btn-lg" onClick={onHandoff}>Show symptoms summary</button>
            </div>
            <div className="em-flags">
              <div className="h">Why NutritiScan is escalating</div>
              <ul>{emergency.emergency_flags.map((f: string, i: number) => (<li key={i}><Icon name="i-alert" /> {f}</li>))}</ul>
            </div>
            <button className="em-dismiss" onClick={onDismissEmergency}>This was a mistake — return to conversation</button>
          </div>
        </div>
      )}
    </>
  );
}

function AiTurn({ t, submit, onHandoff }: { t: Extract<Turn, { role: "ai" }>; submit: (s: string) => void; onHandoff: () => void }) {
  if (t.status) return (<div className="thinking"><span className="dots"><i /><i /><i /></span> {t.status}</div>);
  const p = t.payload; if (!p) return null;
  return (
    <>
      <div className="ai-text"><p>{p.reply} {p.mode === "assess" && p.confidence && <Confidence level={p.confidence} />}</p></div>
      {p.mode === "ask" && p.followups.length > 0 && <Followups followups={p.followups} onAnswer={(s) => submit(s)} />}
      {p.mode === "assess" && (
        <>
          {TRIAGE_META[p.triage] && <Triage level={p.triage} />}
          {p.causes.length > 0 && <Causes causes={p.causes} />}
          <Reasoning factors={p.reasoning} />
          <Steps steps={p.next_steps} />
          {p.disclaimer && <div className="disclaimer"><Icon name="i-info" /><div>{p.disclaimer}</div></div>}
          <Evidence evidence={p.evidence} citations={t.citations || []} />
          <div className="resp-actions">
            <button className="btn btn-primary btn-sm" onClick={onHandoff}><Icon name="i-share" /> Continue with a clinician</button>
            <button className="btn btn-ghost btn-sm" onClick={() => alert("Saved to your health record (prototype).")}><Icon name="i-check" /> Save to health record</button>
          </div>
        </>
      )}
    </>
  );
}

function ContextSymptoms({ turns, emergency }: { turns: Turn[]; emergency: Assessment | null }) {
  const last = [...turns].reverse().find((t) => t.role === "ai" && (t as any).payload) as Extract<Turn, { role: "ai" }> | undefined;
  const p = emergency || last?.payload;
  const symptoms = p?.handoff?.symptoms?.filter(Boolean) || [];
  const level = emergency ? "red" : p?.triage;
  if (!symptoms.length) return <div className="ctx-empty">No active symptoms in this conversation yet.</div>;
  const lvlMap: Record<string, [string, string]> = { green: ["var(--green)", "Low concern"], amber: ["var(--amber)", "Needs review"], red: ["var(--red)", "Urgent"] };
  return (
    <>
      {symptoms.map((s, i) => (<span className="ctx-tag" key={i}><Icon name="i-stethoscope" /> {s}</span>))}
      {level && lvlMap[level] && (<div className="ctx-row" style={{ marginTop: 8 }}><span>Triage</span><b style={{ color: lvlMap[level][0] }}>{lvlMap[level][1]}</b></div>)}
    </>
  );
}

function SimplePage({ title, sub, children, setRailOpen }: { title: string; sub: string; children: React.ReactNode; setRailOpen: (b: boolean) => void }) {
  return (
    <>
      <div className="topbar"><button className="iconbtn menu-btn" onClick={() => setRailOpen(true)}><Icon name="i-menu" /></button><h2 dangerouslySetInnerHTML={{ __html: title }} /></div>
      <div className="scroll"><div className="wrap wrap-wide"><div className="page-head"><h1 dangerouslySetInnerHTML={{ __html: title }} /><p>{sub}</p></div>{children}</div></div>
    </>
  );
}

function HistoryList({ onOpen }: { onOpen: (t: string) => void }) {
  const items = [
    ["Chest pain assessment", "Amber · needs medical review", "I have chest pain since this morning"],
    ["Headache assessment", "Low concern · possible tension headache", "I've had a headache since yesterday"],
    ["Stomach pain", "Low concern · likely reflux", "I have stomach pain after eating"],
    ["Fever & sore throat", "Low concern · likely viral", "I have a fever and a sore throat"],
  ];
  return (
    <div className="panel"><div className="panel-body pad0">
      {items.map(([t, d, prompt]) => (
        <div className="med-card" style={{ alignItems: "center" }} key={t}>
          <div className="med-pill" style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}><Icon name="i-stethoscope" /></div>
          <div className="med-info"><div className="mn" style={{ fontSize: ".94rem" }}>{t}</div><div className="mg">{d}</div></div>
          <button className="btn btn-ghost btn-sm" onClick={() => onOpen(prompt)}>Continue</button>
        </div>
      ))}
    </div></div>
  );
}

function TrustContent() {
  const cards = [
    ["i-brain", "How NutritiScan works", "It reasons over your described symptoms, history and reports to explain possibilities and next steps — never a definitive diagnosis."],
    ["i-info", "AI limitations", "It cannot examine you, run tests, or account for everything a clinician would. Uncertainty is always shown clearly."],
    ["i-alert", "Medical safety", "Emergency and high-risk patterns trigger a clear safety interface that prioritizes getting you appropriate care."],
    ["i-book", "Evidence", "Explanations are grounded in live retrieval from PubMed / Europe PMC and arXiv research."],
    ["i-lock", "Data protection", "Your health data is private by default. You control what is remembered."],
    ["i-stethoscope", "Human clinicians", "NutritiScan bridges you to real care, generating handoff summaries for your clinician."],
  ];
  return (
    <>
      <div className="trust-banner"><Icon name="i-shield" /><div><h3>NutritiScan can make mistakes</h3><p>NutritiScan helps you understand your health, but it is not a doctor and does not provide a diagnosis. Important medical decisions should always be confirmed with a qualified healthcare professional.</p></div></div>
      <div className="trust-grid">{cards.map(([ic, h, p]) => (<div className="trust-card" key={h}><div className="ic"><Icon name={ic} /></div><h4>{h}</h4><p>{p}</p></div>))}</div>
    </>
  );
}
