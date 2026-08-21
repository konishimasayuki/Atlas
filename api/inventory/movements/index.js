// api/inventory/movements/index.js ── 入出庫記録：一覧(GET) / 登録(POST・在庫に即反映)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireInventory, invKey, pad4 } from "../_guard.js";

// reason: sale(販売) | consume(消費) | transfer(現場/部門へ持出) | disposal(廃棄) | adjust_in(その他入庫・在庫調整)
const REASON_LABEL = { sale: "販売", consume: "消費", transfer: "持出", disposal: "廃棄", adjust_in: "入庫調整" };
const OUT_REASONS = ["sale", "consume", "transfer", "disposal"];

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(invKey.movements(tenant));
    const list = ids.length ? await mgetByIds(ids, (id) => invKey.movement(tenant, id)) : [];
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const { itemId, reason, qty } = body;
    if (!itemId || !reason || !qty || Number(qty) <= 0) return res.status(400).json({ ok: false, error: "missing" });
    if (!REASON_LABEL[reason]) return res.status(400).json({ ok: false, error: "bad_reason" });

    const item = await redis.get(invKey.item(tenant, itemId));
    if (!item) return res.status(404).json({ ok: false, error: "item_not_found" });

    const isOut = OUT_REASONS.includes(reason);
    const q = Number(qty);
    if (isOut && (item.theoreticalStock || 0) < q) {
      return res.status(409).json({ ok: false, error: "insufficient_stock", stock: item.theoreticalStock || 0 });
    }

    item.theoreticalStock = (item.theoreticalStock || 0) + (isOut ? -q : q);
    item.updatedAt = Date.now();
    await redis.set(invKey.item(tenant, itemId), item);

    const seq = await redis.incr(invKey.movementSeq(tenant));
    const id = `mv${seq}`;
    const mv = {
      id, code: `MV${pad4(seq)}`,
      itemId, itemCode: item.code, itemName: item.name,
      direction: isOut ? "out" : "in",
      reason, reasonLabel: REASON_LABEL[reason],
      qty: q, stockAfter: item.theoreticalStock,
      destination: body.destination || "",   // 現場/部門名など（持出時）
      note: body.note || "",
      createdBy: me.name,
      createdAt: Date.now(),
    };
    await redis.set(invKey.movement(tenant, id), mv);
    await redis.sadd(invKey.movements(tenant), id);
    return res.status(200).json({ ok: true, data: mv });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
