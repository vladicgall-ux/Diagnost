import { useState } from "react";
import { Gauge, AlertOctagon } from "lucide-react";
import BluetoothScanner from "./components/BluetoothScanner";
import ScannerForm from "./components/ScannerForm";
import DiagnosticSkeleton from "./components/DiagnosticSkeleton";
import DiagnosticReport from "./components/DiagnosticReport";
import { runDiagnose } from "./lib/api";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [context, setContext] = useState(null);
  const [error, setError] = useState("");
  const [scannerFill, setScannerFill] = useState(null);

  const handleDiagnose = async (payload) => {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const result = await runDiagnose(payload);
      setReport(result);
      setContext(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-[#0b0d12]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0d12]/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3.5">
          <Gauge className="text-orange-500" size={22} />
          <div>
            <h1 className="text-base font-bold text-gray-100">АвтоДиагност AI</h1>
            <p className="text-[11px] text-gray-500">OBD-II сканер + ИИ-диагност на Groq</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <BluetoothScanner onData={setScannerFill} />
        <ScannerForm onDiagnose={handleDiagnose} loading={loading} scannerFill={scannerFill} />

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertOctagon size={16} /> {error}
          </div>
        )}

        {loading && <DiagnosticSkeleton />}
        {!loading && report && <DiagnosticReport report={report} context={context} />}
      </main>

      <footer className="px-4 pb-6 pt-2 text-center text-[11px] text-gray-600">
        Диагностика ИИ носит рекомендательный характер и не заменяет визит на СТО.
      </footer>
    </div>
  );
}
