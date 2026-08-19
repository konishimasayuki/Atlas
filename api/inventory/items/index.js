// api/inventory/items/index.js ── 商品マスタ：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireInventory, invKey, pad4 } from "../_guard.js";

const FIELDS = ["name","maker","category","jan","supplier","location","unit","cost","price","theoreticalStock","reorderPoint","status"];
const NUM = ["cost","price","theoreticalStock","reorderPoint"];

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(invKey.items(tenant));
    const list = await mgetByIds(ids, (id) => invKey.item(tenant, id));
    list.sort((a, b) => a.code.localeCompare(b.code));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: "missing_name" });
    const seq = await redis.incr(invKey.itemSeq(tenant));
    const id = `i${seq}`;
    const item = { id, code: `SKU${pad4(seq)}`, createdAt: Date.now() };
    for (const f of FIELDS) {
      if (NUM.includes(f)) item[f] = Number(body[f]) || 0;
      else item[f] = body[f] ?? "";
    }
    if (!item.unit) item.unit = "台";
    if (!item.status) item.status = "取扱中";
    await redis.set(invKey.item(tenant, id), item);
    await redis.sadd(invKey.items(tenant), id);
    return res.status(200).json({ ok: true, data: item });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
