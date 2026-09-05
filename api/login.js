import {
  timingSafeEqualStr,
  signSession,
  sessionCookieHeader,
  makeRateLimiter,
  getClientIp,
} from "../server/auth.js";

const checkRateLimit = makeRateLimiter(5 * 60 * 1000, 10);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!checkRateLimit(getClientIp(req))) {
    res.status(429).json({ error: "Слишком много попыток входа. Попробуйте позже." });
    return;
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    res.status(500).json({ error: "APP_PASSWORD не настроен на сервере" });
    return;
  }

  const { password } = req.body || {};
  if (!timingSafeEqualStr(String(password || ""), appPassword)) {
    res.status(401).json({ error: "Неверный пароль" });
    return;
  }

  res.setHeader("Set-Cookie", sessionCookieHeader(signSession()));
  res.status(200).json({ ok: true });
}
