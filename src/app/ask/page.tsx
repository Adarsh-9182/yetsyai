"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  ArrowUp,
  Stethoscope,
  SquarePen,
  Home,
  MessageSquare,
} from "lucide-react";
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
  "Is 2 rotis + 150g paneer + dal balanced?",
  "What does high cholesterol mean?",
];

function toText(r: CompanionResult): string {
  if (r.emergency) return r.emergency.message;
  const s = r.structured;
  if (!s) return r.text ?? "";
  return [s.summary, ...s.questions, ...s.possibleCauses, ...s.recommendations, s.nutritionAngle]
    .filter(Boolean)
    .join(" ");
}

export default function AskPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const scroll = () =>
    requestAnimationFrame(() =>
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }),
    );

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
        const copy = prev.slice(0, -1);
        if (!res.ok) return [...copy, { role: "assistant", error: data.error || "Something went wrong." }];
        return [...copy, { role: "assistant", result: data as CompanionResult }];
      });
    } catch {
      setItems((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", error: "Couldn't reach the AI doctor. Please try again." },
      ]);
    } finally {
      setBusy(false);
      scroll();
    }
  }

  // Auto-start from a landing-page prompt (/ask?q=…), once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      window.history.replaceState(null, "", "/ask");
      send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newChat = () => {
    setItems([]);
    setInput("");
  };

  const empty = items.length === 0;

  return (
    <div className="flex h-dvh bg-bg">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2 px-4 py-4 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
          NutritiScan
          <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            AI Doctor
          </span>
        </div>

        <div className="px-3">
          <button
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium transition-colors hover:border-ink"
          >
            <SquarePen className="h-4 w-4" /> New consultation
          </button>
        </div>

        <div className="px-3 py-4">
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted">Conversations</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg px-2 py-6 text-xs text-muted">
            <MessageSquare className="h-4 w-4" />
            Your consultations will appear here.
          </div>
        </div>

        <div className="mt-auto border-t border-line p-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted hover:text-ink">
            <Home className="h-4 w-4" /> Back to home
          </Link>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            AI guidance, not a diagnosis. Not a substitute for a licensed
            physician. In an emergency, call your local emergency number.
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold md:hidden">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-white">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            NutritiScan
          </Link>
          <div className="hidden items-center gap-2 text-sm text-muted md:flex">
            <Stethoscope className="h-4 w-4 text-accent" /> AI Doctor consultation
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-success" /> online
          </span>
        </header>

        <div ref={logRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {empty ? (
              <Welcome onPick={send} />
            ) : (
              <div className="space-y-6">
                {items.map((it, i) => (
                  <Row key={i} item={it} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-bg/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm focus-within:border-accent"
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
                placeholder="Message the AI doctor…"
                className="max-h-48 flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.98rem] outline-none placeholder:text-muted"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={busy || !input.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted">
              NutritiScan can make mistakes and does not diagnose. In an emergency, call your local emergency number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Message rows ─────────────────────────────────────────────────────────── */

function Assistant({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-white">
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm font-semibold">NutritiScan</div>
        {children}
      </div>
    </div>
  );
}

function Row({ item }: { item: Item }) {
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-white">
          {item.content}
        </div>
      </div>
    );
  }

  if ("pending" in item) {
    return (
      <Assistant>
        <div className="flex items-center gap-1 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
        </div>
      </Assistant>
    );
  }

  if ("error" in item) {
    return (
      <Assistant>
        <div className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm">{item.error}</div>
      </Assistant>
    );
  }

  const r = item.result;
  if (r.emergency) {
    return (
      <Assistant>
        <EmergencyBanner message={r.emergency.message} />
      </Assistant>
    );
  }

  const showEvidenceNote =
    !!r.structured && r.structured.evidenceSufficient === false && r.sources.length === 0;

  return (
    <Assistant>
      <div className="rounded-2xl rounded-tl-md border border-line bg-surface p-4 shadow-sm">
        {r.structured ? (
          <>
            <AIStructuredMessage data={r.structured} />
            {showEvidenceNote && <EvidenceNote />}
            <SourceList sources={r.sources} />
          </>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{r.text}</p>
        )}
      </div>
    </Assistant>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-white shadow-md">
        <Plus className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">How can I help with your health today?</h1>
      <p className="mt-3 max-w-md text-muted">
        I&rsquo;m your AI doctor. Describe a symptom, ask a nutrition question, or
        start with one of these.
      </p>
      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
