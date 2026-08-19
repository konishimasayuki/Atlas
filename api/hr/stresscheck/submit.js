// api/hr/stresscheck/submit.js ── ログイン中ユーザーがストレスチェックを提出
import { redis } from "../../_lib/redis.js";
import { requireHr, hrKey } from "../_guard.js";
import { scoreAnswers } from "./questions.js";

function currentRound() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() < 6 ? "H1" : "H2"}`;
}

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const body = req.body || {};
  const round = body.round || currentRound();
  const answers = body.answers || {};
  const score = scoreAnswers(answers);

  const result = {
    round,
    empId: me.id,
    empName: me.name,
    answers,       // 本人と管理者のみ閲覧（キーがユーザー単位）
    score,
    submittedAt: Date.now(),
  };
  await redis.set(hrKey.scResult(tenant, round, me.id), result);
  await redis.sadd(hrKey.scResults(tenant, round), me.id);
  await redis.sadd(hrKey.scRounds(tenant), round);

  // 本人向けには結果(スコア＋助言)を返す
  return res.status(200).json({ ok: true, data: { score, round } });
}
