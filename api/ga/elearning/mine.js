// api/ga/elearning/mine.js ── ログイン中ユーザーの全講座進捗（一覧画面のバッジ用）
import { redis } from "../../_lib/redis.js";
import { requireGa, gaKey } from "../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });

  const ids = await redis.smembers(gaKey.userProgress(tenant, me.id));
  const map = {};
  if (ids.length) {
    const vals = await redis.mget(...ids.map((cid) => gaKey.progress(tenant, me.id, cid)));
    vals.forEach((p) => { if (p) map[p.courseId] = { doneLessons: (p.doneLessons || []).length, completed: !!p.completed, quizScore: p.quizScore }; });
  }
  return res.status(200).json({ ok: true, data: map });
}
