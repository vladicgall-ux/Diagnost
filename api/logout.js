import { clearSessionCookieHeader } from "../server/auth.js";

export default function handler(req, res) {
  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  res.status(200).json({ ok: true });
}
