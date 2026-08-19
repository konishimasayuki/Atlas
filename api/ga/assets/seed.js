// api/ga/assets/seed.js ── 会社備品のサンプルを投入
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

const PREFIX = { "PC": "PC", "モニター": "MON", "スマホ": "MOB", "タブレット": "TAB", "複合機": "MFP", "デスク": "DSK", "椅子": "CHR", "車両": "CAR", "工具": "TOL", "その他": "GEN" };
const LIFE = { "PC": 4, "モニター": 4, "スマホ": 4, "タブレット": 4, "複合機": 5, "デスク": 8, "椅子": 8, "車両": 6, "工具": 5, "その他": 5 };

const ITEMS = [
  { category: "PC", name: "ノートPC", maker: "レノビア", model: "ThinkGate X1", lo: 120000, hi: 220000 },
  { category: "PC", name: "デスクトップPC", maker: "デーレル", model: "OptiFlex 7000", lo: 90000, hi: 160000 },
  { category: "モニター", name: "24型モニター", maker: "アイオデータ", model: "LCD-24U", lo: 15000, hi: 35000 },
  { category: "スマホ", name: "業務用スマホ", maker: "林檎", model: "iPhone SE", lo: 60000, hi: 90000 },
  { category: "タブレット", name: "タブレット", maker: "林檎", model: "iPad 10.9", lo: 55000, hi: 110000 },
  { category: "複合機", name: "複合機(コピー機)", maker: "京セラック", model: "TASKforce 2553", lo: 250000, hi: 480000 },
  { category: "デスク", name: "事務デスク", maker: "コクヨン", model: "SAIBI 平机", lo: 25000, hi: 55000 },
  { category: "椅子", name: "オフィスチェア", maker: "オカムーラ", model: "Sylphy", lo: 30000, hi: 78000 },
  { category: "車両", name: "営業車", maker: "トヨダ", model: "プロボクス", lo: 1400000, hi: 1900000 },
  { category: "工具", name: "電動ドライバー", maker: "マキダ", model: "TD172D", lo: 18000, hi: 32000 },
];
const LOCS = ["本社1F", "本社2F", "福岡支店", "佐賀営業所", "倉庫"];
const USERS = ["佐藤 健一", "鈴木 美咲", "田中 大輔", "高橋 直樹", "共用", "（未割当）"];
const STATUS = ["使用中", "使用中", "使用中", "保管中", "修理中", "廃棄"];

function round(n) { return Math.round(n / 100) * 100; }

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(gaKey.assets(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const now = Date.now();
  let n = 0;
  for (let x = 1; x <= 30; x++) {
    const t = ITEMS[(x - 1) % ITEMS.length];
    const price = round(t.lo + ((t.hi - t.lo) * ((x * 41) % 100)) / 100);
    const py = 2020 + (x * 7) % 6;   // 2020〜2025
    const pm = 1 + (x * 5) % 12;
    const seq = await redis.incr(gaKey.assetSeq(tenant));
    const id = `as${seq}`;
    const asset = {
      id,
      assetNo: `${PREFIX[t.category]}-${pad4(seq)}`,
      name: t.name,
      category: t.category,
      maker: t.maker,
      model: t.model,
      serial: `SN${pad4((x * 613) % 9999)}${pad4((x * 271) % 9999)}`,
      purchaseDate: `${py}-${pad4(pm).slice(2)}-01`,
      price,
      usefulLife: LIFE[t.category] || 5,
      location: LOCS[(x * 3) % LOCS.length],
      assignee: USERS[(x * 2) % USERS.length],
      status: STATUS[x % STATUS.length],
      note: "",
      createdAt: now - x * 86400000,
    };
    await redis.set(gaKey.asset(tenant, id), asset);
    await redis.sadd(gaKey.assets(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
