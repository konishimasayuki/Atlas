// api/ga/assets/index.js ── 資産・備品：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

// 付番ルール：管理番号 = 種別プレフィックス + 連番（例 PC-0007）
const PREFIX = { "PC": "PC", "モニター": "MON", "スマホ": "MOB", "タブレット": "TAB", "複合機": "MFP", "デスク": "DSK", "椅子": "CHR", "車両": "CAR", "工具": "TOL", "その他": "GEN" };
const FIELDS = ["name","category","maker","model","serial","assetNo","purchaseDate","price","usefulLife","location","assignee","status","note"];
const NUM = ["price","usefulLife"];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(gaKey.assets(tenant));
    const list = await mgetByIds(ids, (id) => gaKey.asset(tenant, id));
    list.sort((a, b) => (a.assetNo || "").localeCompare(b.assetNo || ""));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: "missing_name" });
    const seq = await redis.incr(gaKey.assetSeq(tenant));
    const id = `as${seq}`;
    const cat = body.category || "その他";
    const asset = { id, createdAt: Date.now() };
    for (const f of FIELDS) {
      if (NUM.includes(f)) asset[f] = Number(body[f]) || 0;
      else asset[f] = body[f] ?? "";
    }
    asset.category = cat;
    // 管理番号は未指定なら自動付番
    if (!asset.assetNo) asset.assetNo = `${PREFIX[cat] || "GEN"}-${pad4(seq)}`;
    if (!asset.status) asset.status = "使用中";
    if (!asset.usefulLife) asset.usefulLife = defaultLife(cat);

    await redis.set(gaKey.asset(tenant, id), asset);
    await redis.sadd(gaKey.assets(tenant), id);
    return res.status(200).json({ ok: true, data: asset });
  }

  return res.status(405).json({ ok: false, error: "method" });
}

function defaultLife(cat) {
  // 参考：法定耐用年数の目安（年）
  const map = { "PC": 4, "モニター": 4, "スマホ": 4, "タブレット": 4, "複合機": 5, "デスク": 8, "椅子": 8, "車両": 6, "工具": 5, "その他": 5 };
  return map[cat] || 5;
}
