import Groq from "groq-sdk";
import crypto from "crypto";
import { CHAT_SYSTEM_PROMPT } from "../server/prompts.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "openai/gpt-oss-120b";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "Слишком много запросов. Попробуйте позже." });
    return;
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    res.status(500).json({ error: "APP_PASSWORD не настроен на сервере" });
    return;
  }
  const providedPassword = req.headers["x-app-password"] || "";
  if (!timingSafeEqualStr(providedPassword, appPassword)) {
    res.status(401).json({ error: "Неверный пароль доступа" });
    return;
  }

  try {
    const { messages, context } = req.body || {};

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_key_here") {
      res.status(500).json({ error: "GROQ_API_KEY не настроен на сервере" });
      return;
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Пустая история чата" });
      return;
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
    res.status(200).json({ reply });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Ошибка при обращении к ИИ-диагносту. Попробуйте ещё раз." });
  }
}
