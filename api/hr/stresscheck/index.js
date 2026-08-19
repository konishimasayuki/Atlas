// api/hr/stresscheck/index.js ── 設問取得(GET ?questions=1) / 実施回の集計(GET) / 実施回作成は暗黙
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireHr, hrKey } from "../_guard.js";
import { SC_QUESTIONS, SC_CHOICES } from "./questions.js";

function currentRound() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() < 6 ? "H1" : "H2"}`; // 半期ごとの実施回
}

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  // 設問だけ欲しい場合
  if (req.query.questions) {
    return res.status(200).json({ ok: true, data: { questions: SC_QUESTIONS, choices: SC_CHOICES, round: currentRound() } });
  }

  const round = req.query.round || currentRound();

  // 自分の受検状況
  const myKey = hrKey.scResult(tenant, round, me.id);
  const mine = await redis.get(myKey);

  // 管理者：全社集計（個人結果は本人と管理者のみ、ここは統計のみ返す）
  let summary = null;
  if (me.canManageUsers) {
    const empIds = await redis.smembers(hrKey.employees(tenant));
    const employees = await mgetByIds(empIds, (id) => hrKey.employee(tenant, id));
    const memberIds = await redis.smembers(hrKey.scResults(tenant, round));
    const results = memberIds.length
      ? await mgetByIds(memberIds, (id) => hrKey.scResult(tenant, round, id))
      : [];
    const done = results.length;
    const high = results.filter((r) => r.score?.highStress).length;
    // 部署別 受検率
    const byDept = {};
    for (const e of employees) {
      byDept[e.department] = byDept[e.department] || { total: 0, done: 0 };
      byDept[e.department].total++;
    }
    for (const r of results) {
      const emp = employees.find((e) => e.id === r.empId);
      if (emp && byDept[emp.department]) byDept[emp.department].done++;
    }
    summary = {
      round,
      targetCount: employees.length,
      doneCount: done,
      rate: employees.length ? Math.round((done / employees.length) * 100) : 0,
      highStressCount: high,
      avgA: done ? Math.round(results.reduce((s, r) => s + (r.score?.A || 0), 0) / done) : 0,
      avgB: done ? Math.round(results.reduce((s, r) => s + (r.score?.B || 0), 0) / done) : 0,
      avgC: done ? Math.round(results.reduce((s, r) => s + (r.score?.C || 0), 0) / done) : 0,
      byDept,
      // 高ストレス者リスト（管理者のみ・氏名/部署）
      highList: results.filter((r) => r.score?.highStress).map((r) => {
        const emp = employees.find((e) => e.id === r.empId);
        return { empId: r.empId, name: emp?.name || r.empId, department: emp?.department || "", score: r.score };
      }),
    };
  }

  return res.status(200).json({ ok: true, data: { round, mine, summary, isApprover: !!me.canManageUsers } });
}
