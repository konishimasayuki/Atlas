// api/core/auth/password.js ── ログイン中の本人がパスワードを変更する
//  POST { currentPassword, newPassword }（新パスワードは6文字以上）
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, k, verifyPassword, hashPassword } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const me = await getCurrentUser(req);
  if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ ok: false, error: "missing" });
  if (newPassword.length < 6) return res.status(400).json({ ok: false, error: "weak_password" });
  if (me.scope === "super" && me.id === "z") return res.status(400).json({ ok: false, error: "fixed_account" });

  const key = me.scope === "super" ? k.superAdmin(me.id) : k.user(me.company, me.id);
  const rec = await redis.get(key);
  if (!rec) return res.status(404).json({ ok: false, error: "not_found" });
  if (!(await verifyPassword(currentPassword, rec.passwordHash))) {
    return res.status(400).json({ ok: false, error: "wrong_current" });
  }
  rec.passwordHash = await hashPassword(newPassword);
  rec.updatedAt = Date.now();
  await redis.set(key, rec);
  return res.status(200).json({ ok: true });
}
