// api/sales/deals/index.js ── 商談：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireSales, salesKey, pad4 } from "../_guard.js";

const FIELDS = ["title","customerId","customerName","phase","amount","probability","owner","expectedDate","nextAction","note"];
const NUM = ["amount","probability"];
// phase: 見込み | 商談中 | 提案 | 受注 | 失注

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(salesKey.deals(tenant));
    const list = await mgetByIds(ids, (id) => salesKey.deal(tenant, id));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ ok: false, error: "missing_title" });
    const seq = await redis.incr(salesKey.dealSeq(tenant));
    const id = `dl${seq}`;
    const d = { id, code: `DL${pad4(seq)}`, createdAt: Date.now() };
    for (const f of FIELDS) d[f] = NUM.includes(f) ? (Number(body[f]) || 0) : (body[f] ?? "");
    if (!d.phase) d.phase = "見込み";
    if (!d.owner) d.owner = me.name;
    if (!d.probability) d.probability = phaseProb(d.phase);
    await redis.set(salesKey.deal(tenant, id), d);
    await redis.sadd(salesKey.deals(tenant), id);
    return res.status(200).json({ ok: true, data: d });
  }
  return res.status(405).json({ ok: false, error: "method" });
}

function phaseProb(p) { return { "見込み": 20, "商談中": 50, "提案": 70, "受注": 100, "失注": 0 }[p] ?? 20; }
