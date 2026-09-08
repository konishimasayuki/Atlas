// api/core/bootstrap/superadmin.js ── 【緊急用】秘密キーで新しいスーパー管理者(z.z)を追加作成する
// 既存のスーパー管理者のID・パスワードが分からなくなった場合の救済用。
// company.js と同じ BOOTSTRAP_SECRET で守られており、未設定なら常に無効。
import { redis } from "../../_lib/redis.js";
import { k, hashPassword } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const secretEnv = process.env.BOOTSTRAP_SECRET;
  if (!secretEnv) return res.status(403).json({ ok: false, error: "bootstrap_disabled" });

  const { secret, loginId, name, password } = req.body || {};
  if (!secret || secret !== secretEnv) return res.status(403).json({ ok: false, error: "invalid_secret" });
  if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });

  const admin = {
    id: loginId, name: name || loginId,
    passwordHash: await hashPassword(password),
    isSuper: true, isActive: true, createdAt: Date.now(),
  };
  await redis.set(k.superAdmin(loginId), admin);
  await redis.sadd(k.superAdmins(), loginId);

  return res.status(200).json({ ok: true, data: { id: loginId, name: admin.name } });
}
