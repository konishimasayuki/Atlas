// api/hr/stresscheck/seed.js ── デモ用：人事台帳の社員の一部が受検済みの状態を投入
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireHr, hrKey } from "../_guard.js";
import { SC_QUESTIONS, scoreAnswers } from "./questions.js";

function currentRound() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() < 6 ? "H1" : "H2"}`;
}

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const round = currentRound();
  const existing = await redis.scard(hrKey.scResults(tenant, round));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  // 人事台帳の社員を対象にする（台帳ベース）
  const empIds = await redis.smembers(hrKey.employees(tenant));
  if (empIds.length === 0) return res.status(409).json({ ok: false, error: "no_employees" });
  const employees = await mgetByIds(empIds, (id) => hrKey.employee(tenant, id));
  employees.sort((a, b) => a.code.localeCompare(b.code));

  const now = Date.now();
  let done = 0;
  // 約7割が受検済み、うち一定数を高ストレスにする擬似回答
  employees.forEach((emp, i) => {
    if (i % 10 >= 7) return; // 3割は未受検のまま
    const stressed = i % 8 === 0; // 一定割合を高ストレスに
    const answers = {};
    for (const q of SC_QUESTIONS) {
      // stressed の人は負担が高くなる回答傾向に
      let base;
      if (q.support) base = stressed ? 3 + (i % 2) : 1 + (i % 2);       // サポート不足寄り
      else if (q.positive) base = stressed ? 1 + (i % 2) : 3 + (i % 2); // 活気なし寄り
      else if (q.reverse) base = stressed ? 3 + (i % 2) : 1 + (i % 2);  // 負担高い寄り
      else base = stressed ? 4 - (i % 2) : 2 + (i % 2);
      answers[q.id] = Math.min(4, Math.max(1, base));
    }
    const score = scoreAnswers(answers);
    const result = { round, empId: emp.id, empName: emp.name, answers, score, submittedAt: now - i * 3600000 };
    redis.set(hrKey.scResult(tenant, round, emp.id), result);
    redis.sadd(hrKey.scResults(tenant, round), emp.id);
    done++;
  });
  await redis.sadd(hrKey.scRounds(tenant), round);

  return res.status(200).json({ ok: true, data: { round, submitted: done, target: employees.length } });
}
