// api/ga/suppliers/index.js ── 仕入・取引条件：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

const FIELDS = ["name","kana","category","contactPerson","phone","email","address",
  "closingDay","paymentMonth","paymentDay","paymentMethod","rate","creditLimit","status","note"];
const NUM = ["rate","creditLimit"];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(gaKey.suppliers(tenant));
    const list = await mgetByIds(ids, (id) => gaKey.supplier(tenant, id));
    list.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: "missing_name" });
    const seq = await redis.incr(gaKey.supplierSeq(tenant));
    const id = `sp${seq}`;
    const s = { id, code: `SP${pad4(seq)}`, createdAt: Date.now() };
    for (const f of FIELDS) s[f] = NUM.includes(f) ? (Number(body[f]) || 0) : (body[f] ?? "");
    if (!s.status) s.status = "取引中";
    if (!s.closingDay) s.closingDay = "末日";
    if (!s.paymentMonth) s.paymentMonth = "翌月";
    if (!s.paymentDay) s.paymentDay = "末日";
    await redis.set(gaKey.supplier(tenant, id), s);
    await redis.sadd(gaKey.suppliers(tenant), id);
    return res.status(200).json({ ok: true, data: s });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
