// api/inventory/orders/index.js ── 発注：一覧(GET) / 作成(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireInventory, invKey, pad4 } from "../_guard.js";

// status: 発注準備 | 発注済 | 入荷済 | キャンセル
export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(invKey.orders(tenant));
    const list = await mgetByIds(ids, (id) => invKey.order(tenant, id));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const lines = Array.isArray(body.lines) ? body.lines.filter((l) => (Number(l.qty) || 0) > 0) : [];
    if (lines.length === 0) return res.status(400).json({ ok: false, error: "no_lines" });

    // 仕入先ごとにまとめず、1発注＝1明細群（画面側で仕入先別に作る）
    const norm = lines.map((l) => ({
      itemId: l.itemId, code: l.code, name: l.name,
      qty: Number(l.qty) || 0, cost: Number(l.cost) || 0, amount: (Number(l.qty) || 0) * (Number(l.cost) || 0),
    }));
    const total = norm.reduce((s, l) => s + l.amount, 0);
    const seq = await redis.incr(invKey.orderSeq(tenant));
    const id = `po${seq}`;
    const order = {
      id, code: `PO${pad4(seq)}`,
      supplier: body.supplier || "（仕入先未設定）",
      lines: norm, total,
      status: "発注準備",
      createdBy: me.name,
      note: body.note || "",
      createdAt: Date.now(),
      history: [{ at: Date.now(), by: me.name, action: "作成" }],
    };
    await redis.set(invKey.order(tenant, id), order);
    await redis.sadd(invKey.orders(tenant), id);
    return res.status(200).json({ ok: true, data: order });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
