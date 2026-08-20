// api/accounting/_guard.js ── 会計(accounting)モジュール共通：アクセス制御とキー
import { getCurrentUser } from "../_lib/core.js";

export async function requireAccounting(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company" || !me.effectiveModules.includes("accounting")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { me, tenant: me.company };
}

export const acctKey = {
  // 勘定科目マスタ
  account: (t, code) => `atlas:${t}:accounting:account:${code}`,
  accounts: (t) => `atlas:${t}:accounting:accounts`,
  // 仕訳
  journal: (t, id) => `atlas:${t}:accounting:journal:${id}`,
  journals: (t) => `atlas:${t}:accounting:journals`,
  journalSeq: (t) => `atlas:${t}:accounting:seq:journal`,
  expense: (t, id) => `atlas:${t}:accounting:expense:${id}`,
  expenses: (t) => `atlas:${t}:accounting:expenses`,
  expenseSeq: (t) => `atlas:${t}:accounting:seq:expense`,
  // 会社の経費精算の設定（ガソリン単価・勘定科目一覧など）
  settings: (t) => `atlas:${t}:accounting:expense_settings`,
};

export function pad4(n) { return String(n).padStart(4, "0"); }

// 既定の勘定科目・ガソリン設定
export const DEFAULT_SETTINGS = {
  fuelUnitPrice: 15,      // 1kmあたりの想定ガソリン代（円）
  categories: ["旅費交通費", "ガソリン代", "会議費", "接待交際費", "消耗品費", "通信費", "新聞図書費", "支払手数料", "雑費"],
};
