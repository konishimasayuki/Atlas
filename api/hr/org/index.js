// api/hr/org/index.js ── 組織図：一覧(GET) / 人事台帳から初期生成(POST init) / ノード追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireHr, hrKey } from "../_guard.js";

// node: { id, type: "company"|"dept"|"person", label, parentId, employeeId, order }
export default async function handler(req, res) {
  const ctx = await requireHr(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(hrKey.orgNodes(tenant));
    const list = ids.length ? await mgetByIds(ids, (id) => hrKey.orgNode(tenant, id)) : [];
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
    return res.status(200).json({ ok: true, data: list });
  }

  if (req.method === "POST") {
    const body = req.body || {};

    // 人事台帳の所属から初期ツリーを自動生成（既存があれば拒否）
    if (body.init) {
      const existing = await redis.scard(hrKey.orgNodes(tenant));
      if (existing > 0) return res.status(409).json({ ok: false, error: "already_exists" });

      const empIds = await redis.smembers(`atlas:${tenant}:hr:employees`);
      const employees = empIds.length ? await mgetByIds(empIds, (id) => `atlas:${tenant}:hr:employee:${id}`) : [];

      let seq = 0;
      const nextId = async () => { seq = await redis.incr(hrKey.orgSeq(tenant)); return `og${seq}`; };

      const rootId = await nextId();
      const root = { id: rootId, type: "company", label: "全社", parentId: null, employeeId: "", order: 0 };
      await redis.set(hrKey.orgNode(tenant, rootId), root);
      await redis.sadd(hrKey.orgNodes(tenant), rootId);

      const deptIds = {};
      const depts = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
      for (let i = 0; i < depts.length; i++) {
        const id = await nextId();
        const node = { id, type: "dept", label: depts[i], parentId: rootId, employeeId: "", order: i };
        await redis.set(hrKey.orgNode(tenant, id), node);
        await redis.sadd(hrKey.orgNodes(tenant), id);
        deptIds[depts[i]] = id;
      }
      let order = 0;
      for (const e of employees) {
        const id = await nextId();
        const node = { id, type: "person", label: `${e.name}（${e.position || "一般"}）`, parentId: deptIds[e.department] || rootId, employeeId: e.id, order: order++ };
        await redis.set(hrKey.orgNode(tenant, id), node);
        await redis.sadd(hrKey.orgNodes(tenant), id);
      }
      return res.status(200).json({ ok: true, data: { depts: depts.length, people: employees.length } });
    }

    // 個別ノード追加
    if (!body.label || !body.parentId) return res.status(400).json({ ok: false, error: "missing" });
    const seq = await redis.incr(hrKey.orgSeq(tenant));
    const id = `og${seq}`;
    const node = { id, type: body.type || "dept", label: body.label, parentId: body.parentId, employeeId: body.employeeId || "", order: Number(body.order) || 999 };
    await redis.set(hrKey.orgNode(tenant, id), node);
    await redis.sadd(hrKey.orgNodes(tenant), id);
    return res.status(200).json({ ok: true, data: node });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
