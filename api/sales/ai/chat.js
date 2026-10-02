// api/sales/ai/chat.js ── 営業支援AIチャット
//  Claude APIキー設定済み（スーパー管理者コンソール）なら Claude が回答。未設定・エラー時はデモ応答。
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireSales, salesKey } from "../_guard.js";
import { callClaude as callClaudeApi } from "../../_lib/ai.js";

export const config = { maxDuration: 60 };

const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();

// ── 営業データのスナップショットを取得（AIに渡すコンテキスト） ──
async function loadContext(tenant) {
  const custIds = await redis.smembers(salesKey.customers(tenant));
  const customers = custIds.length ? await mgetByIds(custIds, (id) => salesKey.customer(tenant, id)) : [];
  const dealIds = await redis.smembers(salesKey.deals(tenant));
  const deals = dealIds.length ? await mgetByIds(dealIds, (id) => salesKey.deal(tenant, id)) : [];
  return { customers, deals };
}

// ★ ここを将来 Anthropic API 呼び出しに差し替える（下部コメント参照） ★
async function callClaude(messages, ctx) {
  const active = ctx.deals.filter((d) => !["受注", "失注"].includes(d.phase));
  const dealLines = ctx.deals.slice(0, 60).map((d) =>
    `${d.code}｜${d.title}｜${d.customerName}｜${d.phase}｜確度${d.probability}%｜${yen(d.amount)}｜担当:${d.owner}｜次:${d.nextAction || "なし"}｜予定:${d.expectedDate || "-"}`
  ).join("\n");
  const custLines = ctx.customers.slice(0, 80).map((c) =>
    `${c.code}｜${c.name}｜ランク${c.rank}｜${c.status}`
  ).join("\n");
  const system = [
    "あなたは日本の中小企業向け業務システム「Atlas」の営業支援AIです。",
    "以下の自社の営業データだけを根拠に、簡潔で実践的な助言を日本語で返してください。データに無いことは推測と明示してください。",
    "Markdownの見出しや表は使わず、読みやすい短い段落と箇条書き（・）で答えてください。",
    `【集計】顧客${ctx.customers.length}件／商談${ctx.deals.length}件（進行中${active.length}件）`,
    "【商談一覧】コード｜案件名｜顧客｜フェーズ｜確度｜金額｜担当｜次アクション｜受注予定",
    dealLines || "（なし）",
    "【顧客一覧】コード｜名称｜ランク｜状況",
    custLines || "（なし）",
  ].join("\n");
  let hist = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-12);
  while (hist.length && hist[0].role !== "user") hist = hist.slice(1); // 先頭はユーザー発言である必要がある
  const r = hist.length ? await callClaudeApi({ system, messages: hist, maxTokens: 1200 }) : null;
  if (r && r.text) return { text: r.text, demo: false };
  return { text: demoReply(messages, ctx), demo: true, error: r?.error };
}

// ── デモ応答ロジック（キーワードで営業データを要約して返す） ──
function demoReply(messages, ctx) {
  const last = (messages[messages.length - 1]?.content || "").toLowerCase();
  const { customers, deals } = ctx;
  const active = deals.filter((d) => !["受注", "失注"].includes(d.phase));

  const has = (...kw) => kw.some((k) => last.includes(k));

  // 商談まとめ
  if (has("商談", "案件", "パイプ", "見込", "予測")) {
    const pipe = active.reduce((s, d) => s + d.amount, 0);
    const weighted = Math.round(active.reduce((s, d) => s + d.amount * (d.probability / 100), 0));
    const byPhase = {};
    for (const d of active) byPhase[d.phase] = (byPhase[d.phase] || 0) + 1;
    const top = [...active].sort((a, b) => b.amount * b.probability - a.amount * a.probability).slice(0, 3);
    return [
      `現在の進行中商談は ${active.length} 件、パイプライン総額は ${yen(pipe)}、加重見込は ${yen(weighted)} です。`,
      `フェーズ内訳: ${Object.entries(byPhase).map(([p, c]) => `${p} ${c}件`).join(" / ")}`,
      top.length ? `注力候補（金額×確度）:\n${top.map((d, i) => `${i + 1}. ${d.title}（${d.customerName}）${yen(d.amount)}・${d.phase}${d.probability}%`).join("\n")}` : "",
      `次アクション未設定の商談があれば早めに設定しましょう。`,
    ].filter(Boolean).join("\n\n");
  }

  // 顧客の相談
  if (has("顧客", "取引先", "アプローチ", "休眠", "深耕")) {
    const dormant = customers.filter((c) => c.status === "休眠");
    const rankA = customers.filter((c) => c.rank === "A");
    return [
      `顧客は全 ${customers.length} 件。ランクA ${rankA.length} 件、休眠 ${dormant.length} 件です。`,
      dormant.length ? `休眠の掘り起こし候補: ${dormant.slice(0, 3).map((c) => c.name).join("、")} など。前回接触からの間隔を口実に再アプローチのメールを送るのが定石です。` : "",
      `ランクA顧客には定期訪問と新商品情報の優先案内で関係を維持しましょう。`,
    ].filter(Boolean).join("\n\n");
  }

  // メール・トーク文面の作成
  if (has("メール", "文面", "案内", "お礼", "トーク", "提案")) {
    return [
      "営業メールの型をご提案します（コピーしてご利用ください）:",
      `件名: 【ご案内】お打ち合わせのお礼と次のご提案について\n\n〇〇様\n\nいつもお世話になっております。先日はお時間をいただきありがとうございました。\nご相談いただいた件、御社の課題に合わせた提案をまとめました。\n次回、15分ほどお電話でご説明できればと存じます。今週後半でご都合いかがでしょうか。\n\n何卒よろしくお願いいたします。`,
      "宛名や商談内容を差し込めば、そのまま送れます。より具体的な文面が必要なら状況を教えてください。",
    ].join("\n\n");
  }

  // 使い方・その他
  if (has("使い方", "何ができ", "ヘルプ", "help", "できること")) {
    return "営業支援AIです。次のようなことをお手伝いできます:\n・商談パイプラインの要約と注力先の提案\n・顧客の掘り起こし・アプローチ方針\n・営業メールやトークの文面作成\n・受注確度や次アクションの相談\n\n例:「今の商談まとめて」「休眠顧客どうする？」「お礼メール作って」";
  }

  // 汎用
  return [
    "承知しました。営業データ（顧客・商談）を踏まえてお答えします。",
    `現在、顧客 ${customers.length} 件・進行中商談 ${active.length} 件を把握しています。`,
    "「商談まとめて」「休眠顧客のアプローチ」「提案メール作って」などと聞いてください。",
  ].join("\n\n");
}

export default async function handler(req, res) {
  const ctx0 = await requireSales(req, res);
  if (!ctx0) return;
  const { tenant } = ctx0;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ ok: false, error: "no_messages" });

  const ctx = await loadContext(tenant);
  const out = await callClaude(messages, ctx);

  // 軽い遅延で"考えている"感（デモ演出・任意）
  return res.status(200).json({ ok: true, data: { role: "assistant", content: out.text, demo: out.demo, aiError: out.error || null } });
}
