import { useEffect, useState } from "react";
import { Wrench, Zap, Gauge, RefreshCw, AlertCircle, ScanLine, Loader2 } from "lucide-react";
import { QUICK_PRESETS, MAKES, FUEL_TYPES, randomFreezeFrame } from "../lib/presets";

const DTC_REGEX = /^[PBCUpbcu][0-9]{4}$/;

export default function ScannerForm({ onDiagnose, loading, obdConnected, obdRef, scannerFill }) {
  const [vehicle, setVehicle] = useState({
    make: MAKES[0],
    model: "",
    year: new Date().getFullYear() - 5,
    fuelType: FUEL_TYPES[0],
  });
  const [dtc, setDtc] = useState("");
  const [dtcError, setDtcError] = useState("");
  const [freezeFrame, setFreezeFrame] = useState({
    rpm: "",
    coolantTemp: "",
    stft: "",
    ltft: "",
    speed: "",
  });

  const [obdBusy, setObdBusy] = useState(false);
  const [obdError, setObdError] = useState("");
  const [foundCodes, setFoundCodes] = useState(null);

  // Manual "peek" reads from BluetoothScanner's own buttons land here.
  useEffect(() => {
    if (!scannerFill) return;
    if (scannerFill.dtc) {
      setDtc(scannerFill.dtc);
      setDtcError("");
    }
    if (scannerFill.freezeFrame) {
      setFreezeFrame(scannerFill.freezeFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerFill]);

  const applyPreset = (preset) => {
    setDtc(preset.dtc);
    setDtcError("");
    setFreezeFrame(preset.freezeFrame);
    setFoundCodes(null);
    setObdError("");
  };

  const handleDtcChange = (val) => {
    setDtc(val.toUpperCase());
    if (val && !DTC_REGEX.test(val)) {
      setDtcError("Формат: буква (P/B/C/U) + 4 цифры, например P0300");
    } else {
      setDtcError("");
    }
  };

  const diagnoseCode = (code, ff) => {
    setDtc(code);
    setDtcError("");
    onDiagnose({ vehicle, dtc: code, freezeFrame: ff });
  };

  const runFromOBD = async () => {
    setObdError("");
    setFoundCodes(null);
    setObdBusy(true);
    try {
      const codes = await obdRef.current.readDTCs();
      if (codes.length === 0) {
        setObdError("Сканер не нашёл активных ошибок в этой машине.");
        return;
      }
      setFoundCodes(codes);
      const ff = await obdRef.current.readFreezeFrame().catch(() => freezeFrame);
      setFreezeFrame(ff);
      diagnoseCode(codes[0], ff);
    } catch (err) {
      setObdError(err.message || "Не удалось считать данные с автомобиля.");
    } finally {
      setObdBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (obdConnected && obdRef?.current) {
      runFromOBD();
      return;
    }
    if (!DTC_REGEX.test(dtc)) {
      setDtcError("Введите корректный код ошибки, например P0300");
      return;
    }
    onDiagnose({ vehicle, dtc: dtc.toUpperCase(), freezeFrame });
  };

  const busy = loading || obdBusy;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-400">
          <Wrench size={16} /> Данные автомобиля
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Марка</label>
            <select
              value={vehicle.make}
              onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
            >
              {MAKES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Модель</label>
            <input
              value={vehicle.model}
              onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
              placeholder="Camry, Golf..."
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Год выпуска</label>
            <input
              type="number"
              value={vehicle.year}
              min="1970"
              max={new Date().getFullYear() + 1}
              onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Топливо</label>
            <select
              value={vehicle.fuelType}
              onChange={(e) => setVehicle({ ...vehicle, fuelType: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
            >
              {FUEL_TYPES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-400">
          <Zap size={16} /> Код ошибки (DTC)
        </h2>

        {obdConnected && (
          <p className="mt-2 text-xs text-gray-400">
            Адаптер подключён — при нажатии «Считать ошибку с авто» код придёт из машины автоматически.
            Поле ниже можно оставить пустым.
          </p>
        )}

        <input
          value={dtc}
          onChange={(e) => handleDtcChange(e.target.value)}
          placeholder="P0300"
          maxLength={5}
          className={`mt-3 w-full rounded-lg border bg-[#0b0d12] px-3 py-2 font-mono text-lg tracking-widest text-gray-100 outline-none ${
            dtcError ? "border-red-500" : "border-white/10 focus:border-blue-500"
          }`}
        />
        {dtcError && (
          <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={13} /> {dtcError}
          </p>
        )}

        <div className="mt-4">
          <p className="mb-2 text-xs text-gray-400">Быстрый тест</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.dtc}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 transition hover:bg-blue-500/20"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-400">
            <Gauge size={16} /> Стоп-кадр (Freeze Frame)
          </h2>
          <button
            type="button"
            onClick={() => setFreezeFrame(randomFreezeFrame())}
            className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-300 transition hover:bg-green-500/20"
          >
            <RefreshCw size={12} /> Сгенерировать данные
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Обороты (RPM)" value={freezeFrame.rpm} onChange={(v) => setFreezeFrame({ ...freezeFrame, rpm: v })} />
          <Field label="Темп. ОЖ (°C)" value={freezeFrame.coolantTemp} onChange={(v) => setFreezeFrame({ ...freezeFrame, coolantTemp: v })} />
          <Field label="STFT (%)" value={freezeFrame.stft} onChange={(v) => setFreezeFrame({ ...freezeFrame, stft: v })} />
          <Field label="LTFT (%)" value={freezeFrame.ltft} onChange={(v) => setFreezeFrame({ ...freezeFrame, ltft: v })} />
          <Field label="Скорость (км/ч)" value={freezeFrame.speed} onChange={(v) => setFreezeFrame({ ...freezeFrame, speed: v })} />
        </div>
      </div>

      {obdError && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={13} /> {obdError}
        </p>
      )}

      {foundCodes && (
        <div className="rounded-xl border border-white/10 bg-[#12141b] p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
            <ScanLine size={13} className="text-orange-400" />
            Считано с автомобиля: {foundCodes.length} {foundCodes.length === 1 ? "код" : "кода"}.
            {foundCodes.length > 1 && " Показан диагноз по первому — можно посмотреть другой:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {foundCodes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => diagnoseCode(c, freezeFrame)}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition ${
                  c === dtc
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-300"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {obdBusy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Считываем с автомобиля...
          </span>
        ) : loading ? (
          "Диагностика..."
        ) : obdConnected ? (
          "Считать ошибку с авто и поставить диагноз"
        ) : (
          "Запустить диагностику"
        )}
      </button>
    </form>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-green-500"
      />
    </div>
  );
}
