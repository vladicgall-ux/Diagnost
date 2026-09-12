// Web Bluetooth client for ELM327-based OBD-II adapters.
// Tries the handful of GATT service/characteristic layouts that cheap
// BLE ELM327 clones actually ship with, since there is no single standard.

const PROFILES = [
  {
    // Nordic UART Service — used by many newer BLE ELM327 clones
    service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
    notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  },
  {
    // Common cheap HM-10/JDY based clones
    service: "0000fff0-0000-1000-8000-00805f9b34fb",
    write: "0000fff2-0000-1000-8000-00805f9b34fb",
    notify: "0000fff1-0000-1000-8000-00805f9b34fb",
  },
  {
    // HM-10 single-characteristic layout
    service: "0000ffe0-0000-1000-8000-00805f9b34fb",
    write: "0000ffe1-0000-1000-8000-00805f9b34fb",
    notify: "0000ffe1-0000-1000-8000-00805f9b34fb",
  },
  {
    // ISSC/Microchip transparent UART — used by some Vgate/Veepeak boards
    service: "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    write: "49535343-8841-43f4-a8d4-ecbe34729bb3",
    notify: "49535343-1e4d-4bd9-ba61-23c647249616",
  },
  {
    // FEE0/FEE1/FEE2 — seen on some cheap Chinese BLE OBD boards
    service: "0000fee0-0000-1000-8000-00805f9b34fb",
    write: "0000fee2-0000-1000-8000-00805f9b34fb",
    notify: "0000fee1-0000-1000-8000-00805f9b34fb",
  },
];

const ALL_SERVICE_UUIDS = [...new Set(PROFILES.map((p) => p.service))];

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function cleanHex(raw) {
  return raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}

function decodeDTC(hex4) {
  const b1 = parseInt(hex4.slice(0, 2), 16);
  const b2 = hex4.slice(2, 4).toUpperCase();
  const letters = ["P", "C", "B", "U"];
  const letter = letters[(b1 >> 6) & 0x03];
  const digit1 = (b1 >> 4) & 0x03;
  const digit2 = (b1 & 0x0f).toString(16).toUpperCase();
  return `${letter}${digit1}${digit2}${b2}`;
}

// marker: the mode-response byte pair that precedes the DTC words, e.g.
// "43" for mode 03 (stored), "47" for mode 07 (pending), "4A" for mode 0A (permanent).
function parseDTCResponse(raw, marker) {
  const clean = cleanHex(raw);
  const idx = clean.indexOf(marker);
  if (idx === -1) return [];
  const body = clean.slice(idx + marker.length);
  const codes = [];
  for (let i = 0; i + 4 <= body.length; i += 4) {
    const word = body.slice(i, i + 4);
    if (word === "0000") continue;
    codes.push(decodeDTC(word));
  }
  return codes;
}

function decodeBytes(raw, marker, numBytes) {
  const clean = cleanHex(raw);
  const idx = clean.indexOf(marker);
  if (idx === -1) return null;
  const hex = clean.slice(idx + marker.length, idx + marker.length + numBytes * 2);
  if (hex.length < numBytes * 2) return null;
  const bytes = [];
  for (let i = 0; i < numBytes; i++) bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return bytes;
}

// One entry per PID we care about, shared between live data (mode 01) and
// the real freeze frame (mode 02) — same PID numbers, same byte math, just
// a different mode byte and (for mode 02) a trailing frame-number byte.
const PID_DEFS = {
  rpm: { pid: "0C", bytes: 2, decode: ([a, b]) => Math.round((a * 256 + b) / 4) },
  coolantTemp: { pid: "05", bytes: 1, decode: ([a]) => a - 40 },
  stft: { pid: "06", bytes: 1, decode: ([a]) => +(((a - 128) * 100) / 128).toFixed(1) },
  ltft: { pid: "07", bytes: 1, decode: ([a]) => +(((a - 128) * 100) / 128).toFixed(1) },
  speed: { pid: "0D", bytes: 1, decode: ([a]) => a },
  engineLoad: { pid: "04", bytes: 1, decode: ([a]) => +((a * 100) / 255).toFixed(1) },
  intakeMAP: { pid: "0B", bytes: 1, decode: ([a]) => a },
  throttlePosition: { pid: "11", bytes: 1, decode: ([a]) => +((a * 100) / 255).toFixed(1) },
  intakeAirTemp: { pid: "0F", bytes: 1, decode: ([a]) => a - 40 },
};

