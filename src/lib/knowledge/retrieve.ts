import { KNOWLEDGE_RECORDS } from "./records";
import type { KnowledgeRecord, RetrievedRecord } from "./types";

/**
 * Lexical (BM25-style) retrieval over the curated knowledge base.
 *
 * Runs fully offline — no embeddings service required — so grounding works with
 * zero external dependencies. This is the keyword/BM25 half of the hybrid
 * retrieval described in the spec (§20); semantic embeddings + a cross-encoder
 * reranker can be layered on later behind the same interface.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "for", "with", "my", "me", "i", "you", "it", "this",
  "that", "have", "has", "had", "do", "does", "did", "am", "im", "ive", "so",
  "if", "at", "as", "by", "from", "about", "what", "why", "how", "when", "should",
  "can", "could", "would", "will", "been", "feeling", "feel", "get", "getting",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function docText(r: KnowledgeRecord): string {
  return `${r.title} ${r.topics.join(" ")} ${r.specialty} ${r.excerpt}`;
}

// Precompute the corpus index once.
const CORPUS = KNOWLEDGE_RECORDS.map((r) => ({
  record: r,
  tokens: tokenize(docText(r)),
  topicSet: new Set(r.topics.map((t) => t.toLowerCase())),
}));

const N = CORPUS.length;
const AVG_LEN = CORPUS.reduce((s, d) => s + d.tokens.length, 0) / Math.max(N, 1);

// Document frequency per term.
const DF = new Map<string, number>();
for (const d of CORPUS) {
  for (const term of new Set(d.tokens)) DF.set(term, (DF.get(term) ?? 0) + 1);
}

const K1 = 1.5;
const B = 0.75;

function idf(term: string): number {
  const df = DF.get(term) ?? 0;
  return Math.log(1 + (N - df + 0.5) / (df + 0.5));
}

export interface RetrievalResult {
  hits: RetrievedRecord[];
  /** false when nothing clears the relevance bar → the AI must not over-claim. */
  sufficient: boolean;
}

export function retrieveEvidence(query: string, k = 4): RetrievalResult {
  const qTerms = tokenize(query);
  if (qTerms.length === 0) return { hits: [], sufficient: false };

  const scored = CORPUS.map((d) => {
    const len = d.tokens.length || 1;
    const tf = new Map<string, number>();
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const term of qTerms) {
      const f = tf.get(term) ?? 0;
      if (f === 0) continue;
      const denom = f + K1 * (1 - B + (B * len) / AVG_LEN);
      score += idf(term) * ((f * (K1 + 1)) / denom);
      if (d.topicSet.has(term)) score += 0.6; // exact topic-tag boost
    }
    // gentle authority boost so Tier 1 sources win close calls
    if (score > 0) score *= 1 + (5 - d.record.evidenceTier) * 0.04;
    return { record: d.record, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const hits: RetrievedRecord[] = scored.map((s, i) => ({
    index: i + 1,
    score: Number(s.score.toFixed(3)),
    record: s.record,
  }));

  // "sufficient" if the top hit is clearly relevant.
  const sufficient = hits.length > 0 && hits[0].score >= 1.2;
  return { hits, sufficient };
}
