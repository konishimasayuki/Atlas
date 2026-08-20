// api/hr/org/[id].js ── 組織図ノード：更新(PUT: label/parentId/order)/削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireHr, hrKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;
  const cur = await redis.get(hrKey.orgNode(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "PUT") {
    const body = req.body || {};
    if (body.label !== undefined) cur.label = body.label;
    if (body.parentId !== undefined) {
      if (body.parentId === id) return res.status(400).json({ ok: false, error: "self_parent" });
      cur.parentId = body.parentId;
    }
    if (body.order !== undefined) cur.order = Number(body.order) || 0;
    await redis.set(hrKey.orgNode(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    if (cur.type === "company") return res.status(400).json({ ok: false, error: "cannot_delete_root" });
    // 子ノードは削除ノードの親へ付け替え（迷子にしない）
    const allIds = await redis.smembers(hrKey.orgNodes(tenant));
    for (const cid of allIds) {
      if (cid === id) continue;
      const c = await redis.get(hrKey.orgNode(tenant, cid));
      if (c && c.parentId === id) {
        c.parentId = cur.parentId || null;
        await redis.set(hrKey.orgNode(tenant, cid), c);
      }
    }
    await redis.del(hrKey.orgNode(tenant, id));
    await redis.srem(hrKey.orgNodes(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
