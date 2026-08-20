// api/sales/deals/[id].js ── 商談：取得/更新/削除
import { redis } from "../../_lib/redis.js";
import { requireSales, salesKey } from "../_guard.js";

const FIELDS = ["title","customerId","customerName","phase","amount","probability","owner","expectedDate","nextAction","note"];
const NUM = ["amount","probability"];

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;
  const cur = await redis.get(salesKey.deal(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });
  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) if (body[f] !== undefined) cur[f] = NUM.includes(f) ? (Number(body[f]) || 0) : body[f];
    cur.updatedAt = Date.now();
    await redis.set(salesKey.deal(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }
  if (req.method === "DELETE") {
    await redis.del(salesKey.deal(tenant, id));
    await redis.srem(salesKey.deals(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
