// api/inventory/orders/[id].js ── 発注：取得(GET)/状態遷移・入荷反映(PUT)/削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireInventory, invKey } from "../_guard.js";

const NEXT = { "発注準備": ["発注済", "キャンセル"], "発注済": ["入荷済", "キャンセル"], "入荷済": [], "キャンセル": [] };

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  const { id } = req.query;
  const cur = await redis.get(invKey.order(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    const to = body.status;
    const allowed = NEXT[cur.status] || [];
    if (!allowed.includes(to)) return res.status(409).json({ ok: false, error: "bad_transition" });

    // 入荷済 → 在庫(理論在庫)に加算
    if (to === "入荷済") {
      for (const l of cur.lines) {
        const item = await redis.get(invKey.item(tenant, l.itemId));
        if (item) {
          item.theoreticalStock = (item.theoreticalStock || 0) + l.qty;
          item.updatedAt = Date.now();
          await redis.set(invKey.item(tenant, l.itemId), item);
        }
      }
      cur.receivedAt = Date.now();
    }
    cur.status = to;
    cur.history = cur.history || [];
    cur.history.push({ at: Date.now(), by: me.name, action: { "発注済": "発注確定", "入荷済": "入荷（在庫反映）", "キャンセル": "キャンセル" }[to] || to });
    cur.updatedAt = Date.now();
    await redis.set(invKey.order(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(invKey.order(tenant, id));
    await redis.srem(invKey.orders(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
