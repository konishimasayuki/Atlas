// api/core/auth/login.js ── 会社コード + ログインID + パスワード
import { redis } from "../../_lib/redis.js";
import {
  k, SUPER_CODE, verifyPassword, hashPassword, createSession, setSessionCookie, companyUserView,
} from "../../_lib/core.js";
import { lockedMinutes, recordFail, clearLock } from "../../_lib/lockout.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { companyCode, loginId, password } = req.body || {};
  if (!companyCode || !loginId || !password) {
    return res.status(400).json({ ok: false, error: "missing" });
  }

  // ロック中なら即拒否（正しいパスワードでも入れない）
  const lockedMin = await lockedMinutes(companyCode, loginId);
  if (lockedMin > 0) return res.status(429).json({ ok: false, error: "locked", minutes: lockedMin });

  const fail = async () => {
    const f = await recordFail(companyCode, loginId);
    if (f.locked) return res.status(429).json({ ok: false, error: "locked", minutes: f.minutes });
    return res.status(401).json({ ok: false, error: "invalid", remaining: f.remaining });
  };

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
      await clearLock(companyCode, loginId);
      const token = await createSession("super", null, "z");
      setSessionCookie(res, token);
      return res.status(200).json({ ok: true, data: { scope: "super", id: "z", name: fixed.name, isSuper: true } });
    }
    const admin = await redis.get(k.superAdmin(loginId));
    if (!admin || admin.isActive === false) return fail();
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) return fail();
    await clearLock(companyCode, loginId);
    const token = await createSession("super", null, loginId);
    setSessionCookie(res, token);
    return res.status(200).json({
      ok: true,
      data: { scope: "super", id: admin.id, name: admin.name, isSuper: true },
    });
  }

  // 通常の会社
  const company = await redis.get(k.company(companyCode));
  if (!company || company.isActive === false) return fail();
  const user = await redis.get(k.user(companyCode, loginId));
  if (!user || user.isActive === false) return fail();
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return fail();
  await clearLock(companyCode, loginId);

  const token = await createSession("company", companyCode, loginId);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true, data: companyUserView(user, company) });
}
