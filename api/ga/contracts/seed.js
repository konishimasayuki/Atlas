// api/ga/contracts/seed.js ── 電子契約サンプル
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

const DATA = [
  ["業務委託基本契約書","業務委託","株式会社みらいシステム","締結済",1200000],
  ["秘密保持契約（NDA）","NDA","九州エレクトロ株式会社","締結済",0],
  ["オフィス賃貸借契約","賃貸借","博多不動産株式会社","締結済",180000],
  ["保守サービス契約","保守","日本総合電機","送信済",360000],
  ["販売代理店契約","代理店","有明サプライ","送信済",0],
  ["請負契約書（Webサイト制作）","請負","佐賀デザイン工房","下書き",800000],
  ["リース契約（複合機）","リース","京セラックリース","締結済",45000],
  ["顧問契約（税務）","顧問","博多会計事務所","締結済",50000],
  ["業務委託契約（清掃）","業務委託","福岡クリーンサービス","却下",90000],
  ["ソフトウェア利用許諾契約","ライセンス","クラウドテック株式会社","下書き",240000],
];

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const existing = await redis.scard(gaKey.contracts(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  const now = Date.now();
  let n = 0;
  for (let x = 0; x < DATA.length; x++) {
    const [title, type, counterparty, status, amount] = DATA[x];
    const seq = await redis.incr(gaKey.contractSeq(tenant));
    const id = `ct${seq}`;
    const sy = 2024 + (x % 2), sm = 1 + (x % 12);
    const history = [{ at: now - x * 8000000, by: "デモ管理者", action: "作成" }];
    if (["送信済", "締結済", "却下"].includes(status)) history.push({ at: now - x * 6000000, by: "デモ管理者", action: "送信（先方へ）" });
    if (status === "締結済") history.push({ at: now - x * 4000000, by: counterparty, action: "締結" });
    if (status === "却下") history.push({ at: now - x * 4000000, by: counterparty, action: "却下" });
    const c = {
      id, code: `CT${pad4(seq)}`, title, type, counterparty,
      counterpartyEmail: `keiyaku${x + 1}@example.jp`,
      startDate: `${sy}-${pad4(sm).slice(2)}-01`,
      endDate: `${sy + 1}-${pad4(sm).slice(2)}-末`.replace("末", "28"),
      autoRenew: x % 3 === 0,
      amount, status, note: "",
      body: `${title}\n\n甲と乙は、次のとおり${type}契約を締結する。\n第1条（目的）…\n第2条（契約期間）…\n第3条（対価）…`,
      createdBy: "デモ管理者",
      signedAt: status === "締結済" ? now - x * 4000000 : undefined,
      createdAt: now - x * 8000000, history,
    };
    await redis.set(gaKey.contract(tenant, id), c);
    await redis.sadd(gaKey.contracts(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
