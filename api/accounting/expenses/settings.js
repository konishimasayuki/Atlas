// api/accounting/expenses/settings.js ── 経費精算の設定（GET/PUT）
import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey, DEFAULT_SETTINGS } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const s = await redis.get(acctKey.settings(tenant));
    return res.status(200).json({ ok: true, data: s || DEFAULT_SETTINGS });
  }
  if (req.method === "PUT") {
    const body = req.body || {};
    const s = (await redis.get(acctKey.settings(tenant))) || { ...DEFAULT_SETTINGS };
    if (body.fuelUnitPrice !== undefined) s.fuelUnitPrice = Number(body.fuelUnitPrice) || 0;
    if (Array.isArray(body.categories)) s.categories = body.categories;
    await redis.set(acctKey.settings(tenant), s);
    return res.status(200).json({ ok: true, data: s });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
