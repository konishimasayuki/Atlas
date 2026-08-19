// api/sales/customers/seed.js ── サンプル顧客50件を投入（既にあれば投入しない）
import { redis } from "../../_lib/redis.js";
import { requireSales, salesKey, pad4 } from "../_guard.js";

const SURNAME = ["佐藤","鈴木","高橋","田中","伊藤","渡辺","山本","中村","小林","加藤","吉田","山田","木村","林","斎藤","清水","松本","井上","中島","前田"];
const SURNAME_KANA = ["サトウ","スズキ","タカハシ","タナカ","イトウ","ワタナベ","ヤマモト","ナカムラ","コバヤシ","カトウ","ヨシダ","ヤマダ","キムラ","ハヤシ","サイトウ","シミズ","マツモト","イノウエ","ナカジマ","マエダ"];
const GIVEN = ["翔太","健一","美咲","裕子","大輔","直樹","彩","拓也","真由美","健太","陽子","浩","恵","誠","智子","隆","愛","徹","由美","剛"];
const CBASE = ["みらい","さくら","東洋","九州","博多","有明","太陽","青空","大和","富士","北斗","明星","一番","筑後","玄海"];
const CBASE_KANA = ["ミライ","サクラ","トウヨウ","キュウシュウ","ハカタ","アリアケ","タイヨウ","アオゾラ","ヤマト","フジ","ホクト","ミョウジョウ","イチバン","チクゴ","ゲンカイ"];
const CTYPE = ["商事","製作所","工業","物産","建設","運輸","フーズ","電機","システム","サービス","興業","産業","販売","農園","印刷"];
const CITY = ["福岡市博多区","福岡市中央区","佐賀市","北九州市小倉北区","久留米市","唐津市","鳥栖市","飯塚市","大牟田市","糸島市"];
const STATUS = ["取引中","取引中","取引中","見込み","見込み","休眠"]; // 取引中を多めに
const RANK = ["A","B","B","C","C"];

function pick(arr, i) { return arr[i % arr.length]; }

export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(salesKey.customers(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const now = Date.now();
  let created = 0;

  for (let n = 1; n <= 50; n++) {
    const isCorp = n % 4 !== 0; // 3/4 を法人、1/4 を個人
    const sIdx = (n * 7) % SURNAME.length;
    const gIdx = (n * 3) % GIVEN.length;
    const person = SURNAME[sIdx] + " " + GIVEN[gIdx];
    const personKana = SURNAME_KANA[sIdx];

    let name, kana, contactPerson, type;
    if (isCorp) {
      const bIdx = (n * 5) % CBASE.length;
      const tIdx = (n * 2) % CTYPE.length;
      name = "株式会社" + CBASE[bIdx] + CTYPE[tIdx];
      kana = CBASE_KANA[bIdx];
      contactPerson = person;
      type = "法人";
    } else {
      name = person;
      kana = personKana;
      contactPerson = person;
      type = "個人";
    }

    const city = pick(CITY, n * 3);
    const phone = `0${92 + (n % 8)}-${pad4(1000 + (n * 37) % 8999)}-${pad4((n * 613) % 9999)}`;
    const month = 3 + (n % 5); // 3〜7月
    const day = 1 + (n * 13) % 27;
    const lastContactDate = `2026-${pad4(month).slice(2)}-${pad4(day).slice(2)}`;

    const id = `c${n}`;
    const customer = {
      id,
      code: `C${pad4(n)}`,
      name,
      kana,
      type,
      contactPerson,
      phone,
      email: `contact${n}@example.jp`,
      address: `${city}${1 + (n % 9)}-${1 + (n * 3) % 20}-${1 + (n * 7) % 15}`,
      rank: pick(RANK, n),
      status: pick(STATUS, n),
      note: n % 6 === 0 ? "定期フォロー対象" : "",
      lastContactDate,
      createdAt: now - n * 86400000,
    };
    await redis.set(salesKey.customer(tenant, id), customer);
    await redis.sadd(salesKey.customers(tenant), id);
    created++;
  }

  // 連番を50に合わせる（以降の追加が C0051 から始まるように）
  await redis.set(salesKey.seq(tenant), 50);

  return res.status(200).json({ ok: true, data: { created } });
}
