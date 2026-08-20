// api/accounting/journal/index.js ── 仕訳：一覧(GET) / 登録(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireAccounting, acctKey, pad4 } from "../_guard.js";

// 仕訳明細：{ side:"debit"|"credit", accountCode, accountName, amount }
export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(acctKey.journals(tenant));
    const list = await mgetByIds(ids, (id) => acctKey.journal(tenant, id));
    list.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || 0) - (b.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const lines = Array.isArray(body.lines) ? body.lines.filter((l) => (Number(l.amount) || 0) > 0 && l.accountCode) : [];
    if (lines.length < 2) return res.status(400).json({ ok: false, error: "need_lines" });

    const debit = lines.filter((l) => l.side === "debit").reduce((s, l) => s + Number(l.amount), 0);
    const credit = lines.filter((l) => l.side === "credit").reduce((s, l) => s + Number(l.amount), 0);
    if (debit !== credit) return res.status(400).json({ ok: false, error: "unbalanced", debit, credit });

    const seq = await redis.incr(acctKey.journalSeq(tenant));
    const id = `jr${seq}`;
    const journal = {
      id, code: `JR${pad4(seq)}`,
      date: body.date || new Date().toISOString().slice(0, 10),
      description: body.description || "",
      lines: lines.map((l) => ({ side: l.side, accountCode: l.accountCode, accountName: l.accountName || "", amount: Number(l.amount) })),
      total: debit,
      source: body.source || "manual", // manual / expense / payroll など連携元
      createdBy: me.name,
      createdAt: Date.now(),
    };
    await redis.set(acctKey.journal(tenant, id), journal);
    await redis.sadd(acctKey.journals(tenant), id);
    return res.status(200).json({ ok: true, data: journal });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
