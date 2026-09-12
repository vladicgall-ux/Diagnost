import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bluetooth, BluetoothConnected, Loader2, ScanLine, Gauge, Unplug, IdCard, Eraser, CheckCircle2, Route, ShieldAlert, ClipboardCheck, Play, Square, Bug } from "lucide-react";
import { OBDBluetoothClient } from "../lib/obd";
import { decodeVIN } from "../lib/vinDecode";

const LIVE_TILES = [
  { key: "rpm", label: "Обороты", unit: "об/мин" },
  { key: "speed", label: "Скорость", unit: "км/ч" },
  { key: "coolantTemp", label: "Темп. ОЖ", unit: "°C" },
  { key: "engineLoad", label: "Нагрузка", unit: "%" },
  { key: "throttlePosition", label: "Дроссель", unit: "%" },
  { key: "intakeMAP", label: "Давление", unit: "кПа" },
  { key: "intakeAirTemp", label: "Темп. воздуха", unit: "°C" },
  { key: "stft", label: "Быстр. коррекция", unit: "%" },
  { key: "ltft", label: "Долгая коррекция", unit: "%" },
];

const BluetoothScanner = forwardRef(function BluetoothScanner({ onData, onStatusChange }, ref) {
  const [supported] = useState(() => OBDBluetoothClient.isSupported());
  const [status, setStatus] = useState("idle"); // idle | connecting | connected
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(""); // "" | "dtc" | "ff" | "clear" | "permanent" | "monitors"
  const [error, setError] = useState("");
  const [foundCodes, setFoundCodes] = useState(null);
  const [permanentCodes, setPermanentCodes] = useState(null);
  const [pendingCodes, setPendingCodes] = useState(null);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [vinStatus, setVinStatus] = useState(""); // "" | "reading" | "done" | "failed"
  const [odometer, setOdometer] = useState(null); // number | "unsupported" | null
  const [clearedAt, setClearedAt] = useState(0);
  const [liveMonitoring, setLiveMonitoring] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [rawLog, setRawLog] = useState([]);
  const [showRawLog, setShowRawLog] = useState(false);
  const clientRef = useRef(null);
  const liveMonitorRef = useRef(false);

  useEffect(() => {
    return () => {
      liveMonitorRef.current = false;
      clientRef.current?.disconnect();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    isConnected: () => status === "connected",
    readDTCs: () => {
      if (!clientRef.current) throw new Error("Адаптер не подключён.");
      return clientRef.current.readDTCs();
    },
    readPermanentDTCs: () => {
      if (!clientRef.current) throw new Error("Адаптер не подключён.");
      return clientRef.current.readPermanentDTCs();
    },
    readPendingDTCs: () => {
      if (!clientRef.current) throw new Error("Адаптер не подключён.");
      return clientRef.current.readPendingDTCs();
    },
    readLiveSensors: () => {
      if (!clientRef.current) throw new Error("Адаптер не подключён.");
      return clientRef.current.readLiveSensors();
    },
    readStoredFreezeFrame: () => {
      if (!clientRef.current) throw new Error("Адаптер не подключён.");
      return clientRef.current.readStoredFreezeFrame();
    },
  }));

  if (!supported) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 text-sm text-gray-400">
        <p className="flex items-center gap-2 text-gray-300">
          <Bluetooth size={16} className="text-gray-500" /> Подключение к OBD-адаптеру
        </p>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          Web Bluetooth доступен только в Chrome на Android (по HTTPS). Откройте страницу на телефоне
          в Chrome, чтобы подключить сканер и считывать ошибки автоматически. Пока можно вводить код
          вручную ниже.
        </p>
      </div>
    );
  }

  const handleConnect = async () => {
    setError("");
    setStatus("connecting");
    setRawLog([]);
    try {
      const client = new OBDBluetoothClient();
      client.onLog = (entry) => setRawLog((log) => [...log.slice(-19), entry]);
      client.onDisconnected = () => {
        liveMonitorRef.current = false;
        setLiveMonitoring(false);
        setLiveData(null);
        setStatus("idle");
        setDeviceName("");
        setVinStatus("");
        setOdometer(null);
        clientRef.current = null;
        onStatusChange?.(false);
      };
      const name = await client.connect();
      clientRef.current = client;
      setDeviceName(name);
      setStatus("connected");
      onStatusChange?.(true);
      detectVehicle(client);
    } catch (err) {
      setError(err.message || "Не удалось подключиться к адаптеру.");
      setStatus("idle");
      onStatusChange?.(false);
    }
  };

  const detectVehicle = async (client) => {
    setVinStatus("reading");
    try {
      const vin = await client.readVIN();
      if (!vin) {
        setVinStatus("failed");
      } else {
        const vehicle = await decodeVIN(vin);
        onData({ vehicle });
        setVinStatus("done");
      }
    } catch {
      setVinStatus("failed");
    }

    try {
      const km = await client.readOdometer();
      if (km === null) {
        setOdometer("unsupported");
      } else {
        setOdometer(km);
        onData({ vehicle: { mileage: km } });
      }
    } catch {
      setOdometer("unsupported");
    }
  };

  const handleDisconnect = () => {
    liveMonitorRef.current = false;
    setLiveMonitoring(false);
    setLiveData(null);
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus("idle");
    setDeviceName("");
    setFoundCodes(null);
    setPermanentCodes(null);
    setPendingCodes(null);
    setMonitorStatus(null);
    setVinStatus("");
    setOdometer(null);
    onStatusChange?.(false);
  };

  const handleToggleLiveMonitor = async () => {
    if (liveMonitorRef.current) {
      liveMonitorRef.current = false;
      setLiveMonitoring(false);
      return;
    }
    if (!clientRef.current) return;
    liveMonitorRef.current = true;
    setLiveMonitoring(true);
    setError("");
    while (liveMonitorRef.current && clientRef.current) {
      try {
        const data = await clientRef.current.readLiveSensors();
        if (!liveMonitorRef.current) break;
        setLiveData(data);
      } catch (err) {
        if (!liveMonitorRef.current) break;
        setError(err.message || "Не удалось считать показания в реальном времени.");
        break;
      }
    }
    liveMonitorRef.current = false;
    setLiveMonitoring(false);
  };

  const handleReadDTCs = async () => {
    if (!clientRef.current) return;
    setBusy("dtc");
    setError("");
    setFoundCodes(null);
    try {
      const codes = await clientRef.current.readDTCs();
      if (codes.length === 0) {
        setError("Сканер не нашёл активных кодов ошибок в этой машине.");
      } else if (codes.length === 1) {
        onData({ dtc: codes[0] });
      } else {
        setFoundCodes(codes);
      }
    } catch (err) {
      setError(err.message || "Не удалось считать коды ошибок.");
    } finally {
      setBusy("");
    }
  };

  const handleReadLiveSensors = async () => {
    if (!clientRef.current) return;
    setBusy("ff");
    setError("");
    try {
      const freezeFrame = await clientRef.current.readLiveSensors();
      onData({ freezeFrame });
    } catch (err) {
      setError(err.message || "Не удалось считать показания приборов.");
    } finally {
      setBusy("");
    }
  };

  const handleReadPermanentDTCs = async () => {
    if (!clientRef.current) return;
    setBusy("permanent");
    setError("");
    setPermanentCodes(null);
    try {
      const codes = await clientRef.current.readPermanentDTCs();
      setPermanentCodes(codes);
    } catch (err) {
      setError(err.message || "Не удалось считать постоянные коды.");
    } finally {
      setBusy("");
    }
  };

  const handleReadPendingDTCs = async () => {
    if (!clientRef.current) return;
    setBusy("pending");
    setError("");
    setPendingCodes(null);
    try {
      const codes = await clientRef.current.readPendingDTCs();
      setPendingCodes(codes);
    } catch (err) {
      setError(err.message || "Не удалось считать скрытые коды.");
    } finally {
      setBusy("");
    }
  };

  const handleReadMonitorStatus = async () => {
    if (!clientRef.current) return;
    setBusy("monitors");
    setError("");
    setMonitorStatus(null);
    try {
      const status = await clientRef.current.readMonitorStatus();
      setMonitorStatus(status);
    } catch (err) {
      setError(err.message || "Не удалось считать готовность систем.");
    } finally {
      setBusy("");
    }
  };

  const handleClearDTCs = async () => {
    if (!clientRef.current) return;
    const confirmed = window.confirm(
      "Сбросить ошибки на автомобиле? Лампа Check Engine погаснет, но если неисправность не устранена, " +
        "код появится снова после нескольких поездок. Это также сбросит счётчики готовности систем."
    );
    if (!confirmed) return;
    setBusy("clear");
    setError("");
    setFoundCodes(null);
    try {
      await clientRef.current.clearDTCs();
      setClearedAt(Date.now());
    } catch (err) {
      setError(err.message || "Не удалось сбросить ошибки.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-400">
          {status === "connected" ? (
            <BluetoothConnected size={16} />
          ) : (
            <Bluetooth size={16} />
          )}
          OBD-адаптер
        </p>
        {status === "connected" && (
          <span className="truncate rounded-full bg-green-500/10 px-2.5 py-1 text-xs text-green-400">
            {deviceName}
          </span>
        )}
      </div>

      {status !== "connected" ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={status === "connecting"}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 py-2.5 text-sm text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-60"
        >
          {status === "connecting" ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Ищем адаптер...
            </>
          ) : (
            <>
              <Bluetooth size={15} /> Подключить OBD-адаптер
            </>
          )}
        </button>
      ) : (
        <>
          <p className="mt-3 text-xs text-gray-400">
            Адаптер подключён — нажмите «Считать ошибку с авто» в блоке ниже, чтобы получить коды прямо
            из машины. Или считайте отдельно здесь:
          </p>

          {vinStatus === "reading" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" /> Определяем марку и модель по VIN...
            </p>
          )}
          {vinStatus === "done" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-green-500">
              <IdCard size={12} /> Марка, модель и год определены по VIN и подставлены выше.
            </p>
          )}
          {vinStatus === "failed" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <IdCard size={12} /> Не удалось определить авто по VIN — впишите марку и модель вручную.
            </p>
          )}

          {typeof odometer === "number" && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-400">
              <Route size={12} className="mt-0.5 shrink-0" />
              <span>
                Пробег по данным авто: <b className="text-gray-200">{odometer.toLocaleString("ru-RU")} км</b>.
                Это значение из блока управления машины — совпадает с приборной панелью. Если пробег
                скручен, тут будет та же скрученная цифра: OBD не может это обнаружить.
              </span>
            </p>
          )}
          {odometer === "unsupported" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Route size={12} /> Эта машина не отдаёт пробег через стандартный OBD-PID (частый случай для
              старых или не-американских/не-евро моделей).
            </p>
          )}

          <button
            type="button"
            onClick={handleToggleLiveMonitor}
            disabled={busy !== ""}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm transition disabled:opacity-60 ${
              liveMonitoring
                ? "border-orange-500/50 bg-orange-500/15 text-orange-300 hover:bg-orange-500/20"
                : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            {liveMonitoring ? <Square size={14} /> : <Play size={14} />}
            {liveMonitoring ? "Остановить реальное время" : "Показатели в реальном времени"}
          </button>

          {liveMonitoring && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {LIVE_TILES.map((t) => (
                <div key={t.key} className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">{t.label}</p>
                  <p className="font-mono text-base text-orange-300">
                    {liveData?.[t.key] === "" || liveData?.[t.key] === undefined ? "—" : liveData[t.key]}
                  </p>
                  <p className="text-[10px] text-gray-600">{t.unit}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleReadDTCs}
              disabled={busy !== "" || liveMonitoring}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-60"
            >
              {busy === "dtc" ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
              Считать ошибки
            </button>
            <button
              type="button"
              onClick={handleReadLiveSensors}
              disabled={busy !== "" || liveMonitoring}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 py-2.5 text-xs text-green-300 transition hover:bg-green-500/20 disabled:opacity-60"
            >
              {busy === "ff" ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />}
              Считать датчики
            </button>
            <button
              type="button"
              onClick={handleReadPermanentDTCs}
              disabled={busy !== "" || liveMonitoring}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
              title="Коды, которые нельзя стереть сбросом — полезно для проверки б/у авто"
            >
              {busy === "permanent" ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
              Постоянные ошибки
            </button>
            <button
              type="button"
              onClick={handleReadPendingDTCs}
              disabled={busy !== "" || liveMonitoring}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 py-2.5 text-xs text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-60"
              title="Коды, которые ещё не зажгли Check Engine — компьютер их уже заметил"
            >
              {busy === "pending" ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
              Скрытые ошибки
            </button>
            <button
              type="button"
              onClick={handleReadMonitorStatus}
              disabled={busy !== "" || liveMonitoring}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-60"
            >
              {busy === "monitors" ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
              Готовность систем
            </button>
            <button
              type="button"
              onClick={handleClearDTCs}
              disabled={busy !== "" || liveMonitoring}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
            >
              {busy === "clear" ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}
              Сбросить ошибки (погасить Check Engine)
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-gray-400 transition hover:bg-white/10"
            >
              <Unplug size={13} /> Отключить
            </button>
          </div>

          {clearedAt > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-green-500">
              <CheckCircle2 size={12} /> Ошибки сброшены, лампа Check Engine должна погаснуть.
            </p>
          )}
        </>
      )}

      {foundCodes && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-gray-400">Найдено несколько кодов, выберите один:</p>
          <div className="flex flex-wrap gap-2">
            {foundCodes.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onData({ dtc: c });
                  setFoundCodes(null);
                }}
                className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 font-mono text-xs text-blue-300 hover:bg-blue-500/20"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {permanentCodes && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-red-300">
            <ShieldAlert size={13} />
            {permanentCodes.length === 0
              ? "Постоянных кодов нет."
              : `Постоянные коды (${permanentCodes.length}) — их нельзя стереть сбросом или отключением батареи:`}
          </p>
          {permanentCodes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {permanentCodes.map((c) => (
                <span key={c} className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-xs text-red-300">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {pendingCodes && (
        <div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-yellow-300">
            <ShieldAlert size={13} />
            {pendingCodes.length === 0
              ? "Скрытых кодов нет."
              : `Скрытые коды (${pendingCodes.length}) — Check Engine ещё не горит, но компьютер уже их заметил:`}
          </p>
          {pendingCodes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingCodes.map((c) => (
                <span key={c} className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 font-mono text-xs text-yellow-300">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {monitorStatus && (
        <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs text-blue-300">
            <ClipboardCheck size={13} />
            Check Engine: {monitorStatus.milOn ? "горит" : "не горит"}, кодов: {monitorStatus.dtcCount}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {monitorStatus.monitors.map((m) => (
              <span
                key={m.name}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  m.ready ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
                }`}
              >
                {m.name}: {m.ready ? "готово" : "не готово"}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      {status === "connected" && rawLog.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowRawLog((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400"
          >
            <Bug size={11} /> {showRawLog ? "Скрыть" : "Показать"} сырые данные адаптера (для отладки)
          </button>
          {showRawLog && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-gray-500">
              {rawLog.map((entry, i) => (
                <div key={i} className="mb-1">
                  <span className="text-blue-400">{`> ${entry.cmd}`}</span>
                  <br />
                  <span className="whitespace-pre-wrap break-all text-gray-400">
                    {JSON.stringify(entry.raw)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BluetoothScanner;
