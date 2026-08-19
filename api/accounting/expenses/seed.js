// api/accounting/expenses/seed.js ── サンプル経費申請を投入（デモ用）
import { redis } from "../../_lib/redis.js";
import { requireAccounting, acctKey, pad4, DEFAULT_SETTINGS } from "../_guard.js";

const APPLICANTS = [
  { id: "demo", name: "デモ管理者" },
  { id: "sato", name: "佐藤 健一" },
  { id: "suzuki", name: "鈴木 美咲" },
  { id: "tanaka", name: "田中 大輔" },
];
const STATES = ["申請中", "承認済", "精算済", "差戻", "下書き"];

export default async function handler(req, res) {
  const ctx = await requireAccounting(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const existing = await redis.scard(acctKey.expenses(tenant));
  if (existing > 0) return res.status(409).json({ ok: false, error: "already_seeded", count: existing });

  // 設定を用意（ガソリン単価15円/km）
  await redis.set(acctKey.settings(tenant), { ...DEFAULT_SETTINGS });
  const fuel = DEFAULT_SETTINGS.fuelUnitPrice;
  const now = Date.now();
  let n = 0;

  for (let x = 1; x <= 18; x++) {
    const ap = APPLICANTS[x % APPLICANTS.length];
    const status = STATES[x % STATES.length];
    const day = 1 + (x * 3) % 27;
    const dateStr = `2026-07-${pad4(day).slice(2)}`;

    const lines = [];
    // ガソリン明細（距離×単価で自動計算）
    if (x % 2 === 0) {
      const dist = 20 + (x * 7) % 120;
      lines.push({ date: dateStr, category: "ガソリン代", payee: "自家用車", description: "客先往復", isFuel: true, distance: dist, amount: Math.round(dist * fuel), receipt: "" });
    }
    // 交通費
    lines.push({ date: dateStr, category: "旅費交通費", payee: "JR九州", description: "電車代", isFuel: false, distance: 0, amount: 480 + (x * 130) % 3000, receipt: "" });
    // 会議費/消耗品など
    if (x % 3 === 0) {
      lines.push({ date: dateStr, category: "会議費", payee: "カフェ・ド・博多", description: "打合せ飲食", isFuel: false, distance: 0, amount: 800 + (x * 90) % 2500, receipt: "" });
    }

    const total = lines.reduce((s, l) => s + l.amount, 0);
    const seq = await redis.incr(acctKey.expenseSeq(tenant));
    const id = `ex${seq}`;
    const history = [{ at: now - x * 3600000, by: ap.name, action: "申請" }];
    if (["承認済", "精算済"].includes(status)) history.push({ at: now - x * 3000000, by: "デモ管理者", action: "承認" });
    if (status === "精算済") history.push({ at: now - x * 1000000, by: "デモ管理者", action: "精算" });
    if (status === "差戻") history.push({ at: now - x * 2000000, by: "デモ管理者", action: "差戻", comment: "領収書を添付してください" });

    const expense = {
      id, code: `EX${pad4(seq)}`,
      title: `${ap.name} 経費申請（7月）`,
      applicantId: ap.id, applicantName: ap.name,
      lines, total, status,
      note: "", createdAt: now - x * 3600000, history,
      approvedBy: ["承認済", "精算済"].includes(status) ? "デモ管理者" : undefined,
      settledAt: status === "精算済" ? now - x * 1000000 : undefined,
    };
    await redis.set(acctKey.expense(tenant, id), expense);
    await redis.sadd(acctKey.expenses(tenant), id);
    n++;
  }
  return res.status(200).json({ ok: true, data: { created: n } });
}
