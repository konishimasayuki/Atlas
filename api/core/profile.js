// api/core/profile.js ── 自社情報（会社名・住所・連絡先・登録番号・振込先・ロゴ・社印）
//  GET：ログイン中の自社ユーザー全員（帳票PDFのヘッダーに使うため）
//  PUT：ユーザー管理権限（canManageUsers）を持つ人のみ
import { redis } from "../_lib/redis.js";
import { getCurrentUser, k } from "../_lib/core.js";

const FIELDS = ["companyName", "representative", "postal", "address", "tel", "fax", "email", "invoiceNo", "bankInfo", "note"];
const IMG_MAX = 400 * 1024; // dataURL の上限（約400KB）
const profileKey = (c) => `atlas:${c}:core:profile`;

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (me.scope !== "company") return res.status(403).json({ ok: false, error: "forbidden" });
  const code = me.company;

  const cur = (await redis.get(profileKey(code))) || {};
  const withDefault = (p) => ({ companyName: me.companyName || "", ...p });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: withDefault(cur) });

  if (req.method === "PUT") {
    if (!me.canManageUsers) return res.status(403).json({ ok: false, error: "forbidden" });
    const b = req.body || {};
    const next = { ...cur };
    for (const f of FIELDS) if (typeof b[f] === "string") next[f] = b[f].slice(0, 500);
    for (const f of ["logo", "seal"]) {
      if (b[f] === "") next[f] = "";
      else if (typeof b[f] === "string" && b[f].startsWith("data:image/")) {
        if (b[f].length > IMG_MAX) return res.status(400).json({ ok: false, error: "image_too_large", field: f });
        next[f] = b[f];
      }
    }
    next.updatedAt = Date.now();
    await redis.set(profileKey(code), next);
    return res.status(200).json({ ok: true, data: withDefault(next) });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
