import { ScanLine } from "lucide-react";

export default function DiagnosticSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#12141b] p-5">
      <div className="mb-4 flex items-center gap-2 text-orange-400">
        <ScanLine size={18} className="animate-pulse-glow" />
        <span className="text-sm font-semibold uppercase tracking-wide">
          Сканирование системы...
        </span>
      </div>
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-4 w-5/6 rounded bg-white/10" />
        <div className="h-24 w-full rounded bg-white/10" />
        <div className="h-4 w-2/3 rounded bg-white/10" />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-scan h-1/3 w-full bg-gradient-to-b from-transparent via-orange-500/10 to-transparent" />
      </div>
    </div>
  );
}
