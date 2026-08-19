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
