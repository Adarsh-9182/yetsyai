import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthPreview } from "./health-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* very subtle, restrained background wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 70% 0%, hsl(var(--accent) / 0.06), transparent 70%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            AI-powered health guidance · free to start
          </span>

          <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            A smarter way to understand your health.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            NutritiScan combines AI-powered health guidance, nutrition
            intelligence, meal analysis, and personalized insights in one
            private health companion.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ask">
              <Button size="lg">
                Start your health assessment <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">Explore NutritiScan</Button>
            </a>
          </div>

          <p className="mt-5 text-xs text-muted">
            Evidence-informed guidance — not a diagnosis or a replacement for your doctor.
          </p>
        </div>

        <div className="animate-fade-up md:pl-6">
          <HealthPreview />
        </div>
      </div>
    </section>
  );
}
