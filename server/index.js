import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { DIAGNOSE_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from "./prompts.js";

dotenv.config({ path: "../.env" });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const DTC_REGEX = /^[PBCU][0-9]{4}$/i;

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.GROQ_API_KEY) && process.env.GROQ_API_KEY !== "your_key_here" });
});

app.post("/api/diagnose", async (req, res) => {
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

Код ошибки (DTC): ${dtc.trim().toUpperCase()}

Параметры стоп-кадра (Freeze Frame):
Обороты (RPM): ${freezeFrame?.rpm ?? "нет данных"}
Температура ОЖ (°C): ${freezeFrame?.coolantTemp ?? "нет данных"}
Краткосрочная коррекция топлива STFT (%): ${freezeFrame?.stft ?? "нет данных"}
Долгосрочная коррекция топлива LTFT (%): ${freezeFrame?.ltft ?? "нет данных"}
Скорость (км/ч): ${freezeFrame?.speed ?? "нет данных"}

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

app.post("/api/chat", async (req, res) => {
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
