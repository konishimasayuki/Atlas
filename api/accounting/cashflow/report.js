// api/accounting/cashflow/report.js ── 現金残高(仕訳から) + 入出金予定 から将来の資金推移を算出
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireAccounting, acctKey } from "../_guard.js";

async function currentCash(tenant) {
  const codes = await redis.smembers(acctKey.accounts(tenant));
  const accounts = codes.length ? await mgetByIds(codes, (c) => acctKey.account(tenant, c)) : [];
  const acc = {}; for (const a of accounts) acc[a.code] = a;
  const jIds = await redis.smembers(acctKey.journals(tenant));
  const journals = jIds.length ? await mgetByIds(jIds, (id) => acctKey.journal(tenant, id)) : [];
  const agg = {};
  for (const j of journals) for (const l of j.lines) { agg[l.accountCode] = agg[l.accountCode] || { debit: 0, credit: 0 }; agg[l.accountCode][l.side] += Number(l.amount) || 0; }
  const cashCodes = ["101", "102"];
  let cash = 0;
  for (const code of cashCodes) {
    const a = agg[code]; if (!a) continue;
    cash += (acc[code]?.side === "credit" ? a.credit - a.debit : a.debit - a.credit);
  }
  return cash;
}

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  const startCash = await currentCash(tenant);
  const ids = await redis.smembers(acctKey.cfEntries(tenant));
  const entries = ids.length ? await mgetByIds(ids, (id) => acctKey.cfEntry(tenant, id)) : [];
  entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // 今日以降の予定のみを積み上げて残高推移を作る
  const today = new Date().toISOString().slice(0, 10);
  const future = entries.filter((e) => e.date >= today);
  const past = entries.filter((e) => e.date < today);

  let running = startCash;
  const timeline = future.map((e) => {
    running += e.type === "in" ? e.amount : -e.amount;
    return { ...e, balanceAfter: running };
  });

  // 月別サマリ（今月含む向こう3ヶ月）
  const months = [];
  const base = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inAmt = future.filter((e) => e.date.startsWith(ym) && e.type === "in").reduce((s, e) => s + e.amount, 0);
    const outAmt = future.filter((e) => e.date.startsWith(ym) && e.type === "out").reduce((s, e) => s + e.amount, 0);
    months.push({ ym, in: inAmt, out: outAmt, net: inAmt - outAmt });
  }

  const minBalance = timeline.length ? Math.min(startCash, ...timeline.map((t) => t.balanceAfter)) : startCash;
  const warn = minBalance < 0;

  return res.status(200).json({
    ok: true,
    data: { startCash, timeline, months, minBalance, warn, pastCount: past.length, entryCount: entries.length },
  });
}
