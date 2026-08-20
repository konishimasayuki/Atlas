// api/sales/campaigns/[id].js ── キャンペーン：取得（宛先込み）/ 配信実行(PUT) / 削除
import { redis } from "../../_lib/redis.js";
import { requireSales, salesKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;
  const cur = await redis.get(salesKey.campaign(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    if (body.action === "send") {
      if (cur.status === "配信済") return res.status(409).json({ ok: false, error: "already_sent" });
      cur.status = "配信済";
      cur.sentAt = Date.now();
    }
    await redis.set(salesKey.campaign(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(salesKey.campaign(tenant, id));
    await redis.srem(salesKey.campaigns(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
