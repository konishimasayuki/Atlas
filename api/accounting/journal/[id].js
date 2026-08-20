// api/accounting/journal/[id].js ── 仕訳：取得(GET)/削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  const { id } = req.query;
  const cur = await redis.get(acctKey.journal(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });
  if (req.method === "DELETE") {
    await redis.del(acctKey.journal(tenant, id));
    await redis.srem(acctKey.journals(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
