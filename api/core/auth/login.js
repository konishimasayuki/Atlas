// api/core/auth/login.js ── 会社コード + ログインID + パスワード
import { redis } from "../../_lib/redis.js";
import {
  k, SUPER_CODE, verifyPassword, createSession, setSessionCookie, companyUserView,
} from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { companyCode, loginId, password } = req.body || {};
  if (!companyCode || !loginId || !password) {
    return res.status(400).json({ ok: false, error: "missing" });
  }

  // スーパー管理者（運営）
  if (companyCode === SUPER_CODE) {
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
