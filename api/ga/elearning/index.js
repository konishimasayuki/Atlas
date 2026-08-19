// api/ga/elearning/index.js ── 講座：一覧(GET) / 追加(POST)
import { redis } from "../../_lib/redis.js";
import { mgetByIds } from "../../_lib/core.js";
import { requireGa, gaKey, pad4 } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant } = ctx;

  if (req.method === "GET") {
    const ids = await redis.smembers(gaKey.courses(tenant));
    const list = await mgetByIds(ids, (id) => gaKey.course(tenant, id));
    // 一覧は本文を省いて軽く（category, title, レッスン数など）
    const light = list.map((c) => ({
      id: c.id, code: c.code, category: c.category, title: c.title,
      description: c.description, level: c.level,
      lessonCount: (c.lessons || []).length,
      hasQuiz: (c.lessons || []).some((l) => (l.quiz || []).length > 0),
    }));
    light.sort((a, b) => (a.category + a.code).localeCompare(b.category + b.code));
    return res.status(200).json({ ok: true, data: light });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.title) return res.status(400).json({ ok: false, error: "missing_title" });
    const seq = await redis.incr(gaKey.courseSeq(tenant));
    const id = `crs${seq}`;
    const course = {
      id, code: `C${pad4(seq)}`,
      category: body.category || "その他",
      title: body.title,
      description: body.description || "",
      level: body.level || "初級",
      lessons: Array.isArray(body.lessons) ? body.lessons : [],
      createdAt: Date.now(),
    };
    await redis.set(gaKey.course(tenant, id), course);
    await redis.sadd(gaKey.courses(tenant), id);
    return res.status(200).json({ ok: true, data: course });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
