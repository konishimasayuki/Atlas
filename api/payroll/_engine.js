// api/payroll/_engine.js ── 給与・賞与の計算エンジン（概算）
// ※ 社会保険料率・源泉所得税は簡易な概算です。実務では協会けんぽの都道府県別料率・
//    源泉徴収税額表（月額表）に基づく正確な計算が必要です。UI上でも「概算」と明示します。

export const DEFAULT_RATES = {
  health: 4.99,       // 健康保険（労働者負担・折半後の概算）%
  nursing: 0.80,      // 介護保険（40歳以上・折半後）%
  pension: 9.15,      // 厚生年金（労働者負担・折半後）%
  employment: 0.60,   // 雇用保険（労働者負担・一般の事業）%
};

const yen = (n) => Math.round(n);
const floor10 = (n) => Math.floor(n / 10) * 10;

// 甲欄：源泉所得税(月額)の概算。社会保険料控除後の課税支給額と扶養人数から。
export function withholdingKou(afterSocialTaxable, dependents) {
  const basePlusEmployment = 88000;          // 給与所得控除+基礎控除相当の月額下限(概算)
  const perDependent = 31667;                // 扶養1人あたり(38万/12)概算
  let t = afterSocialTaxable - basePlusEmployment - dependents * perDependent;
  if (t <= 0) return 0;
  let tax;
  if (t <= 50000) tax = t * 0.05;
  else if (t <= 150000) tax = 2500 + (t - 50000) * 0.08;
  else if (t <= 300000) tax = 10500 + (t - 150000) * 0.12;
  else tax = 28500 + (t - 300000) * 0.20;
  return floor10(tax);
}
// 乙欄：概算（扶養控除なし・やや高め）
export function withholdingOtsu(afterSocialTaxable) {
  if (afterSocialTaxable <= 0) return 0;
  return floor10(afterSocialTaxable * 0.06 + 3000);
}

// 月次給与計算
export function calcSalary(setting, rates = DEFAULT_RATES) {
  const base = Number(setting.base) || 0;
  const posA = Number(setting.positionAllowance) || 0;
  const otherA = Number(setting.otherAllowance) || 0;
  const commute = Number(setting.commuteAllowance) || 0; // 通勤手当（非課税と仮定）
  const gross = base + posA + otherA + commute;

  const shakaiBase = base + posA + otherA; // 社保・課税の算定基礎（通勤を除く簡易）
  const joinSP = setting.healthPension !== false;
  const health = joinSP ? yen(shakaiBase * rates.health / 100) : 0;
  const nursing = joinSP && setting.over40 ? yen(shakaiBase * rates.nursing / 100) : 0;
  const pension = joinSP ? yen(shakaiBase * rates.pension / 100) : 0;
  const employment = setting.employmentIns !== false ? yen(gross * rates.employment / 100) : 0;
  const socialTotal = health + nursing + pension + employment;

  const taxable = Math.max(0, shakaiBase - socialTotal); // 課税支給額(通勤除く - 社保)
  const incomeTax = setting.taxTable === "乙"
    ? withholdingOtsu(taxable)
    : withholdingKou(taxable, Number(setting.dependents) || 0);
  const residentTax = Number(setting.residentTax) || 0;

  const deductionTotal = socialTotal + incomeTax + residentTax;
  const net = gross - deductionTotal;

  return {
    gross, base, posA, otherA, commute,
    health, nursing, pension, employment, socialTotal,
    taxable, incomeTax, residentTax, deductionTotal, net,
  };
}

