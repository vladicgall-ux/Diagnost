import { verifySession, parseCookies, SESSION_COOKIE_NAME } from "../server/auth.js";

export default function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  res.status(200).json({ authed: verifySession(cookies[SESSION_COOKIE_NAME]) });
}