function parseMilDistance(raw) {
  const bytes = decodeBytes(raw, "4121", 2);
  return bytes ? bytes[0] * 256 + bytes[1] : null; // km
}

function parseOdometer(raw) {
  // PID 0xA6 "Odometer" — added to OBD-II in SAE J1979-2 (mandatory on many
  // markets only from ~2019+). Older or non-compliant vehicles won't answer.
  const bytes = decodeBytes(raw, "41A6", 4);
  if (!bytes) return null;
  const [a, b, c, d] = bytes;
  return +((a * 16777216 + b * 65536 + c * 256 + d) * 0.1).toFixed(1); // km
}

function parseVIN(raw) {
  const clean = cleanHex(raw);
  const idx = clean.indexOf("4902");
  if (idx === -1) return null;
  let body = clean.slice(idx + 4);
  // Mode 09 responses lead with a "number of data items" byte before the VIN bytes.
  if (body.length % 2 === 1) body = body.slice(0, -1);
  if (body.length >= 2) body = body.slice(2);

  let vin = "";
  for (let i = 0; i + 2 <= body.length; i += 2) {
    const code = parseInt(body.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) vin += String.fromCharCode(code);
  }
  vin = vin.slice(-17); // keep the last 17 printable chars in case of leading noise
  return vin.length === 17 ? vin : null;
}

// Standard monitor names per SAE J1979, in the fixed bit order the spec
// defines for bytes C/D of PID 0x01 — different table for spark vs
// compression ignition engines (indicated by a bit in byte B).
const SPARK_MONITORS = [
  "Катализатор", "Подогрев катализатора", "Улавливание паров топлива (EVAP)",
  "Система вторичного воздуха", "Хладагент кондиционера", "Датчик кислорода",
  "Подогрев датчика кислорода", "Рециркуляция ОГ (EGR)",
];
const COMPRESSION_MONITORS = [
  "NMHC-катализатор", "Система NOx/SCR", null, "Датчик отработавших газов",
  "Сажевый фильтр (DPF)", "Наддув", null, "EGR/VVT",
];

function parseMonitorStatus(raw) {
  const bytes = decodeBytes(raw, "4101", 4);
  if (!bytes) return null;
  const [a, b, c, d] = bytes;
  const isCompression = !!(b & 0x08);
  const continuous = [
    { name: "Пропуски зажигания", supported: !!(b & 0x01), ready: !(b & 0x10) },
    { name: "Топливная система", supported: !!(b & 0x02), ready: !(b & 0x20) },
    { name: "Общие компоненты", supported: !!(b & 0x04), ready: !(b & 0x40) },
  ].filter((m) => m.supported);

  const names = isCompression ? COMPRESSION_MONITORS : SPARK_MONITORS;
  const nonContinuous = names
    .map((name, i) => (name && c & (1 << i) ? { name, supported: true, ready: !(d & (1 << i)) } : null))
    .filter(Boolean);

  return {
    milOn: !!(a & 0x80),
    dtcCount: a & 0x7f,
    isCompression,
    monitors: [...continuous, ...nonContinuous],
  };
}

export class OBDBluetoothClient {
  constructor() {
    this.device = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.buffer = "";
    this._pending = null;
    this.onDisconnected = null;
    this.onLog = null; // ({cmd, raw}) => void — every raw command/response pair, for diagnosing a specific adapter
  }