// 賞与計算（概算）
export function calcBonus(amount, setting, rates = DEFAULT_RATES) {
  const gross = Number(amount) || 0;
  const joinSP = setting.healthPension !== false;
  const health = joinSP ? yen(gross * rates.health / 100) : 0;
  const nursing = joinSP && setting.over40 ? yen(gross * rates.nursing / 100) : 0;
  const pension = joinSP ? yen(gross * rates.pension / 100) : 0;
  const employment = setting.employmentIns !== false ? yen(gross * rates.employment / 100) : 0;
  const socialTotal = health + nursing + pension + employment;

  const afterSocial = Math.max(0, gross - socialTotal);
  // 賞与の源泉税率（前月給与ベースの算出率の代わりに基本給から概算）
  const base = Number(setting.base) || 0;
  let rate;
  if (setting.taxTable === "乙") rate = 0.1021;
  else if (base <= 220000) rate = 0.02042;
  else if (base <= 370000) rate = 0.04084;
  else if (base <= 580000) rate = 0.06126;
  else rate = 0.08168;
  const dep = Number(setting.dependents) || 0;
  const incomeTax = Math.floor(afterSocial * Math.max(0, rate - dep * 0.002));

  const deductionTotal = socialTotal + incomeTax;
  const net = gross - deductionTotal;
  return { gross, health, nursing, pension, employment, socialTotal, incomeTax, deductionTotal, net };
}


// ========== 年末調整（概算） ==========
// 給与所得控除（令和以降の速算・概算）
export function salaryIncomeDeduction(income) {
  if (income <= 1625000) return 550000;
  if (income <= 1800000) return Math.floor(income * 0.4) - 100000;
  if (income <= 3600000) return Math.floor(income * 0.3) + 80000;
  if (income <= 6600000) return Math.floor(income * 0.2) + 440000;
  if (income <= 8500000) return Math.floor(income * 0.1) + 1100000;
  return 1950000;
}

// 基礎控除（合計所得に応じ逓減・概算。給与のみ想定）
export function basicDeduction(totalIncome) {
  if (totalIncome <= 24000000) return 480000;
  if (totalIncome <= 24500000) return 320000;
  if (totalIncome <= 25000000) return 160000;
  return 0;
}

// 所得税の速算（課税所得→年税額。復興特別所得税2.1%込み）
export function incomeTaxAnnual(taxable) {
  const t = Math.max(0, Math.floor(taxable / 1000) * 1000);
  let base;
  if (t <= 1950000) base = t * 0.05;
  else if (t <= 3300000) base = t * 0.10 - 97500;
  else if (t <= 6950000) base = t * 0.20 - 427500;
  else if (t <= 9000000) base = t * 0.23 - 636000;
  else if (t <= 18000000) base = t * 0.33 - 1536000;
  else if (t <= 40000000) base = t * 0.40 - 2796000;
  else base = t * 0.45 - 4796000;
  return Math.floor(Math.max(0, base) * 1.021); // 復興特別所得税込み
}

// 年末調整の計算
// params: { grossYear(年間総支給), socialYear(年間社会保険料), withheldYear(源泉徴収済), dependents,
//           insuranceDeduction(生命保険料控除など任意), spouseDeduction(配偶者控除 任意) }
export function calcYearEnd(p) {
  const gross = Number(p.grossYear) || 0;
  const social = Number(p.socialYear) || 0;
  const withheld = Number(p.withheldYear) || 0;
  const dependents = Number(p.dependents) || 0;
  const insDed = Number(p.insuranceDeduction) || 0;
  const spouseDed = Number(p.spouseDeduction) || 0;

  const salaryDed = salaryIncomeDeduction(gross);
  const employmentIncome = Math.max(0, gross - salaryDed); // 給与所得
  const basic = basicDeduction(employmentIncome);
  const dependentDed = dependents * 380000; // 扶養控除（一般38万・概算）

  const totalDeduction = basic + social + dependentDed + spouseDed + insDed;
  const taxable = Math.max(0, employmentIncome - totalDeduction);
  const annualTax = incomeTaxAnnual(taxable);

  const diff = withheld - annualTax; // 正:還付 / 負:追徴
  return {
    gross, salaryDed, employmentIncome, basic, social,
    dependentDed, spouseDed, insDed, totalDeduction,
    taxable, annualTax, withheld,
    refund: diff >= 0 ? diff : 0,
    collect: diff < 0 ? -diff : 0,
    diff,
  };
}
