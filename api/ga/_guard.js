// api/ga/_guard.js ── 総務(ga)モジュール共通：アクセス制御とキー
import { getCurrentUser } from "../_lib/core.js";

export async function requireGa(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "company" || !me.effectiveModules.includes("ga")) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return null;
  }
  return { me, tenant: me.company };
}

export const gaKey = {
  // 仕入・取引条件
  supplier: (t, id) => `atlas:${t}:ga:supplier:${id}`,
  suppliers: (t) => `atlas:${t}:ga:suppliers`,
  supplierSeq: (t) => `atlas:${t}:ga:seq:supplier`,
  // 電子契約
  contract: (t, id) => `atlas:${t}:ga:contract:${id}`,
  contracts: (t) => `atlas:${t}:ga:contracts`,
  contractSeq: (t) => `atlas:${t}:ga:seq:contract`,
  // 資産・備品管理
  asset: (t, id) => `atlas:${t}:ga:asset:${id}`,
  assets: (t) => `atlas:${t}:ga:assets`,
  assetSeq: (t) => `atlas:${t}:ga:seq:asset`,
  // eラーニング：講座（course）にレッスン・クイズを内包
  course: (t, id) => `atlas:${t}:ga:course:${id}`,
  courses: (t) => `atlas:${t}:ga:courses`,
  courseSeq: (t) => `atlas:${t}:ga:seq:course`,
  // 受講進捗：ユーザー×講座（{完了レッスンid, クイズ得点, 完了}）
  progress: (t, userId, courseId) => `atlas:${t}:ga:progress:${userId}:${courseId}`,
  userProgress: (t, userId) => `atlas:${t}:ga:progress:${userId}`, // SET of courseId
};

export function pad4(n) { return String(n).padStart(4, "0"); }
