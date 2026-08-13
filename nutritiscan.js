/* ═══════════════════════════════════════════════════════════════
   NutritiScan — front-end prototype engine
   A deterministic "AI doctor" experience: routing, conversational
   triage flows, structured medical responses, report analysis.
   No real medical advice — a design prototype only.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ic = (id) => `<svg><use href="#${id}"/></svg>`;
  const app = $("#app");

  const NS = window.NS = {};

  /* ───────────────────────── ROUTING ───────────────────────── */
  const CONTEXT_VIEWS = new Set(["chat"]);
  NS.go = function (view, opts = {}) {
    app.dataset.view = view;
    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.viewName === view));
    // rail + tab active state
    $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.nav === view));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.nav === view));
    if (view === "labdetail" || view === "report") $$(".tab").forEach(t=>t.classList.toggle("active", t.dataset.nav==="health"));
    // context panel only on chat
    app.dataset.context = CONTEXT_VIEWS.has(view) && window.innerWidth > 1080 ? "on" : "off";
    app.classList.remove("rail-open");
    // scroll views to top
    const active = $(`.view[data-view-name="${view}"] .scroll`);
    if (active && view !== "chat") active.scrollTop = 0;
    if (opts.fresh && view === "chat") Chat.reset();
    window.scrollTo(0, 0);
  };

  /* ───────────────────────── DATA ───────────────────────── */
  const DATA = {
    meds: [
      {
        name: "Lisinopril", dose: "10 mg", freq: "Once daily", purpose: "Lowers blood pressure",
        tags: ["Blood pressure", "Once daily", "Long-term"],
        typical: "Commonly taken once a day to help manage high blood pressure (hypertension) and protect the heart and kidneys over time.",
        effects: "Dry cough, dizziness (especially when standing up), headache, tiredness.",
        warnings: "Tell your doctor if you develop swelling of the lips or throat, or a persistent dry cough. Not usually taken during pregnancy.",
        interactions: "May interact with ibuprofen and other anti-inflammatory painkillers."
      },
      {
        name: "Ibuprofen", dose: "200 mg", freq: "As needed", purpose: "Relieves pain and inflammation",
        tags: ["Pain relief", "As needed", "Over-the-counter"],
        typical: "Used occasionally for pain, inflammation or fever. Best taken with food and for the shortest time needed.",
        effects: "Stomach upset, heartburn, nausea.",
        warnings: "Long-term or frequent use can affect the stomach and kidneys. Use caution if you have high blood pressure.",
        interactions: "Can reduce the effect of blood-pressure medicines such as lisinopril."
      }
    ],
    memory: [
      { id: "m1", ic: "i-brain",  text: "You mentioned recurring headaches recently.", sub: "From a conversation · Aug 13", on: true },
      { id: "m2", ic: "i-pill",   text: "You take medication for hypertension.", sub: "From your profile", on: true },
      { id: "m3", ic: "i-alert",  text: "You reported a penicillin allergy.", sub: "From your profile · important safety info", on: true }
    ],
    biomarkers: [
      { id: "hgb", name: "Hemoglobin", value: 11.2, unit: "g/dL", lo: 12, hi: 16, status: "low",
        trend: [{l:"Jan",v:13.1},{l:"Mar",v:12.4},{l:"Jun",v:11.8},{l:"Aug",v:11.2}],
        explain: "Your hemoglobin is <b>below</b> the reference range shown on this report.",
        why: "Lower hemoglobin can occur for several reasons, including iron deficiency and other conditions. It can sometimes cause tiredness or shortness of breath.",
        discuss: ["Iron studies (ferritin)", "Diet and iron intake", "Menstrual or other blood loss", "Any related symptoms like fatigue"] },
      { id: "b12", name: "Vitamin B12", value: 182, unit: "pg/mL", lo: 200, hi: 900, status: "low",
        trend: [{l:"Jan",v:340},{l:"Mar",v:265},{l:"Jun",v:214},{l:"Aug",v:182}],
        explain: "Your Vitamin B12 has been <b>trending downward</b> and is now just below the reference range.",
        why: "B12 supports red blood cells and nerve function. Low levels can relate to diet or absorption and may contribute to tiredness.",
        discuss: ["Dietary sources of B12", "Whether supplementation is appropriate", "Absorption-related causes"] },
      { id: "vitd", name: "Vitamin D", value: 28, unit: "ng/mL", lo: 30, hi: 100, status: "low",
        trend: [{l:"Jan",v:22},{l:"Jun",v:26},{l:"Aug",v:28}],
        explain: "Your Vitamin D is <b>slightly below</b> the reference range but improving.",
        why: "Vitamin D supports bone health. Mildly low levels are common, especially with limited sun exposure.",
        discuss: ["Sun exposure and diet", "Whether a supplement is appropriate"] },
      { id: "tsh", name: "TSH (thyroid)", value: 2.1, unit: "mIU/L", lo: 0.4, hi: 4.0, status: "ok",
        trend: [{l:"Jan",v:1.9},{l:"Aug",v:2.1}],
        explain: "Your thyroid stimulating hormone is <b>within</b> the reference range.",
        why: "TSH within range suggests thyroid function is likely normal on this test.",
        discuss: ["No action typically needed for this value"] },
      { id: "glu", name: "Fasting glucose", value: 92, unit: "mg/dL", lo: 70, hi: 99, status: "ok",
        trend: [{l:"Jan",v:88},{l:"Aug",v:92}],
        explain: "Your fasting glucose is <b>within</b> the reference range.",
        why: "This value is in the typical fasting range.",
        discuss: ["Maintain balanced diet and activity"] },
      { id: "chol", name: "Total cholesterol", value: 205, unit: "mg/dL", lo: 0, hi: 200, status: "high",
        trend: [{l:"Jan",v:198},{l:"Jun",v:201},{l:"Aug",v:205}],
        explain: "Your total cholesterol is <b>slightly above</b> the reference range.",
        why: "Mildly raised cholesterol is common and is usually considered alongside other heart-health factors.",
        discuss: ["Full lipid breakdown (LDL/HDL)", "Diet and activity", "Overall cardiovascular risk"] }
    ],
    history: [
      { id:"chest",   t:"Chest pain assessment", d:"Amber · needs medical review", when:"Just now", ic:"i-stethoscope" },
      { id:"headache",t:"Headache assessment", d:"Low concern · possible tension headache", when:"Aug 13", ic:"i-brain" },
      { id:"report",  t:"Blood report review", d:"Hemoglobin below range", when:"Aug 10", ic:"i-doc" },
      { id:"med",     t:"Medication question", d:"Ibuprofen and Lisinopril interaction", when:"Aug 8", ic:"i-pill" },
      { id:"stomach", t:"Stomach pain", d:"Low concern · likely reflux", when:"Aug 5", ic:"i-stethoscope" },
      { id:"skin",    t:"Skin concern", d:"Image assessment · monitor", when:"Aug 2", ic:"i-camera" }
    ],
    timeline: [
      { cls:"sym",    tag:"Symptom",    tagc:"symtag", date:"Aug 13", t:"Symptom consultation", d:"Headache reported · possible tension type" },
      { cls:"report", tag:"Report",     tagc:"reptag", date:"Aug 10", t:"Blood report uploaded", d:"Complete blood count · hemoglobin flagged low" },
      { cls:"med",    tag:"Medication", tagc:"medtag", date:"Aug 8",  t:"Medication added", d:"Ibuprofen 200mg added to your list" },
      { cls:"sym",    tag:"Symptom",    tagc:"symtag", date:"Aug 5",  t:"Symptom consultation", d:"Stomach pain after eating · likely reflux" },
      { cls:"report", tag:"Consult",    tagc:"reptag", date:"Aug 2",  t:"Previous consultation", d:"Skin concern · image assessment" }
    ],
    privacy: [
      { t:"Use my memory to personalize conversations", d:"Let NutritiScan remember relevant health context.", on:true },
      { t:"Remember new health details automatically", d:"Save details you mention during consultations.", on:true },
      { t:"Include reports in AI context", d:"Let NutritiScan reference your uploaded reports.", on:true }
    ],
    settings: [
      { t:"Proactive health suggestions", d:"Surface useful context on your home screen.", on:true },
      { t:"Voice consultation", d:"Enable the voice doctor experience.", on:true },
      { t:"Show evidence & sources", d:"Attach clinical sources to medical explanations.", on:false }
    ]
  };

  /* ───────────────────────── CHAT ENGINE ───────────────────────── */
  const thread = $("#thread");

  function scrollThread() {
    const s = thread.closest(".scroll");
    requestAnimationFrame(() => { s.scrollTop = s.scrollHeight; });
  }
  function bubbleUser(text) {
    const el = document.createElement("div");
    el.className = "msg user";
    el.innerHTML = `<div class="msg-ava">AB</div><div class="msg-body"><div class="bubble-user"></div></div>`;
    el.querySelector(".bubble-user").textContent = text;
    thread.appendChild(el); scrollThread();
  }
  function aiShell() {
    const el = document.createElement("div");
    el.className = "msg ai";
    el.innerHTML = `<div class="msg-ava">${ic("i-logo")}</div>
      <div class="msg-body"><div class="msg-name">NutritiScan ${ic("i-sparkles")}</div><div class="ai-content"></div></div>`;
    thread.appendChild(el); scrollThread();
    return el.querySelector(".ai-content");
  }
  function thinking(label) {
    const c = aiShell();
    c.innerHTML = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span> ${label}</div>`;
    return c;
  }
  function typeInto(node, html, delay = 650) {
    return new Promise((res) => setTimeout(() => { node.innerHTML = html; scrollThread(); res(node); }, delay));
  }

  /* ── Structured response builders ── */
  const RESP = {
    triage(level, text) {
      const map = { green:["LOW CONCERN","i-check-c"], amber:["NEEDS MEDICAL REVIEW","i-info"], red:["URGENT","i-alert"] };
      const [t, i] = map[level];
      return `<div class="triage ${level}"><div class="tri-ic">${ic(i)}</div>
        <div><div class="tri-t">${t}</div><div class="tri-d">${text}</div></div></div>`;
    },
    causes(groups) {
      const grp = groups.map(g => `
        <div class="cause-group">
          <div class="cg-label"><span class="pip ${g.kind}"></span>${g.label}</div>
          ${g.items.map(c => `<div class="cause"><span class="c-name">${c.n}</span>
            <span class="likelihood">${[0,1,2].map(k=>`<i class="${k<c.l?'on':''}"></i>`).join("")}</span></div>`).join("")}
        </div>`).join("");
      return `<div class="card"><div class="card-head">${ic("i-brain")}<h4>What could be causing this?</h4></div>
        <div class="card-body">${grp}</div></div>`;
    },
    confidence(level) {
      const map = { high:["High confidence",4], mod:["Moderate confidence",2], low:["Insufficient information",1] };
      const [lbl,n]=map[level];
      return `<span class="confidence ${level}"><span class="bars">${[0,1,2,3].map(k=>`<i class="${k<n?'on':''}"></i>`).join("")}</span>${lbl}</span>`;
    },
    reasoning(factors) {
      return `<details class="reasoning"><summary>${ic("i-brain")} Why NutritiScan is suggesting this <span class="chev">${ic("i-chevron")}</span></summary>
        <div class="r-body">${factors.map(f=>`<div class="factor"><span class="k">${f.k}</span><span>${f.v}</span></div>`).join("")}</div></details>`;
    },
    steps(items) {
      return `<div class="card"><div class="card-head">${ic("i-arrow")}<h4>Recommended next steps</h4></div>
        <div class="card-body"><div class="steps-list">${items.map((s,i)=>`<div class="step-item"><span class="num">${i+1}</span><span>${s}</span></div>`).join("")}</div></div>`;
    },
    disclaimer(text) {
      return `<div class="disclaimer">${ic("i-info")}<div>${text}</div></div>`;
    },
    evidence(items) {
      return `<details class="evidence"><summary>${ic("i-book")} Why am I seeing this? · Sources</summary>
        ${items.map(e=>`<div class="ev-item"><div class="src">${e.src}</div><div class="meta">${e.meta}</div><div class="desc">${e.desc}</div></div>`).join("")}</details>`;
    },
    actions(list) {
      return `<div class="resp-actions">${list.map(a=>`<button class="btn ${a.primary?'btn-primary':'btn-ghost'} btn-sm" ${a.nav?`data-nav="${a.nav}"`:''} ${a.fn?`data-fn="${a.fn}"`:''}>${a.ic?ic(a.ic):''} ${a.label}</button>`).join("")}</div>`;
    }
  };

  /* ── Conversation flows ── */
  const FLOWS = {
    chest: {
      title: "Chest pain assessment",
      intro: `<p>Let's assess this carefully. Chest pain can have many causes, and some require urgent evaluation.</p><p>I need to ask a few quick questions.</p>`,
      symptoms: ["Chest pain"],
      steps: [
        { blocks: [
          { key:"loc", q:"Where exactly is the pain?", opts:[{l:"Center of chest"},{l:"Left side"},{l:"Right side"},{l:"Other"}] },
          { key:"feel", q:"What does it feel like?", opts:[{l:"Pressure"},{l:"Sharp"},{l:"Burning"},{l:"Tightness"}] }
        ]},
        { blocks: [
          { key:"assoc", multi:true, q:"Are you experiencing any of these?", hint:"Select all that apply",
            opts:[{l:"Shortness of breath",danger:true},{l:"Cold sweat",danger:true},{l:"Nausea"},{l:"Weakness"},{l:"Pain spreading to arm or jaw",danger:true},{l:"None of these"}] }
        ]}
      ],
      evaluate(a) {
        const red = (a.assoc||[]).filter(x => /breath|sweat|spreading/i.test(x));
        if (red.length) return { emergency: true, flags: [
          ...red, "Chest pain with these features can indicate a heart or lung emergency"
        ]};
        return {
          triage: ["amber", "Chest pain should be evaluated by a healthcare professional, even when it seems mild."],
          confidence: "mod",
          causes: [
            { kind:"common", label:"Common possibilities", items:[
              { n:"Acid reflux", l:3 },{ n:"Muscle strain", l:2 },{ n:"Anxiety-related symptoms", l:2 } ]},
            { kind:"important", label:"Less common but important", items:[
              { n:"Heart-related causes", l:1 },{ n:"Lung-related conditions", l:1 } ]}
          ],
          reasoning: [
            { k:"Location", v:a.loc || "chest" },
            { k:"Character", v:a.feel || "not specified" },
            { k:"Red flags", v:"none of the urgent warning signs were reported" },
            { k:"History", v:"blood-pressure medication on record" }
          ],
          steps: [
            "Contact a clinician today to have this chest pain evaluated in person.",
            "Seek urgent care immediately if you develop shortness of breath, sweating, or pain spreading to the arm or jaw.",
            "Note when the pain occurs and whether it relates to meals, movement or stress."
          ],
          disclaimer: "This cannot be diagnosed from symptoms alone. A clinician may want to examine you and possibly run tests such as an ECG.",
          handoff: { concern:"Chest pain since this morning", symptoms:[a.feel?`${a.feel} sensation`:"chest discomfort", a.loc||"central chest"], history:"On lisinopril for hypertension", questions:["Is a cardiac cause reasonably excluded?","Would an ECG be appropriate?"], eval:"In-person assessment ± ECG" }
        };
      }
    },

    headache: {
      title: "Headache assessment",
      intro: `<p>I'm sorry you're dealing with a headache. Let's understand it a little better so I can give you useful guidance.</p>`,
      symptoms: ["Headache"],
      steps: [
        { blocks: [
          { key:"dur", q:"How long has it lasted?", opts:[{l:"A few hours"},{l:"Since yesterday"},{l:"Several days"},{l:"Over a week"}] },
          { key:"sev", q:"How severe is it?", opts:[{l:"Mild"},{l:"Moderate"},{l:"Severe"}] }
        ]},
        { blocks: [
          { key:"assoc", multi:true, q:"Any of these alongside the headache?", hint:"Select all that apply",
            opts:[{l:"Light sensitivity"},{l:"Nausea"},{l:"Fever"},{l:"Worst headache of your life",danger:true},{l:"Vision changes",danger:true},{l:"Weakness or numbness",danger:true},{l:"None of these"}] }
        ]}
      ],
      evaluate(a) {
        const red = (a.assoc||[]).filter(x=>/worst|vision|weakness/i.test(x));
        if (red.length) return { emergency:true, flags:[...red,"Sudden severe or neurological headache features need urgent assessment"] };
        const sev = a.sev === "Severe";
        return {
          triage: sev ? ["amber","A severe or persistent headache is worth having reviewed by a clinician."]
                      : ["green","Based on what you've shared, there are no obvious emergency warning signs."],
          confidence: "mod",
          causes: [
            { kind:"common", label:"Common possibilities", items:[
              { n:"Tension-type headache", l:3 },{ n:"Dehydration or poor sleep", l:2 },{ n:"Migraine", l:2 } ]},
            { kind:"important", label:"Less common but worth noting", items:[
              { n:"Medication-related headache", l:1 },{ n:"Sinus-related causes", l:1 } ]}
          ],
          reasoning: [
            { k:"Duration", v:a.dur || "not specified" },
            { k:"Severity", v:a.sev || "not specified" },
            { k:"Red flags", v:"no sudden-onset or neurological warning signs reported" },
            { k:"Pattern", v:"you've mentioned recurring headaches before" }
          ],
          steps: [
            "Rest, hydrate, and note what seems to trigger the headaches.",
            "Consider a clinician review if they keep recurring, as we've discussed before.",
            "Seek urgent care for a sudden 'worst-ever' headache, vision changes, or weakness."
          ],
          disclaimer: "Symptoms alone can't confirm the type of headache. Keeping a short diary of timing and triggers can really help a clinician.",
          handoff: { concern:"Recurring headaches", symptoms:["Headache "+(a.dur||""), ...(a.assoc||[]).filter(x=>x!=="None of these")], history:"No previous migraine diagnosis", questions:["Could this represent migraine?","Is any imaging warranted?"], eval:"Clinical assessment; symptom diary" }
        };
      }
    },

    abdominal: {
      title: "Stomach pain assessment",
      intro: `<p>Stomach pain has many possible causes. A few questions will help me narrow down what's most relevant.</p>`,
      symptoms: ["Abdominal pain"],
      steps: [
        { blocks: [
          { key:"loc", q:"Where is the pain mainly?", opts:[{l:"Upper abdomen"},{l:"Around the navel"},{l:"Lower abdomen"},{l:"All over"}] },
          { key:"food", q:"Is it related to eating?", opts:[{l:"Worse after eating"},{l:"Better after eating"},{l:"No clear link"}] }
        ]},
        { blocks: [
          { key:"assoc", multi:true, q:"Any of these?", hint:"Select all that apply",
            opts:[{l:"Heartburn"},{l:"Nausea"},{l:"Bloating"},{l:"Blood in stool",danger:true},{l:"Severe constant pain",danger:true},{l:"Fever"},{l:"None of these"}] }
        ]}
      ],
      evaluate(a) {
        const red = (a.assoc||[]).filter(x=>/blood|severe/i.test(x));
        if (red.length) return { emergency:true, flags:[...red,"These abdominal features can indicate a condition needing urgent evaluation"] };
        return {
          triage: ["amber","Consider contacting a clinician today, particularly if the pain persists or worsens."],
          confidence: "mod",
          causes: [
            { kind:"common", label:"Common possibilities", items:[
              { n:"Acid reflux / indigestion", l:3 },{ n:"Gastritis", l:2 },{ n:"Dietary trigger", l:2 } ]},
            { kind:"important", label:"Important to keep in mind", items:[
              { n:"Ulcer-related causes", l:1 },{ n:"Gallbladder-related causes", l:1 } ]}
          ],
          reasoning: [
            { k:"Location", v:a.loc || "not specified" },
            { k:"Food link", v:a.food || "not specified" },
            { k:"Red flags", v:"none of the urgent signs were reported" }
          ],
          steps: [
            "Note which foods seem to trigger it and try smaller, lighter meals.",
            "Contact a clinician today if pain persists, worsens, or keeps returning.",
            "Seek urgent care for severe constant pain, or any blood in vomit or stool."
          ],
          disclaimer: "This cannot be diagnosed from symptoms alone. Relationship to meals and location are helpful clues for your clinician.",
          handoff: { concern:"Stomach pain related to eating", symptoms:[a.loc||"abdominal pain", a.food||""], history:"Occasional ibuprofen use", questions:["Could this be reflux or gastritis?","Is testing for H. pylori appropriate?"], eval:"Clinical assessment" }
        };
      }
    },

    fever: {
      title: "Fever & sore throat",
      intro: `<p>Fever with a sore throat is common and usually has a clear cause. Let me ask a couple of things.</p>`,
      symptoms: ["Fever","Sore throat"],
      steps: [
        { blocks: [
          { key:"temp", q:"How high is the fever, roughly?", opts:[{l:"Feels warm"},{l:"Around 38°C / 100°F"},{l:"Over 39°C / 102°F"},{l:"Not sure"}] },
          { key:"dur", q:"How long have you felt unwell?", opts:[{l:"Today"},{l:"1–2 days"},{l:"3+ days"}] }
        ]},
        { blocks: [
          { key:"assoc", multi:true, q:"Any of these?", hint:"Select all that apply",
            opts:[{l:"Cough"},{l:"Runny nose"},{l:"Difficulty breathing",danger:true},{l:"Difficulty swallowing saliva",danger:true},{l:"Stiff neck",danger:true},{l:"None of these"}] }
        ]}
      ],
      evaluate(a) {
        const red = (a.assoc||[]).filter(x=>/breathing|swallowing|stiff/i.test(x));
        if (red.length) return { emergency:true, flags:[...red,"These features with fever can indicate a more serious infection"] };
        const hot = a.temp === "Over 39°C / 102°F";
        return {
          triage: hot ? ["amber","A high or persistent fever should be reviewed by a clinician."]
                      : ["green","This pattern is often a self-limiting viral illness, with no obvious emergency signs."],
          confidence: "mod",
          causes: [
            { kind:"common", label:"Common possibilities", items:[
              { n:"Viral pharyngitis (common cold/flu-like)", l:3 },{ n:"Viral upper respiratory infection", l:2 } ]},
            { kind:"important", label:"Sometimes bacterial", items:[
              { n:"Strep throat", l:1 },{ n:"Tonsillitis", l:1 } ]}
          ],
          reasoning: [
            { k:"Temperature", v:a.temp || "not specified" },
            { k:"Duration", v:a.dur || "not specified" },
            { k:"Red flags", v:"no breathing or swallowing difficulty reported" }
          ],
          steps: [
            "Rest, fluids, and simple fever relief can help most viral illnesses.",
            "See a clinician if the fever is high, lasts beyond 3 days, or you feel worse.",
            "Seek urgent care for difficulty breathing or swallowing, or a stiff neck."
          ],
          disclaimer: "A throat swab may be needed to tell viral from bacterial causes — that requires a clinician.",
          handoff: { concern:"Fever and sore throat", symptoms:["Fever "+(a.temp||""), "Sore throat", ...(a.assoc||[]).filter(x=>x!=="None of these")], history:"Penicillin allergy on record", questions:["Is a throat swab warranted?","If antibiotics are needed, note penicillin allergy."], eval:"Clinical assessment ± throat swab" }
        };
      }
    },

    dizzy: {
      title: "Dizziness assessment",
      intro: `<p>Let's look at your dizziness. A few questions will help me understand what might be behind it.</p>`,
      symptoms: ["Dizziness"],
      steps: [
        { blocks: [
          { key:"type", q:"Which best describes it?", opts:[{l:"Lightheaded / faint"},{l:"Spinning (vertigo)"},{l:"Off-balance"},{l:"Not sure"}] },
          { key:"when", q:"When does it happen?", opts:[{l:"On standing up"},{l:"All the time"},{l:"In episodes"}] }
        ]},
        { blocks: [
          { key:"assoc", multi:true, q:"Any of these?", hint:"Select all that apply",
            opts:[{l:"Chest pain",danger:true},{l:"Fainting",danger:true},{l:"Slurred speech",danger:true},{l:"Palpitations"},{l:"Nausea"},{l:"None of these"}] }
        ]}
      ],
      evaluate(a) {
        const red = (a.assoc||[]).filter(x=>/chest|fainting|slurred/i.test(x));
        if (red.length) return { emergency:true, flags:[...red,"Dizziness with these features needs urgent evaluation"] };
        return {
          triage: ["amber","Recurrent or persistent dizziness is worth having reviewed, especially with your blood-pressure medication."],
          confidence: "mod",
          causes: [
            { kind:"common", label:"Common possibilities", items:[
              { n:"Drop in blood pressure on standing", l:3 },{ n:"Dehydration", l:2 },{ n:"Inner-ear (vertigo)", l:2 } ]},
            { kind:"important", label:"Worth ruling out", items:[
              { n:"Medication effect", l:1 },{ n:"Heart-rhythm causes", l:1 } ]}
          ],
          reasoning: [
            { k:"Type", v:a.type || "not specified" },
            { k:"Timing", v:a.when || "not specified" },
            { k:"Medication", v:"lisinopril can sometimes cause lightheadedness" }
          ],
          steps: [
            "Rise slowly from sitting or lying, and keep well hydrated.",
            "Mention your lisinopril to a clinician — dizziness on standing can relate to it.",
            "Seek urgent care for fainting, chest pain, or slurred speech."
          ],
          disclaimer: "Blood-pressure readings sitting and standing, and a review of your medication, would help a clinician here.",
          handoff: { concern:"Dizziness", symptoms:[a.type||"dizziness", a.when||""], history:"On lisinopril for hypertension", questions:["Could this be medication-related orthostatic dizziness?"], eval:"Lying/standing BP; medication review" }
        };
      }
    },

    generic: {
      title: "Health consultation",
      intro: `<p>Thanks for telling me. I'll help you understand what might be going on and what to do next. A couple of questions first.</p>`,
      symptoms: [],
      steps: [
        { blocks: [
          { key:"dur", q:"How long has this been going on?", opts:[{l:"Today"},{l:"A few days"},{l:"A week or more"},{l:"On and off"}] },
          { key:"sev", q:"How much is it affecting you?", opts:[{l:"Mildly"},{l:"Moderately"},{l:"A lot"}] }
        ]},
        { blocks: [
          { key:"assoc", multi:true, q:"Any of these warning signs?", hint:"Select all that apply",
            opts:[{l:"Severe pain",danger:true},{l:"Difficulty breathing",danger:true},{l:"Fainting",danger:true},{l:"High fever"},{l:"None of these"}] }
        ]}
      ],
      evaluate(a) {
        const red = (a.assoc||[]).filter(x=>/severe|breathing|fainting/i.test(x));
        if (red.length) return { emergency:true, flags:[...red,"These warning signs should be evaluated urgently"] };
        return {
          triage: a.sev === "A lot" ? ["amber","Since this is affecting you significantly, a clinician review is a good idea."]
                                     : ["green","There are no obvious emergency warning signs in what you've shared."],
          confidence: "low",
          causes: [
            { kind:"common", label:"This is where I'd start", items:[
              { n:"Common, self-limiting causes", l:2 },{ n:"Lifestyle or stress-related factors", l:2 } ]},
            { kind:"important", label:"Keep an eye out", items:[
              { n:"Causes that need a clinician if it persists", l:1 } ]}
          ],
          reasoning: [
            { k:"Duration", v:a.dur || "not specified" },
            { k:"Impact", v:a.sev || "not specified" },
            { k:"Red flags", v:"none reported" }
          ],
          steps: [
            "Monitor your symptoms and note any changes over the next day or two.",
            "Contact a clinician if it persists, worsens, or you're worried.",
            "Seek urgent care for severe pain, breathing difficulty, or fainting."
          ],
          disclaimer: "I don't have enough detail to be specific here safely. Sharing more about your symptoms would let me help more.",
          handoff: { concern:"General health concern", symptoms:["See conversation"], history:"See profile", questions:["Assessment of ongoing symptoms"], eval:"Clinical assessment" }
        };
      }
    }
  };

  function detectFlow(text) {
    const t = text.toLowerCase();
    if (/chest|heart (pain|attack)/.test(t)) return "chest";
    if (/head ?ache|migraine|head hurts/.test(t)) return "headache";
    if (/stomach|abdomen|abdominal|belly|tummy|nausea|indigest|reflux/.test(t)) return "abdominal";
    if (/(fever|temperature).*(throat|cough|cold)|(throat|cough).*(fever)|sore throat|fever/.test(t)) return "fever";
    if (/dizz|lighthead|vertigo|faint|balance/.test(t)) return "dizzy";
    return "generic";
  }

  const Chat = {
    flow: null, stepIdx: 0, answers: {}, lastHandoff: null,
    reset() {
      thread.innerHTML = "";
      this.flow = null; this.stepIdx = 0; this.answers = {};
      $("#emergency").classList.remove("on");
      $("#ctxSymptoms").innerHTML = `<div class="ctx-empty">No active symptoms in this conversation yet.</div>`;
      this.greet();
    },
    greet() {
      const c = aiShell();
      c.innerHTML = `<div class="ai-text"><p>Hi, I'm NutritiScan. Tell me what's going on and I'll help you understand what might be happening and what to do next.</p>
        <p style="color:var(--ink-3);font-size:.88rem">You can describe symptoms, ask about a report or a medication, or use voice or a photo.</p></div>`;
    },
    async start(text) {
      NS.go("chat");
      if (!this.flow && thread.children.length <= 1) thread.innerHTML = "";
      bubbleUser(text);
      const key = detectFlow(text);
      // medication-style questions answered directly
      if (/what is (this )?(medicine|medication|drug)|lisinopril|ibuprofen|side effect|take .* together|interaction/i.test(text)) {
        return this.answerMedication(text);
      }
      this.flow = FLOWS[key];
      this.stepIdx = 0; this.answers = {};
      $("#chatTitle").textContent = this.flow.title;
      $("#chatSub").textContent = "Assessing · not a substitute for emergency care";
      updateContextSymptoms(this.flow.symptoms);
      const th = thinking("Reviewing your symptoms…");
      await typeInto(th, `<div class="ai-text">${this.flow.intro}</div>`, 850);
      this.askStep();
    },
    askStep() {
      const step = this.flow.steps[this.stepIdx];
      const card = document.createElement("div");
      const content = aiShell();
      const blocks = step.blocks.map((b, bi) => `
        <div class="qblock" data-block="${b.key}" data-multi="${!!b.multi}">
          <div class="q">${b.q}${b.hint?`<span class="hint">${b.hint}</span>`:""}</div>
          <div class="opts">${b.opts.map(o=>`<button class="opt ${o.danger?'danger':''}" data-val="${o.l}">${o.l}</button>`).join("")}</div>
        </div>`).join("");
      content.innerHTML = `<div class="qcard">${blocks}
        <div class="qcard-foot"><button class="btn btn-primary btn-sm" data-continue disabled>Continue ${ic("i-arrow")}</button>
        <span class="note">Answer only what's relevant.</span></div></div>`;

      const qcard = content.querySelector(".qcard");
      const contBtn = content.querySelector("[data-continue]");
      qcard.addEventListener("click", (e) => {
        const opt = e.target.closest(".opt"); if (!opt) return;
        const block = opt.closest(".qblock");
        const multi = block.dataset.multi === "true";
        if (multi) {
          // "None" is exclusive
          if (/none/i.test(opt.dataset.val)) {
            block.querySelectorAll(".opt.sel").forEach(o=>o.classList.remove("sel"));
            opt.classList.add("sel");
          } else {
            block.querySelectorAll(".opt").forEach(o=>{ if(/none/i.test(o.dataset.val)) o.classList.remove("sel"); });
            opt.classList.toggle("sel");
          }
        } else {
          block.querySelectorAll(".opt").forEach(o=>o.classList.remove("sel"));
          opt.classList.add("sel");
        }
        // enable continue when each block has a selection
        const ready = Array.from(qcard.querySelectorAll(".qblock")).every(bl=>bl.querySelector(".opt.sel"));
        contBtn.disabled = !ready;
      });
      contBtn.addEventListener("click", () => {
        // capture answers + echo as user summary
        const summary = [];
        step.blocks.forEach(b => {
          const bl = qcard.querySelector(`.qblock[data-block="${b.key}"]`);
          const sels = Array.from(bl.querySelectorAll(".opt.sel")).map(o=>o.dataset.val);
          this.answers[b.key] = b.multi ? sels : sels[0];
          if (sels.length) summary.push(sels.join(", "));
        });
        // lock the card
        qcard.querySelectorAll(".opt:not(.sel)").forEach(o=>o.style.opacity=".45");
        qcard.querySelector(".qcard-foot").remove();
        qcard.querySelectorAll(".opt").forEach(o=>o.style.pointerEvents="none");
        bubbleUser(summary.join(" · "));
        this.stepIdx++;
        if (this.stepIdx < this.flow.steps.length) {
          const th = thinking("Noted. One more thing…");
          typeInto(th, `<div class="ai-text"><p>Thanks — that helps.</p></div>`, 600).then(()=>this.askStep());
        } else {
          this.finish();
        }
      });
      scrollThread();
    },
    async finish() {
      const th = thinking("Reviewing your symptoms and history…");
      const res = this.flow.evaluate(this.answers);
      updateContextSymptoms(this.flow.symptoms, res.emergency ? "red" : (res.triage ? res.triage[0] : null));
      if (res.emergency) {
        await wait(900);
        th.closest(".msg").remove();
        triggerEmergency(res.flags);
        return;
      }
      this.lastHandoff = res.handoff; buildHandoff(res.handoff);
      let html = `<div class="ai-text"><p>Here's my assessment. ${RESP.confidence(res.confidence)}</p></div>`;
      html += RESP.triage(res.triage[0], res.triage[1]);
      html += RESP.causes(res.causes);
      html += RESP.reasoning(res.reasoning);
      html += RESP.steps(res.steps);
      html += RESP.disclaimer(res.disclaimer);
      html += RESP.evidence([
        { src:"Clinical assessment guidance", meta:"Trusted medical organization · Reviewed 2024", desc:"General guidance on evaluating this type of symptom and identifying warning signs." }
      ]);
      html += RESP.actions([
        { label:"Continue with a clinician", ic:"i-share", primary:true, nav:"handoff" },
        { label:"Save to health record", ic:"i-check", fn:"save" }
      ]);
      await typeInto(th, html, 1000);
      $("#chatSub").textContent = "Assessment ready · confirm with a clinician";
    },
    async answerMedication(text) {
      const which = /ibuprofen/i.test(text) ? DATA.meds[1] : DATA.meds[0];
      const together = /together|interaction/i.test(text);
      const th = thinking("Checking medication information…");
      let html;
      if (together) {
        html = `<div class="ai-text"><p>Good question to ask. Here's what to know about taking <strong>Ibuprofen</strong> with <strong>Lisinopril</strong>.</p></div>
          <div class="interaction">${ic("i-alert")}<div><div class="it">Worth reviewing with a professional</div>
          <div class="id">Taking ibuprofen regularly alongside lisinopril can reduce lisinopril's blood-pressure effect and, in some people, affect kidney function — especially with dehydration or long-term use. Occasional use is often fine, but it's best confirmed with your doctor or pharmacist.</div></div></div>
          ${RESP.disclaimer("Never change how you take a prescribed medication without professional guidance.")}`;
      } else {
        html = `<div class="ai-text"><p>Here's a clear overview of <strong>${which.name} ${which.dose}</strong>.</p></div>
          ${medDetailCard(which)}
          ${RESP.disclaimer("This is general information, not a change to your prescription. Follow your clinician's instructions.")}
          ${RESP.actions([{ label:"Open medication assistant", ic:"i-pill", nav:"meds" }])}`;
      }
      await typeInto(th, html, 850);
    }
  };

  function updateContextSymptoms(list, level) {
    const el = $("#ctxSymptoms");
    if (!list || !list.length) { el.innerHTML = `<div class="ctx-empty">No active symptoms yet.</div>`; return; }
    let h = list.map(s=>`<span class="ctx-tag">${ic("i-stethoscope")} ${s}</span>`).join("");
    if (level) {
      const map = { green:["var(--green)","Low concern"], amber:["var(--amber)","Needs review"], red:["var(--red)","Urgent"] };
      const [c,t] = map[level];
      h += `<div class="ctx-row" style="margin-top:8px"><span>Triage</span><b style="color:${c}">${t}</b></div>`;
    }
    el.innerHTML = h;
  }

  /* ── Emergency ── */
  function triggerEmergency(flags) {
    const em = $("#emergency");
    $("#emFlags").innerHTML = flags.map(f=>`<li>${ic("i-alert")} ${f}</li>`).join("");
    em.classList.add("on");
    $("#chatSub").textContent = "Urgent — seek medical care";
    updateContextSymptoms(Chat.flow ? Chat.flow.symptoms : [], "red");
    if (navigator.vibrate) navigator.vibrate([40,60,40]);
  }
  $("#emDismiss").addEventListener("click", () => {
    $("#emergency").classList.remove("on");
    const c = aiShell();
    c.innerHTML = `<div class="ai-text"><p>Understood — I've returned to our conversation. If your symptoms change or worsen, please don't hesitate to seek urgent care.</p></div>`;
  });

  /* ── Medication detail card ── */
  function medDetailCard(m) {
    return `<div class="card"><div class="card-head">${ic("i-pill")}<h4>${m.name} ${m.dose}</h4></div>
      <div class="card-body med-detail">
        <div class="lbl">Purpose</div>${m.purpose}
        <div class="lbl">Typical use</div>${m.typical}
        <div class="lbl">Common side effects</div>${m.effects}
        <div class="lbl">Important warnings</div>${m.warnings}
        <div class="lbl">Potential interactions</div>${m.interactions}
      </div></div>`;
  }

  /* ───────────────────────── RENDERERS ───────────────────────── */
  function renderMeds() {
    const html = DATA.meds.map((m,i)=>`
      <div class="med-card">
        <div class="med-pill">${ic("i-pill")}</div>
        <div class="med-info">
          <div class="mn">${m.name} <span class="mg">· ${m.dose}</span></div>
          <div class="mg">${m.purpose}</div>
          <div class="mrow">${m.tags.map(t=>`<span class="med-tag">${t}</span>`).join("")}</div>
          <details class="reasoning" style="margin-top:10px;border:none">
            <summary style="padding:6px 0;color:var(--accent)">${ic("i-info")} Details <span class="chev">${ic("i-chevron")}</span></summary>
            <div class="med-detail" style="padding:0">
              <div class="lbl">Typical use</div>${m.typical}
              <div class="lbl">Common side effects</div>${m.effects}
              <div class="lbl">Warnings</div>${m.warnings}
              <div class="lbl">Interactions</div>${m.interactions}
            </div>
          </details>
        </div>
      </div>`).join("");
    $("#medsList").innerHTML = html;
    $("#healthMeds").innerHTML = DATA.meds.map(m=>`
      <div class="med-card" style="padding:13px 18px">
        <div class="med-pill" style="width:38px;height:38px">${ic("i-pill")}</div>
        <div class="med-info"><div class="mn" style="font-size:.92rem">${m.name} <span class="mg">${m.dose}</span></div><div class="mg">${m.freq}</div></div>
      </div>`).join("");
  }

  function renderMemory() {
    const html = DATA.memory.map(m=>`
      <div class="mem-item ${m.on?'':'off'}" data-mem="${m.id}">
        <div class="mem-ic">${ic(m.ic)}</div>
        <div class="mem-body"><div class="mt">${m.text}</div><div class="ms">${m.sub}</div></div>
        <div class="mem-actions">
          <button data-mem-act="edit">Edit</button>
          <button data-mem-act="toggle">${m.on?"Don't use":"Use"}</button>
          <button class="del" data-mem-act="delete">Delete</button>
        </div>
      </div>`).join("");
    $("#healthMemory").innerHTML = html;
    $("#memCount").textContent = `${DATA.memory.filter(m=>m.on).length} memories`;
  }

  function renderHistory() {
    $("#historyList").innerHTML = DATA.history.map(h=>`
      <div class="med-card" style="align-items:center" data-hist="${h.id}">
        <div class="med-pill" style="background:var(--surface-3);color:var(--ink-2)">${ic(h.ic)}</div>
        <div class="med-info">
          <div class="mn" style="font-size:.94rem">${h.t}</div>
          <div class="mg">${h.d} · ${h.when}</div>
        </div>
        <div class="mem-actions">
          <button data-hist-act="continue">Continue</button>
          <button data-hist-act="rename">Rename</button>
          <button class="del" data-hist-act="delete">Delete</button>
        </div>
      </div>`).join("");
  }

  function renderTimeline() {
    $("#timeline").innerHTML = DATA.timeline.map(t=>`
      <div class="tl-item ${t.cls}">
        <div class="tl-date">${t.date}</div>
        <div class="tl-card"><div class="tc-t">${t.t} <span class="tag ${t.tagc}">${t.tag}</span></div><div class="tc-d">${t.d}</div></div>
      </div>`).join("");
  }

  function renderToggles(list, containerId) {
    $(containerId).innerHTML = list.map((r,i)=>`
      <div class="toggle-row"><div class="tr-body"><div class="tr-t">${r.t}</div><div class="tr-d">${r.d}</div></div>
      <button class="switch ${r.on?'on':''}" data-toggle="${i}"></button></div>`).join("");
  }

  /* ── Report / biomarkers ── */
  function renderBiomarkers() {
    $("#biomarkers").innerHTML = DATA.biomarkers.map(b=>{
      const flagTxt = { low:"Below range", high:"Above range", ok:"Normal" }[b.status];
      const range = rangeBar(b);
      return `<div class="biomarker clickable" data-bm="${b.id}">
        <div><div class="bm-name">${b.name}</div><div class="bm-sub">Reference ${b.lo}–${b.hi} ${b.unit}</div></div>
        <div class="bm-val"><div class="v">${b.value}<small> ${b.unit}</small></div><span class="bm-flag ${b.status}">${flagTxt}</span></div>
        <div class="bm-range">${range}</div>
      </div>`;
    }).join("");
  }
  function rangeBar(b) {
    const span = b.hi - b.lo;
    const padLo = b.lo - span*0.35, padHi = b.hi + span*0.35;
    const total = padHi - padLo;
    const pct = (v)=> Math.max(2, Math.min(98, ((v-padLo)/total)*100));
    const okL = pct(b.lo), okR = pct(b.hi);
    const mk = pct(b.value);
    return `<div class="range-track"><div class="range-fill-ok" style="left:${okL}%;width:${okR-okL}%"></div>
      <div class="range-marker ${b.status}" style="left:${mk}%"></div></div>
      <div class="range-labels"><span>${(padLo).toFixed(0)}</span><span>Reference ${b.lo}–${b.hi}</span><span>${(padHi).toFixed(0)}</span></div>`;
  }

  /* ── Lab detail with SVG trend ── */
  function openLabDetail(id) {
    const b = DATA.biomarkers.find(x=>x.id===id); if (!b) return;
    $("#labTitle").textContent = b.name;
    const trendDir = b.trend.length>1 ? (b.trend[b.trend.length-1].v - b.trend[0].v) : 0;
    const dirTxt = Math.abs(trendDir) < (b.hi-b.lo)*0.05 ? "held steady over" :
      (trendDir < 0 ? "decreased over" : "increased over");
    const conf = b.status==="ok" ? "high" : "mod";
    $("#labDetailBody").innerHTML = `
      <div class="page-head" style="margin-bottom:16px">
        <h1 style="display:flex;align-items:center;gap:10px">${b.value} <small style="font-size:1rem;color:var(--ink-3);font-weight:500">${b.unit}</small>
          <span class="bm-flag ${b.status}">${{low:"Below range",high:"Above range",ok:"Normal"}[b.status]}</span></h1>
        <p>Reference range ${b.lo}–${b.hi} ${b.unit} · ${RESP.confidence(conf)}</p>
      </div>
      <div class="panel trend-card">
        <div class="panel-head">${ic("i-trend")}<h3>Historical trend</h3></div>
        <div class="panel-body">${trendSVG(b)}</div>
        <div class="trend-note">${ic("i-info")} <div>Your ${b.name} has <strong>${dirTxt}</strong> the last ${b.trend.length} measurements.</div></div>
      </div>
      <div class="card" style="margin-top:0">
        <div class="card-head">${ic("i-brain")}<h4>What this means</h4></div>
        <div class="card-body"><div class="ai-text"><p>${b.explain}</p><p style="color:var(--ink-2)">${b.why}</p></div></div>
      </div>
      <div class="card">
        <div class="card-head">${ic("i-stethoscope")}<h4>What to discuss with your doctor</h4></div>
        <div class="card-body"><div class="steps-list">${b.discuss.map((d,i)=>`<div class="step-item"><span class="num">${i+1}</span><span>${d}</span></div>`).join("")}</div></div>
      </div>
      ${RESP.disclaimer("NutritiScan explains your result — it does not diagnose. Your doctor interprets this alongside your full history.")}
      <div class="resp-actions"><button class="btn btn-primary btn-sm" data-fn="ask-lab" data-lab="${b.name}">${ic("i-stethoscope")} Ask NutritiScan about this</button>
        <button class="btn btn-ghost btn-sm" data-nav="report">${ic("i-arrow")} Back to report</button></div>`;
    NS.go("labdetail");
  }
  function trendSVG(b) {
    const W=560,H=200, pl=44, pr=16, pt=16, pb=34;
    const iw=W-pl-pr, ih=H-pt-pb;
    const vals=b.trend.map(p=>p.v);
    let min=Math.min(...vals,b.lo), max=Math.max(...vals,b.hi);
    const padY=(max-min)*0.18||1; min-=padY; max+=padY;
    const x=(i)=> pl + (b.trend.length===1? iw/2 : (i/(b.trend.length-1))*iw);
    const y=(v)=> pt + (1-(v-min)/(max-min))*ih;
    const bandTop=y(b.hi), bandBot=y(b.lo);
    const pts=b.trend.map((p,i)=>[x(i),y(p.v)]);
    const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area=`${line} L${pts[pts.length-1][0].toFixed(1)},${(pt+ih)} L${pts[0][0].toFixed(1)},${(pt+ih)} Z`;
    const grid=[0,.5,1].map(f=>{const yy=pt+f*ih;return `<line class="grid-line" x1="${pl}" y1="${yy}" x2="${W-pr}" y2="${yy}"/>`}).join("");
    const dots=pts.map((p,i)=>`<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="4.5"/>
      <text class="dot-val" x="${p[0]}" y="${p[1]-10}">${b.trend[i].v}</text>
      <text class="dot-lbl" x="${p[0]}" y="${pt+ih+18}">${b.trend[i].l}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.18"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <rect class="range-band" x="${pl}" y="${Math.min(bandTop,bandBot)}" width="${iw}" height="${Math.abs(bandBot-bandTop)}" rx="4"/>
      <text class="axis-lbl" x="${pl}" y="${Math.min(bandTop,bandBot)-4}">reference range</text>
      ${grid}
      <path class="trend-area" d="${area}"/>
      <path class="trend-path" d="${line}"/>
      ${dots}
    </svg>`;
  }

  /* ── Handoff ── */
  function buildHandoff(d) {
    d = d || { concern:"Recurring headaches", symptoms:["Mild nausea","Light sensitivity"], history:"No previous migraine diagnosis", questions:["Could this represent migraine?"], eval:"Clinical assessment" };
    $("#handoffCard").innerHTML = `
      <div class="handoff-head"><div class="hic">${ic("i-share")}</div>
        <div><h3>Patient summary</h3><p>Prepared by NutritiScan · ${new Date().toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</p></div></div>
      <div class="handoff-sec"><div class="hs-label">Primary concern</div><div class="hs-val">${d.concern}</div></div>
      <div class="handoff-sec"><div class="hs-label">Symptoms</div><ul>${d.symptoms.filter(Boolean).map(s=>`<li>${s}</li>`).join("")}</ul></div>
      <div class="handoff-sec"><div class="hs-label">Relevant history</div><div class="hs-val">${d.history}</div></div>
      <div class="handoff-sec"><div class="hs-label">Questions for the clinician</div><ul>${d.questions.map(q=>`<li>${q}</li>`).join("")}</ul></div>
      <div class="handoff-sec"><div class="hs-label">Suggested evaluation</div><div class="hs-val">${d.eval}</div></div>
      <div class="handoff-foot"><button class="btn btn-primary" data-fn="share">${ic("i-share")} Share summary</button>
        <button class="btn btn-ghost" data-fn="copy">Copy to clipboard</button></div>`;
  }

  /* ───────────────────────── SEARCH ───────────────────────── */
  const SEARCH_INDEX = [
    ...DATA.history.map(h=>({t:h.t,d:h.when+" · "+h.d,ic:h.ic,fn:()=>openHistory(h.id)})),
    {t:"Blood report",d:"Report · Aug 10",ic:"i-doc",fn:()=>{loadReport();NS.go("report");}},
    {t:"Hemoglobin trend",d:"Lab result",ic:"i-trend",fn:()=>{loadReport();openLabDetail("hgb");}},
    {t:"Vitamin B12 trend",d:"Lab result",ic:"i-trend",fn:()=>{loadReport();openLabDetail("b12");}},
    {t:"Lisinopril",d:"Medication",ic:"i-pill",fn:()=>NS.go("meds")},
    {t:"Ibuprofen",d:"Medication",ic:"i-pill",fn:()=>NS.go("meds")},
    {t:"NutritiScan Memory",d:"Health context",ic:"i-brain",fn:()=>NS.go("health")},
    {t:"Health timeline",d:"Your history over time",ic:"i-clock",fn:()=>NS.go("timeline")},
    {t:"Trust & Safety",d:"How NutritiScan works",ic:"i-shield",fn:()=>NS.go("trust")}
  ];
  function renderSearch(q="") {
    const r = q ? SEARCH_INDEX.filter(x=>(x.t+" "+x.d).toLowerCase().includes(q.toLowerCase())) : SEARCH_INDEX;
    $("#searchResults").innerHTML = r.length ? r.map((x,i)=>`
      <div class="search-item" data-si="${SEARCH_INDEX.indexOf(x)}">
        <div class="si-ic">${ic(x.ic)}</div><div><div class="si-t">${x.t}</div><div class="si-d">${x.d}</div></div></div>`).join("")
      : `<div class="empty" style="padding:30px"><div class="eic">${ic("i-search")}</div><h3>No results</h3><p>Try a different search.</p></div>`;
  }

  /* ───────────────────────── HELPERS ───────────────────────── */
  const wait = (ms) => new Promise(r=>setTimeout(r,ms));
  let reportLoaded = false;
  function loadReport() {
    if (reportLoaded) return;
    reportLoaded = true;
    renderBiomarkers();
    $("#uploadZone").parentElement.parentElement.style.display = "none";
    $("#reportResult").style.display = "block";
  }
  function openHistory(id) {
    if (id==="report") { loadReport(); NS.go("report"); return; }
    if (id==="med")    { NS.go("meds"); return; }
    if (id==="skin")   { NS.go("chat"); openImageAssessment(); return; }
    const map = { chest:"I have chest pain since this morning.", headache:"I've had a headache since yesterday.", stomach:"I have stomach pain after eating." };
    NS.submit(map[id] || "I'd like to continue my assessment.", { fresh: true });
  }

  NS.toast = function (msg) {
    $("#toastMsg").textContent = msg;
    const t = $("#toast"); t.classList.add("on");
    clearTimeout(NS._tt); NS._tt = setTimeout(()=>t.classList.remove("on"), 2600);
  };

  /* ── Image assessment (multimodal demo) ── */
  function openImageAssessment() {
    $("#imageModalBody").innerHTML = `
      <div class="upload-zone" style="padding:22px" id="imgDrop">
        <div class="uic">${ic("i-camera")}</div>
        <h4>Add a photo of the area</h4>
        <p>Skin, swelling, redness, throat or a visible symptom.</p>
        <button class="btn btn-primary btn-sm" id="imgSample">${ic("i-sparkles")} Use a sample photo</button>
      </div>`;
    $("#imageScrim").classList.add("on");
    $("#imgSample").addEventListener("click", async () => {
      $("#imageScrim").classList.remove("on");
      NS.go("chat");
      bubbleUser("📷 Shared a photo of a skin area");
      const th = thinking("Reading your image…");
      await wait(1100);
      th.innerHTML = `<div class="ai-text"><p><strong>Image assessment.</strong> I can identify features that may be consistent with several skin conditions, but an image alone cannot establish a diagnosis.</p></div>
        <div class="card"><div class="card-head">${ic("i-camera")}<h4>Observed features</h4></div>
          <div class="card-body"><span class="ctx-tag">Redness</span><span class="ctx-tag">Localized swelling</span><span class="ctx-tag">Mild scaling</span></div></div>
        ${RESP.causes([{kind:"common",label:"Possible explanations",items:[{n:"Contact irritation / eczema",l:2},{n:"Mild skin infection",l:2},{n:"Allergic reaction",l:1}]}])}
        <div class="card"><div class="card-head">${ic("i-alert")}<h4>What to watch for</h4></div>
          <div class="card-body"><div class="steps-list">
            <div class="step-item"><span class="num" style="background:var(--red-soft);color:var(--red)">!</span><span>Rapid spread of redness</span></div>
            <div class="step-item"><span class="num" style="background:var(--red-soft);color:var(--red)">!</span><span>Severe pain or fever</span></div>
            <div class="step-item"><span class="num" style="background:var(--red-soft);color:var(--red)">!</span><span>Any difficulty breathing</span></div>
          </div></div></div>
        ${RESP.triage("amber","Consider professional evaluation if symptoms worsen or persist beyond a few days.")}
        ${RESP.disclaimer("Photos help, but skin conditions often need to be seen in person to be assessed properly.")}`;
      scrollThread();
      updateContextSymptoms(["Skin concern"], "amber");
    });
  }

  /* ───────────────────────── VOICE ───────────────────────── */
  function openVoice() {
    const scrim = $("#voiceScrim"), modal = $("#voiceModal");
    scrim.classList.add("on"); modal.classList.add("listening");
    $("#voiceStatus").textContent = "Listening…";
    $("#voiceSub").textContent = "Tell me what's bothering you.";
    clearTimeout(NS._v1); clearTimeout(NS._v2);
    NS._v1 = setTimeout(()=>{
      modal.classList.remove("listening");
      $("#voiceStatus").textContent = "Reviewing your symptoms…";
      $("#voiceSub").textContent = "“I've had a headache since yesterday and I'm a bit sensitive to light.”";
    }, 3200);
    NS._v2 = setTimeout(()=>{
      scrim.classList.remove("on");
      NS.submit("I've had a headache since yesterday and I'm sensitive to light.", { fresh: true });
    }, 5200);
  }
  function closeVoice() {
    $("#voiceScrim").classList.remove("on");
    clearTimeout(NS._v1); clearTimeout(NS._v2);
  }

  /* ───────────────────────── INPUT WIRING ───────────────────────── */
  function autoGrow(el){ el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,160)+"px"; }
  function wireComposer(inputSel, sendSel, onSend) {
    const inp = $(inputSel), snd = $(sendSel);
    inp.addEventListener("input", ()=>{ autoGrow(inp); snd.disabled = !inp.value.trim(); });
    inp.addEventListener("keydown", (e)=>{ if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); if (inp.value.trim()) fire(); }});
    snd.addEventListener("click", fire);
    function fire(){ const v=inp.value.trim(); if(!v) return; inp.value=""; autoGrow(inp); snd.disabled=true; onSend(v); }
  }

  /* ───────────────────────── GLOBAL CLICK DELEGATION ───────────────────────── */
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      const v = nav.dataset.nav;
      if (v==="report") loadReportMaybe(nav);
      if (v==="meds") renderMeds();
      if (v==="handoff") buildHandoff(Chat.lastHandoff);
      NS.go(v, { fresh: nav.dataset.fresh==="1" });
      return;
    }
    const prompt = e.target.closest("[data-prompt]");
    if (prompt) {
      if (prompt.dataset.go==="report") { loadReport(); NS.go("report"); return; }
      NS.submit(prompt.dataset.prompt, { fresh: true }); return;
    }
    const act = e.target.closest("[data-action]");
    if (act) {
      if (act.dataset.action==="voice") openVoice();
      if (act.dataset.action==="image") openImageAssessment();
      return;
    }
    // rail / mobile
    if (e.target.closest("[data-open-rail]")) { app.classList.add("rail-open"); return; }
    if (e.target.closest("[data-close-rail]")) { app.classList.remove("rail-open"); return; }
    // search
    if (e.target.closest("[data-open-search]")) { $("#searchScrim").classList.add("on"); renderSearch(); setTimeout(()=>$("#searchInput").focus(),50); return; }
    if (e.target.closest("[data-close-search]")) { $("#searchScrim").classList.remove("on"); return; }
    if (e.target.closest("[data-close-image]")) { $("#imageScrim").classList.remove("on"); return; }
    const si = e.target.closest("[data-si]");
    if (si) { $("#searchScrim").classList.remove("on"); SEARCH_INDEX[+si.dataset.si].fn(); return; }
    // convo open
    const convo = e.target.closest("[data-open-convo]");
    if (convo) { openHistory(convo.dataset.openConvo); return; }
    // context toggle
    if (e.target.closest("#ctxToggle")) { app.dataset.context = app.dataset.context==="on"?"off":"on"; return; }
    // biomarker
    const bm = e.target.closest("[data-bm]");
    if (bm) { openLabDetail(bm.dataset.bm); return; }
    // scrim backdrop close
    if (e.target.classList.contains("scrim")) { e.target.classList.remove("on"); if(e.target.id==="voiceScrim") closeVoice(); return; }
    // memory actions
    const memAct = e.target.closest("[data-mem-act]");
    if (memAct) {
      const item = memAct.closest("[data-mem]"); const m = DATA.memory.find(x=>x.id===item.dataset.mem);
      const a = memAct.dataset.memAct;
      if (a==="delete") { DATA.memory = DATA.memory.filter(x=>x.id!==m.id); renderMemory(); NS.toast("Memory deleted"); }
      if (a==="toggle") { m.on=!m.on; renderMemory(); NS.toast(m.on?"Memory in use":"Memory turned off"); }
      if (a==="edit") { const v=prompt2("Edit memory", m.text); if(v){m.text=v;renderMemory();} }
      return;
    }
    // history actions
    const histAct = e.target.closest("[data-hist-act]");
    if (histAct) {
      const item = histAct.closest("[data-hist]"); const id=item.dataset.hist; const a=histAct.dataset.histAct;
      if (a==="continue") openHistory(id);
      if (a==="delete") { DATA.history = DATA.history.filter(x=>x.id!==id); renderHistory(); NS.toast("Conversation deleted"); }
      if (a==="rename") { const h=DATA.history.find(x=>x.id===id); const v=prompt2("Rename conversation", h.t); if(v){h.t=v;renderHistory();} }
      return;
    }
    // toggles
    const tg = e.target.closest("[data-toggle]");
    if (tg) { tg.classList.toggle("on"); NS.toast(tg.classList.contains("on")?"Turned on":"Turned off"); return; }
    // fn buttons
    const fn = e.target.closest("[data-fn]");
    if (fn) {
      const f = fn.dataset.fn;
      if (f==="save") NS.toast("Saved to your health record");
      if (f==="share") NS.toast("Handoff summary ready to share");
      if (f==="copy") { copyHandoff(); }
      if (f==="ask-lab") { Chat.reset(); Chat.start(`Can you explain my ${fn.dataset.lab} result?`); }
      return;
    }
  });
  function loadReportMaybe(nav){ if(nav.dataset.nav==="report") loadReport(); }
  function prompt2(label, val){ try { return window.prompt(label, val); } catch(_){ return null; } }
  function copyHandoff(){
    const txt = $("#handoffCard").innerText;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(()=>NS.toast("Copied to clipboard"), ()=>NS.toast("Copied"));
    else NS.toast("Copied");
  }

  $("#searchInput") && $("#searchInput").addEventListener("input", (e)=>renderSearch(e.target.value));
  $("#voiceEnd").addEventListener("click", closeVoice);
  window.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){ $$(".scrim.on").forEach(s=>{s.classList.remove("on"); if(s.id==="voiceScrim")closeVoice();}); }});

  /* ═══════════════════════ REAL AI BACKEND (Claude + RAG) ═══════════════════════
     When the NutritiScan backend (ai/server.mjs) is reachable, chat is powered by
     Claude (claude-opus-5) with a medical/safety system prompt and retrieval-
     augmented grounding. When it isn't (e.g. the static GitHub Pages demo), we
     fall back to the local deterministic engine so the prototype still works. */
  NS.config = Object.assign({ backend: "", enabled: false },
    (typeof window !== "undefined" && window.NS_CONFIG) || {});

  (function detectBackend() {
    // Same-origin by default; if the page is served by server.mjs, /api/health answers.
    const base = NS.config.backend || (location.protocol.startsWith("http") ? location.origin : "");
    if (!base) return;
    fetch(base.replace(/\/$/, "") + "/api/health", { method: "GET" })
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j && j.ok) { NS.config.backend = base.replace(/\/$/, ""); NS.config.enabled = true; NS.config.model = j.model;
        $("#chatSub") && ($("#chatSub").textContent = "Grounded in medical literature · confirm with a clinician"); } })
      .catch(() => {});
  })();

  const patientContext = () => ({
    age: 29, sex: "male",
    conditions: ["hypertension"], allergies: ["penicillin"],
    medications: DATA.meds.map((m) => `${m.name} ${m.dose}`),
    memory: DATA.memory.filter((m) => m.on).map((m) => m.text),
  });

  const AIChat = {
    history: [],
    reset() { thread.innerHTML = ""; this.history = []; $("#emergency").classList.remove("on"); },
    async consult(text, { fresh } = {}) {
      NS.go("chat");
      if (fresh) this.reset();
      if (!this.history.length) thread.innerHTML = "";
      bubbleUser(text);
      this.history.push({ role: "user", content: text });
      $("#chatTitle").textContent = "AI Doctor";
      const th = thinking("Connecting to NutritiScan…");
      try {
        const res = await fetch(NS.config.backend + "/api/consult", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: this.history, patient: patientContext() }),
        });
        if (!res.ok || !res.body) throw new Error("backend");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", done = false, handled = false;
        while (!done) {
          const { value, done: d } = await reader.read(); done = d;
          buf += dec.decode(value || new Uint8Array(), { stream: !done });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
            const ev = (chunk.match(/^event: (.*)$/m) || [])[1];
            const dataLine = (chunk.match(/^data: (.*)$/m) || [])[1];
            if (!dataLine) continue;
            const data = JSON.parse(dataLine);
            if (ev === "status") { th.innerHTML = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span> ${data.label}</div>`; scrollThread(); }
            else if (ev === "final") { handled = true; this.renderFinal(th, data.payload, data.citations || []); }
            else if (ev === "error") { throw new Error(data.message || "backend"); }
          }
        }
        if (!handled) throw new Error("empty");
      } catch (e) {
        // graceful fallback to the offline engine
        th.closest(".msg") && th.closest(".msg").remove();
        this.history.pop();
        NS.config.enabled = false;
        Chat.start(text);
      }
    },
    renderFinal(th, p, citations) {
      this.history.push({ role: "assistant", content: p.reply || "" });
      const symptoms = (p.handoff && p.handoff.symptoms) || [];
      if (p.mode === "emergency") {
        th.closest(".msg").remove();
        buildHandoff(p.handoff);
        triggerEmergency((p.emergency_flags && p.emergency_flags.length) ? p.emergency_flags : ["Potential emergency features described"]);
        return;
      }
      const triMap = { green: "green", amber: "amber", red: "red" };
      const confMap = { high: "high", moderate: "mod", insufficient: "low" };
      let html = `<div class="ai-text"><p>${escapeHtml(p.reply || "")}</p></div>`;
      if (p.mode === "assess") {
        if (p.confidence) html = `<div class="ai-text"><p>${escapeHtml(p.reply || "")} ${RESP.confidence(confMap[p.confidence] || "low")}</p></div>`;
        if (p.triage && triMap[p.triage]) html += RESP.triage(triMap[p.triage], triageText(p.triage));
        if (p.causes && p.causes.length) html += RESP.causes(groupCauses(p.causes));
        if (p.reasoning && p.reasoning.length) html += RESP.reasoning(p.reasoning.map((r) => ({ k: r.factor, v: r.value })));
        if (p.next_steps && p.next_steps.length) html += RESP.steps(p.next_steps);
        if (p.disclaimer) html += RESP.disclaimer(escapeHtml(p.disclaimer));
        if ((p.evidence && p.evidence.length) || citations.length) html += aiEvidence(p.evidence, citations);
        html += RESP.actions([{ label: "Continue with a clinician", ic: "i-share", primary: true, nav: "handoff" }, { label: "Save to health record", ic: "i-check", fn: "save" }]);
        buildHandoff(p.handoff);
        updateContextSymptoms(symptoms, p.triage);
      } else if (p.mode === "ask" && p.followups && p.followups.length) {
        html += aiFollowups(p.followups);
        updateContextSymptoms(symptoms);
      }
      typeInto(th, html, 200).then(() => {
        if (p.mode === "ask") wireAIFollowups(th);
      });
    },
  };

  function escapeHtml(s) { const d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  function triageText(t) { return { green: "Based on what you've shared, there are no obvious emergency warning signs.", amber: "Your symptoms should be evaluated by a healthcare professional.", red: "These symptoms can indicate a medical emergency. Seek urgent care now." }[t] || ""; }
  function groupCauses(list) {
    const g = { common: [], important: [] };
    list.forEach((c) => (g[c.group] || g.common).push({ n: escapeHtml(c.name), l: Math.max(1, Math.min(3, c.likelihood || 1)) }));
    const out = [];
    if (g.common.length) out.push({ kind: "common", label: "Common possibilities", items: g.common });
    if (g.important.length) out.push({ kind: "important", label: "Less common but important", items: g.important });
    return out;
  }
  function aiEvidence(evidence, citations) {
    const items = (evidence && evidence.length ? evidence.map((e) => ({ src: e.title, meta: e.source + (e.url ? " · " + e.url : ""), desc: e.detail }))
      : citations.slice(0, 3).map((c) => ({ src: c.title, meta: `${c.source}${c.year ? " · " + c.year : ""}`, desc: c.url || "" })));
    return `<details class="evidence"><summary>${ic("i-book")} Why am I seeing this? · Sources</summary>
      ${items.map((e) => `<div class="ev-item"><div class="src">${escapeHtml(e.src)}</div><div class="meta">${escapeHtml(e.meta)}</div><div class="desc">${escapeHtml(e.desc)}</div></div>`).join("")}</details>`;
  }
  function aiFollowups(followups) {
    const blocks = followups.map((b, i) => `
      <div class="qblock" data-block="q${i}" data-multi="${!!b.multi}">
        <div class="q">${escapeHtml(b.question)}${b.multi ? `<span class="hint">Select all that apply</span>` : ""}</div>
        <div class="opts">${b.options.map((o) => `<button class="opt" data-val="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join("")}</div>
      </div>`).join("");
    return `<div class="qcard">${blocks}<div class="qcard-foot"><button class="btn btn-primary btn-sm" data-continue disabled>Continue ${ic("i-arrow")}</button><span class="note">Answer only what's relevant.</span></div></div>`;
  }
  function wireAIFollowups(node) {
    const qcard = node.querySelector(".qcard"); if (!qcard) return;
    const contBtn = qcard.querySelector("[data-continue]");
    qcard.addEventListener("click", (e) => {
      const opt = e.target.closest(".opt"); if (!opt) return;
      const block = opt.closest(".qblock");
      if (block.dataset.multi === "true") opt.classList.toggle("sel");
      else { block.querySelectorAll(".opt").forEach((o) => o.classList.remove("sel")); opt.classList.add("sel"); }
      contBtn.disabled = !Array.from(qcard.querySelectorAll(".qblock")).every((bl) => bl.querySelector(".opt.sel"));
    });
    contBtn.addEventListener("click", () => {
      const parts = Array.from(qcard.querySelectorAll(".qblock")).map((bl) => Array.from(bl.querySelectorAll(".opt.sel")).map((o) => o.dataset.val).join(", ")).filter(Boolean);
      qcard.querySelectorAll(".opt:not(.sel)").forEach((o) => (o.style.opacity = ".45"));
      qcard.querySelectorAll(".opt").forEach((o) => (o.style.pointerEvents = "none"));
      qcard.querySelector(".qcard-foot").remove();
      AIChat.consult(parts.join(" · "));
    });
  }

  /* Unified entry point — real AI when available, offline engine otherwise. */
  NS.submit = function (text, opts = {}) {
    if (NS.config.enabled) return AIChat.consult(text, opts);
    if (opts.fresh) Chat.reset();
    return Chat.start(text);
  };

  /* ───────────────────────── INIT ───────────────────────── */
  wireComposer("#homeInput", "#homeSend", (v)=>NS.submit(v, { fresh: true }));
  wireComposer("#chatInput", "#chatSend", (v)=>NS.submit(v));
  $("#loadSample") && $("#loadSample").addEventListener("click", ()=>{ loadReport(); NS.toast("Report analyzed"); });

  renderMeds(); renderMemory(); renderHistory(); renderTimeline();
  renderToggles(DATA.privacy, "#privacyControls");
  renderToggles(DATA.settings, "#settingsBody");
  buildHandoff(null);
  Chat.greet();

  // responsive context panel on resize
  window.addEventListener("resize", ()=>{ if (app.dataset.view!=="chat") app.dataset.context="off"; else app.dataset.context = window.innerWidth>1080?"on":"off"; });
})();
