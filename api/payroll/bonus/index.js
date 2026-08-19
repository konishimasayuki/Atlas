// api/payroll/bonus/index.js
//  GET              → 賞与実施回の一覧
//  GET ?bid=xxx     → その回の賞与明細（＋合計）
//  POST {label, ym, amounts:{empId:額}} → 賞与を計算して保存
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";
import { calcBonus, DEFAULT_RATES } from "../_engine.js";

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const bid = req.query.bid;
    if (!bid) {
      const ids = await redis.smembers(payKey.bonusRuns(tenant));
      const runs = ids.length ? await mgetByIds(ids, (id) => payKey.bonusRun(tenant, id)) : [];
      runs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return res.status(200).json({ ok: true, data: runs });
    }
    const ids = await redis.smembers(payKey.bonusMembers(tenant, bid));
    const rows = ids.length ? await mgetByIds(ids, (id) => payKey.bonus(tenant, bid, id)) : [];
    rows.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    const totals = rows.reduce((t, r) => ({
      gross: t.gross + r.calc.gross, social: t.social + r.calc.socialTotal,
      tax: t.tax + r.calc.incomeTax, net: t.net + r.calc.net,
    }), { gross: 0, social: 0, tax: 0, net: 0 });
    const run = await redis.get(payKey.bonusRun(tenant, bid));
    return res.status(200).json({ ok: true, data: { run, rows, totals, count: rows.length } });
  }

  if (req.method === "POST") {
    const { label, ym, amounts } = req.body || {};
    if (!label || !amounts || typeof amounts !== "object") return res.status(400).json({ ok: false, error: "missing" });

    const rates = (await redis.get(payKey.rates(tenant))) || DEFAULT_RATES;
    const roster = await hrRoster(tenant);
    const setIds = await redis.smembers(payKey.settings(tenant));
    const settingList = setIds.length ? await mgetByIds(setIds, (id) => payKey.setting(tenant, id)) : [];
    const sMap = {};
    for (const s of settingList) sMap[s.empId] = s;

    const bid = `b${Date.now().toString(36)}`;
    let n = 0;
    for (const e of roster) {
      const amt = Number(amounts[e.id]) || 0;
      if (amt <= 0) continue;
      const setting = sMap[e.id] || { base: amt };
      const calc = calcBonus(amt, setting, rates);
      const row = { bid, empId: e.id, code: e.code, name: e.name, department: e.department, calc, createdAt: Date.now() };
      await redis.set(payKey.bonus(tenant, bid, e.id), row);
      await redis.sadd(payKey.bonusMembers(tenant, bid), e.id);
      n++;
    }
    const run = { bid, label, ym: ym || "", count: n, createdAt: Date.now() };
    await redis.set(payKey.bonusRun(tenant, bid), run);
    await redis.sadd(payKey.bonusRuns(tenant), bid);
    return res.status(200).json({ ok: true, data: { bid, count: n } });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
