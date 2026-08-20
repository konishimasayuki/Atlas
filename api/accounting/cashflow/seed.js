// api/accounting/cashflow/seed.js ── デモ：入金/支払予定サンプル（向こう3ヶ月）
import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey, pad4 } from "../_guard.js";

function addMonthDate(offsetMonths, day) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  const y = d.getFullYear(), m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(acctKey.cfEntries(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const entries = [
    // 今月
    ["in", 0, 25, "売掛金回収", "西日本電機商会", 2400000, "予定"],
    ["out", 0, 27, "給与支払", "従業員一同", 1800000, "確定"],
    ["out", 0, 28, "家賃支払", "博多不動産", 180000, "確定"],
    ["in", 0, 20, "現金売上入金", "店頭売上分", 650000, "確定"],
    // 来月
    ["out", 1, 5, "仕入代金支払", "九州エレクトロ", 1200000, "予定"],
    ["in", 1, 10, "売掛金回収", "有明サプライ", 1800000, "予定"],
    ["out", 1, 27, "給与支払", "従業員一同", 1850000, "予定"],
    ["out", 1, 28, "家賃支払", "博多不動産", 180000, "予定"],
    ["out", 1, 31, "借入返済", "地方銀行", 300000, "予定"],
    // 再来月
    ["in", 2, 15, "売掛金回収", "日本総合電機", 3200000, "予定"],
    ["out", 2, 20, "賞与支払", "従業員一同", 2500000, "予定"],
    ["out", 2, 27, "給与支払", "従業員一同", 1850000, "予定"],
    ["out", 2, 28, "家賃支払", "博多不動産", 180000, "予定"],
    ["in", 2, 25, "現金売上入金", "店頭売上分", 700000, "予定"],
  ];

  let n = 0;
  for (const [type, offset, day, category, partner, amount, status] of entries) {
    const seq = await redis.incr(acctKey.cfSeq(tenant));
    const id = `cf${seq}`;
    const e = { id, code: `CF${pad4(seq)}`, type, date: addMonthDate(offset, day), category, partner, amount, status, note: "", createdAt: Date.now() + n };
    await redis.set(acctKey.cfEntry(tenant, id), e);
    await redis.sadd(acctKey.cfEntries(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
