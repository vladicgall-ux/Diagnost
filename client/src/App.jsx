import { useEffect, useRef, useState } from "react";
import { Gauge, AlertOctagon, Loader2 } from "lucide-react";
import BluetoothScanner from "./components/BluetoothScanner";
import ScannerForm from "./components/ScannerForm";
import DiagnosticSkeleton from "./components/DiagnosticSkeleton";
import DiagnosticReport from "./components/DiagnosticReport";
import { runDiagnose, login, fetchSession } from "./lib/api";

function LoginGate({ onSuccess }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(value);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#0b0d12] px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-2">
          <Gauge className="text-orange-500" size={22} />
          <h1 className="text-base font-bold text-gray-100">Автодиагност AI</h1>
        </div>
        <p className="text-[13px] text-gray-500">Введите пароль для входа</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
          placeholder="Пароль"
        />
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertOctagon size={16} /> {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {submitting ? "Входим..." : "Войти"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null); // null = checking, then true/false
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [context, setContext] = useState(null);
  const [error, setError] = useState("");
  const [obdConnected, setObdConnected] = useState(false);
  const [scannerFill, setScannerFill] = useState(null);
  const obdRef = useRef(null);

  useEffect(() => {
    fetchSession()
      .then((data) => setAuthed(Boolean(data.authed)))
      .catch(() => setAuthed(false));
  }, []);

  const handleDiagnose = async (payload) => {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const result = await runDiagnose(payload);
      setReport(result);
      setContext(payload);
    } catch (err) {
      if (err.message === "Требуется вход") {
        setAuthed(false);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authed === null) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 bg-[#0b0d12] text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Загрузка...
      </div>
    );
  }

  if (!authed) {
    return <LoginGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-svh bg-[#0b0d12]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0d12]/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3.5">
          <Gauge className="text-orange-500" size={22} />
          <div>
            <h1 className="text-base font-bold text-gray-100">Автодиагност AI</h1>
            <p className="text-[11px] text-gray-500">OBD-II сканер + ИИ-диагностика на Groq</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <BluetoothScanner ref={obdRef} onData={setScannerFill} onStatusChange={setObdConnected} />
        <ScannerForm
          onDiagnose={handleDiagnose}
          loading={loading}
          obdConnected={obdConnected}
          obdRef={obdRef}
          scannerFill={scannerFill}
        />

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
