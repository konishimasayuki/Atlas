// api/hr/shift/seed.js ── デモ用：当月シフトを自動生成
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireHr, hrKey } from "../_guard.js";

function daysInMonth(ym) { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); }

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const ym = (req.body && req.body.ym) || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const existing = await redis.get(hrKey.shiftBoard(tenant, ym));
  if (existing && Object.keys(existing.assignments || {}).length > 0) return res.status(409).json({ ok: false, error: "already_seeded" });

  const empIds = await redis.smembers(`atlas:${tenant}:hr:employees`);
  const employees = empIds.length ? await mgetByIds(empIds, (id) => `atlas:${tenant}:hr:employee:${id}`) : [];
  const days = daysInMonth(ym);
  const CODES = ["日", "早", "遅", "休"];

  const assignments = {};
  employees.forEach((e, idx) => {
    const row = {};
    for (let d = 1; d <= days; d++) {
      const dow = new Date(`${ym}-${String(d).padStart(2, "0")}`).getDay();
      if (dow === 0 || (dow === 6 && (d + idx) % 2 === 0)) { row[d] = "休"; continue; }
      row[d] = CODES[(d + idx) % 3]; // 日/早/遅を回す
    }
    // 有給を月1回ランダムに
    const paidDay = 3 + (idx * 5) % (days - 5);
    row[paidDay] = "有";
    assignments[e.id] = row;
  });

  await redis.set(hrKey.shiftBoard(tenant, ym), { ym, assignments, updatedAt: Date.now() });
  await redis.sadd(hrKey.shiftBoards(tenant), ym);
  return res.status(200).json({ ok: true, data: { ym, count: employees.length } });
}
