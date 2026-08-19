// api/ga/elearning/[id].js ── 講座：取得(GET, 本文含む) / 更新(PUT) / 削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey } from "../_guard.js";

const FIELDS = ["category", "title", "description", "level", "lessons"];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;

  const cur = await redis.get(gaKey.course(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    for (const f of FIELDS) if (body[f] !== undefined) cur[f] = body[f];
    cur.updatedAt = Date.now();
    await redis.set(gaKey.course(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(gaKey.course(tenant, id));
    await redis.srem(gaKey.courses(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
