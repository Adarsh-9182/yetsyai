import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Photo } from "./photo";

export function NutritionBand() {
  return (
    <section id="nutrition" className="border-y border-line bg-panel">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-20">
        <Photo
          src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1000&q=80&auto=format&fit=crop"
          alt="Fresh fruit and vegetables arranged on a table"
          className="aspect-[5/4] w-full"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Prevention, not just triage
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Food is the first medicine
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
            NutritiScan doesn&rsquo;t just help you understand what might be
            wrong — it connects how you eat and live to how you feel, so small
            changes today prevent bigger problems tomorrow.
          </p>
          <div className="mt-7">
            <Link href="/ask">
              <Button>Try it free</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
