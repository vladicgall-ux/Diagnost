import { useEffect, useRef, useState } from "react";
import { Bluetooth, BluetoothConnected, Loader2, ScanLine, Gauge, Unplug } from "lucide-react";
import { OBDBluetoothClient } from "../lib/obd";

export default function BluetoothScanner({ onData }) {
  const [supported] = useState(() => OBDBluetoothClient.isSupported());
  const [status, setStatus] = useState("idle"); // idle | connecting | connected
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(""); // "" | "dtc" | "ff"
  const [error, setError] = useState("");
  const [foundCodes, setFoundCodes] = useState(null);
  const clientRef = useRef(null);

  useEffect(() => {
    return () => clientRef.current?.disconnect();
  }, []);

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
    try {
      const client = new OBDBluetoothClient();
      client.onDisconnected = () => {
        setStatus("idle");
        setDeviceName("");
        clientRef.current = null;
      };
      const name = await client.connect();
      clientRef.current = client;
      setDeviceName(name);
      setStatus("connected");
    } catch (err) {
      setError(err.message || "Не удалось подключиться к адаптеру.");
      setStatus("idle");
    }
  };

  const handleDisconnect = () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setStatus("idle");
    setDeviceName("");
    setFoundCodes(null);
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

  const handleReadFreezeFrame = async () => {
    if (!clientRef.current) return;
    setBusy("ff");
    setError("");
    try {
      const freezeFrame = await clientRef.current.readFreezeFrame();
      onData({ freezeFrame });
    } catch (err) {
      setError(err.message || "Не удалось считать показания приборов.");
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleReadDTCs}
            disabled={busy !== ""}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 py-2.5 text-xs text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-60"
          >
            {busy === "dtc" ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
            Считать ошибки
          </button>
          <button
            type="button"
            onClick={handleReadFreezeFrame}
            disabled={busy !== ""}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 py-2.5 text-xs text-green-300 transition hover:bg-green-500/20 disabled:opacity-60"
          >
            {busy === "ff" ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />}
            Считать датчики
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-gray-400 transition hover:bg-white/10"
          >
            <Unplug size={13} /> Отключить
          </button>
        </div>
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

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
