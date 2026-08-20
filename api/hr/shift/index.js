// api/hr/shift/index.js
//  GET ?ym=YYYY-MM → その月のシフト表（人事台帳の社員×日付、コード凡例）
//  POST {ym, empId, day, code} → 1セル更新（upsert）
import { redis } from "../../_lib/redis.js";
import { requireHr, hrKey } from "../_guard.js";

const DEFAULT_CODES = [
  { code: "日", label: "日勤", time: "9:00-18:00", color: "#1657B0" },
  { code: "早", label: "早番", time: "7:00-16:00", color: "#0B6E52" },
  { code: "遅", label: "遅番", time: "13:00-22:00", color: "#9A5A0B" },
  { code: "休", label: "休み", time: "", color: "#8a94a5" },
  { code: "有", label: "有給", time: "", color: "#6A34A0" },
];

function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ym = req.query.ym;
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return res.status(400).json({ ok: false, error: "bad_ym" });
    const empIds = await redis.smembers(`atlas:${tenant}:hr:employees`);
    const codes = (await redis.get(hrKey.shiftCodes(tenant))) || DEFAULT_CODES;
    const board = (await redis.get(hrKey.shiftBoard(tenant, ym))) || { ym, assignments: {} };
    return res.status(200).json({ ok: true, data: { ym, days: daysInMonth(ym), codes, assignments: board.assignments || {} } });
  }

  if (req.method === "POST") {
    const { ym, empId, day, code } = req.body || {};
    if (!ym || !empId || !day) return res.status(400).json({ ok: false, error: "missing" });
    const board = (await redis.get(hrKey.shiftBoard(tenant, ym))) || { ym, assignments: {} };
    board.assignments[empId] = board.assignments[empId] || {};
    if (code) board.assignments[empId][day] = code;
    else delete board.assignments[empId][day];
    board.updatedAt = Date.now();
    await redis.set(hrKey.shiftBoard(tenant, ym), board);
    await redis.sadd(hrKey.shiftBoards(tenant), ym);
    return res.status(200).json({ ok: true, data: board.assignments[empId] });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
