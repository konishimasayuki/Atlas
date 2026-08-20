import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;
  const cur = await redis.get(acctKey.cfEntry(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });
  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of ["type", "date", "category", "partner", "amount", "status", "note"]) {
      if (body[f] === undefined) continue;
      cur[f] = f === "amount" ? Math.abs(Number(body[f])) || 0 : body[f];
    }
    await redis.set(acctKey.cfEntry(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }
  if (req.method === "DELETE") {
    await redis.del(acctKey.cfEntry(tenant, id));
    await redis.srem(acctKey.cfEntries(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
