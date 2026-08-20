// api/ga/suppliers/seed.js ── 仕入先サンプル
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

const NAMES = [
  ["西日本電機商会","ニシニホンデンキ","電機卸"],["九州エレクトロ","キュウシュウエレクトロ","電子部品"],
  ["博多家電流通","ハカタカデンリュウツウ","家電卸"],["有明サプライ","アリアケサプライ","雑貨"],
  ["日本総合電機","ニホンソウゴウデンキ","電機卸"],["筑後包装資材","チクゴホウソウ","梱包資材"],
  ["玄海物流","ゲンカイブツリュウ","物流"],["佐賀鉄工所","サガテッコウ","金属加工"],
  ["九州オフィス機器","キュウシュウオフィス","OA機器"],["福岡クリーンサービス","フクオカクリーン","清掃"],
];
const CLOSING = ["末日","20日","15日","10日"];
const PMONTH = ["翌月","翌々月","当月"];
const PMETHOD = ["銀行振込","手形","口座振替","現金"];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const existing = await redis.scard(gaKey.suppliers(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const now = Date.now();
  let n = 0;
  for (let x = 0; x < NAMES.length; x++) {
    const [name, kana, category] = NAMES[x];
    const seq = await redis.incr(gaKey.supplierSeq(tenant));
    const id = `sp${seq}`;
    const s = {
      id, code: `SP${pad4(seq)}`, name, kana, category,
      contactPerson: ["山田","佐藤","田中","鈴木","高橋"][x % 5] + "部長",
      phone: `092-${pad4(100 + x * 37)}-${pad4(1000 + x * 613)}`,
      email: `sales${x + 1}@example-supplier.jp`,
      address: ["福岡市博多区","佐賀市","北九州市","久留米市","糸島市"][x % 5] + `${1 + x}-${2 + x}`,
      closingDay: CLOSING[x % CLOSING.length],
      paymentMonth: PMONTH[x % PMONTH.length],
      paymentDay: ["末日","25日","10日"][x % 3],
      paymentMethod: PMETHOD[x % PMETHOD.length],
      rate: [100, 95, 92, 88, 85][x % 5],           // 掛率(%)
      creditLimit: (3 + (x % 8)) * 1000000,          // 与信限度
      status: x % 9 === 0 ? "取引停止" : "取引中",
      note: "",
      createdAt: now - x * 86400000,
    };
    await redis.set(gaKey.supplier(tenant, id), s);
    await redis.sadd(gaKey.suppliers(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
