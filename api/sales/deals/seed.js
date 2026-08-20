// api/sales/deals/seed.js ── 商談サンプル（顧客台帳と紐付け）
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireSales, salesKey, pad4 } from "../_guard.js";

const TITLES = ["新規システム導入","保守契約更新","増設案件","リプレース提案","追加ライセンス","定期メンテ契約","コンサル契約","機器入替","サポート延長","新店舗向け一式"];
const PHASES = ["見込み","商談中","商談中","提案","提案","受注","受注","失注"];
const PROB = { "見込み": 20, "商談中": 50, "提案": 70, "受注": 100, "失注": 0 };
const OWNERS = ["佐藤 健一","鈴木 美咲","田中 大輔","高橋 直樹"];
const ACTIONS = ["見積提出","次回訪問アポ","デモ実施","稟議待ち","クロージング","フォロー連絡","提案書修正"];

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const existing = await redis.scard(salesKey.deals(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  // 顧客台帳を参照して紐付け
  const custIds = await redis.smembers(salesKey.customers(tenant));
  const customers = custIds.length ? await mgetByIds(custIds, (id) => salesKey.customer(tenant, id)) : [];

  const now = Date.now();
  let n = 0;
  for (let x = 1; x <= 20; x++) {
    const phase = PHASES[x % PHASES.length];
    const cust = customers[(x * 3) % Math.max(1, customers.length)] || null;
    const seq = await redis.incr(salesKey.dealSeq(tenant));
    const id = `dl${seq}`;
    const month = 8 + (x % 5);
    const d = {
      id, code: `DL${pad4(seq)}`,
      title: TITLES[x % TITLES.length],
      customerId: cust?.id || "",
      customerName: cust?.name || "（顧客未設定）",
      phase,
      amount: (3 + (x * 7) % 50) * 100000,
      probability: PROB[phase],
      owner: OWNERS[x % OWNERS.length],
      expectedDate: `2026-${pad4(month).slice(2)}-${pad4(1 + (x * 5) % 27).slice(2)}`,
      nextAction: phase === "受注" || phase === "失注" ? "" : ACTIONS[x % ACTIONS.length],
      note: "",
      createdAt: now - x * 86400000,
    };
    await redis.set(salesKey.deal(tenant, id), d);
    await redis.sadd(salesKey.deals(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
