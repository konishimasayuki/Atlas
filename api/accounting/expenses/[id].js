// api/accounting/expenses/[id].js ── 経費：取得(GET) / 更新・状態変更(PUT) / 削除(DELETE)
import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey } from "../_guard.js";

function normalizeLines(lines, fuelUnitPrice) {
  if (!Array.isArray(lines)) return null;
  return lines.map((l) => {
    const isFuel = !!l.isFuel;
    const distance = Number(l.distance) || 0;
    const amount = isFuel ? Math.round(distance * (Number(fuelUnitPrice) || 0)) : (Number(l.amount) || 0);
    return { date: l.date || "", category: l.category || (isFuel ? "ガソリン代" : "旅費交通費"), payee: l.payee || "", description: l.description || "", isFuel, distance, amount, receipt: l.receipt || "" };
  });
}

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  const { id } = req.query;

  const cur = await redis.get(acctKey.expense(tenant, id));
  if (!cur) return res.status(404).json({ ok: false, error: "not_found" });

  const isOwner = cur.applicantId === me.id;
  const isApprover = !!me.canManageUsers;

  if (req.method === "GET") {
    if (!isOwner && !isApprover) return res.status(403).json({ ok: false, error: "forbidden" });
    return res.status(200).json({ ok: true, data: cur }); // 詳細はレシート込み
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    const action = body.action; // save | submit | approve | reject | settle

    // 申請者による編集（下書き/差戻のときのみ）
    if (["save", "submit"].includes(action)) {
      if (!isOwner) return res.status(403).json({ ok: false, error: "forbidden" });
      if (!["下書き", "差戻"].includes(cur.status)) return res.status(409).json({ ok: false, error: "not_editable" });
      const settings = (await redis.get(acctKey.settings(tenant))) || { fuelUnitPrice: 15 };
      if (body.title !== undefined) cur.title = body.title;
      if (body.note !== undefined) cur.note = body.note;
      const nl = normalizeLines(body.lines, settings.fuelUnitPrice);
      if (nl) { cur.lines = nl; cur.total = nl.reduce((s, l) => s + l.amount, 0); }
      if (action === "submit") {
        cur.status = "申請中";
        cur.history.push({ at: Date.now(), by: me.name, action: "申請" });
      }
    }

    // 承認者による処理
    else if (["approve", "reject", "settle"].includes(action)) {
      if (!isApprover) return res.status(403).json({ ok: false, error: "forbidden" });
      if (action === "approve") {
        if (cur.status !== "申請中") return res.status(409).json({ ok: false, error: "bad_state" });
        cur.status = "承認済";
        cur.approvedBy = me.name;
        cur.history.push({ at: Date.now(), by: me.name, action: "承認" });
      } else if (action === "reject") {
        if (cur.status !== "申請中") return res.status(409).json({ ok: false, error: "bad_state" });
        cur.status = "差戻";
        cur.history.push({ at: Date.now(), by: me.name, action: "差戻", comment: body.comment || "" });
      } else if (action === "settle") {
        if (cur.status !== "承認済") return res.status(409).json({ ok: false, error: "bad_state" });
        cur.status = "精算済";
        cur.settledAt = Date.now();
        cur.history.push({ at: Date.now(), by: me.name, action: "精算" });
      }
    } else {
      return res.status(400).json({ ok: false, error: "bad_action" });
    }

    cur.updatedAt = Date.now();
    await redis.set(acctKey.expense(tenant, id), cur);
    return res.status(200).json({ ok: true, data: cur });
  }

  if (req.method === "DELETE") {
    if (!isOwner && !isApprover) return res.status(403).json({ ok: false, error: "forbidden" });
    if (!["下書き", "差戻"].includes(cur.status) && !isApprover) return res.status(409).json({ ok: false, error: "not_deletable" });
    await redis.del(acctKey.expense(tenant, id));
    await redis.srem(acctKey.expenses(tenant), id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
