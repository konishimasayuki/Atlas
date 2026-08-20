// api/payroll/_annual.js ── 年間の給与・賞与を集計し、年末調整(概算)を計算する共通処理
import { redis } from "../_lib/redis.js";
import { mgetByIds } from "../_lib/core.js";
import { payKey, hrRoster } from "./_guard.js";

// 指定年(YYYY)の全給与明細・賞与を社員ごとに集計
export async function collectYear(tenant, year) {
  // 対象年月（その年に実施された給与）
  const runs = (await redis.smembers(payKey.payRuns(tenant))).filter((ym) => ym.startsWith(`${year}-`));
  const bonusIds = await redis.smembers(payKey.bonusRuns(tenant));
  const bonusRuns = bonusIds.length ? await mgetByIds(bonusIds, (id) => payKey.bonusRun(tenant, id)) : [];
  const yearBonus = bonusRuns.filter((b) => (b.ym || "").startsWith(`${year}-`) || (!b.ym && new Date(b.createdAt).getFullYear() === Number(year)));

  // 社員ごとに積算
  const per = {}; // empId -> {gross, social, incomeTax, months, bonusGross, bonusSocial, bonusTax}
  const ensure = (id) => (per[id] = per[id] || { empId: id, gross: 0, social: 0, incomeTax: 0, months: 0, bonusGross: 0, bonusSocial: 0, bonusTax: 0 });

  for (const ym of runs) {
    const ids = await redis.smembers(payKey.payMembers(tenant, ym));
    const slips = ids.length ? await mgetByIds(ids, (id) => payKey.payslip(tenant, ym, id)) : [];
    for (const s of slips) {
      const p = ensure(s.empId);
      p.gross += s.calc.gross;
      p.social += s.calc.socialTotal;
      p.incomeTax += s.calc.incomeTax;
      p.months += 1;
    }
  }
  for (const b of yearBonus) {
    const ids = await redis.smembers(payKey.bonusMembers(tenant, b.bid));
    const rows = ids.length ? await mgetByIds(ids, (id) => payKey.bonus(tenant, b.bid, id)) : [];
    for (const r of rows) {
      const p = ensure(r.empId);
      p.bonusGross += r.calc.gross;
      p.bonusSocial += r.calc.socialTotal;
      p.bonusTax += r.calc.incomeTax;
    }
  }
  return { per, months: runs.length, bonusCount: yearBonus.length };
}

// 給与所得控除（令和2年分以降）
export function employmentIncomeDeduction(income) {
  if (income <= 550999) return income;              // 給与所得0
  if (income <= 1618999) return 550000;
  if (income <= 1799999) return Math.floor(income / 4000) * 4000 * 0.4 - 100000;
  if (income <= 3599999) return Math.floor(income / 4000) * 4000 * 0.3 + 80000;
  if (income <= 6599999) return Math.floor(income / 4000) * 4000 * 0.2 + 440000;
  if (income <= 8499999) return income * 0.1 + 1100000;
  return 1950000; // 上限
}

// 基礎控除（合計所得2400万以下は48万）
export function basicDeduction(totalIncome) {
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

// 所得税の速算表（課税所得→税額）
export function incomeTaxByBracket(taxable) {
  const t = Math.floor(taxable / 1000) * 1000;
  let tax;
  if (t <= 1949000) tax = t * 0.05;
  else if (t <= 3299000) tax = t * 0.10 - 97500;
  else if (t <= 6949000) tax = t * 0.20 - 427500;
  else if (t <= 8999000) tax = t * 0.23 - 636000;
  else if (t <= 17999000) tax = t * 0.33 - 1536000;
  else if (t <= 39999000) tax = t * 0.40 - 2796000;
  else tax = t * 0.45 - 4796000;
  return Math.max(0, Math.floor(tax));
}

// 年末調整（概算）：社員1名分
// setting から扶養人数、集計から給与総額・社保・源泉徴収済を使う
export function calcYearEnd(agg, setting) {
  const salaryIncome = agg.gross + agg.bonusGross;            // 年間給与総額（総支給）
  const socialPaid = agg.social + agg.bonusSocial;           // 支払った社会保険料
  const taxWithheld = agg.incomeTax + agg.bonusTax;          // 源泉徴収済み

  const empDeduction = employmentIncomeDeduction(salaryIncome);
  const incomeAfterEmp = Math.max(0, salaryIncome - empDeduction); // 給与所得
  const basic = basicDeduction(incomeAfterEmp);
  const dependents = Number(setting?.dependents) || 0;
  const dependentDeduction = dependents * 380000;            // 扶養控除(一般)概算 38万/人

  const taxableIncome = Math.max(0, incomeAfterEmp - socialPaid - basic - dependentDeduction);
  const yearTaxBase = incomeTaxByBracket(taxableIncome);
  const yearTax = Math.floor(yearTaxBase * 1.021);           // 復興特別所得税2.1%込み

  const diff = taxWithheld - yearTax;                        // + なら還付、- なら追徴
  return {
    salaryIncome, socialPaid, taxWithheld,
    empDeduction, incomeAfterEmp, basic, dependentDeduction,
    taxableIncome, yearTax,
    settlement: diff, // 正=還付 / 負=不足徴収
  };
}
