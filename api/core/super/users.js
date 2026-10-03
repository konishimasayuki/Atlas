// api/core/super/users.js ── スーパー管理者専用：全会社・全ユーザーの一覧とパスワード再設定・ロック解除
//  GET  → 全会社の全ユーザー（ID・名前・権限・状態・ロック状態）。パスワードは暗号化保存のため表示不可
//  POST { action: "reset", company, id, newPassword } → パスワード再設定（ロックも解除）
//  POST { action: "unlock", company, id }             → ログインロック解除
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, k, hashPassword, mgetByIds } from "../../_lib/core.js";
import { lockState, clearLock } from "../../_lib/lockout.js";

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "super") return res.status(403).json({ ok: false, error: "forbidden" });

  if (req.method === "GET") {
    const codes = await redis.smembers(k.companies());
    const companies = await mgetByIds(codes, (c) => k.company(c));
    const out = [];
    for (const co of companies) {
      const ids = await redis.smembers(k.users(co.code));
      const users = await mgetByIds(ids, (id) => k.user(co.code, id));
      for (const u of users) {
        const lk = await lockState(co.code, u.id);
        out.push({
          company: co.code, companyName: co.name, companyActive: co.isActive !== false,
          id: u.id, name: u.name, canManageUsers: !!u.canManageUsers, isActive: u.isActive !== false,
          locked: lk.locked, lockMinutes: lk.minutes, fails: lk.fails,
        });
      }
    }
    out.sort((a, b) => a.company.localeCompare(b.company) || a.id.localeCompare(b.id));
    return res.status(200).json({ ok: true, data: out });
  }

  if (req.method === "POST") {
    const { action, company, id, newPassword } = req.body || {};
    if (!company || !id) return res.status(400).json({ ok: false, error: "missing" });
    const key = k.user(company, id);
    const u = await redis.get(key);
    if (!u) return res.status(404).json({ ok: false, error: "not_found" });

    if (action === "unlock") {
      await clearLock(company, id);
      return res.status(200).json({ ok: true });
    }
    if (action === "reset") {
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ ok: false, error: "weak_password" });
      u.passwordHash = await hashPassword(newPassword);
      u.updatedAt = Date.now();
      await redis.set(key, u);
      await clearLock(company, id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: "bad_action" });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
