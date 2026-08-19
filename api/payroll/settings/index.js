// api/payroll/settings/index.js ── 給与設定：一覧(GET, 人事台帳と結合) / 登録更新(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requirePayroll, payKey, hrRoster } from "../_guard.js";

const FIELDS = ["base","positionAllowance","commuteAllowance","otherAllowance","dependents","taxTable","over40","residentTax","healthPension","employmentIns"];
const NUM = ["base","positionAllowance","commuteAllowance","otherAllowance","dependents","residentTax"];
const BOOL = ["over40","healthPension","employmentIns"];

export default async function handler(req, res) {
  const ctx = await requirePayroll(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const roster = await hrRoster(tenant); // 人のマスタ=人事台帳
    const ids = roster.map((e) => e.id);
    const settings = ids.length ? await mgetByIds(ids, (id) => payKey.setting(tenant, id)) : [];
    const map = {};
    for (const s of settings) map[s.empId] = s;
    const rows = roster.map((e) => ({
      empId: e.id, code: e.code, name: e.name, department: e.department,
      position: e.position, employmentType: e.employmentType,
      setting: map[e.id] || null,
    }));
    return res.status(200).json({ ok: true, data: rows });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.empId) return res.status(400).json({ ok: false, error: "missing_empId" });
    const emp = await redis.get(`atlas:${tenant}:hr:employee:${body.empId}`);
    if (!emp) return res.status(404).json({ ok: false, error: "employee_not_found" });

    const prev = (await redis.get(payKey.setting(tenant, body.empId))) || {};
    const s = { empId: body.empId, empName: emp.name, ...prev };
    for (const f of FIELDS) {
      if (body[f] === undefined) continue;
      if (NUM.includes(f)) s[f] = Number(body[f]) || 0;
      else if (BOOL.includes(f)) s[f] = !!body[f];
      else s[f] = body[f];
    }
    if (!s.taxTable) s.taxTable = "甲";
    s.updatedAt = Date.now();
    await redis.set(payKey.setting(tenant, body.empId), s);
    await redis.sadd(payKey.settings(tenant), body.empId);
    return res.status(200).json({ ok: true, data: s });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
