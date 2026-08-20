// api/ga/contracts/[id].js ── 契約：取得/更新(編集・ステータス遷移)/削除
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey } from "../_guard.js";

const FIELDS = ["title","type","counterparty","counterpartyEmail","startDate","endDate","autoRenew","amount","note","body"];
const NUM = ["amount"];
// 許可する遷移
const NEXT = { "下書き": ["送信済"], "送信済": ["締結済", "却下", "下書き"], "締結済": ["期限切れ"], "却下": ["下書き"], "期限切れ": [] };

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  const { id } = req.query;
  const cur = await redis.get(gaKey.contract(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  if (req.method === "GET") return res.status(200).json({ ok: true, data: cur });

  if (req.method === "PUT") {
    const body = req.body || {};
    // 内容編集（下書き・却下のときのみ）
    if (body.fields) {
      if (!["下書き", "却下"].includes(cur.status)) return res.status(409).json({ ok: false, error: "not_editable" });
      for (const f of FIELDS) {
        if (body.fields[f] === undefined) continue;
        cur[f] = NUM.includes(f) ? (Number(body.fields[f]) || 0) : (f === "autoRenew" ? !!body.fields[f] : body.fields[f]);
      }
    }
    // ステータス遷移
    if (body.status) {
      const allowed = NEXT[cur.status] || [];
      if (!allowed.includes(body.status)) return res.status(409).json({ ok: false, error: "bad_transition" });
      cur.status = body.status;
      const label = { "送信済": "送信（先方へ）", "締結済": "締結", "却下": "却下", "下書き": "差戻", "期限切れ": "期限切れ" }[body.status] || body.status;
      cur.history = cur.history || [];
      cur.history.push({ at: Date.now(), by: me.name, action: label });
      if (body.status === "締結済") cur.signedAt = Date.now();
    }
    cur.updatedAt = Date.now();
    await redis.set(gaKey.contract(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    await redis.del(gaKey.contract(tenant, id));
    await redis.srem(gaKey.contracts(tenant), id);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
