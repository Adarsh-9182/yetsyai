"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Plus } from "lucide-react";

const SUGGESTIONS = [
  "I've been tired for a week",
  "What should I eat for more energy?",
  "Is 2 rotis + paneer + dal balanced?",
  "What does high cholesterol mean?",
];

export function Hero() {
  const router = useRouter();
  const [text, setText] = useState("");

  const go = (q: string) => {
    const query = q.trim();
    router.push(query ? `/ask?q=${encodeURIComponent(query)}` : "/ask");
  };

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 0%, hsl(var(--accent) / 0.07), transparent 70%)",
        }}
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center md:py-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Your AI Doctor · free to start
        </span>

        <div className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white shadow-md">
          <Plus className="h-7 w-7" strokeWidth={2.5} />
        </div>

        <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Meet NutritiScan, your AI&nbsp;doctor.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Describe how you feel or ask any health or nutrition question. It
          listens like a clinician, explains in plain language, shows its
          sources, and tells you when to seek real care.
        </p>

        {/* Big chatbot-forward prompt box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(text);
          }}
          className="mt-8 w-full max-w-2xl"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg focus-within:border-accent">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  go(text);
                }
              }}
              rows={1}
              placeholder="Describe your symptoms, or ask the AI doctor anything…"
              className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.98rem] outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              aria-label="Ask the AI doctor"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/90"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => go(s)}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-ink hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">
          AI guidance for education — not a substitute for a licensed physician,
          and not for emergencies.
        </p>
      </div>
    </section>
  );
}
