import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#6A34A0";

export default function StressCheck({ onBack }) {
  const { user } = useAuth();
  const [state, setState] = useState(null); // { round, mine, summary, isApprover }
  const [loading, setLoading] = useState(true);
  const [taking, setTaking] = useState(false);

  async function load() {
    const r = await fetch("/api/hr/stresscheck", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : null;
  }
  async function init() {
    setLoading(true);
    // デモ(TEST)は集計が空なら受検済みデータを自動投入
    let d = await load();
    if (user.company === "TEST" && d?.isApprover && d?.summary?.doneCount === 0) {
      await fetch("/api/hr/stresscheck/seed", { method: "POST", credentials: "include" });
      d = await load();
    }
    setState(d);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  if (loading) return <div className="page"><p className="muted">読み込み中…</p></div>;
  if (taking) return <Survey round={state.round} onBack={() => { setTaking(false); init(); }} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 人事管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>ストレスチェック</h2>
        <span className="pill" style={{ marginLeft: "auto" }}>{state.round} 実施回</span>
      </div>

      {/* 自分の受検状況 */}
      <div className="sc-self">
        {state.mine ? (
          <>
            <div className="sc-self-head">あなたの受検結果</div>
            <ScoreBars score={state.mine.score} />
            <div className={"sc-verdict " + (state.mine.score.highStress ? "high" : "ok")}>
              {state.mine.score.highStress
                ? "高ストレスの傾向があります。産業医・相談窓口の面談をおすすめします。"
                : "現在のところ、ストレスは高くない状態です。"}
            </div>
          </>
        ) : (
          <>
            <div className="sc-self-head">あなたはまだ受検していません</div>
            <p className="muted" style={{ fontSize: 13 }}>22問・約3分。回答内容は本人と人事管理者のみが確認できます。</p>
            <button className="btn-primary" style={{ background: ACCENT, width: "auto", marginTop: 8 }} onClick={() => setTaking(true)}>受検する</button>
          </>
        )}
      </div>

      {/* 管理者向け集計 */}
      {state.isApprover && state.summary && <AdminSummary s={state.summary} />}
    </div>
  );
}

function ScoreBars({ score }) {
  const rows = [
    { k: "仕事の負担 (A)", v: score.A },
    { k: "心身の反応 (B)", v: score.B },
    { k: "サポート不足 (C)", v: score.C },
  ];
  const color = (v) => v >= 63 ? "#B23A48" : v >= 45 ? "#9A5A0B" : "#0B6E52";
  return (
    <div className="sc-bars">
      {rows.map((r) => (
        <div key={r.k} className="sc-bar-row">
          <span className="sc-bar-label">{r.k}</span>
          <span className="sc-bar-track"><span className="sc-bar-fill" style={{ width: r.v + "%", background: color(r.v) }} /></span>
          <span className="sc-bar-val" style={{ color: color(r.v) }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function AdminSummary({ s }) {
  return (
    <div className="sc-admin">
      <div className="pb-label" style={{ marginTop: 18 }}>全社集計（管理者のみ）</div>
      <div className="sc-kpis">
        <div className="sc-kpi"><span className="sk-v">{s.rate}%</span><span className="sk-l">受検率<br/>{s.doneCount}/{s.targetCount}人</span></div>
        <div className="sc-kpi warn"><span className="sk-v">{s.highStressCount}</span><span className="sk-l">高ストレス者</span></div>
        <div className="sc-kpi"><span className="sk-v">{s.avgB}</span><span className="sk-l">心身反応<br/>平均</span></div>
      </div>

      <div className="sc-dept">
        <div className="pb-label">部署別 受検率</div>
        {Object.entries(s.byDept).map(([d, v]) => (
          <div key={d} className="sc-dept-row">
            <span className="sc-dept-name">{d}</span>
            <span className="sc-bar-track"><span className="sc-bar-fill" style={{ width: (v.total ? (v.done / v.total) * 100 : 0) + "%", background: ACCENT }} /></span>
            <span className="sc-dept-val">{v.done}/{v.total}</span>
          </div>
        ))}
      </div>

      {s.highList.length > 0 && (
        <div className="sc-high">
          <div className="pb-label">要フォロー（高ストレス者）</div>
          {s.highList.map((h) => (
            <div key={h.empId} className="sc-high-row">
              <span className="cust-name">{h.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{h.department}</span>
              <span className="status st-low" style={{ marginLeft: "auto" }}>B {h.score.B}</span>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>※ 高ストレス者への対応は、産業医面談の案内など適切な手続きに従ってください。個人結果の取り扱いには十分ご注意ください。</p>
        </div>
      )}
    </div>
  );
}

// ---- 受検フォーム ----
function Survey({ round, onBack }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/hr/stresscheck?questions=1", { credentials: "include" });
      const j = await r.json();
      if (j.ok) setData(j.data);
    })();
  }, []);

  if (!data) return <div className="page"><p className="muted">読み込み中…</p></div>;

  const areas = { A: "Ⅰ. あなたの仕事について", B: "Ⅱ. 最近1か月のあなたの状態", C: "Ⅲ. 周りの方々について" };
  const byArea = { A: [], B: [], C: [] };
  for (const q of data.questions) byArea[q.area].push(q);
  const answered = Object.keys(answers).length;
  const allDone = answered >= data.questions.length;

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/hr/stresscheck/submit", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ round, answers }) });
    const j = await r.json(); setBusy(false);
    if (j.ok) setResult(j.data.score);
  }

  if (result) {
    return (
      <div className="page ledger">
        <div className="ledger-top"><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>受検完了</h2></div>
        <div className="sc-self">
          <div className="sc-self-head">あなたの結果</div>
          <ScoreBars score={result} />
          <div className={"sc-verdict " + (result.highStress ? "high" : "ok")}>
            {result.highStress ? "高ストレスの傾向があります。相談窓口の利用をおすすめします。" : "ストレスは高くない状態です。"}
          </div>
          <button className="btn-primary" style={{ background: ACCENT, width: "auto", marginTop: 12 }} onClick={onBack}>閉じる</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 戻る</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>ストレスチェック 受検</h2>
        <span className="pill" style={{ marginLeft: "auto" }}>{answered}/{data.questions.length}</span>
      </div>

      {["A", "B", "C"].map((area) => (
        <div key={area} className="sc-section">
          <div className="sc-section-h">{areas[area]}</div>
          {byArea[area].map((q, qi) => (
            <div key={q.id} className="sc-q">
              <div className="sc-q-text">{q.text}</div>
              <div className="sc-choices">
                {data.choices[area].map((label, ci) => (
                  <label key={ci} className={"sc-choice" + (answers[q.id] === ci + 1 ? " on" : "")}>
                    <input type="radio" name={q.id} checked={answers[q.id] === ci + 1} onChange={() => setAnswers((p) => ({ ...p, [q.id]: ci + 1 }))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="st-actions">
        <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !allDone} onClick={submit}>
          {busy ? "送信中…" : allDone ? "回答を送信する" : `残り ${data.questions.length - answered} 問`}
        </button>
      </div>
    </div>
  );
}
