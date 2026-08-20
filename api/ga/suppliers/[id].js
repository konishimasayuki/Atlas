// api/ga/suppliers/[id].js ── 仕入先：取得/更新/削除
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey } from "../_guard.js";

const FIELDS = ["name","kana","category","contactPerson","phone","email","address",
  "closingDay","paymentMonth","paymentDay","paymentMethod","rate","creditLimit","status","note"];
const NUM = ["rate","creditLimit"];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;
  const cur = await redis.get(gaKey.supplier(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });
  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) if (body[f] !== undefined) cur[f] = NUM.includes(f) ? (Number(body[f]) || 0) : body[f];
    cur.updatedAt = Date.now();
    await redis.set(gaKey.supplier(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }
  if (req.method === "DELETE") {
    await redis.del(gaKey.supplier(tenant, id));
    await redis.srem(gaKey.suppliers(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