  static isSupported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  async connect() {
    if (!OBDBluetoothClient.isSupported()) {
      throw new Error(
        "Web Bluetooth не поддерживается в этом браузере. Откройте страницу в Chrome на Android."
      );
    }

    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ALL_SERVICE_UUIDS,
    });
    this.device.addEventListener("gattserverdisconnected", () => {
      this.writeChar = null;
      this.notifyChar = null;
      this.onDisconnected?.();
    });

    const server = await withTimeout(
      this.device.gatt.connect(),
      10000,
      "Не удалось установить связь с адаптером за 10 секунд. Убедитесь, что он вставлен в машину и не занят другим телефоном/приложением, затем попробуйте снова."
    );

    let connected = false;
    for (const profile of PROFILES) {
      try {
        const service = await withTimeout(
          server.getPrimaryService(profile.service),
          6000,
          "профиль не отвечает"
        );
        const writeChar = await service.getCharacteristic(profile.write);
        const notifyChar =
          profile.notify === profile.write
            ? writeChar
            : await service.getCharacteristic(profile.notify);
        await withTimeout(notifyChar.startNotifications(), 6000, "профиль не отвечает");
        notifyChar.addEventListener("characteristicvaluechanged", (e) =>
          this._handleNotify(e)
        );
        this.writeChar = writeChar;
        this.notifyChar = notifyChar;
        connected = true;
        break;
      } catch {
        continue;
      }
    }

    if (!connected) {
      this.device.gatt.disconnect();
      throw new Error(
        "Не удалось найти совместимый OBD-профиль на этом устройстве. Возможно, у этого адаптера " +
          "нестандартная BLE-схема — напишите точную модель адаптера."
      );
    }

    try {
      await withTimeout(
        this._initELM327(),
        10000,
        "Адаптер подключился по Bluetooth, но не отвечает на команды ELM327. Попробуйте переподключить его к машине или перезапустить телефон."
      );
    } catch (err) {
      this.device.gatt.disconnect();
      throw err;
    }
    return this.device.name || "OBD-адаптер";
  }

  disconnect() {
    this.device?.gatt?.disconnect();
  }

  _handleNotify(event) {
    const text = new TextDecoder().decode(event.target.value);
    this.buffer += text;
    if (this.buffer.includes(">") && this._pending) {
      const result = this.buffer;
      this.buffer = "";
      const { resolve, timer } = this._pending;
      this._pending = null;
      clearTimeout(timer);
      resolve(result);
    }
  }

  async _writeRaw(str) {
    const data = new TextEncoder().encode(str + "\r");
    await this.writeChar.writeValue(data);
  }

  async sendCommand(cmd, timeoutMs = 5000) {
    if (!this.writeChar) throw new Error("Адаптер не подключён.");
    this.buffer = "";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending = null;
        reject(new Error(`Таймаут ответа адаптера на команду ${cmd}`));
      }, timeoutMs);
      this._pending = {
        resolve: (raw) => {
          this.onLog?.({ cmd, raw });
          resolve(raw);
        },
        timer,
      };
      this._writeRaw(cmd).catch((err) => {
        clearTimeout(timer);
        this._pending = null;
        reject(err);
      });
    });
  }

  async _initELM327() {
    await this.sendCommand("ATZ").catch(() => {});
    await this.sendCommand("ATE0");
    await this.sendCommand("ATL0");
    await this.sendCommand("ATH0");
    await this.sendCommand("ATS0").catch(() => {});
    await this.sendCommand("ATCAF1").catch(() => {});
    await this.sendCommand("ATSP0");
  }

  // Mode 03: active/confirmed DTCs — the ones that lit the Check Engine light.
  async readDTCs() {
    return parseDTCResponse(await this.sendCommand("03"), "43");
  }

  // Mode 07: pending DTCs — detected but not yet confirmed over enough
  // drive cycles to turn the light on. Useful for catching a problem early.
  async readPendingDTCs() {
    return parseDTCResponse(await this.sendCommand("07"), "47");
  }

  // Mode 0A: permanent DTCs. These cannot be erased by mode 04, by
  // disconnecting the battery, or by any generic scan tool — only by the
  // car itself, after the underlying fault is actually fixed and confirmed
  // over real drive cycles. Good for checking a used car honestly: a
  // seller who cleared the active codes can't hide these.
  async readPermanentDTCs() {
    return parseDTCResponse(await this.sendCommand("0A"), "4A");
  }

  async readVIN() {
    const raw = await this.sendCommand("0902", 6000);
    const vin = parseVIN(raw);
    if (vin) return vin;
    // A blank/garbled first read is common on cheap BLE clones (a dropped
    // BLE packet corrupts one multi-frame response) — one retry often works.
    const retryRaw = await this.sendCommand("0902", 6000).catch(() => "");
    return parseVIN(retryRaw);
  }

  // Reads the mileage as currently stored in the vehicle's own control
  // unit — the same number the instrument cluster shows. This is NOT a
  // way to detect or bypass odometer tampering: a rolled-back odometer
  // reports the rolled-back value here too. Not every vehicle supports
  // this PID (added to the standard only for newer/certain-market cars).
  async readOdometer() {
    const raw = await this.sendCommand("01A6");
    const km = parseOdometer(raw);
    if (km !== null) return km;
    const retryRaw = await this.sendCommand("01A6").catch(() => "");
    return parseOdometer(retryRaw);
  }

  // Mode 04: clears stored DTCs, turns off the Check Engine light, and
  // resets the car's readiness monitors. The car itself decides whether
  // to accept this (some refuse while the engine is running).
  async clearDTCs() {
    const raw = await this.sendCommand("04");
    const clean = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    if (clean.includes("44")) return true;
    if (clean.includes("NODATA") || clean.includes("UNABLETOCONNECT")) {
      throw new Error("Машина отказалась сбросить ошибки. Попробуйте при заглушённом двигателе.");
    }
    return true;
  }

  // Mode 01: the car's sensors RIGHT NOW, not at the moment of the fault.
  async readLiveSensors() {
    const out = {};
    // ELM327 talks to the car one command at a time over a serial-like
    // link, so these must run sequentially, never in parallel.
    for (const [key, def] of Object.entries(PID_DEFS)) {
      const raw = await this.sendCommand("01" + def.pid).catch(() => "");
      const bytes = decodeBytes(raw, "41" + def.pid, def.bytes);
      out[key] = bytes ? def.decode(bytes) : "";
    }
    const milDistRaw = await this.sendCommand("0121").catch(() => "");
    out.milDistance = parseMilDistance(milDistRaw) ?? "";
    return out;
  }

  // Mode 02: the REAL freeze frame — sensor values the car recorded at the
  // exact moment the fault was set, not "right now". Falls back to null
  // when the car has no freeze frame stored (no active DTC) or the
  // adapter/vehicle doesn't support mode 02 — the caller should fall back
  // to readLiveSensors() in that case.
  async readStoredFreezeFrame() {
    const dtcRaw = await this.sendCommand("0102").catch(() => "");
    const dtcBytes = decodeBytes(dtcRaw, "4102", 2);
    if (!dtcBytes || (dtcBytes[0] === 0 && dtcBytes[1] === 0)) return null;

    const out = {};
    let anyData = false;
    for (const [key, def] of Object.entries(PID_DEFS)) {
      const raw = await this.sendCommand("02" + def.pid + "00").catch(() => "");
      const bytes = decodeBytes(raw, "42" + def.pid + "00", def.bytes);
      out[key] = bytes ? def.decode(bytes) : "";
      if (bytes) anyData = true;
    }
    return anyData ? out : null;
  }

  // Mode 01 PID 01: which emission-related self-tests have finished since
  // codes were last cleared — what a tech inspection actually checks for.
  async readMonitorStatus() {
    const raw = await this.sendCommand("0101");
    return parseMonitorStatus(raw);
  }
}
