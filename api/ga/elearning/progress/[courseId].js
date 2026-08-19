// api/ga/elearning/progress/[courseId].js ── 受講進捗（ログイン中ユーザー×講座）
import { redis } from "../../../_lib/redis.js";
import { requireGa, gaKey } from "../../_guard.js";

export default async function handler(req, res) {
  const ctx = await requireGa(req, res);
  if (!ctx) return;
  const { tenant, me } = ctx;
  const { courseId } = req.query;
  const userId = me.id;

  const key = gaKey.progress(tenant, userId, courseId);

  if (req.method === "GET") {
    const p = await redis.get(key);
    return res.status(200).json({ ok: true, data: p || { courseId, doneLessons: [], quizScore: null, completed: false } });
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    const course = await redis.get(gaKey.course(tenant, courseId));
    if (!course) return res.status(404).json({ ok: false, error: "course_not_found" });

    const prev = (await redis.get(key)) || { courseId, doneLessons: [], quizScore: null, completed: false };
    const done = new Set(prev.doneLessons || []);

    if (body.completeLesson) done.add(body.completeLesson);
    if (Array.isArray(body.doneLessons)) for (const l of body.doneLessons) done.add(l);
    if (body.quizScore !== undefined) prev.quizScore = body.quizScore;

    const totalLessons = (course.lessons || []).length;
    const allLessonsDone = totalLessons > 0 && [...done].filter((l) => course.lessons.some((x) => x.id === l)).length >= totalLessons;
    const hasQuiz = (course.lessons || []).some((l) => (l.quiz || []).length > 0);
    // 完了条件：全レッスン完了（クイズがあれば合格点60%以上も必要）
    const quizOk = !hasQuiz || (prev.quizScore !== null && prev.quizScore >= 60);

    const next = {
      courseId,
      doneLessons: [...done],
      quizScore: prev.quizScore,
      completed: allLessonsDone && quizOk,
      updatedAt: Date.now(),
    };
    await redis.set(key, next);
    await redis.sadd(gaKey.userProgress(tenant, userId), courseId);
    return res.status(200).json({ ok: true, data: next });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
