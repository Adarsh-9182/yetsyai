// Retrieval-Augmented Grounding: pull citable evidence from open-access
// medical literature (Europe PMC / PubMed) and research pre-prints (arXiv).
import type { Citation } from "./types";

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have i in is it my me of on or that the to was we what when why with you your do does can could should would will ive im having had been since ago about into over under out get got feel feeling really very just").split(/\s+/)
);

export function toQuery(text: string): string {
  const words = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const w of words) if (!seen.has(w)) { seen.add(w); terms.push(w); }
  return terms.slice(0, 8).join(" ").trim();
}

async function fetchWithTimeout(url: string, ms: number, headers?: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal, headers }); }
  finally { clearTimeout(t); }
}

async function europePMC(query: string, limit = 4): Promise<Citation[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${limit}&resultType=lite`;
  const res = await fetchWithTimeout(url, 6000, { "User-Agent": "NutritiScan/1.0 (research prototype)" });
  if (!res.ok) return [];
  const data: any = await res.json();
  const results: any[] = data?.resultList?.result ?? [];
  return results.map((r) => ({
    source: "Europe PMC",
    title: r.title || "Untitled",
    authors: r.authorString || "",
    publication: r.journalTitle || r.source || "",
    year: r.pubYear || "",
    id: r.pmid ? `PMID:${r.pmid}` : r.doi ? `DOI:${r.doi}` : r.id || "",
    url: r.doi ? `https://doi.org/${r.doi}` : r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : "",
  }));
}

async function arxiv(query: string, limit = 2): Promise<Citation[]> {
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent("all:" + query)}&start=0&max_results=${limit}`;
  const res = await fetchWithTimeout(url, 6000);
  if (!res.ok) return [];
  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => {
    const pick = (tag: string) => {
      const m = e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].replace(/\s+/g, " ").trim() : "";
    };
    const id = pick("id");
    return {
      source: "arXiv",
      title: pick("title"),
      authors: (e.match(/<name>([\s\S]*?)<\/name>/g) || []).slice(0, 3).map((n) => n.replace(/<\/?name>/g, "")).join(", "),
      publication: "arXiv pre-print",
      year: (pick("published").match(/\d{4}/) || [""])[0],
      id: id.split("/abs/")[1] || "",
      url: id,
    } as Citation;
  }).filter((r) => r.title);
}

export async function retrieve(rawText: string, max = 5): Promise<{ query: string; citations: Citation[] }> {
  const query = toQuery(rawText);
  if (!query) return { query: "", citations: [] };
  const settled = await Promise.allSettled([europePMC(query, 4), arxiv(query, 2)]);
  const merged = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const c of merged) {
    const key = (c.title || "").toLowerCase().slice(0, 80);
    if (key && !seen.has(key)) { seen.add(key); citations.push(c); }
    if (citations.length >= max) break;
  }
  return { query, citations };
}
