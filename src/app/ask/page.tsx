"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Plus, Send, ShieldCheck, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmergencyBanner } from "@/components/companion/emergency-banner";
import { AIStructuredMessage } from "@/components/companion/ai-message";
import { SourceList, EvidenceNote } from "@/components/companion/sources";
import type { CompanionResult } from "@/lib/ai/types";

type Item =
  | { role: "user"; content: string }
  | { role: "assistant"; result: CompanionResult }
  | { role: "assistant"; pending: true }
  | { role: "assistant"; error: string };

const SUGGESTIONS = [
  "I've been feeling tired for a week",
  "What should I eat for more energy?",
  "Is 2 rotis + paneer + dal a balanced meal?",
  "What does high cholesterol mean?",
];

/** Flatten a result to plain text so the model keeps conversational context. */
function toText(r: CompanionResult): string {
  if (r.emergency) return r.emergency.message;
  const s = r.structured;
  if (!s) return r.text ?? "";
  return [
    s.summary,
    ...s.questions,
    ...s.possibleCauses,
    ...s.recommendations,
    s.nutritionAngle,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function AskPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const scroll = () =>
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    });

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const priorApi = items
      .filter(
        (it): it is Extract<Item, { role: "user" } | { role: "assistant"; result: CompanionResult }> =>
          it.role === "user" || (it.role === "assistant" && "result" in it),
      )
      .map((it) =>
        it.role === "user"
          ? { role: "user" as const, content: it.content }
          : { role: "assistant" as const, content: toText(it.result) },
      );

    const nextApi = [...priorApi, { role: "user" as const, content: trimmed }];

    setItems((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", pending: true }]);
    setInput("");
    setBusy(true);
    scroll();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextApi }),
      });
      const data = await res.json();
      setItems((prev) => {
        const copy = prev.slice(0, -1); // drop the pending placeholder
        if (!res.ok) return [...copy, { role: "assistant", error: data.error || "Something went wrong." }];
        return [...copy, { role: "assistant", result: data as CompanionResult }];
      });
    } catch {
      setItems((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", error: "Couldn't reach NutritiScan. Please try again." },
      ]);
    } finally {
      setBusy(false);
      scroll();
    }
  }

  const empty = items.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-line bg-bg/80 px-5 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-white">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          NutritiScan
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="h-3.5 w-3.5" /> AI Health Companion
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 overflow-hidden px-5 py-5">
        {/* main conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={logRef} className="flex-1 space-y-5 overflow-y-auto pb-4">
            {empty ? (
              <EmptyState onPick={send} />
            ) : (
              items.map((it, i) => <Bubble key={i} item={it} />)
            )}
          </div>

          {/* input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="mt-2 flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Describe how you feel, or ask a health or nutrition question…"
              className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-[0.95rem] outline-none placeholder:text-muted"
            />
            <Button type="submit" size="sm" variant="accent" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted">
            NutritiScan gives general information, not a diagnosis. In an emergency, call your local emergency number.
          </p>
        </div>

        {/* context panel (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-accent" /> How NutritiScan helps
              </div>
              <ul className="space-y-2.5 text-sm text-muted">
                <li>Asks focused follow-ups before guiding you.</li>
                <li>Explains possible causes — never a diagnosis.</li>
                <li>Flags when to seek professional care.</li>
                <li>Connects symptoms to nutrition & lifestyle.</li>
              </ul>
              <p className="flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your messages are used only to generate this guidance.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Bubble({ item }: { item: Item }) {
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-white">
          {item.content}
        </div>
      </div>
    );
  }

  if ("pending" in item) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        NutritiScan is thinking…
      </div>
    );
  }

  if ("error" in item) {
    return (
      <Card className="border-danger/40 bg-danger-soft">
        <CardBody className="text-sm text-ink">{item.error}</CardBody>
      </Card>
    );
  }

  // assistant result
  const r = item.result;
  if (r.emergency) return <EmergencyBanner message={r.emergency.message} />;

  const showEvidenceNote =
    !!r.structured && r.structured.evidenceSufficient === false && r.sources.length === 0;

  return (
    <Card>
      <CardBody>
        {r.structured ? (
          <>
            <AIStructuredMessage data={r.structured} />
            {showEvidenceNote && <EvidenceNote />}
            <SourceList sources={r.sources} />
          </>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{r.text}</p>
        )}
      </CardBody>
    </Card>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">How are you feeling?</h1>
      <p className="mt-2 max-w-md text-muted">
        Describe a symptom, ask a nutrition question, or start with one of these.
      </p>
      <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm hover:border-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
