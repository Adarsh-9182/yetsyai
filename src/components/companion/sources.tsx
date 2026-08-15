import { BookOpen, ExternalLink, ShieldQuestion } from "lucide-react";
import type { CitedSource } from "@/lib/ai/types";

const TIER_LABEL: Record<number, string> = {
  1: "Guideline / authority",
  2: "Peer-reviewed",
  3: "Secondary reference",
  4: "General source",
};

/** Renders the real records a response cited. Never model-invented. */
export function SourceList({ sources }: { sources: CitedSource[] }) {
  if (sources.length === 0) return null;
  const anyUnverified = sources.some((s) => s.reviewStatus === "unverified");

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <BookOpen className="h-3.5 w-3.5" /> Sources
      </div>
      <ul className="mt-2 space-y-1.5">
        {sources.map((s) => (
          <li key={s.index} className="flex items-start gap-2 text-xs">
            <span className="tnum mt-0.5 shrink-0 text-muted">[{s.index}]</span>
            <span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {s.title}
                <ExternalLink className="ml-0.5 inline h-3 w-3 align-baseline" />
              </a>
              <span className="text-muted">
                {" "}· {s.publisher} · {TIER_LABEL[s.evidenceTier]}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {anyUnverified && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
          <ShieldQuestion className="mt-0.5 h-3 w-3 shrink-0" />
          Starter references — must be verified against the current primary source
          before clinical use.
        </p>
      )}
    </div>
  );
}

export function EvidenceNote() {
  return (
    <p className="mt-3 rounded-lg bg-panel px-3 py-2 text-xs text-muted">
      No vetted sources closely matched this question, so the guidance below is
      general and not drawn from NutritiScan&rsquo;s knowledge base.
    </p>
  );
}
