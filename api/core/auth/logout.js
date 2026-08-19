// api/core/auth/logout.js
import { getToken, destroySession, clearSessionCookie } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  await destroySession(getToken(req));
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
