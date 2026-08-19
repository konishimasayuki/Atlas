// api/hr/_guard.js ── 人事(hr)モジュール共通：アクセス制御とキー
import { getCurrentUser } from "../_lib/core.js";

export async function requireHr(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company" || !me.effectiveModules.includes("hr")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { me, tenant: me.company };
}

export const hrKey = {
  employee: (t, id) => `atlas:${t}:hr:employee:${id}`,
  employees: (t) => `atlas:${t}:hr:employees`,
  seq: (t) => `atlas:${t}:hr:seq:employee`,
};

export function pad4(n) {
  return String(n).padStart(4, "0");
}
