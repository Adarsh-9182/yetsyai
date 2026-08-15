import { PhoneCall, AlertTriangle } from "lucide-react";

/** High-visibility emergency state. Never buried under other content. */
export function EmergencyBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border-2 border-danger bg-danger-soft p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-danger text-white">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-danger">This may be a medical emergency</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{message}</p>
          <a
            href="tel:112"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90"
          >
            <PhoneCall className="h-4 w-4" /> Call emergency services
          </a>
        </div>
      </div>
    </div>
  );
}
