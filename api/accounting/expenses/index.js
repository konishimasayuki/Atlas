// api/accounting/expenses/index.js ── 経費精算：一覧(GET) / 申請作成(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireAccounting, acctKey, pad4 } from "../_guard.js";

// 明細1行：{ date, category, payee(支払先), description, amount, isFuel, distance, receipt(dataURL) }
function normalizeLines(lines, fuelUnitPrice) {
  if (!Array.isArray(lines)) return [];
  return lines.map((l) => {
    const isFuel = !!l.isFuel;
    const distance = Number(l.distance) || 0;
    const amount = isFuel ? Math.round(distance * (Number(fuelUnitPrice) || 0)) : (Number(l.amount) || 0);
    return {
      date: l.date || "",
      category: l.category || (isFuel ? "ガソリン代" : "旅費交通費"),
      payee: l.payee || "",
      description: l.description || "",
      isFuel,
      distance,
      amount,
      receipt: l.receipt || "", // レシート画像(dataURL) 任意
    };
  });
}

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(acctKey.expenses(tenant));
    let list = await mgetByIds(ids, (id) => acctKey.expense(tenant, id));
    // 権限：承認権(canManageUsers)がなければ自分の申請のみ表示
    if (!me.canManageUsers) list = list.filter((e) => e.applicantId === me.id);
    // 一覧はレシート画像を落として軽くする
    list = list.map((e) => ({ ...e, lines: (e.lines || []).map(({ receipt, ...r }) => ({ ...r, hasReceipt: !!receipt })) }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const settings = (await redis.get(acctKey.settings(tenant))) || { fuelUnitPrice: 15 };
    const lines = normalizeLines(body.lines, settings.fuelUnitPrice);
    if (lines.length === 0) return res.status(400).json({ ok: false, error: "no_lines" });

    const total = lines.reduce((s, l) => s + l.amount, 0);
    const seq = await redis.incr(acctKey.expenseSeq(tenant));
    const id = `ex${seq}`;
    const expense = {
      id, code: `EX${pad4(seq)}`,
      title: body.title || `${me.name} 経費申請`,
      applicantId: me.id,
      applicantName: me.name,
      lines,
      total,
      status: body.submit ? "申請中" : "下書き", // 下書き | 申請中 | 承認済 | 差戻 | 精算済
      note: body.note || "",
      createdAt: Date.now(),
      history: [{ at: Date.now(), by: me.name, action: body.submit ? "申請" : "作成" }],
    };
    await redis.set(acctKey.expense(tenant, id), expense);
    await redis.sadd(acctKey.expenses(tenant), id);
    return res.status(200).json({ ok: true, data: { ...expense, lines: expense.lines.map(({ receipt, ...r }) => ({ ...r, hasReceipt: !!receipt })) } });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
