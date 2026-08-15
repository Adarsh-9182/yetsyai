import {
  Stethoscope,
  Camera,
  LineChart,
  ShieldCheck,
  Salad,
  FileText,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Stethoscope,
    title: "AI Health Companion",
    body: "Describe how you feel. NutritiScan asks the right follow-ups, then gives possible causes, next steps, and when to seek care — never a diagnosis.",
  },
  {
    icon: Camera,
    title: "Meal Vision",
    body: "Snap or describe a meal and get an estimated calorie and macro breakdown, plus a quality score and one concrete way to improve it.",
  },
  {
    icon: Salad,
    title: "Nutrition intelligence",
    body: "Personalized calorie, protein, fibre and water targets with strong Indian-food support — roti, dal, paneer, rice and more.",
  },
  {
    icon: LineChart,
    title: "Health timeline & insights",
    body: "Meals, symptoms, weight and conversations become a longitudinal record, with trends drawn from your real data — never invented.",
  },
  {
    icon: FileText,
    title: "Lab report analysis",
    body: "Upload a report and see each value against its reference range, explained in plain language — with a nudge to discuss it with a professional.",
  },
  {
    icon: ShieldCheck,
    title: "Safety first",
    body: "Potential emergencies are detected instantly and surfaced up front, with clear guidance to contact real emergency care.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          One companion
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything your health needs, in one calm place
        </h2>
        <p className="mt-3 text-lg text-muted">
          Ambitious in capability, conservative in medical claims.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="transition-shadow hover:shadow-md">
            <CardBody>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
