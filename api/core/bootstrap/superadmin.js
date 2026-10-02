// api/core/bootstrap/superadmin.js ── /bootstrap からスーパー管理者(会社コード z.z)を作成
// ★このURLを知っていれば誰でも作成できる。使い終わったら削除推奨★
import { redis } from "../../_lib/redis.js";
import { k, hashPassword } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const { loginId, name, password } = req.body || {};
  if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });
  if (password.length < 8) return res.status(400).json({ ok: false, error: "weak_password" });

  const exists = await redis.get(k.superAdmin(loginId));
  if (exists) return res.status(409).json({ ok: false, error: "exists" });

  const admin = {
    id: loginId, name: name || loginId,
    passwordHash: await hashPassword(password),
    isSuper: true, isActive: true, createdAt: Date.now(),
  };
  await redis.set(k.superAdmin(loginId), admin);
  await redis.sadd(k.superAdmins(), loginId);
  return res.status(200).json({ ok: true, data: { id: loginId, name: admin.name } });
}
