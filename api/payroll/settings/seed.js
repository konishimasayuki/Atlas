// api/payroll/settings/seed.js ── 人事台帳の社員から給与設定を自動生成（デモ）
import { redis } from "../../_lib/redis.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";

const BASE_BY_POS = { "部長": 450000, "課長": 380000, "係長": 330000, "主任": 300000, "リーダー": 290000, "一般": 250000 };
const POSA_BY_POS = { "部長": 80000, "課長": 50000, "係長": 30000, "主任": 20000, "リーダー": 15000, "一般": 0 };

function ageFrom(birth) {
  if (!birth) return 30;
  const b = new Date(birth); if (isNaN(b)) return 30;
  return Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(payKey.settings(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const roster = await hrRoster(tenant);
  if (roster.length === 0) return res.status(409).json({ ok: false, error: "no_employees" });

  await redis.set(payKey.rates(tenant), null); // 既定料率を使用
  const now = Date.now();
  let n = 0;
  for (const e of roster) {
    const base = BASE_BY_POS[e.position] || 250000;
    const posA = POSA_BY_POS[e.position] || 0;
    const age = ageFrom(e.birthDate);
    const isPart = e.employmentType === "パート";
    const setting = {
      empId: e.id, empName: e.name,
      base: isPart ? 165000 : base,
      positionAllowance: isPart ? 0 : posA,
      commuteAllowance: 8000 + (n % 5) * 3000,
      otherAllowance: (n % 3 === 0) ? 15000 : 0,
      dependents: age >= 35 ? (n % 3) : 0,
      taxTable: "甲",
      over40: age >= 40,
      residentTax: isPart ? 0 : Math.round(base * 0.045 / 100) * 100,
      healthPension: !isPart,        // パートは社保未加入と仮定
      employmentIns: true,
      updatedAt: now,
    };
    await redis.set(payKey.setting(tenant, e.id), setting);
    await redis.sadd(payKey.settings(tenant), e.id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
