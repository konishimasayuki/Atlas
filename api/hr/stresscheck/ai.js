// api/hr/stresscheck/ai.js ── AIストレスチェック分析（デモ）
//  個人：スコアからパーソナライズド助言。組織：集計から改善提言。
//  将来：aiAnalyze() をClaude APIに差し替えると本格的な分析コメントに。
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireHr, hrKey } from "../_guard.js";

function currentRound() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() < 6 ? "H1" : "H2"}`;
}

// ★将来Claudeに差し替え（scoreや集計を渡してコメント生成）
function aiPersonalAdvice(score) {
  const tips = [];
  if (score.B >= 63) tips.push("心身のストレス反応が高めです。十分な睡眠と休養を優先し、つらさが続く場合は産業医・相談窓口の利用を検討してください。");
  else if (score.B >= 45) tips.push("疲れが溜まりつつあるサインがあります。こまめな休憩と、業務量の見直しを意識しましょう。");
  else tips.push("心身の状態は落ち着いています。今の生活リズムを維持しましょう。");

  if (score.A >= 55) tips.push("仕事の負担感が高い状態です。タスクの優先順位づけや、抱え込みを避けて上司に相談することが有効です。");
  if (score.C >= 55) tips.push("周囲のサポートを得にくいと感じているようです。困りごとは早めに共有し、相談できる相手を一人決めておくと安心です。");
  else if (score.C <= 30) tips.push("周囲のサポートは得やすい環境です。その関係性を活かして相談・連携を進めましょう。");

  const level = score.highStress ? "高ストレス" : (score.B >= 45 || score.A >= 50) ? "やや注意" : "良好";
  return { level, advice: tips.join("\n\n") };
}

function aiOrgInsight(summary) {
  const lines = [];
  if (!summary || summary.doneCount === 0) return { headline: "データがありません", insight: "受検が完了すると分析が表示されます。" };
  lines.push(`受検率は ${summary.rate}%（${summary.doneCount}/${summary.targetCount}名）です。`);
  if (summary.rate < 80) lines.push("受検率が80%未満です。未受検者への個別リマインドで回収率を高めましょう。");
  if (summary.highStressCount > 0) lines.push(`高ストレス者が ${summary.highStressCount} 名います。産業医面談の案内など、プライバシーに配慮した個別フォローを推奨します。`);
  else lines.push("高ストレス者は確認されていません。良好な状態を維持できています。");

  // 部署別の弱点
  const weak = Object.entries(summary.byDept || {}).filter(([, v]) => v.total > 0 && v.done / v.total < 0.6).map(([d]) => d);
  if (weak.length) lines.push(`受検率が低い部署: ${weak.join("、")}。管理者から受検を促すと効果的です。`);

  if (summary.avgB >= 55) lines.push("全社的に心身反応の平均が高めです。業務負荷の平準化や休暇取得の促進が有効と考えられます。");

  const headline = summary.highStressCount > 0 ? "要フォロー対象あり" : summary.rate >= 80 ? "全体的に良好" : "受検率の向上が課題";
  return { headline, insight: lines.join("\n") };
}

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  const round = req.query.round || currentRound();

  // 個人分析（自分の結果）
  const mine = await redis.get(hrKey.scResult(tenant, round, me.id));
  const personal = mine ? aiPersonalAdvice(mine.score) : null;

  // 組織分析（管理者のみ）
  let org = null;
  if (me.canManageUsers) {
    const empIds = await redis.smembers(hrKey.employees(tenant));
    const employees = await mgetByIds(empIds, (id) => hrKey.employee(tenant, id));
    const memberIds = await redis.smembers(hrKey.scResults(tenant, round));
    const results = memberIds.length ? await mgetByIds(memberIds, (id) => hrKey.scResult(tenant, round, id)) : [];
    const byDept = {};
    for (const e of employees) { byDept[e.department] = byDept[e.department] || { total: 0, done: 0 }; byDept[e.department].total++; }
    for (const r of results) { const e = employees.find((x) => x.id === r.empId); if (e && byDept[e.department]) byDept[e.department].done++; }
    const summary = {
      targetCount: employees.length, doneCount: results.length,
      rate: employees.length ? Math.round((results.length / employees.length) * 100) : 0,
      highStressCount: results.filter((r) => r.score?.highStress).length,
      avgB: results.length ? Math.round(results.reduce((s, r) => s + (r.score?.B || 0), 0) / results.length) : 0,
      byDept,
    };
    org = aiOrgInsight(summary);
  }

  return res.status(200).json({ ok: true, data: { round, personal, org, demo: true } });
}
