// api/core/auth/logout.js
import { getToken, getTenant, destroySession, clearSessionCookie } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const token = getToken(req);
  await destroySession(getTenant(req), token);
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
