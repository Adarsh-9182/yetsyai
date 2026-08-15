import {
  ListChecks,
  HelpCircle,
  Lightbulb,
  Salad,
  ShieldAlert,
  MessageCircleQuestion,
  Info,
} from "lucide-react";
import type { StructuredResponse } from "@/lib/ai/types";

/** Renders a structured AI answer as calm, scannable sections (never a wall of text). */
export function AIStructuredMessage({ data }: { data: StructuredResponse }) {
  return (
    <div className="space-y-4">
      {data.summary && <p className="leading-relaxed">{data.summary}</p>}

      {data.needMoreInfo && data.questions.length > 0 && (
        <Section icon={<HelpCircle className="h-4 w-4" />} title="A few quick questions" accent>
          <List items={data.questions} />
        </Section>
      )}

      {data.possibleCauses.length > 0 && (
        <Section icon={<Lightbulb className="h-4 w-4" />} title="What could be contributing">
          <List items={data.possibleCauses} />
          <p className="mt-2 text-xs text-muted">Possibilities to consider — not a diagnosis.</p>
        </Section>
      )}

      {data.recommendations.length > 0 && (
        <Section icon={<ListChecks className="h-4 w-4" />} title="What you can do now">
          <List items={data.recommendations} />
        </Section>
      )}

      {data.nutritionAngle && (
        <Section icon={<Salad className="h-4 w-4" />} title="Nutrition angle">
          <p className="text-sm leading-relaxed">{data.nutritionAngle}</p>
        </Section>
      )}

      {data.seekCareIf.length > 0 && (
        <Section icon={<ShieldAlert className="h-4 w-4" />} title="See a clinician if" warn>
          <List items={data.seekCareIf} />
        </Section>
      )}

      {data.doctorQuestions.length > 0 && (
        <Section icon={<MessageCircleQuestion className="h-4 w-4" />} title="Questions to ask your doctor">
          <List items={data.doctorQuestions} />
        </Section>
      )}

      {data.disclaimer && (
        <p className="flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {data.disclaimer}
        </p>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
}) {
  const tone = warn ? "text-warn" : accent ? "text-accent" : "text-ink";
  return (
    <div>
      <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
        {icon}
        {title}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
