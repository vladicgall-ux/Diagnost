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
];

const ALL_SERVICE_UUIDS = [...new Set(PROFILES.map((p) => p.service))];

function decodeDTC(hex4) {
  const b1 = parseInt(hex4.slice(0, 2), 16);
  const b2 = hex4.slice(2, 4).toUpperCase();
  const letters = ["P", "C", "B", "U"];
  const letter = letters[(b1 >> 6) & 0x03];
  const digit1 = (b1 >> 4) & 0x03;
  const digit2 = (b1 & 0x0f).toString(16).toUpperCase();
  return `${letter}${digit1}${digit2}${b2}`;
}

function parseDTCResponse(raw) {
  const clean = raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const idx = clean.indexOf("43");
  if (idx === -1) return [];
  const body = clean.slice(idx + 2);
  const codes = [];
  for (let i = 0; i + 4 <= body.length; i += 4) {
    const word = body.slice(i, i + 4);
    if (word === "0000") continue;
    codes.push(decodeDTC(word));
  }
  return codes;
}

function extractBytes(raw, modePidHexNoSpace) {
  const clean = raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const idx = clean.indexOf(modePidHexNoSpace);
  if (idx === -1) return null;
  return clean.slice(idx + modePidHexNoSpace.length);
}

function parseRPM(raw) {
  const bytes = extractBytes(raw, "410C");
  if (!bytes || bytes.length < 4) return null;
  const a = parseInt(bytes.slice(0, 2), 16);
  const b = parseInt(bytes.slice(2, 4), 16);
  return Math.round((a * 256 + b) / 4);
}

function parseCoolantTemp(raw) {
  const bytes = extractBytes(raw, "4105");
  if (!bytes || bytes.length < 2) return null;
  return parseInt(bytes.slice(0, 2), 16) - 40;
}

function parseFuelTrim(raw, pidHex) {
  const bytes = extractBytes(raw, pidHex);
  if (!bytes || bytes.length < 2) return null;
  const a = parseInt(bytes.slice(0, 2), 16);
  return +(((a - 128) * 100) / 128).toFixed(1);
}

function parseSpeed(raw) {
  const bytes = extractBytes(raw, "410D");
  if (!bytes || bytes.length < 2) return null;
  return parseInt(bytes.slice(0, 2), 16);
}

function parseEngineLoad(raw) {
  const bytes = extractBytes(raw, "4104");
  if (!bytes || bytes.length < 2) return null;
  const a = parseInt(bytes.slice(0, 2), 16);
  return +((a * 100) / 255).toFixed(1);
}

function parseIntakeMAP(raw) {
  const bytes = extractBytes(raw, "410B");
  if (!bytes || bytes.length < 2) return null;
  return parseInt(bytes.slice(0, 2), 16); // kPa, direct byte value
}

function parseThrottlePosition(raw) {
  const bytes = extractBytes(raw, "4111");
  if (!bytes || bytes.length < 2) return null;
  const a = parseInt(bytes.slice(0, 2), 16);
  return +((a * 100) / 255).toFixed(1);
}

function parseIntakeAirTemp(raw) {
  const bytes = extractBytes(raw, "410F");
  if (!bytes || bytes.length < 2) return null;
  return parseInt(bytes.slice(0, 2), 16) - 40;
}

function parseMilDistance(raw) {
  const bytes = extractBytes(raw, "4121");
  if (!bytes || bytes.length < 4) return null;
  const a = parseInt(bytes.slice(0, 2), 16);
  const b = parseInt(bytes.slice(2, 4), 16);
  return a * 256 + b; // km
}

function parseOdometer(raw) {
  // PID 0xA6 "Odometer" — added to OBD-II in SAE J1979-2 (mandatory on many
  // markets only from ~2019+). Older or non-compliant vehicles won't answer.
  const bytes = extractBytes(raw, "41A6");
  if (!bytes || bytes.length < 8) return null;
  const a = parseInt(bytes.slice(0, 2), 16);
  const b = parseInt(bytes.slice(2, 4), 16);
  const c = parseInt(bytes.slice(4, 6), 16);
  const d = parseInt(bytes.slice(6, 8), 16);
  const raw32 = a * 16777216 + b * 65536 + c * 256 + d;
  return +(raw32 * 0.1).toFixed(1); // km
}

function parseVIN(raw) {
  const clean = raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
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

export class OBDBluetoothClient {
  constructor() {
    this.device = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.buffer = "";
    this._pending = null;
    this.onDisconnected = null;
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

    const server = await this.device.gatt.connect();

    let connected = false;
    for (const profile of PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.service);
        const writeChar = await service.getCharacteristic(profile.write);
        const notifyChar =
          profile.notify === profile.write
            ? writeChar
            : await service.getCharacteristic(profile.notify);
        await notifyChar.startNotifications();
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
        "Не удалось найти совместимый OBD-профиль на этом устройстве."
      );
    }

    await this._initELM327();
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
      this._pending = { resolve, timer };
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
    await this.sendCommand("ATSP0");
  }

  async readDTCs() {
    const raw = await this.sendCommand("03");
    return parseDTCResponse(raw);
  }

  async readVIN() {
    const raw = await this.sendCommand("0902", 6000);
    return parseVIN(raw);
  }

  // Reads the mileage as currently stored in the vehicle's own control
  // unit — the same number the instrument cluster shows. This is NOT a
  // way to detect or bypass odometer tampering: a rolled-back odometer
  // reports the rolled-back value here too. Not every vehicle supports
  // this PID (added to the standard only for newer/certain-market cars).
  async readOdometer() {
    const raw = await this.sendCommand("01A6");
    return parseOdometer(raw);
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

  async readFreezeFrame() {
    // ELM327 talks to the car one command at a time over a serial-like
    // link, so these must run sequentially, never in parallel.
    const rpmRaw = await this.sendCommand("010C").catch(() => "");
    const tempRaw = await this.sendCommand("0105").catch(() => "");
    const stftRaw = await this.sendCommand("0106").catch(() => "");
    const ltftRaw = await this.sendCommand("0107").catch(() => "");
    const speedRaw = await this.sendCommand("010D").catch(() => "");
    const loadRaw = await this.sendCommand("0104").catch(() => "");
    const mapRaw = await this.sendCommand("010B").catch(() => "");
    const throttleRaw = await this.sendCommand("0111").catch(() => "");
    const iatRaw = await this.sendCommand("010F").catch(() => "");
    const milDistRaw = await this.sendCommand("0121").catch(() => "");

    return {
      rpm: parseRPM(rpmRaw) ?? "",
      coolantTemp: parseCoolantTemp(tempRaw) ?? "",
      stft: parseFuelTrim(stftRaw, "4106") ?? "",
      ltft: parseFuelTrim(ltftRaw, "4107") ?? "",
      speed: parseSpeed(speedRaw) ?? "",
      engineLoad: parseEngineLoad(loadRaw) ?? "",
      intakeMAP: parseIntakeMAP(mapRaw) ?? "",
      throttlePosition: parseThrottlePosition(throttleRaw) ?? "",
      intakeAirTemp: parseIntakeAirTemp(iatRaw) ?? "",
      milDistance: parseMilDistance(milDistRaw) ?? "",
    };
  }
}
