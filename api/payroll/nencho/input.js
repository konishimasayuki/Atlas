// api/payroll/nencho/input.js ── 年末調整の申告内容（保険料控除・配偶者・住宅ローン控除）
//  GET ?year=YYYY&empId=xxx → 入力内容
//  PUT { year, empId, ...入力 } → 保存
import { redis } from "../../_lib/redis.js";
import { requirePayroll } from "../_guard.js";

export const nenchoInputKey = (t, year, empId) => `atlas:${t}:payroll:nenchoInput:${year}:${empId}`;
const NUM = ["lifeGeneral", "lifeMedical", "lifePension", "earthquake", "spouseIncome", "housingLoanCredit"];
const BOOL = ["hasSpouse", "spouseElderly"];

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const { year, empId } = req.query;
    if (!year || !empId) return res.status(400).json({ ok: false, error: "missing" });
    return res.status(200).json({ ok: true, data: (await redis.get(nenchoInputKey(tenant, year, empId))) || {} });
  }
  if (req.method === "PUT") {
    const b = req.body || {};
    if (!b.year || !b.empId) return res.status(400).json({ ok: false, error: "missing" });
    const out = { updatedAt: Date.now() };
    for (const f of NUM) out[f] = Math.max(0, Math.floor(Number(b[f]) || 0));
    for (const f of BOOL) out[f] = !!b[f];
    await redis.set(nenchoInputKey(tenant, b.year, b.empId), out);
    return res.status(200).json({ ok: true, data: out });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
