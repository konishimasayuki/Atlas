// api/accounting/journal/seed.js ── サンプル仕訳（標準科目を使った1年分の取引例）
import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey, pad4 } from "../_guard.js";
import { STANDARD_ACCOUNTS } from "../_coa.js";

const NM = {}; for (const a of STANDARD_ACCOUNTS) NM[a.code] = a.name;
const D = (code, amount) => ({ side: "debit", accountCode: code, accountName: NM[code], amount });
const C = (code, amount) => ({ side: "credit", accountCode: code, accountName: NM[code], amount });

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  // 勘定科目が無ければ初期化
  const accCount = await redis.scard(acctKey.accounts(tenant));
  if (accCount === 0) {
    for (const a of STANDARD_ACCOUNTS) { await redis.set(acctKey.account(tenant, a.code), a); await redis.sadd(acctKey.accounts(tenant), a.code); }
  }
  const existing = await redis.scard(acctKey.journals(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  // 取引例（貸借一致）
  const entries = [
    ["2026-01-05", "資本金の払込", [D("102", 5000000), C("301", 5000000)]],
    ["2026-01-10", "事務所家賃 前払", [D("519", 180000), C("102", 180000)]],
    ["2026-01-15", "商品仕入（掛）", [D("501", 1200000), C("201", 1200000)]],
    ["2026-01-25", "売上（掛）", [D("103", 2400000), C("401", 2400000)]],
    ["2026-01-31", "給料支払", [D("511", 800000), C("102", 720000), C("204", 80000)]],
    ["2026-02-10", "買掛金の支払", [D("201", 1200000), C("102", 1200000)]],
    ["2026-02-20", "売掛金の回収", [D("102", 2000000), C("103", 2000000)]],
    ["2026-02-25", "備品購入（現金）", [D("113", 300000), C("101", 300000)]],
    ["2026-03-05", "現金売上", [D("101", 650000), C("401", 650000)]],
    ["2026-03-15", "通信費・消耗品", [D("517", 45000), D("516", 60000), C("102", 105000)]],
    ["2026-03-20", "接待交際費", [D("514", 88000), C("101", 88000)]],
    ["2026-03-31", "借入（短期）", [D("102", 3000000), C("205", 3000000)]],
    ["2026-04-10", "商品仕入（掛）", [D("501", 900000), C("201", 900000)]],
    ["2026-04-25", "売上（掛）", [D("103", 1800000), C("401", 1800000)]],
    ["2026-04-30", "支払利息", [D("531", 12000), C("102", 12000)]],
  ];

  let n = 0;
  for (const [date, description, lines] of entries) {
    const seq = await redis.incr(acctKey.journalSeq(tenant));
    const id = `jr${seq}`;
    const total = lines.filter((l) => l.side === "debit").reduce((s, l) => s + l.amount, 0);
    const journal = { id, code: `JR${pad4(seq)}`, date, description, lines, total, source: "manual", createdBy: "デモ管理者", createdAt: Date.now() + n };
    await redis.set(acctKey.journal(tenant, id), journal);
    await redis.sadd(acctKey.journals(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
