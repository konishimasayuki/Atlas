// api/accounting/journal/report.js ── 仕訳から 試算表・B/S・P/L・簡易C/F を集計
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireAccounting, acctKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  // 勘定科目マスタ
  const codes = await redis.smembers(acctKey.accounts(tenant));
  const accounts = codes.length ? await mgetByIds(codes, (c) => acctKey.account(tenant, c)) : [];
  const acc = {};
  for (const a of accounts) acc[a.code] = a;

  // 仕訳
  const ids = await redis.smembers(acctKey.journals(tenant));
  const journals = ids.length ? await mgetByIds(ids, (id) => acctKey.journal(tenant, id)) : [];

  // 勘定ごとに借方・貸方を集計
  const agg = {}; // code -> { debit, credit }
  for (const j of journals) {
    for (const l of j.lines) {
      agg[l.accountCode] = agg[l.accountCode] || { debit: 0, credit: 0 };
      agg[l.accountCode][l.side] += Number(l.amount) || 0;
    }
  }

  // 試算表：各勘定の残高（借方科目は 借方-貸方、貸方科目は 貸方-借方）
  const trial = [];
  let totalDebit = 0, totalCredit = 0;
  for (const code of Object.keys(agg).sort()) {
    const a = acc[code] || { code, name: code, side: "debit", type: "asset", stmt: "bs", sub: "" };
    const d = agg[code].debit, c = agg[code].credit;
    const balance = a.side === "debit" ? d - c : c - d;
    trial.push({ code, name: a.name, type: a.type, side: a.side, stmt: a.stmt, sub: a.sub, debit: d, credit: c, balance });
    totalDebit += d; totalCredit += c;
  }

  // P/L：収益・費用
  const plRev = trial.filter((t) => t.type === "revenue");
  const plExp = trial.filter((t) => t.type === "expense");
  const revenue = plRev.reduce((s, t) => s + t.balance, 0);
  const expense = plExp.reduce((s, t) => s + t.balance, 0);
  const netIncome = revenue - expense;

  // 売上総利益・営業利益の簡易区分
  const byName = (arr, sub) => arr.filter((t) => t.sub === sub).reduce((s, t) => s + t.balance, 0);
  const sales = plRev.filter((t) => t.sub === "売上高").reduce((s, t) => s + t.balance, 0);
  const cogs = plExp.filter((t) => t.sub === "売上原価").reduce((s, t) => s + t.balance, 0);
  const sga = plExp.filter((t) => t.sub === "販管費").reduce((s, t) => s + t.balance, 0);
  const grossProfit = sales - cogs;
  const operatingProfit = grossProfit - sga;

  // B/S：資産・負債・純資産（当期純利益を純資産に組み入れ）
  const bsAsset = trial.filter((t) => t.type === "asset");
  const bsLiab = trial.filter((t) => t.type === "liability");
  const bsEquity = trial.filter((t) => t.type === "equity");
  const assetTotal = bsAsset.reduce((s, t) => s + t.balance, 0);
  const liabTotal = bsLiab.reduce((s, t) => s + t.balance, 0);
  const equityBase = bsEquity.reduce((s, t) => s + t.balance, 0);
  const equityTotal = equityBase + netIncome; // 当期純利益を加算

  // 簡易C/F：現金・預金の増減を仕訳から（現金101・普通預金102の残高＝期末残高）
  const cashCodes = ["101", "102"];
  const cashEnd = trial.filter((t) => cashCodes.includes(t.code)).reduce((s, t) => s + t.balance, 0);

  return res.status(200).json({
    ok: true,
    data: {
      journalCount: journals.length,
      trial: { rows: trial, totalDebit, totalCredit, balanced: totalDebit === totalCredit },
      pl: { rows: [...plRev, ...plExp], sales, cogs, grossProfit, sga, operatingProfit, revenue, expense, netIncome },
      bs: {
        asset: bsAsset, liability: bsLiab, equity: bsEquity,
        assetTotal, liabTotal, equityBase, netIncome, equityTotal,
        balanced: assetTotal === (liabTotal + equityTotal),
      },
      cf: { cashEnd },
    },
  });
}
