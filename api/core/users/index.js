// api/core/users/index.js ── 会社管理者が自社ユーザーを一覧/追加（canManageUsers 必須）
// 付与できる画面は「会社が契約している機能(enabledModules)」の範囲内に限定される。
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, k, hashPassword, safeUser, mgetByIds } from "../../_lib/core.js";

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (me.scope !== "company") return res.status(403).json({ ok: false, error: "forbidden" });
  if (!me.canManageUsers) return res.status(403).json({ ok: false, error: "forbidden" });

  const code = me.company;
  const company = await redis.get(k.company(code));
  if (!company || company.isActive === false) return res.status(403).json({ ok: false, error: "company_inactive" });
  const enabled = company.enabledModules || [];

  if (req.method === "GET") {
    const ids = await redis.smembers(k.users(code));
    const raw = await mgetByIds(ids, (id) => k.user(code, id));
    const users = raw.map(safeUser);
    users.sort((a, b) => a.id.localeCompare(b.id));
    return res.status(200).json({ ok: true, data: users });
  }

  if (req.method === "POST") {
    const { loginId, name, password, allowedModules, canManageUsers } = req.body || {};
    if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });

    const exists = await redis.get(k.user(code, loginId));
    if (exists) return res.status(409).json({ ok: false, error: "exists" });

    // 会社が契約している機能の範囲内だけを許可
    const requested = Array.isArray(allowedModules) ? allowedModules : [];
    const allowed = requested.filter((m) => enabled.includes(m));

    const user = {
      id: loginId,
      name: name || loginId,
      company: code,
      passwordHash: await hashPassword(password),
      allowedModules: allowed,
      canManageUsers: !!canManageUsers,
      isActive: true,
      createdAt: Date.now(),
    };
    await redis.set(k.user(code, loginId), user);
    await redis.sadd(k.users(code), loginId);
    return res.status(200).json({ ok: true, data: safeUser(user) });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
