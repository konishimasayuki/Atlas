// api/payroll/salary/seedyear.js ── デモ用：指定年の給与12ヶ月＋賞与2回を一括生成
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";
import { calcSalary, calcBonus, DEFAULT_RATES } from "../_engine.js";

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const year = (req.body && req.body.year) || String(new Date().getFullYear());

  // 既に当年の給与があればスキップ
  const runs = (await redis.smembers(payKey.payRuns(tenant))).filter((ym) => ym.startsWith(`${year}-`));
  if (runs.length > 0) return res.status(409).json({ ok: false, error: "already_seeded" });

  const roster = await hrRoster(tenant);
  const setIds = await redis.smembers(payKey.settings(tenant));
  if (setIds.length === 0) return res.status(409).json({ ok: false, error: "no_settings" });
  const settingList = await mgetByIds(setIds, (id) => payKey.setting(tenant, id));
  const sMap = {};
  for (const s of settingList) sMap[s.empId] = s;
  const rates = (await redis.get(payKey.rates(tenant))) || DEFAULT_RATES;

  // 給与12ヶ月
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    for (const e of roster) {
      const setting = sMap[e.id];
      if (!setting) continue;
      const calc = calcSalary(setting, rates);
      const slip = { ym, empId: e.id, code: e.code, name: e.name, department: e.department, position: e.position, calc, ratesUsed: rates, createdAt: Date.now() };
      await redis.set(payKey.payslip(tenant, ym, e.id), slip);
      await redis.sadd(payKey.payMembers(tenant, ym), e.id);
    }
    await redis.sadd(payKey.payRuns(tenant), ym);
  }

  // 賞与2回（夏6月・冬12月／基本給2ヶ月分）
  for (const [label, bm] of [["夏季賞与", "06"], ["冬季賞与", "12"]]) {
    const bid = `b${year}${bm}`;
    let n = 0;
    for (const e of roster) {
      const setting = sMap[e.id];
      if (!setting || !setting.base) continue;
      const amt = Math.round(setting.base * 2);
      const calc = calcBonus(amt, setting, rates);
      const row = { bid, empId: e.id, code: e.code, name: e.name, department: e.department, calc, createdAt: Date.now() };
      await redis.set(payKey.bonus(tenant, bid, e.id), row);
      await redis.sadd(payKey.bonusMembers(tenant, bid), e.id);
      n++;
    }
    await redis.set(payKey.bonusRun(tenant, bid), { bid, label, ym: `${year}-${bm}`, count: n, createdAt: Date.now() });
    await redis.sadd(payKey.bonusRuns(tenant), bid);
  }

  return res.status(200).json({ ok: true, data: { year, months: 12, bonuses: 2 } });
}
