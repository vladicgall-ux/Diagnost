import { AlertTriangle, CheckCircle2, ShieldAlert, ListChecks, Wallet } from "lucide-react";
import Chat from "./Chat";

const SEVERITY_STYLES = {
  low: {
    badge: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: CheckCircle2,
  },
  medium: {
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: AlertTriangle,
  },
  critical: {
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: ShieldAlert,
  },
};

export default function DiagnosticReport({ report, context }) {
  const style = SEVERITY_STYLES[report.severity] || SEVERITY_STYLES.medium;
  const SeverityIcon = style.icon;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-gray-500">{report.code}</p>
            <h2 className="text-lg font-semibold text-gray-100">{report.title}</h2>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${style.badge}`}
          >
            <SeverityIcon size={14} /> {report.severityLabel}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">{report.explanation}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-400">
          <AlertTriangle size={16} /> ТОП-3 вероятные причины
        </h3>
        <div className="space-y-2.5">
          {report.topCauses?.map((c, i) => (
            <div key={i} className="rounded-xl bg-white/5 p-3">
              <p className="text-sm font-medium text-gray-100">
                <span className="mr-2 text-orange-400">{i + 1}.</span>
                {c.cause}
              </p>
              <p className="mt-1 text-xs text-gray-400">{c.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-400">
          <ListChecks size={16} /> Алгоритм проверки
        </h3>
        <ol className="space-y-2">
          {report.steps?.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-300">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-300">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {report.estimatedRepairCost && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12141b] p-4 text-sm text-gray-300">
          <Wallet size={16} className="text-green-400" />
          Примерная стоимость ремонта: <span className="font-semibold text-gray-100">{report.estimatedRepairCost}</span>
        </div>
      )}

      <Chat context={{ ...context, report }} />
    </div>
  );
}
