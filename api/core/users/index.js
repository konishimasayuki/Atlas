// api/core/users/index.js  ── ユーザー一覧 / 追加（canManageUsers 権限が必須）
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, getTenant, k, hashPassword, safeUser } from "../../_lib/core.js";

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!me.canManageUsers) return res.status(403).json({ ok: false, error: "forbidden" });

  const t = getTenant(req);

  if (req.method === "GET") {
    const ids = await redis.smembers(k.users(t));
    const users = [];
    for (const id of ids) {
      const u = await redis.get(k.user(t, id));
      if (u) users.push(safeUser(u));
    }
    users.sort((a, b) => a.id.localeCompare(b.id));
    return res.status(200).json({ ok: true, data: users });
  }

  if (req.method === "POST") {
    const { loginId, name, password, allowedModules, canManageUsers } = req.body || {};
    if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });

    const exists = await redis.get(k.user(t, loginId));
    if (exists) return res.status(409).json({ ok: false, error: "exists" });

    const user = {
      id: loginId,
      name: name || loginId,
      tenant: t,
      passwordHash: await hashPassword(password),
      allowedModules: Array.isArray(allowedModules) ? allowedModules : [],
      canManageUsers: !!canManageUsers,
      isActive: true,
      createdAt: Date.now(),
    };
    await redis.set(k.user(t, loginId), user);
    await redis.sadd(k.users(t), loginId);
    return res.status(200).json({ ok: true, data: safeUser(user) });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
