// api/payroll/nencho/index.js ── 年末調整（申告内容＝保険料・配偶者・住宅ローン控除を反映）
//  GET ?year=YYYY           → 全社員の年調結果一覧（還付/追徴サマリ）
//  GET ?year=YYYY&empId=xxx → 個人の年調内訳
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";
import { collectYear, calcYearEnd } from "../_annual.js";
import { nenchoInputKey } from "./input.js";

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  const year = req.query.year || String(new Date().getFullYear());
  const roster = await hrRoster(tenant);
  const { per } = await collectYear(tenant, year);

  const setIds = await redis.smembers(payKey.settings(tenant));
  const settingList = setIds.length ? await mgetByIds(setIds, (id) => payKey.setting(tenant, id)) : [];
  const sMap = {};
  for (const s of settingList) sMap[s.empId] = s;

  const empId = req.query.empId;
  if (empId) {
    const agg = per[empId];
    if (!agg) return res.status(404).json({ ok: false, error: "no_data" });
    const emp = roster.find((e) => e.id === empId) || {};
    const input = (await redis.get(nenchoInputKey(tenant, year, empId))) || {};
    const ye = calcYearEnd(agg, sMap[empId], input, year);
    return res.status(200).json({ ok: true, data: { year, emp: { name: emp.name, code: emp.code, department: emp.department }, agg, input, result: ye } });
  }

  const targets = roster.filter((e) => per[e.id] && per[e.id].months > 0);
  const inputs = targets.length ? await redis.mget(...targets.map((e) => nenchoInputKey(tenant, year, e.id))) : [];
  const iMap = {};
  targets.forEach((e, i) => { iMap[e.id] = inputs[i] || {}; });

  const rows = [];
  for (const emp of roster) {
    const agg = per[emp.id];
    if (!agg || agg.months === 0) continue; // 給与実績がない人は対象外
    const ye = calcYearEnd(agg, sMap[emp.id], iMap[emp.id], year);
    rows.push({
      empId: emp.id, code: emp.code, name: emp.name, department: emp.department,
      salaryIncome: ye.salaryIncome, taxWithheld: ye.taxWithheld, yearTax: ye.yearTax, settlement: ye.settlement,
      hasInput: !!iMap[emp.id]?.updatedAt,
    });
  }
  rows.sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  const totalRefund = rows.filter((r) => r.settlement > 0).reduce((s, r) => s + r.settlement, 0);
  const totalCollect = rows.filter((r) => r.settlement < 0).reduce((s, r) => s - r.settlement, 0);

  return res.status(200).json({ ok: true, data: { year, rows, count: rows.length, totalRefund, totalCollect } });
}
