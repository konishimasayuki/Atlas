// api/ga/contracts/index.js ── 電子契約：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

const FIELDS = ["title","type","counterparty","counterpartyEmail","startDate","endDate","autoRenew","amount","status","note","body"];
const NUM = ["amount"];

// status: 下書き | 送信済(先方確認待ち) | 締結済 | 却下 | 期限切れ
export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(gaKey.contracts(tenant));
    let list = await mgetByIds(ids, (id) => gaKey.contract(tenant, id));
    // 一覧は本文を省く
    list = list.map(({ body, ...r }) => ({ ...r, hasBody: !!body }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ ok: false, error: "missing_title" });
    const seq = await redis.incr(gaKey.contractSeq(tenant));
    const id = `ct${seq}`;
    const c = { id, code: `CT${pad4(seq)}`, createdBy: me.name, createdAt: Date.now(), history: [{ at: Date.now(), by: me.name, action: "作成" }] };
    for (const f of FIELDS) {
      if (NUM.includes(f)) c[f] = Number(body[f]) || 0;
      else if (f === "autoRenew") c[f] = !!body[f];
      else c[f] = body[f] ?? "";
    }
    if (!c.status) c.status = "下書き";
    if (!c.type) c.type = "業務委託";
    await redis.set(gaKey.contract(tenant, id), c);
    await redis.sadd(gaKey.contracts(tenant), id);
    return res.status(200).json({ ok: true, data: c });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
