import Groq from "groq-sdk";
import { CHAT_SYSTEM_PROMPT } from "../server/prompts.js";
import { verifySession, parseCookies, SESSION_COOKIE_NAME, makeRateLimiter, getClientIp } from "../server/auth.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "openai/gpt-oss-120b";

const checkRateLimit = makeRateLimiter(5 * 60 * 1000, 20);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!checkRateLimit(getClientIp(req))) {
    res.status(429).json({ error: "Слишком много запросов. Попробуйте позже." });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  if (!verifySession(cookies[SESSION_COOKIE_NAME])) {
    res.status(401).json({ error: "Требуется вход" });
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
