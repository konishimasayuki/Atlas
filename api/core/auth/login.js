// api/core/auth/login.js  ── ID + パスワードでログイン
import { redis } from "../../_lib/redis.js";
import {
  DEFAULT_TENANT, k, verifyPassword, createSession, setSessionCookie, safeUser,
} from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { loginId, password } = req.body || {};
  if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });

  const t = DEFAULT_TENANT;
  const user = await redis.get(k.user(t, loginId));
  if (!user || user.isActive === false) {
    return res.status(401).json({ ok: false, error: "invalid" });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, error: "invalid" });

  const token = await createSession(t, loginId);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true, data: safeUser(user) });
}
