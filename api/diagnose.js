import Groq from "groq-sdk";
import { DIAGNOSE_SYSTEM_PROMPT } from "../server/prompts.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "openai/gpt-oss-120b";
const DTC_REGEX = /^[PBCU][0-9]{4}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { vehicle, dtc, freezeFrame } = req.body || {};

    if (!dtc || !DTC_REGEX.test(String(dtc).trim())) {
      res.status(400).json({ error: "Некорректный формат кода ошибки. Пример: P0300" });
      return;
    }
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_key_here") {
      res.status(500).json({ error: "GROQ_API_KEY не настроен на сервере" });
      return;
    }

    const userPrompt = `Данные автомобиля:
Марка: ${vehicle?.make || "не указана"}
Модель: ${vehicle?.model || "не указана"}
Год выпуска: ${vehicle?.year || "не указан"}
Тип двигателя/топливо: ${vehicle?.fuelType || "не указан"}

Код ошибки (DTC): ${String(dtc).trim().toUpperCase()}

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
    res.status(200).json({ report: JSON.parse(raw) });
  } catch (err) {
    console.error("diagnose error:", err);
    res.status(500).json({ error: "Ошибка при обращении к ИИ-диагносту. Попробуйте ещё раз." });
  }
}
