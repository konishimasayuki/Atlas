// api/payroll/salary/index.js
//  GET             → 実施済みの年月一覧
//  GET ?ym=YYYY-MM → その月の給与明細一覧（＋会社合計）
//  POST {ym}       → その月の給与を計算して保存（設定済みの社員が対象）
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";
import { calcSalary, DEFAULT_RATES } from "../_engine.js";

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ym = req.query.ym;
    if (!ym) {
      const runs = await redis.smembers(payKey.payRuns(tenant));
      runs.sort().reverse();
      return res.status(200).json({ ok: true, data: runs });
    }
    const ids = await redis.smembers(payKey.payMembers(tenant, ym));
    const slips = ids.length ? await mgetByIds(ids, (id) => payKey.payslip(tenant, ym, id)) : [];
    slips.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    const totals = slips.reduce((t, s) => ({
      gross: t.gross + s.calc.gross, social: t.social + s.calc.socialTotal,
      tax: t.tax + s.calc.incomeTax, resident: t.resident + s.calc.residentTax,
      net: t.net + s.calc.net,
    }), { gross: 0, social: 0, tax: 0, resident: 0, net: 0 });
    return res.status(200).json({ ok: true, data: { ym, slips, totals, count: slips.length } });
  }

  if (req.method === "POST") {
    const { ym } = req.body || {};
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return res.status(400).json({ ok: false, error: "bad_ym" });

    const rates = (await redis.get(payKey.rates(tenant))) || DEFAULT_RATES;
    const roster = await hrRoster(tenant);
    const setIds = await redis.smembers(payKey.settings(tenant));
    const settingList = setIds.length ? await mgetByIds(setIds, (id) => payKey.setting(tenant, id)) : [];
    const sMap = {};
    for (const s of settingList) sMap[s.empId] = s;

    let n = 0;
    for (const e of roster) {
      const setting = sMap[e.id];
      if (!setting) continue; // 設定のない社員はスキップ
      const calc = calcSalary(setting, rates);
      const slip = {
        ym, empId: e.id, code: e.code, name: e.name,
        department: e.department, position: e.position,
        calc, ratesUsed: rates, createdAt: Date.now(),
      };
      await redis.set(payKey.payslip(tenant, ym, e.id), slip);
      await redis.sadd(payKey.payMembers(tenant, ym), e.id);
      n++;
    }
    await redis.sadd(payKey.payRuns(tenant), ym);
    return res.status(200).json({ ok: true, data: { ym, count: n } });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
