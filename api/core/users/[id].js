// api/core/users/[id].js ── 自社ユーザーの編集(PUT)・削除(DELETE)（canManageUsers 必須）
//  PUT { name?, allowedModules?, canManageUsers?, isActive?, password? }
//  ・自分自身の「停止」「管理権限の解除」「削除」は不可（締め出し防止）
//  ・有効な管理者が0人になる変更は不可
//  ・停止/削除は即時反映（ログイン中でも次の操作から弾かれる）
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, k, hashPassword, safeUser, mgetByIds } from "../../_lib/core.js";

async function activeAdminCount(code, exceptId) {
  const ids = await redis.smembers(k.users(code));
  const users = await mgetByIds(ids, (id) => k.user(code, id));
  return users.filter((u) => u.id !== exceptId && u.canManageUsers && u.isActive !== false).length;
}

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (me.scope !== "company" || !me.canManageUsers) return res.status(403).json({ ok: false, error: "forbidden" });

  const code = me.company;
  const { id } = req.query;
  const company = await redis.get(k.company(code));
  if (!company || company.isActive === false) return res.status(403).json({ ok: false, error: "company_inactive" });

  const cur = await redis.get(k.user(code, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });
  const isSelf = id === me.id;

  if (req.method === "PUT") {
    const b = req.body || {};
    const next = { ...cur };

    if (typeof b.name === "string" && b.name.trim()) next.name = b.name.trim();
    if (Array.isArray(b.allowedModules)) {
      next.allowedModules = b.allowedModules.filter((m) => (company.enabledModules || []).includes(m));
    }
    if (typeof b.canManageUsers === "boolean") {
      if (isSelf && !b.canManageUsers) return res.status(400).json({ ok: false, error: "self_admin" });
      next.canManageUsers = b.canManageUsers;
    }
    if (typeof b.isActive === "boolean") {
      if (isSelf && !b.isActive) return res.status(400).json({ ok: false, error: "self_stop" });
      next.isActive = b.isActive;
    }
    if (typeof b.password === "string" && b.password) {
      if (b.password.length < 6) return res.status(400).json({ ok: false, error: "weak_password" });
      next.passwordHash = await hashPassword(b.password);
    }
    // 有効な管理者が0人になる変更を防ぐ
    const wasActiveAdmin = cur.canManageUsers && cur.isActive !== false;
    const willBeActiveAdmin = next.canManageUsers && next.isActive !== false;
    if (wasActiveAdmin && !willBeActiveAdmin && (await activeAdminCount(code, id)) === 0) {
      return res.status(400).json({ ok: false, error: "last_admin" });
    }
    next.updatedAt = Date.now();
    await redis.set(k.user(code, id), next);
    return res.status(200).json({ ok: true, data: safeUser(next) });
  }

  if (req.method === "DELETE") {
    if (isSelf) return res.status(400).json({ ok: false, error: "self_delete" });
    if (cur.canManageUsers && cur.isActive !== false && (await activeAdminCount(code, id)) === 0) {
      return res.status(400).json({ ok: false, error: "last_admin" });
    }
    await redis.del(k.user(code, id));
    await redis.srem(k.users(code), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
