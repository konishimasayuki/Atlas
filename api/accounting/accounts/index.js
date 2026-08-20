// api/accounting/accounts/index.js ── 勘定科目：一覧(GET) / 標準科目の初期化(POST seed) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireAccounting, acctKey } from "../_guard.js";
import { STANDARD_ACCOUNTS } from "../_coa.js";

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const codes = await redis.smembers(acctKey.accounts(tenant));
    let list = codes.length ? await mgetByIds(codes, (c) => acctKey.account(tenant, c)) : [];
    list.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    // 標準科目の一括初期化
    if (body.seed) {
      const existing = await redis.scard(acctKey.accounts(tenant));
      if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });
      for (const a of STANDARD_ACCOUNTS) {
        await redis.set(acctKey.account(tenant, a.code), a);
        await redis.sadd(acctKey.accounts(tenant), a.code);
      }
      return res.status(200).json({ ok: true, data: { created: STANDARD_ACCOUNTS.length } });
    }
    // 個別追加
    if (!body.code || !body.name || !body.type) return res.status(400).json({ ok: false, error: "missing" });
    const side = ["asset", "expense"].includes(body.type) ? "debit" : "credit";
    const stmt = ["revenue", "expense"].includes(body.type) ? "pl" : "bs";
    const a = { code: body.code, name: body.name, type: body.type, side, stmt, sub: body.sub || "" };
    await redis.set(acctKey.account(tenant, a.code), a);
    await redis.sadd(acctKey.accounts(tenant), a.code);
    return res.status(200).json({ ok: true, data: a });
  }
  return res.status(405).json({ ok: false, error: "method" });
}
