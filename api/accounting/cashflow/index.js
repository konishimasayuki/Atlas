// api/accounting/cashflow/index.js ── 資金繰り：入出金予定：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireAccounting, acctKey, pad4 } from "../_guard.js";

// entry: { id, type:"in"|"out", date, category, partner, amount, status:"予定"|"確定", note }
export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(acctKey.cfEntries(tenant));
    const list = ids.length ? await mgetByIds(ids, (id) => acctKey.cfEntry(tenant, id)) : [];
    list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.date || !body.amount || !body.type) return res.status(400).json({ ok: false, error: "missing" });
    const seq = await redis.incr(acctKey.cfSeq(tenant));
    const id = `cf${seq}`;
    const e = {
      id, code: `CF${pad4(seq)}`,
      type: body.type, date: body.date,
      category: body.category || (body.type === "in" ? "売上入金" : "諸経費"),
      partner: body.partner || "", amount: Math.abs(Number(body.amount)) || 0,
      status: body.status || "予定", note: body.note || "",
      createdAt: Date.now(),
    };
    await redis.set(acctKey.cfEntry(tenant, id), e);
    await redis.sadd(acctKey.cfEntries(tenant), id);
    return res.status(200).json({ ok: true, data: e });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
