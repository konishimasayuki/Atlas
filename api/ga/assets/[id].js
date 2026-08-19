// api/ga/assets/[id].js ── 備品：取得(GET)/更新(PUT)/削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey } from "../_guard.js";

const FIELDS = ["name","category","maker","model","serial","assetNo","purchaseDate","price","usefulLife","location","assignee","status","note"];
const NUM = ["price","usefulLife"];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;

  const cur = await redis.get(gaKey.asset(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) {
      if (body[f] === undefined) continue;
      cur[f] = NUM.includes(f) ? Number(body[f]) || 0 : body[f];
    }
    cur.updatedAt = Date.now();
    await redis.set(gaKey.asset(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(gaKey.asset(tenant, id));
    await redis.srem(gaKey.assets(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
