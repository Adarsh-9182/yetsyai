import { Sparkles, Droplet, Flame, Beef, TrendingUp } from "lucide-react";

/** A hand-built representation of the NutritiScan interface (not a chatbot). */
export function HealthPreview() {
  const score = 82;
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);

  return (
    <div className="w-full rounded-[22px] border border-line bg-surface p-5 shadow-lg">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Good morning, Aarav</p>
          <p className="text-sm font-semibold">Your health overview</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent">
          <Sparkles className="h-3 w-3" /> AI insights
        </span>
      </div>

      {/* score + metrics */}
      <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-5">
        <div className="relative grid place-items-center">
          <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
            <circle cx="46" cy="46" r={r} fill="none" stroke="hsl(var(--line))" strokeWidth="8" />
            <circle
              cx="46" cy="46" r={r} fill="none" stroke="hsl(var(--accent))"
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute text-center">
            <div className="tnum text-xl font-semibold leading-none">{score}</div>
            <div className="text-[10px] text-muted">score</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric icon={<Beef className="h-3.5 w-3.5" />} label="Protein" value="38g" />
          <Metric icon={<Flame className="h-3.5 w-3.5" />} label="Calories" value="680" />
          <Metric icon={<Droplet className="h-3.5 w-3.5" />} label="Water" value="1.4L" />
        </div>
      </div>

      {/* insight */}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-panel p-3">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p className="text-xs leading-relaxed text-ink">
          Your protein intake is up <span className="font-semibold">18%</span> this
          week. Add a serving of vegetables at dinner to lift fibre.
        </p>
      </div>

      {/* mini AI exchange */}
      <div className="mt-4 space-y-2">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-xs text-white">
          I&rsquo;ve been feeling tired lately.
        </div>
        <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-xs">
          <p className="font-medium">A few things could contribute — let&rsquo;s narrow it down.</p>
          <p className="mt-1 text-muted">When did it start, and how are you sleeping?</p>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5">
      <div className="flex items-center gap-1 text-muted">{icon}</div>
      <div className="tnum mt-1.5 text-base font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] text-muted">{label}</div>
    </div>
  );
}
