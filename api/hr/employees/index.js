// api/hr/employees/index.js ── 人事台帳：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireHr, hrKey, pad4 } from "../_guard.js";

const FIELDS = ["name","kana","gender","department","position","employmentType","joinDate","birthDate","email","phone","location","skills","qualifications","hobbies","bio","status"];
const ARRAYS = ["skills","qualifications"];

export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(hrKey.employees(tenant));
    const list = await mgetByIds(ids, (id) => hrKey.employee(tenant, id));
    list.sort((a, b) => a.code.localeCompare(b.code));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ ok: false, error: "missing_name" });

    const seq = await redis.incr(hrKey.seq(tenant));
    const id = `e${seq}`;
    const emp = { id, code: `EMP${pad4(seq)}`, createdAt: Date.now() };
    for (const f of FIELDS) {
      if (ARRAYS.includes(f)) emp[f] = Array.isArray(body[f]) ? body[f] : [];
      else emp[f] = body[f] ?? "";
    }
    if (!emp.status) emp.status = "在籍";
    if (!emp.employmentType) emp.employmentType = "正社員";

    await redis.set(hrKey.employee(tenant, id), emp);
    await redis.sadd(hrKey.employees(tenant), id);
    return res.status(200).json({ ok: true, data: emp });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
