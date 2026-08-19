// api/payroll/_guard.js ── 労務(payroll)モジュール共通：アクセス制御・キー・人事台帳参照
import { getCurrentUser, mgetByIds } from "../_lib/core.js";
import { redis } from "../_lib/redis.js";

export async function requirePayroll(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company" || !me.effectiveModules.includes("payroll")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { me, tenant: me.company };
}

export const payKey = {
  // 各人の給与設定（労務が保持）
  setting: (t, empId) => `atlas:${t}:payroll:setting:${empId}`,
  settings: (t) => `atlas:${t}:payroll:settings`,
  // 会社の料率設定
  rates: (t) => `atlas:${t}:payroll:rates`,
  // 月次給与明細
  payslip: (t, ym, empId) => `atlas:${t}:payroll:pay:${ym}:${empId}`,
  payMembers: (t, ym) => `atlas:${t}:payroll:pay:${ym}:members`,
  payRuns: (t) => `atlas:${t}:payroll:runs`, // 実施済みの年月SET
  // 賞与
  bonus: (t, bid, empId) => `atlas:${t}:payroll:bonus:${bid}:${empId}`,
  bonusMembers: (t, bid) => `atlas:${t}:payroll:bonus:${bid}:members`,
  bonusRun: (t, bid) => `atlas:${t}:payroll:bonusrun:${bid}`,
  bonusRuns: (t) => `atlas:${t}:payroll:bonusruns`,
};

// 人事台帳（人のマスタ）を参照して社員名簿を取得（read-only）
export async function hrRoster(tenant) {
  const ids = await redis.smembers(`atlas:${tenant}:hr:employees`);
  const list = await mgetByIds(ids, (id) => `atlas:${tenant}:hr:employee:${id}`);
  list.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  return list;
}
