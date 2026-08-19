// api/inventory/stocktake/index.js ── 棚卸：一覧(GET) / 新規開始(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireInventory, invKey, pad4 } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(invKey.counts(tenant));
    const list = await mgetByIds(ids, (id) => invKey.count(tenant, id));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // 一覧では明細(lines)は返さず軽くする
    const light = list.map(({ lines, ...rest }) => ({ ...rest, itemCount: (lines || []).length }));
    return res.status(200).json({ ok: true, data: light });
  }

  if (req.method === "POST") {
    // 現在の商品マスタをスナップショットして棚卸明細を作る（理論在庫を固定）
    const body = req.body || {};
    const itemIds = await redis.smembers(invKey.items(tenant));
    const items = await mgetByIds(itemIds, (id) => invKey.item(tenant, id));
    items.sort((a, b) => a.code.localeCompare(b.code));

    const seq = await redis.incr(invKey.countSeq(tenant));
    const id = `st${seq}`;
    const today = new Date().toISOString().slice(0, 10);
    const lines = items.map((it) => ({
      itemId: it.id, code: it.code, name: it.name, maker: it.maker,
      location: it.location, unit: it.unit,
      theoretical: it.theoreticalStock || 0,
      counted: null,            // 未カウント
      cost: it.cost || 0,
    }));
    const session = {
      id,
      code: `ST${pad4(seq)}`,
      name: body.name || `${today} 棚卸`,
      date: today,
      status: "進行中",         // 進行中 | 確定
      lines,
      createdAt: Date.now(),
    };
    await redis.set(invKey.count(tenant, id), session);
    await redis.sadd(invKey.counts(tenant), id);
    return res.status(200).json({ ok: true, data: session });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
