// api/inventory/items/[id].js ── 商品：取得(GET)/更新(PUT)/削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireInventory, invKey } from "../_guard.js";

const FIELDS = ["name","maker","category","jan","supplier","location","unit","cost","price","theoreticalStock","reorderPoint","status"];
const NUM = ["cost","price","theoreticalStock","reorderPoint"];

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;

  const cur = await redis.get(invKey.item(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) {
      if (body[f] === undefined) continue;
      cur[f] = NUM.includes(f) ? Number(body[f]) || 0 : body[f];
    }
    cur.updatedAt = Date.now();
    await redis.set(invKey.item(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(invKey.item(tenant, id));
    await redis.srem(invKey.items(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
