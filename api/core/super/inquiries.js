// api/core/super/inquiries.js ── スーパー管理者：全社の問い合わせ一覧・対応状況/返信の更新
//  GET → 全件（新しい順）
//  PUT { id, status?, reply? }  status: 未対応 / 対応中 / 対応済
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, mgetByIds } from "../../_lib/core.js";
import { inqKey, inqSet } from "../inquiry.js";

const STATUSES = ["未対応", "対応中", "対応済"];

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "super") return res.status(403).json({ ok: false, error: "forbidden" });

  if (req.method === "GET") {
    const ids = await redis.smembers(inqSet());
    const all = (await mgetByIds(ids, (id) => inqKey(id))).sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ ok: true, data: all });
  }
  if (req.method === "PUT") {
    const { id, status, reply } = req.body || {};
    const q = await redis.get(inqKey(id));
    if (!q) return res.status(404).json({ ok: false, error: "not_found" });
    if (status && STATUSES.includes(status)) q.status = status;
    if (typeof reply === "string") { q.reply = reply.slice(0, 5000); q.repliedAt = Date.now(); q.repliedBy = me.name; }
    q.updatedAt = Date.now();
    await redis.set(inqKey(id), q);
    return res.status(200).json({ ok: true, data: q });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
