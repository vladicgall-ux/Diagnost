import { useEffect, useState } from "react";
import { Wrench, Zap, Gauge, AlertCircle, ScanLine, Loader2 } from "lucide-react";
import { FUEL_TYPES } from "../lib/presets";
import { CAR_CATALOG, MAKES } from "../lib/carCatalog";

const DTC_REGEX = /^[PBCUpbcu][0-9]{4}$/;
const OTHER = "__other__";

export default function ScannerForm({ onDiagnose, loading, obdConnected, obdRef, scannerFill }) {
  const [vehicle, setVehicle] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear() - 5,
    fuelType: FUEL_TYPES[0],
    mileage: null,
  });
  const [dtc, setDtc] = useState("");
  const [dtcError, setDtcError] = useState("");
  const [freezeFrame, setFreezeFrame] = useState({
    rpm: "",
    coolantTemp: "",
    stft: "",
    ltft: "",
    speed: "",
    engineLoad: "",
    intakeMAP: "",
    throttlePosition: "",
    intakeAirTemp: "",
    milDistance: "",
  });

  const [obdBusy, setObdBusy] = useState(false);
  const [obdError, setObdError] = useState("");
  const [foundCodes, setFoundCodes] = useState(null);

  const [makeCustom, setMakeCustom] = useState(false);
  const [modelCustom, setModelCustom] = useState(false);

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
    if (scannerFill.vehicle) {
      setVehicle((v) => ({ ...v, ...scannerFill.vehicle }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerFill]);

  // Keep the make/model dropdowns in sync when the vehicle is filled
  // from outside (VIN auto-detect) rather than typed by hand.
  useEffect(() => {
    if (vehicle.make && CAR_CATALOG[vehicle.make]) setMakeCustom(false);
    else if (vehicle.make) setMakeCustom(true);
  }, [vehicle.make]);

  useEffect(() => {
    if (makeCustom) return;
    const options = CAR_CATALOG[vehicle.make] || [];
    if (vehicle.model && options.includes(vehicle.model)) setModelCustom(false);
    else if (vehicle.model) setModelCustom(true);
  }, [vehicle.model, vehicle.make, makeCustom]);

  const handleMakeSelect = (value) => {
    if (value === OTHER) {
      setMakeCustom(true);
      setVehicle((v) => ({ ...v, make: CAR_CATALOG[v.make] ? "" : v.make, model: "" }));
      setModelCustom(false);
    } else {
      setMakeCustom(false);
      setVehicle((v) => ({ ...v, make: value, model: "" }));
      setModelCustom(false);
    }
  };

  const handleModelSelect = (value) => {
    if (value === OTHER) {
      setModelCustom(true);
      setVehicle((v) => ({ ...v, model: "" }));
    } else {
      setModelCustom(false);
      setVehicle((v) => ({ ...v, model: value }));
    }
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
              value={makeCustom ? OTHER : vehicle.make || ""}
              onChange={(e) => handleMakeSelect(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
            >
              <option value="" disabled>
                Выберите марку
              </option>
              {MAKES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={OTHER}>Другая марка…</option>
            </select>
            {makeCustom && (
              <input
                value={vehicle.make}
                onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                placeholder="Впишите марку"
                autoFocus
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Модель</label>
            {!makeCustom && CAR_CATALOG[vehicle.make] ? (
              <select
                value={modelCustom ? OTHER : vehicle.model || ""}
                onChange={(e) => handleModelSelect(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
              >
                <option value="" disabled>
                  Выберите модель
                </option>
                {CAR_CATALOG[vehicle.make].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value={OTHER}>Другая модель…</option>
              </select>
            ) : (
              <input
                value={vehicle.model}
                onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                placeholder="Впишите модель"
                className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
              />
            )}
            {!makeCustom && CAR_CATALOG[vehicle.make] && modelCustom && (
              <input
                value={vehicle.model}
                onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                placeholder="Впишите модель"
                autoFocus
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
              />
            )}
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
          <div>
            <label className="mb-1 block text-xs text-gray-400">Пробег, км</label>
            <input
              type="number"
              value={vehicle.mileage ?? ""}
              onChange={(e) => setVehicle({ ...vehicle, mileage: e.target.value })}
              placeholder="Считается с OBD"
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500"
            />
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
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-400">
          <Gauge size={16} /> Стоп-кадр (Freeze Frame)
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          «Подстройка топлива» — это на сколько процентов компьютер машины добавляет или убавляет топливо
          по сравнению с нормой, чтобы смесь бензина и воздуха была правильной. Плюс — топлива не хватало,
          компьютер добавил. Минус — топлива было слишком много, компьютер убавил.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Обороты (RPM)" value={freezeFrame.rpm} onChange={(v) => setFreezeFrame({ ...freezeFrame, rpm: v })} />
          <Field label="Темп. ОЖ (°C)" value={freezeFrame.coolantTemp} onChange={(v) => setFreezeFrame({ ...freezeFrame, coolantTemp: v })} />
          <Field label="Быстрая подстройка топлива (%)" value={freezeFrame.stft} onChange={(v) => setFreezeFrame({ ...freezeFrame, stft: v })} />
          <Field label="Долгая подстройка топлива (%)" value={freezeFrame.ltft} onChange={(v) => setFreezeFrame({ ...freezeFrame, ltft: v })} />
          <Field label="Скорость (км/ч)" value={freezeFrame.speed} onChange={(v) => setFreezeFrame({ ...freezeFrame, speed: v })} />
          <Field label="Нагрузка двигателя (%)" value={freezeFrame.engineLoad} onChange={(v) => setFreezeFrame({ ...freezeFrame, engineLoad: v })} />
          <Field label="Давление в коллекторе (кПа)" value={freezeFrame.intakeMAP} onChange={(v) => setFreezeFrame({ ...freezeFrame, intakeMAP: v })} />
          <Field label="Дроссель (%)" value={freezeFrame.throttlePosition} onChange={(v) => setFreezeFrame({ ...freezeFrame, throttlePosition: v })} />
          <Field label="Темп. впуск. воздуха (°C)" value={freezeFrame.intakeAirTemp} onChange={(v) => setFreezeFrame({ ...freezeFrame, intakeAirTemp: v })} />
          <Field label="Пробег с Check Engine (км)" value={freezeFrame.milDistance} onChange={(v) => setFreezeFrame({ ...freezeFrame, milDistance: v })} />
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
