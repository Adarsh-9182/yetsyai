import { Plus } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-white">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          NutritiScan
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          NutritiScan provides evidence-informed health and nutrition guidance for
          educational purposes only. It is not a medical device and is not a
          substitute for professional medical advice, diagnosis, or treatment.
          In an emergency, call your local emergency number.
        </p>
        <p className="mt-6 text-xs text-muted">
          © {new Date().getFullYear()} NutritiScan · Your intelligent health companion
        </p>
      </div>
    </footer>
  );
}
