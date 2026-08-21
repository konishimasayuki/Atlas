// api/inventory/movements/seed.js ── デモ用：入出庫の履歴サンプル（在庫には反映しない・記録のみ過去分）
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireInventory, invKey, pad4 } from "../_guard.js";

const REASON_LABEL = { sale: "販売", consume: "消費", transfer: "持出", disposal: "廃棄", adjust_in: "入庫調整" };
const DESTS = ["福岡支店", "佐賀営業所", "北九州倉庫", "施工現場A", "施工現場B", ""];

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(invKey.movements(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const itemIds = await redis.smembers(invKey.items(tenant));
  const items = itemIds.length ? await mgetByIds(itemIds, (id) => invKey.item(tenant, id)) : [];
  if (items.length === 0) return res.status(409).json({ ok: false, error: "no_items" });

  const reasons = ["sale", "sale", "consume", "transfer", "disposal"];
  const now = Date.now();
  let n = 0;
  for (let x = 0; x < 25; x++) {
    const item = items[(x * 7) % items.length];
    const reason = reasons[x % reasons.length];
    const qty = 1 + (x % 5);
    const seq = await redis.incr(invKey.movementSeq(tenant));
    const id = `mv${seq}`;
    const mv = {
      id, code: `MV${pad4(seq)}`,
      itemId: item.id, itemCode: item.code, itemName: item.name,
      direction: "out", reason, reasonLabel: REASON_LABEL[reason],
      qty, stockAfter: Math.max(0, (item.theoreticalStock || 0) - x), // 参考値（履歴表示用の概算）
      destination: reason === "transfer" ? DESTS[x % DESTS.length] || "福岡支店" : "",
      note: "",
      createdBy: "デモ管理者",
      createdAt: now - x * 3600000 * 8,
    };
    await redis.set(invKey.movement(tenant, id), mv);
    await redis.sadd(invKey.movements(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
