import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#2A6F8E";
const CAT_COLORS = { "会計": "#0B6E52", "Excel": "#1657B0", "ビジネスマナー": "#9A5A0B", "情報セキュリティ": "#B23A48", "その他": "#6A34A0" };
const catColor = (c) => CAT_COLORS[c] || "#2A6F8E";

export default function Elearning({ onBack }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [mine, setMine] = useState({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [cat, setCat] = useState("すべて");

  async function fetchCourses() {
    const r = await fetch("/api/ga/elearning", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function fetchMine() {
    const r = await fetch("/api/ga/elearning/mine", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : {};
  }
  async function init() {
    setLoading(true);
    let list = await fetchCourses();
    if (list.length === 0 && user.company === "TEST") {
      await fetch("/api/ga/elearning/seed", { method: "POST", credentials: "include" });
      list = await fetchCourses();
    }
    setCourses(list);
    setMine(await fetchMine());
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function refresh() { setCourses(await fetchCourses()); setMine(await fetchMine()); }

  const cats = useMemo(() => ["すべて", ...Array.from(new Set(courses.map((c) => c.category)))], [courses]);
  const filtered = useMemo(() => cat === "すべて" ? courses : courses.filter((c) => c.category === cat), [courses, cat]);
  const doneCount = useMemo(() => Object.values(mine).filter((p) => p.completed).length, [mine]);

  if (openId) {
    return <CoursePlayer courseId={openId} onBack={() => { setOpenId(null); refresh(); }} />;
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 総務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>eラーニング</h2>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : courses.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>講座がまだありません。</b></p>
          <button className="btn-primary sm" style={{ background: ACCENT, marginTop: 10 }}
            onClick={async () => { await fetch("/api/ga/elearning/seed", { method: "POST", credentials: "include" }); refresh(); }}>
            サンプル講座を投入
          </button>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>全 {courses.length} 講座</span>
            <span className="pill active">修了 {doneCount}</span>
          </div>
          <div className="tabs">
            {cats.map((c) => (
              <button key={c} className={"tab" + (cat === c ? " on" : "")} onClick={() => setCat(c)}
                style={cat === c ? { background: catColor(c === "すべて" ? "その他" : c), borderColor: catColor(c === "すべて" ? "その他" : c) } : undefined}>{c}</button>
            ))}
          </div>

          <div className="course-grid">
            {filtered.map((c) => {
              const p = mine[c.id];
              const pct = p && c.lessonCount ? Math.round((p.doneLessons / c.lessonCount) * 100) : 0;
              return (
                <button key={c.id} className="course-card" style={{ "--cc": catColor(c.category) }} onClick={() => setOpenId(c.id)}>
                  <div className="course-top">
                    <span className="course-cat">{c.category}</span>
                    <span className="course-level">{c.level}</span>
                    {p?.completed && <span className="course-done">✓ 修了</span>}
                  </div>
                  <div className="course-title">{c.title}</div>
                  <div className="course-desc">{c.description}</div>
                  <div className="course-meta">
                    <span>{c.lessonCount}レッスン{c.hasQuiz ? "・確認テスト" : ""}</span>
                  </div>
                  <div className="prog-bar"><span className="prog-fill" style={{ width: pct + "%" }} /></div>
                  <div className="prog-label">{pct}%</div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CoursePlayer({ courseId, onBack }) {
  const [course, setCourse] = useState(null);
  const [prog, setProg] = useState({ doneLessons: [], quizScore: null, completed: false });
  const [idx, setIdx] = useState(0);        // 現在のレッスン
  const [mode, setMode] = useState("lesson"); // lesson | quiz
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  async function load() {
    const cr = await fetch(`/api/ga/elearning/${courseId}`, { credentials: "include" });
    const cj = await cr.json();
    if (cj.ok) setCourse(cj.data);
    const pr = await fetch(`/api/ga/elearning/progress/${courseId}`, { credentials: "include" });
    const pj = await pr.json();
    if (pj.ok) setProg(pj.data);
  }
  useEffect(() => { load(); }, []);

  if (!course) return <div className="page"><p className="muted">読み込み中…</p></div>;

  const lessons = course.lessons || [];
  const lesson = lessons[idx];
  const done = new Set(prog.doneLessons || []);
  const allQuiz = lessons.flatMap((l) => (l.quiz || []).map((q) => ({ ...q, lessonTitle: l.title })));

  async function completeLesson() {
    const r = await fetch(`/api/ga/elearning/progress/${courseId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ completeLesson: lesson.id }),
    });
    const j = await r.json();
    if (j.ok) setProg(j.data);
    if (idx < lessons.length - 1) setIdx(idx + 1);
    else if (allQuiz.length > 0) setMode("quiz");
  }

  async function submitQuiz() {
    let correct = 0;
    allQuiz.forEach((q, i) => { if (answers[i] === q.answer) correct++; });
    const score = Math.round((correct / allQuiz.length) * 100);
    setResult({ correct, total: allQuiz.length, score });
    const r = await fetch(`/api/ga/elearning/progress/${courseId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ quizScore: score, doneLessons: lessons.map((l) => l.id) }),
    });
    const j = await r.json();
    if (j.ok) setProg(j.data);
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: catColor(course.category), margin: 0 }}>{course.title}</h2>
        {prog.completed && <span className="course-done" style={{ marginLeft: "auto" }}>✓ 修了</span>}
      </div>

      {/* レッスンのステップ */}
      <div className="lesson-steps">
        {lessons.map((l, i) => (
          <button key={l.id} className={"step-dot" + (i === idx && mode === "lesson" ? " cur" : "") + (done.has(l.id) ? " done" : "")}
            onClick={() => { setMode("lesson"); setIdx(i); }}>{i + 1}</button>
        ))}
        {allQuiz.length > 0 && (
          <button className={"step-dot quiz" + (mode === "quiz" ? " cur" : "")} onClick={() => setMode("quiz")}>テスト</button>
        )}
      </div>

      {mode === "lesson" ? (
        <div className="lesson-body">
          <h3 className="lesson-title">{idx + 1}. {lesson.title}</h3>
          {lesson.video && (
            <a className="lesson-video" href={lesson.video} target="_blank" rel="noreferrer">▶ 動画を見る（別ウィンドウ）</a>
          )}
          <p className="lesson-text">{lesson.body}</p>
          <div className="lesson-nav">
            <button className="btn-ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>前へ</button>
            <button className="btn-primary" style={{ background: catColor(course.category) }} onClick={completeLesson}>
              {idx < lessons.length - 1 ? "完了して次へ" : (allQuiz.length > 0 ? "完了してテストへ" : "完了")}
            </button>
          </div>
        </div>
      ) : (
        <div className="quiz-body">
          {result ? (
            <div className={"quiz-result " + (result.score >= 60 ? "pass" : "fail")}>
              <div className="qr-score">{result.score}<small>点</small></div>
              <div>{result.correct} / {result.total} 正解 — {result.score >= 60 ? "合格！修了しました" : "60点以上で合格です。復習して再挑戦しましょう"}</div>
              <div className="lesson-nav" style={{ justifyContent: "center", marginTop: 14 }}>
                {result.score < 60 && <button className="btn-ghost" onClick={() => { setResult(null); setAnswers({}); setMode("lesson"); setIdx(0); }}>復習する</button>}
                <button className="btn-primary" style={{ background: catColor(course.category) }} onClick={onBack}>一覧へ戻る</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="lesson-title">確認テスト（{allQuiz.length}問・60点で合格）</h3>
              {allQuiz.map((q, i) => (
                <div key={i} className="quiz-q">
                  <div className="qq">Q{i + 1}. {q.q}</div>
                  <div className="qq-choices">
                    {q.choices.map((ch, ci) => (
                      <label key={ci} className={"qq-choice" + (answers[i] === ci ? " on" : "")}>
                        <input type="radio" name={"q" + i} checked={answers[i] === ci} onChange={() => setAnswers((p) => ({ ...p, [i]: ci }))} />
                        <span>{ch}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="lesson-nav">
                <span style={{ flex: 1 }} />
                <button className="btn-primary" style={{ background: catColor(course.category) }}
                  disabled={Object.keys(answers).length < allQuiz.length} onClick={submitQuiz}>採点する</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
