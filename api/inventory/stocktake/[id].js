// api/inventory/stocktake/[id].js ── 棚卸：取得(GET) / カウント保存・確定(PUT) / 削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireInventory, invKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;

  const cur = await redis.get(invKey.count(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    if (cur.status === "確定") return res.status(409).json({ ok: false, error: "already_fixed" });

    // カウント値の更新（{ counts: { itemId: number } }）
    if (body.counts && typeof body.counts === "object") {
      cur.lines = cur.lines.map((l) =>
        body.counts[l.itemId] !== undefined
          ? { ...l, counted: body.counts[l.itemId] === null ? null : Number(body.counts[l.itemId]) }
          : l
      );
    }

    // 確定：差異を在庫(理論在庫)に反映し、商品マスタを更新
    if (body.finalize === true) {
      for (const l of cur.lines) {
        if (l.counted === null) continue; // 未カウントは触らない
        const item = await redis.get(invKey.item(tenant, l.itemId));
        if (item) {
          item.theoreticalStock = l.counted; // 実地数で上書き
          item.updatedAt = Date.now();
          await redis.set(invKey.item(tenant, l.itemId), item);
        }
      }
      cur.status = "確定";
      cur.fixedAt = Date.now();
    }

    cur.updatedAt = Date.now();
    await redis.set(invKey.count(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(invKey.count(tenant, id));
    await redis.srem(invKey.counts(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
