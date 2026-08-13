/* ═══════════════════════════════════════════════════════════════
   NutritiScan — Retrieval-Augmented Grounding
   Pulls citations from open-access medical literature so every
   AI explanation can be grounded in a real, retrievable source:
     · Europe PMC  (PubMed / MEDLINE / PMC — clinical literature)
     · arXiv       (pre-print research, incl. medical AI / stats)
   These are public APIs. Failures degrade gracefully to [].
   ═══════════════════════════════════════════════════════════════ */

const STOPWORDS = new Set(("a an and are as at be but by for from has have i in is it my me of on or that the to was we what when why with you your do does can could should would will i've i'm having had been my mr been since ago about into over under out get got feel feeling really very just been").split(/\s+/));

/** Turn free-text symptoms into a compact literature query. */
export function toQuery(text) {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // keep the most informative (longer) unique terms
  const seen = new Set();
  const terms = [];
  for (const w of words) { if (!seen.has(w)) { seen.add(w); terms.push(w); } }
  return terms.slice(0, 8).join(" ").trim();
}

async function withTimeout(promise, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await promise(ctrl.signal); }
  finally { clearTimeout(t); }
}

/** Europe PMC — the primary clinical source. */
async function europePMC(query, limit = 4) {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${limit}&resultType=lite`;
  const res = await withTimeout((signal) => fetch(url, { signal, headers: { "User-Agent": "NutritiScan/1.0 (research prototype)" } }), 6000);
  if (!res.ok) return [];
  const data = await res.json();
  const results = (data && data.resultList && data.resultList.result) || [];
  return results.map((r) => ({
    source: "Europe PMC",
    title: r.title || "Untitled",
    authors: r.authorString || "",
    publication: r.journalTitle || r.source || "",
    year: r.pubYear || "",
    id: r.pmid ? `PMID:${r.pmid}` : (r.doi ? `DOI:${r.doi}` : (r.id || "")),
    url: r.doi ? `https://doi.org/${r.doi}` : (r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : ""),
  }));
}

/** arXiv — pre-print research (light XML parse, no XML dependency). */
async function arxiv(query, limit = 2) {
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent("all:" + query)}&start=0&max_results=${limit}`;
  const res = await withTimeout((signal) => fetch(url, { signal }), 6000);
  if (!res.ok) return [];
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => {
    const pick = (tag) => { const m = e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? m[1].replace(/\s+/g, " ").trim() : ""; };
    const id = pick("id");
    return {
      source: "arXiv",
      title: pick("title"),
      authors: (e.match(/<name>([\s\S]*?)<\/name>/g) || []).slice(0, 3).map((n) => n.replace(/<\/?name>/g, "")).join(", "),
      publication: "arXiv pre-print",
      year: (pick("published").match(/\d{4}/) || [""])[0],
      id: id.split("/abs/")[1] || "",
      url: id,
    };
  }).filter((r) => r.title);
}

/**
 * Retrieve grounding evidence for a query.
 * Returns a de-duplicated, capped list of citation objects.
 */
export async function retrieve(rawText, { max = 5 } = {}) {
  const query = toQuery(rawText);
  if (!query) return { query: "", citations: [] };
  const settled = await Promise.allSettled([europePMC(query, 4), arxiv(query, 2)]);
  const merged = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const seen = new Set();
  const citations = [];
  for (const c of merged) {
    const key = (c.title || "").toLowerCase().slice(0, 80);
    if (key && !seen.has(key)) { seen.add(key); citations.push(c); }
    if (citations.length >= max) break;
  }
  return { query, citations };
}
