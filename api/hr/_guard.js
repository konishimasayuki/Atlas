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
  // シフト管理（月単位の割当ボード）
  shiftBoard: (t, ym) => `atlas:${t}:hr:shiftboard:${ym}`,
  shiftBoards: (t) => `atlas:${t}:hr:shiftboards`,
  shiftCodes: (t) => `atlas:${t}:hr:shiftcodes`,
  // 組織図（編集可能な独立ツリー）
  orgNode: (t, id) => `atlas:${t}:hr:orgnode:${id}`,
  orgNodes: (t) => `atlas:${t}:hr:orgnodes`,
  orgSeq: (t) => `atlas:${t}:hr:seq:orgnode`,
  employee: (t, id) => `atlas:${t}:hr:employee:${id}`,
  employees: (t) => `atlas:${t}:hr:employees`,
  seq: (t) => `atlas:${t}:hr:seq:employee`,
  // ストレスチェック：1回答＝1社員×1実施回
  scResult: (t, round, empId) => `atlas:${t}:hr:sc:${round}:${empId}`,
  scResults: (t, round) => `atlas:${t}:hr:sc:${round}:members`,
  scRounds: (t) => `atlas:${t}:hr:sc:rounds`,
};

export function pad4(n) {
  return String(n).padStart(4, "0");
}
