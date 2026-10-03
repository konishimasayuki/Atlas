// api/core/auth/login.js ── 会社コード + ログインID + パスワード
import { redis } from "../../_lib/redis.js";
import {
  k, SUPER_CODE, verifyPassword, hashPassword, createSession, setSessionCookie, companyUserView,
} from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { companyCode, loginId, password } = req.body || {};
  if (!companyCode || !loginId || !password) {
    return res.status(400).json({ ok: false, error: "missing" });
  }

  // スーパー管理者（運営）
  if (companyCode === SUPER_CODE) {
    // 固定の運営アカウント（コード z / ID z / パスワード z）。初回ログイン時に自動作成。
    if (loginId === "z" && password === "z") {
      let fixed = await redis.get(k.superAdmin("z"));
      if (!fixed) {
        fixed = { id: "z", name: "運営管理者", passwordHash: await hashPassword("z"), isSuper: true, isActive: true, createdAt: Date.now() };
        await redis.set(k.superAdmin("z"), fixed);
        await redis.sadd(k.superAdmins(), "z");
      }
      const token = await createSession("super", null, "z");
      setSessionCookie(res, token);
      return res.status(200).json({ ok: true, data: { scope: "super", id: "z", name: fixed.name, isSuper: true } });
    }
    const admin = await redis.get(k.superAdmin(loginId));
    if (!admin || admin.isActive === false) return res.status(401).json({ ok: false, error: "invalid" });
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid" });
    const token = await createSession("super", null, loginId);
    setSessionCookie(res, token);
    return res.status(200).json({
      ok: true,
      data: { scope: "super", id: admin.id, name: admin.name, isSuper: true },
    });
  }

  // 通常の会社
  const company = await redis.get(k.company(companyCode));
  if (!company || company.isActive === false) return res.status(401).json({ ok: false, error: "invalid" });
  const user = await redis.get(k.user(companyCode, loginId));
  if (!user || user.isActive === false) return res.status(401).json({ ok: false, error: "invalid" });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, error: "invalid" });

  const token = await createSession("company", companyCode, loginId);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true, data: companyUserView(user, company) });
}
