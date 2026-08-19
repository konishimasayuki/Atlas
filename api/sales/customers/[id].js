// api/sales/customers/[id].js ── 顧客：取得(GET) / 更新(PUT) / 削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireSales, salesKey } from "../_guard.js";

const FIELDS = ["name", "kana", "type", "contactPerson", "phone", "email", "address", "rank", "status", "note"];

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;

  const cur = await redis.get(salesKey.customer(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) {
      if (body[f] !== undefined) cur[f] = body[f];
    }
    cur.updatedAt = Date.now();
    await redis.set(salesKey.customer(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(salesKey.customer(tenant, id));
    await redis.srem(salesKey.customers(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
