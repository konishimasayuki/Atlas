// api/sales/campaigns/index.js ── 販促メール：一覧(GET) / 作成(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireSales, salesKey, pad4 } from "../_guard.js";

// デモのため実際のメール送信は行わず、配信リストと記録のみ管理する
export default async function handler(req, res) {
  const ctx = await requireSales(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(salesKey.campaigns(tenant));
    let list = await mgetByIds(ids, (id) => salesKey.campaign(tenant, id));
    list = list.map(({ recipients, body, ...r }) => ({ ...r, recipientCount: (recipients || []).length }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title || !body.subject) return res.status(400).json({ ok: false, error: "missing" });

    // 宛先：顧客台帳から条件で抽出（rank/status指定 or 明示リスト）
    const custIds = await redis.smembers(salesKey.customers(tenant));
    const customers = custIds.length ? await mgetByIds(custIds, (id) => salesKey.customer(tenant, id)) : [];
    let targets = customers.filter((c) => c.email);
    if (Array.isArray(body.ranks) && body.ranks.length) targets = targets.filter((c) => body.ranks.includes(c.rank));
    if (Array.isArray(body.statuses) && body.statuses.length) targets = targets.filter((c) => body.statuses.includes(c.status));

    const recipients = targets.map((c) => ({ id: c.id, name: c.name, email: c.email, rank: c.rank, status: c.status }));

    const seq = await redis.incr(salesKey.campaignSeq(tenant));
    const id = `cp${seq}`;
    const c = {
      id, code: `CP${pad4(seq)}`,
      title: body.title, subject: body.subject, body: body.body || "",
      ranks: body.ranks || [], statuses: body.statuses || [],
      recipients,
      status: body.send ? "配信済" : "下書き",
      sentAt: body.send ? Date.now() : null,
      createdAt: Date.now(),
    };
    await redis.set(salesKey.campaign(tenant, id), c);
    await redis.sadd(salesKey.campaigns(tenant), id);
    return res.status(200).json({ ok: true, data: { id: c.id, code: c.code, recipientCount: recipients.length, status: c.status } });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
