// api/inventory/forecast/index.js ── AI需要予測（デモ）
//  商品マスタの在庫・発注点・カテゴリから、需要傾向と推奨発注量を算出。
//  将来：aiForecast() をClaude API等に差し替えると、より高度な予測に。
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireInventory, invKey } from "../_guard.js";
import { callClaude } from "../../_lib/ai.js";

export const config = { maxDuration: 60 };

// カテゴリ別の需要係数（季節性の擬似・デモ）
const SEASON = { "エアコン": 1.5, "季節家電": 1.4, "冷蔵庫": 1.1, "テレビ": 1.15, "洗濯機": 1.0, "電子レンジ": 0.95, "掃除機": 1.0, "炊飯器": 0.9, "調理家電": 1.05, "生活家電": 1.0 };

// ★将来ここをClaude等に差し替え（商品履歴を渡して予測を得る）
function aiForecast(items) {
  const month = new Date().getMonth() + 1;
  const summer = month >= 5 && month <= 9;
  return items.map((it) => {
    const seasonF = (SEASON[it.category] || 1) * (summer && ["エアコン", "季節家電"].includes(it.category) ? 1.2 : 1);
    // 擬似的な月間需要：発注点と在庫回転から推定
    const baseDemand = Math.max(1, Math.round((it.reorderPoint || 5) * 1.8 * seasonF));
    const stock = it.theoreticalStock || 0;
    // 推奨発注量：需要2ヶ月分 - 現在庫（発注点考慮）
    const recommend = Math.max(0, Math.round(baseDemand * 2 - stock));
    const daysLeft = baseDemand > 0 ? Math.round((stock / baseDemand) * 30) : 999;
    let risk = "安定";
    if (stock <= (it.reorderPoint || 0)) risk = "欠品危険";
    else if (daysLeft <= 30) risk = "要注意";
    const trend = seasonF >= 1.3 ? "増加" : seasonF <= 0.95 ? "減少" : "横ばい";
    return {
      id: it.id, code: it.code, name: it.name, category: it.category, maker: it.maker,
      stock, reorderPoint: it.reorderPoint || 0, supplier: it.supplier,
      forecastDemand: baseDemand, daysLeft, recommend, risk, trend, cost: it.cost || 0,
    };
  });
}

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  const ids = await redis.smembers(invKey.items(tenant));
  const items = ids.length ? await mgetByIds(ids, (id) => invKey.item(tenant, id)) : [];
  const active = items.filter((i) => i.status !== "取扱終了");
  const rows = aiForecast(active).sort((a, b) => {
    const order = { "欠品危険": 0, "要注意": 1, "安定": 2 };
    return order[a.risk] - order[b.risk] || b.recommend - a.recommend;
  });

  const summary = {
    total: rows.length,
    danger: rows.filter((r) => r.risk === "欠品危険").length,
    warn: rows.filter((r) => r.risk === "要注意").length,
    recommendValue: rows.reduce((s, r) => s + r.recommend * r.cost, 0),
    recommendItems: rows.filter((r) => r.recommend > 0).length,
  };
  // Claude による分析コメント（数値予測は上の計算ロジック、解説・優先順位付けをAIが担当）
  let aiComment = null;
  if (req.query.ai !== "0") {
    const top = rows.filter((r) => r.risk !== "安定").slice(0, 25).map((r) =>
      `${r.code}｜${r.name}｜${r.category}｜在庫${r.stock}｜発注点${r.reorderPoint}｜需要予測${r.forecastDemand}/月｜残${r.daysLeft}日｜${r.risk}｜傾向${r.trend}｜推奨発注${r.recommend}｜仕入先${r.supplier || "-"}`
    ).join("\n");
    const month = new Date().getMonth() + 1;
    const r = await callClaude({
      system: [
        "あなたは日本の卸・小売業の在庫管理に詳しい需要予測アシスタントです。",
        "与えられた在庫・需要予測データを読み、発注担当者向けに『今すぐ発注すべきもの』『注意して見るもの』『季節要因などの補足』を簡潔にまとめてください。",
        "Markdownの見出し・表は使わず、・の箇条書き中心で全体400字程度。データに無いことは推測と明示すること。",
      ].join("\n"),
      messages: [{ role: "user", content: `現在${month}月。全${summary.total}品目中、欠品危険${summary.danger}・要注意${summary.warn}、推奨発注${summary.recommendItems}品目／金額¥${summary.recommendValue.toLocaleString()}。\n【要確認品目】コード｜品名｜カテゴリ｜在庫｜発注点｜需要予測｜残日数｜リスク｜傾向｜推奨発注｜仕入先\n${top || "（なし）"}` }],
      maxTokens: 900,
    });
    if (r && r.text) aiComment = r.text;
  }
  return res.status(200).json({ ok: true, data: { rows, summary, aiComment, demo: !aiComment } });
}
