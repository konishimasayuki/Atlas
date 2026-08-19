// api/sales/customers/index.js ── 顧客台帳：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { requireSales, salesKey, pad4 } from "../_guard.js";

const FIELDS = ["name", "kana", "type", "contactPerson", "phone", "email", "address", "rank", "status", "note"];

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(salesKey.customers(tenant));
    const list = [];
    for (const id of ids) {
      const c = await redis.get(salesKey.customer(tenant, id));
      if (c) list.push(c);
    }
    list.sort((a, b) => a.code.localeCompare(b.code));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: "missing_name" });

    const seq = await redis.incr(salesKey.seq(tenant));
    const id = `c${seq}`;
    const customer = {
      id,
      code: `C${pad4(seq)}`,
      createdAt: Date.now(),
    };
    for (const f of FIELDS) customer[f] = body[f] ?? "";
    if (!customer.rank) customer.rank = "B";
    if (!customer.status) customer.status = "見込み";
    if (!customer.type) customer.type = "法人";

    await redis.set(salesKey.customer(tenant, id), customer);
    await redis.sadd(salesKey.customers(tenant), id);
    return res.status(200).json({ ok: true, data: customer });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
