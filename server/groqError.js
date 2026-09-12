// Turns a groq-sdk error into an accurate, specific message instead of one
// generic "something went wrong" string every time — so a real cause
// (expired key, rate limit, deprecated model) is visible instead of hidden.
export function describeGroqError(err) {
  const status = err?.status;
  const code = err?.error?.error?.code || err?.code;
  const upstreamMessage = err?.error?.error?.message || err?.message;

  if (status === 401 || code === "expired_api_key" || code === "invalid_api_key") {
    return "Groq API-ключ недействителен или истёк. Нужно обновить GROQ_API_KEY на сервере.";
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    return "Groq: превышен лимит запросов на этом ключе. Подождите немного и попробуйте снова.";
  }
  if (code === "model_not_found" || code === "model_decommissioned") {
    return "Groq: используемая модель ИИ больше не поддерживается. Нужно обновить модель в коде сервера.";
  }
  if (typeof status === "number" && status >= 500) {
    return "Groq временно недоступен (сбой на их стороне). Попробуйте через минуту.";
  }
  if (upstreamMessage) {
    return `Groq вернул ошибку: ${upstreamMessage}`;
  }
  return "Ошибка при обращении к ИИ-диагносту. Попробуйте ещё раз.";
}
