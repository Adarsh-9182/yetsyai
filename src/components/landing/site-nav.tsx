import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg tracking-tight">NutritiScan</span>
          <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            AI Doctor
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#features" className="hover:text-ink">What it does</a>
          <a href="#nutrition" className="hover:text-ink">Nutrition</a>
        </nav>

        <Link href="/ask">
          <Button size="sm">
            Talk to the AI Doctor <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
