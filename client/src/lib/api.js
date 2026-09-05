export async function login(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Не удалось войти");
  return data;
}

export async function fetchSession() {
  const res = await fetch("/api/session", { credentials: "same-origin" });
  if (!res.ok) return { authed: false };
  return res.json();
}

export async function runDiagnose({ vehicle, dtc, freezeFrame }) {
  const res = await fetch("/api/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ vehicle, dtc, freezeFrame }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка диагностики");
  return data.report;
}

export async function sendChatMessage({ messages, context }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ messages, context }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка чата");
  return data.reply;
}
