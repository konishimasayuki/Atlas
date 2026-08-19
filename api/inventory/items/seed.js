// api/inventory/items/seed.js ── 家電卸会社想定の商品50件を投入
import { redis } from "../../_lib/redis.js";
import { requireInventory, invKey, pad4 } from "../_guard.js";

const MAKERS = ["ソニックス","パナテック","東芝ライク","日立エース","三菱スター","シャープル","富士ゼネ","アイリスク","バルミュー風","山善ライク"];
const CATS = [
  { c: "テレビ", names: ["4K液晶テレビ 43型","4K液晶テレビ 55型","有機ELテレビ 48型","液晶テレビ 32型"], unit: "台", lo: 45000, hi: 180000 },
  { c: "冷蔵庫", names: ["冷蔵庫 400L","冷蔵庫 500L 幅60","2ドア冷蔵庫 140L","大容量冷蔵庫 600L"], unit: "台", lo: 60000, hi: 240000 },
  { c: "洗濯機", names: ["ドラム式洗濯乾燥機 11kg","縦型洗濯機 8kg","縦型洗濯機 5kg","ドラム式 12kg"], unit: "台", lo: 40000, hi: 260000 },
  { c: "エアコン", names: ["エアコン 6畳用","エアコン 10畳用","エアコン 14畳用","エアコン 20畳用"], unit: "台", lo: 55000, hi: 220000 },
  { c: "電子レンジ", names: ["オーブンレンジ 26L","単機能レンジ 17L","過熱水蒸気レンジ 30L"], unit: "台", lo: 12000, hi: 78000 },
  { c: "掃除機", names: ["スティック掃除機","ロボット掃除機","紙パック式掃除機","サイクロン掃除機"], unit: "台", lo: 9000, hi: 89000 },
  { c: "炊飯器", names: ["IH炊飯器 5.5合","圧力IH炊飯器 5.5合","マイコン炊飯器 3合"], unit: "台", lo: 8000, hi: 68000 },
  { c: "調理家電", names: ["電気ケトル 1.0L","トースター 2枚","ホットプレート","コーヒーメーカー"], unit: "台", lo: 3000, hi: 22000 },
  { c: "季節家電", names: ["空気清浄機 20畳","扇風機 DCモーター","加湿器 5L","セラミックヒーター"], unit: "台", lo: 6000, hi: 62000 },
  { c: "生活家電", names: ["ドライヤー","電気シェーバー","アイロン","除湿機"], unit: "台", lo: 3000, hi: 35000 },
];
const LOCS = ["A-01","A-02","A-03","B-01","B-02","B-03","C-01","C-02","D-01","D-02"];
const SUPPLIERS = ["西日本電機商会","九州エレクトロ","博多家電流通","有明サプライ","日本総合電機"];

function round(n) { return Math.round(n / 100) * 100; }

export default async function handler(req, res) {
  const ctx = await requireInventory(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(invKey.items(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const now = Date.now();
  let n = 0;
  for (let x = 1; x <= 50; x++) {
    const cat = CATS[(x - 1) % CATS.length];
    const nm = cat.names[(x * 3) % cat.names.length];
    const maker = MAKERS[(x * 7) % MAKERS.length];
    const price = round(cat.lo + ((cat.hi - cat.lo) * ((x * 37) % 100)) / 100);
    const cost = round(price * (0.62 + ((x % 10) / 100)));  // 原価率 62〜71%
    const stock = (x * 13) % 60;                             // 0〜59
    const reorder = 5 + (x % 10);
    n++;
    const id = `i${n}`;
    const item = {
      id,
      code: `SKU${pad4(n)}`,
      name: `${maker} ${nm}`,
      maker,
      category: cat.c,
      jan: `49${pad4((x * 631) % 9999)}${pad4((x * 977) % 9999)}0`,
      supplier: SUPPLIERS[(x * 5) % SUPPLIERS.length],
      location: LOCS[(x * 3) % LOCS.length],
      unit: cat.unit,
      cost,
      price,
      theoreticalStock: stock,
      reorderPoint: reorder,
      status: x % 17 === 0 ? "取扱終了" : "取扱中",
      createdAt: now - x * 3600000,
    };
    await redis.set(invKey.item(tenant, id), item);
    await redis.sadd(invKey.items(tenant), id);
  }
  await redis.set(invKey.itemSeq(tenant), 50);
  return res.status(200).json({ ok: true, data: { created: n } });
}
