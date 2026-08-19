// api/sales/_guard.js ── 営業(sales)モジュール共通：アクセス制御とキー
import { getCurrentUser } from "../_lib/core.js";

// sales を使える会社ユーザーだけ許可。tenant(会社コード)を返す。
export async function requireSales(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company" || !me.effectiveModules.includes("sales")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { me, tenant: me.company };
}

export const salesKey = {
  customer: (t, id) => `atlas:${t}:sales:customer:${id}`,
  customers: (t) => `atlas:${t}:sales:customers`,
  seq: (t) => `atlas:${t}:sales:seq:customer`,
};

export function pad4(n) {
  return String(n).padStart(4, "0");
}
