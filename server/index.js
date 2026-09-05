import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { DIAGNOSE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from "./prompts.js";
import {
  timingSafeEqualStr,
  signSession,
  verifySession,
  parseCookies,
  sessionCookieHeader,
  clearSessionCookieHeader,
  SESSION_COOKIE_NAME,
  makeRateLimiter,
  getClientIp,
} from "./auth.js";

dotenv.config({ path: "../.env" });
dotenv.config();

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || null;
app.use(
  cors({
    origin: allowedOrigin ? allowedOrigin.split(",").map((s) => s.trim()) : false,
    credentials: true,
  })
);
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "openai/gpt-oss-120b";

const DTC_REGEX = /^[PBCU][0-9]{4}$/i;

const checkApiRateLimit = makeRateLimiter(5 * 60 * 1000, 20);
const checkLoginRateLimit = makeRateLimiter(5 * 60 * 1000, 10);

function requireSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  if (!verifySession(cookies[SESSION_COOKIE_NAME])) {
    return res.status(401).json({ error: "Требуется вход" });
  }
  next();
}

function requireApiRateLimit(req, res, next) {
  if (!checkApiRateLimit(getClientIp(req))) {
    return res.status(429).json({ error: "Слишком много запросов. Попробуйте позже." });
  }
  next();
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.GROQ_API_KEY) && process.env.GROQ_API_KEY !== "your_key_here" });
});

app.post("/api/login", (req, res) => {
  if (!checkLoginRateLimit(getClientIp(req))) {
    return res.status(429).json({ error: "Слишком много попыток входа. Попробуйте позже." });
  }
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return res.status(500).json({ error: "APP_PASSWORD не настроен на сервере" });
  }
  const { password } = req.body || {};
  if (!timingSafeEqualStr(String(password || ""), appPassword)) {
    return res.status(401).json({ error: "Неверный пароль" });
  }
  res.setHeader("Set-Cookie", sessionCookieHeader(signSession()));
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  res.json({ authed: verifySession(cookies[SESSION_COOKIE_NAME]) });
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  res.json({ ok: true });
});

app.post("/api/diagnose", requireApiRateLimit, requireSession, async (req, res) => {
  try {
    const { vehicle, dtc, freezeFrame } = req.body;

    if (!dtc || !DTC_REGEX.test(dtc.trim())) {
      return res.status(400).json({ error: "Некорректный формат кода ошибки. Пример: P0300" });
    }
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_key_here") {
      return res.status(500).json({ error: "GROQ_API_KEY не настроен на сервере (.env)" });
    }

    const userPrompt = `Данные автомобиля:
Марка: ${vehicle?.make || "не указана"}
Модель: ${vehicle?.model || "не указана"}
Год выпуска: ${vehicle?.year || "не указан"}
Тип двигателя/топливо: ${vehicle?.fuelType || "не указан"}
Пробег: ${vehicle?.mileage ? `${vehicle.mileage} км` : "не указан"}

Код ошибки (DTC): ${dtc.trim().toUpperCase()}

Параметры стоп-кадра (Freeze Frame):
Обороты (RPM): ${freezeFrame?.rpm ?? "нет данных"}
Температура ОЖ (°C): ${freezeFrame?.coolantTemp ?? "нет данных"}
Краткосрочная коррекция топлива STFT (%): ${freezeFrame?.stft ?? "нет данных"}
Долгосрочная коррекция топлива LTFT (%): ${freezeFrame?.ltft ?? "нет данных"}
Скорость (км/ч): ${freezeFrame?.speed ?? "нет данных"}
Нагрузка двигателя (%): ${freezeFrame?.engineLoad ?? "нет данных"}
Давление во впускном коллекторе MAP (кПа): ${freezeFrame?.intakeMAP ?? "нет данных"}
Положение дроссельной заслонки (%): ${freezeFrame?.throttlePosition ?? "нет данных"}
Температура впускного воздуха (°C): ${freezeFrame?.intakeAirTemp ?? "нет данных"}
Пробег с горящим Check Engine (км): ${freezeFrame?.milDistance ?? "нет данных"}

Дай диагностику строго в формате JSON, описанном в системном промпте.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: DIAGNOSE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    res.json({ report: parsed });
  } catch (err) {
    console.error("diagnose error:", err);
    res.status(500).json({ error: "Ошибка при обращении к ИИ-диагносту. Попробуйте ещё раз." });
  }
});

app.post("/api/chat", requireApiRateLimit, requireSession, async (req, res) => {
  try {
    const { messages, context } = req.body;

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_key_here") {
      return res.status(500).json({ error: "GROQ_API_KEY не настроен на сервере (.env)" });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Пустая история чата" });
    }

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT(context || {}) },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content || "";
    res.json({ reply });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Ошибка при обращении к ИИ-диагносту. Попробуйте ещё раз." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Autodiag server listening on http://localhost:${PORT}`);
});
