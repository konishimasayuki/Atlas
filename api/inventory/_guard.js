// api/inventory/_guard.js ── 在庫(inventory)モジュール共通：アクセス制御とキー
import { getCurrentUser } from "../_lib/core.js";

export async function requireInventory(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company" || !me.effectiveModules.includes("inventory")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { me, tenant: me.company };
}

export const invKey = {
  // 入出庫（出庫記録：販売/消費/持出/廃棄、入庫：その他調整）
  movement: (t, id) => `atlas:${t}:inventory:movement:${id}`,
  movements: (t) => `atlas:${t}:inventory:movements`,
  movementSeq: (t) => `atlas:${t}:inventory:seq:movement`,
  // 発注管理
  order: (t, id) => `atlas:${t}:inventory:order:${id}`,
  orders: (t) => `atlas:${t}:inventory:orders`,
  orderSeq: (t) => `atlas:${t}:inventory:seq:order`,
  item: (t, id) => `atlas:${t}:inventory:item:${id}`,
  items: (t) => `atlas:${t}:inventory:items`,
  itemSeq: (t) => `atlas:${t}:inventory:seq:item`,
  // 棚卸（1回のセッション＝1棚卸）
  count: (t, id) => `atlas:${t}:inventory:stocktake:${id}`,
  counts: (t) => `atlas:${t}:inventory:stocktakes`,
  countSeq: (t) => `atlas:${t}:inventory:seq:stocktake`,
};

export function pad4(n) { return String(n).padStart(4, "0"); }
