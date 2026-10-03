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

// ============ 税制パラメータ（年分で切替） ============
// 令和7年度税制改正（令和7年分＝2025年分以降の年末調整に適用）
//  ・給与所得控除の最低額 55万→65万
//  ・基礎控除 48万→58万（＋合計所得655万以下は令和7・8年分の上乗せあり）
//  ・配偶者控除/配偶者特別控除の配偶者の所得要件 48万→58万
// ※ 令和8年度税制改正で令和8年分の数値が変わった場合は、ここを更新すること。
const isR7 = (year) => Number(year) >= 2025;

// 給与所得控除
export function employmentIncomeDeduction(income, year) {
  const r4 = (x) => Math.floor(x / 4000) * 4000; // 660万円未満は4,000円単位（所得税法別表第五の簡易計算）
  if (isR7(year)) {
    if (income <= 1900000) return Math.min(income, 650000);
    if (income <= 3600000) return r4(income) * 0.3 + 80000;
    if (income <= 6600000) return r4(income) * 0.2 + 440000;
    if (income <= 8500000) return income * 0.1 + 1100000;
    return 1950000;
  }
  if (income <= 550999) return income;
  if (income <= 1618999) return 550000;
  if (income <= 1799999) return r4(income) * 0.4 - 100000;
  if (income <= 3599999) return r4(income) * 0.3 + 80000;
  if (income <= 6599999) return r4(income) * 0.2 + 440000;
  if (income <= 8499999) return income * 0.1 + 1100000;
  return 1950000;
}

// 基礎控除（合計所得金額により変動）
export function basicDeduction(totalIncome, year) {
  if (isR7(year)) {
    const y = Number(year);
    if (y <= 2026) { // 令和7・8年分の上乗せ
      if (totalIncome <= 1320000) return 950000;
      if (totalIncome <= 3360000) return 880000;
      if (totalIncome <= 4890000) return 680000;
      if (totalIncome <= 6550000) return 630000;
    } else if (totalIncome <= 1320000) return 950000;
    if (totalIncome <= 23500000) return 580000;
  } else if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

// 生命保険料控除（新制度・所得税）：区分ごとに計算し合計12万円まで
export function lifeInsuranceItem(premium) {
  const p = Math.max(0, Number(premium) || 0);
  if (p <= 20000) return p;
  if (p <= 40000) return Math.ceil(p / 2 + 10000);
  if (p <= 80000) return Math.ceil(p / 4 + 20000);
  return 40000;
}
export function lifeInsuranceDeduction(general, medical, pension) {
  return Math.min(120000, lifeInsuranceItem(general) + lifeInsuranceItem(medical) + lifeInsuranceItem(pension));
}

// 地震保険料控除（所得税）：支払額全額・上限5万円
export function earthquakeDeduction(premium) {
  return Math.min(50000, Math.max(0, Number(premium) || 0));
}

// 配偶者控除・配偶者特別控除
//  本人の合計所得 1,000万円超は対象外。配偶者の合計所得で控除額が決まる。
export function spouseDeduction(selfIncome, spouseIncome, elderly, year) {
  const tier = selfIncome <= 9000000 ? 0 : selfIncome <= 9500000 ? 1 : selfIncome <= 10000000 ? 2 : -1;
  if (tier < 0) return { amount: 0, kind: "対象外（本人の所得1,000万円超）" };
  const s = Math.max(0, Number(spouseIncome) || 0);
  const limit = isR7(year) ? 580000 : 480000;
  if (s <= limit) {
    const base = elderly ? [480000, 320000, 160000] : [380000, 260000, 130000];
    return { amount: base[tier], kind: elderly ? "配偶者控除（老人）" : "配偶者控除" };
  }
  const table = [
    [950000, [380000, 260000, 130000]],
    [1000000, [360000, 240000, 120000]],
    [1050000, [310000, 210000, 110000]],
    [1100000, [260000, 180000, 90000]],
    [1150000, [210000, 140000, 70000]],
    [1200000, [160000, 110000, 60000]],
    [1250000, [110000, 80000, 40000]],
    [1300000, [60000, 40000, 20000]],
    [1330000, [30000, 20000, 10000]],
  ];
  for (const [max, vals] of table) if (s <= max) return { amount: vals[tier], kind: "配偶者特別控除" };
  return { amount: 0, kind: "対象外（配偶者の所得133万円超）" };
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

// 年末調整：社員1名分
//  input（年調の申告内容）: { lifeGeneral, lifeMedical, lifePension, earthquake,
//                            hasSpouse, spouseIncome, spouseElderly, housingLoanCredit }
export function calcYearEnd(agg, setting, input = {}, year = new Date().getFullYear()) {
  const salaryIncome = agg.gross + agg.bonusGross;            // 年間給与総額（総支給）
  const socialPaid = agg.social + agg.bonusSocial;           // 支払った社会保険料
  const taxWithheld = agg.incomeTax + agg.bonusTax;          // 源泉徴収済み

  const empDeduction = Math.floor(employmentIncomeDeduction(salaryIncome, year));
  const incomeAfterEmp = Math.max(0, salaryIncome - empDeduction); // 給与所得＝合計所得
  const basic = basicDeduction(incomeAfterEmp, year);
  const dependents = Number(setting?.dependents) || 0;
  const dependentDeduction = dependents * 380000;            // 扶養控除（一般）38万/人

  const lifeInsurance = lifeInsuranceDeduction(input.lifeGeneral, input.lifeMedical, input.lifePension);
  const earthquake = earthquakeDeduction(input.earthquake);
  const sp = input.hasSpouse
    ? spouseDeduction(incomeAfterEmp, input.spouseIncome, !!input.spouseElderly, year)
    : { amount: 0, kind: "なし" };

  const totalDeductions = socialPaid + basic + dependentDeduction + lifeInsurance + earthquake + sp.amount;
  const taxableIncome = Math.max(0, Math.floor((incomeAfterEmp - totalDeductions) / 1000) * 1000);
  const computedTax = incomeTaxByBracket(taxableIncome);      // 算出所得税額
  const housingLoan = Math.min(computedTax, Math.max(0, Number(input.housingLoanCredit) || 0)); // 住宅ローン控除（税額控除）
  const taxAfterCredit = computedTax - housingLoan;
  const yearTax = Math.floor((taxAfterCredit * 1.021) / 100) * 100; // 復興特別所得税込み・100円未満切捨て

  const diff = taxWithheld - yearTax;                        // + なら還付、- なら追徴
  return {
    salaryIncome, socialPaid, taxWithheld,
    empDeduction, incomeAfterEmp, basic, dependentDeduction,
    lifeInsurance, earthquake, spouse: sp.amount, spouseKind: sp.kind,
    taxableIncome, computedTax, housingLoan, yearTax,
    settlement: diff, // 正=還付 / 負=不足徴収
  };
}
