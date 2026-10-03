// api/core/inquiry.js ── 会社ユーザーからの問い合わせ（運営＝スーパー管理者に届く）
//  GET  → 自分が送った問い合わせの一覧（運営の返信・対応状況つき）
//  POST { category, subject, body } → 送信
import { redis } from "../_lib/redis.js";
import { getCurrentUser, mgetByIds } from "../_lib/core.js";

export const inqKey = (id) => `atlas:_super:inquiry:${id}`;
export const inqSet = () => `atlas:_super:inquiries`;
const CATEGORIES = ["使い方", "不具合", "要望", "契約・請求", "その他"];

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company") return res.status(403).json({ ok: false, error: "forbidden" });

  if (req.method === "GET") {
    const ids = await redis.smembers(inqSet());
    const all = await mgetByIds(ids, (id) => inqKey(id));
    const mine = all.filter((q) => q.company === me.company && q.userId === me.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ ok: true, data: mine });
  }

  if (req.method === "POST") {
    const { category, subject, body } = req.body || {};
    if (!subject || !body) return res.status(400).json({ ok: false, error: "missing" });
    const seq = await redis.incr("atlas:_super:seq:inquiry");
    const id = `Q${String(seq).padStart(5, "0")}`;
    const q = {
      id, category: CATEGORIES.includes(category) ? category : "その他",
      subject: String(subject).slice(0, 120), body: String(body).slice(0, 5000),
      company: me.company, companyName: me.companyName || me.company, userId: me.id, userName: me.name,
      status: "未対応", reply: "", createdAt: Date.now(), updatedAt: Date.now(),
    };
    await redis.set(inqKey(id), q);
    await redis.sadd(inqSet(), id);
    return res.status(200).json({ ok: true, data: q });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
