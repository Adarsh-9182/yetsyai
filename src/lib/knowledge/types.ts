/**
 * Medical/nutrition knowledge record.
 *
 * This is the provenance-carrying unit the citation engine cites. The AI is
 * NEVER allowed to cite anything that isn't one of these records — it can only
 * reference records we retrieved and handed it. That is the core anti-invented-
 * citation control (spec §23).
 *
 * `evidenceTier` follows the spec's evidence hierarchy (§21):
 *   1 = current clinical guidelines / government health authorities / regulatory
 *       labels / systematic reviews
 *   2 = peer-reviewed clinical studies / major academic institutions
 *   3 = secondary medical references
 *   4 = general health websites
 *
 * `reviewStatus` is "unverified" for the starter set below: the retrieval and
 * citation *engine* is real, but these seed excerpts and links must be verified
 * by a clinician/medical librarian before any production/clinical use.
 */
export type EvidenceTier = 1 | 2 | 3 | 4;
export type ReviewStatus = "verified" | "unverified";

export interface KnowledgeRecord {
  id: string;
  title: string;
  publisher: string;
  jurisdiction: string; // "global" | "US" | "UK" | "IN" | ...
  specialty: string;
  evidenceTier: EvidenceTier;
  url: string; // stable top-level source, not a fabricated deep link
  publishedYear?: number;
  topics: string[]; // retrieval tags
  excerpt: string; // paraphrased summary — verify before clinical use
  reviewStatus: ReviewStatus;
}

/** A retrieval hit: the record plus its relevance score and display index. */
export interface RetrievedRecord {
  index: number; // 1-based, shown to the model for citation
  score: number;
  record: KnowledgeRecord;
}
