// api/payroll/gensen/index.js ── 源泉徴収簿
//  GET ?year=YYYY → 社員別の月次源泉税・賞与源泉・年間合計、会社の納付額(月次)集計
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  const year = req.query.year || String(new Date().getFullYear());
  const roster = await hrRoster(tenant);
  const nameMap = {};
  for (const e of roster) nameMap[e.id] = { name: e.name, code: e.code, department: e.department };

  const runs = (await redis.smembers(payKey.payRuns(tenant))).filter((ym) => ym.startsWith(`${year}-`)).sort();

  // 社員別：月ごとの源泉税
  const per = {}; // empId -> { months:{ym:tax}, salaryTax, bonusTax }
  const monthlyTotal = {}; // ym -> 会社の源泉税合計（納付額）

  for (const ym of runs) {
    const ids = await redis.smembers(payKey.payMembers(tenant, ym));
    const slips = ids.length ? await mgetByIds(ids, (id) => payKey.payslip(tenant, ym, id)) : [];
    for (const s of slips) {
      per[s.empId] = per[s.empId] || { empId: s.empId, months: {}, salaryTax: 0, bonusTax: 0 };
      per[s.empId].months[ym] = (per[s.empId].months[ym] || 0) + s.calc.incomeTax;
      per[s.empId].salaryTax += s.calc.incomeTax;
      monthlyTotal[ym] = (monthlyTotal[ym] || 0) + s.calc.incomeTax;
    }
  }

  // 賞与の源泉
  const bonusIds = await redis.smembers(payKey.bonusRuns(tenant));
  const bonusRuns = bonusIds.length ? await mgetByIds(bonusIds, (id) => payKey.bonusRun(tenant, id)) : [];
  for (const b of bonusRuns) {
    const bym = b.ym || "";
    if (!(bym.startsWith(`${year}-`) || (!bym && new Date(b.createdAt).getFullYear() === Number(year)))) continue;
    const ids = await redis.smembers(payKey.bonusMembers(tenant, b.bid));
    const rows = ids.length ? await mgetByIds(ids, (id) => payKey.bonus(tenant, b.bid, id)) : [];
    for (const r of rows) {
      per[r.empId] = per[r.empId] || { empId: r.empId, months: {}, salaryTax: 0, bonusTax: 0 };
      per[r.empId].bonusTax += r.calc.incomeTax;
      if (bym) monthlyTotal[bym] = (monthlyTotal[bym] || 0) + r.calc.incomeTax;
    }
  }

  const rows = Object.values(per).map((p) => ({
    ...p,
    ...(nameMap[p.empId] || { name: p.empId, code: "", department: "" }),
    total: p.salaryTax + p.bonusTax,
  })).sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return res.status(200).json({
    ok: true,
    data: { year, months: runs, rows, monthlyTotal, grandTotal, count: rows.length },
  });
}
