// api/hr/employees/[id].js ── 社員：取得(GET) / 更新(PUT) / 削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireHr, hrKey } from "../_guard.js";

const FIELDS = ["name","kana","gender","department","position","employmentType","joinDate","birthDate","email","phone","location","skills","qualifications","hobbies","bio","status"];

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;

  const cur = await redis.get(hrKey.employee(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) if (body[f] !== undefined) cur[f] = body[f];
    cur.updatedAt = Date.now();
    await redis.set(hrKey.employee(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(hrKey.employee(tenant, id));
    await redis.srem(hrKey.employees(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
