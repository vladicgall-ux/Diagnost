import { useState } from "react";
import { Wrench, Zap, Gauge, RefreshCw, AlertCircle } from "lucide-react";
import { QUICK_PRESETS, MAKES, FUEL_TYPES, randomFreezeFrame } from "../lib/presets";

const DTC_REGEX = /^[PBCUpbcu][0-9]{4}$/;

export default function ScannerForm({ onDiagnose, loading }) {
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

  const applyPreset = (preset) => {
    setDtc(preset.dtc);
    setDtcError("");
    setFreezeFrame(preset.freezeFrame);
  };

  const handleDtcChange = (val) => {
    setDtc(val.toUpperCase());
    if (val && !DTC_REGEX.test(val)) {
      setDtcError("Формат: буква (P/B/C/U) + 4 цифры, например P0300");
    } else {
      setDtcError("");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!DTC_REGEX.test(dtc)) {
      setDtcError("Введите корректный код ошибки, например P0300");
      return;
    }
    onDiagnose({ vehicle, dtc: dtc.toUpperCase(), freezeFrame });
  };

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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-semibold uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Диагностика..." : "Запустить диагностику"}
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
