const APP_PASSWORD = "1234567890";

export async function runDiagnose({ vehicle, dtc, freezeFrame }) {
  const res = await fetch("/api/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Password": APP_PASSWORD },
    body: JSON.stringify({ vehicle, dtc, freezeFrame }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка диагностики");
  return data.report;
}

export async function sendChatMessage({ messages, context }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Password": APP_PASSWORD },
    body: JSON.stringify({ messages, context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка чата");
  return data.reply;
}
