import { useEffect, useState } from "react";
import EmployeeBook from "./EmployeeBook.jsx";
import StressCheck from "./StressCheck.jsx";

const FEATURES = [
  { id: "book",   no: "1", label: "人事台帳", desc: "社員プロフィール・スキルの管理", ready: true },
  { id: "attend", no: "2", label: "勤怠・シフト", desc: "打刻・シフト・36協定（近日）", ready: false },
  { id: "stress", no: "3", label: "AIストレスチェック", desc: "受検・AI分析・高ストレス者判定・組織提言", ready: true },
  { id: "org",    no: "4", label: "組織図", desc: "部署・役割の可視化（近日）", ready: false },
];

const ACCENT = "#6A34A0";

export default function HrModule() {
  const [view, setView] = useState("dashboard");
  const [count, setCount] = useState(null);

  async function loadCount() {
    try {
      const r = await fetch("/api/hr/employees", { credentials: "include" });
      const j = await r.json();
      setCount(j.ok ? j.data.length : 0);
    } catch {
      setCount(0);
    }
  }
  useEffect(() => { loadCount(); }, []);

  if (view === "book") {
    return <EmployeeBook onBack={() => { setView("dashboard"); loadCount(); }} />;
  }
  if (view === "stress") {
    return <StressCheck onBack={() => setView("dashboard")} />;
  }

  return (
    <div className="page mod-dash">
      <h2 className="page-h" style={{ color: ACCENT }}>⑤ 人事管理</h2>
      <p className="mod-dash-sub">使う機能を選んでください。</p>
      <div className="feat-grid">
        {FEATURES.map((f) => (
          <button
            key={f.id}
            className={"feat-card" + (f.ready ? "" : " soon")}
            style={{ "--fc": ACCENT }}
            disabled={!f.ready}
            onClick={() => f.ready && setView(f.id)}
          >
            <span className="feat-no">{f.no}</span>
            <span className="feat-body">
              <span className="feat-label">{f.label}</span>
              <span className="feat-desc">{f.desc}</span>
            </span>
            {f.id === "book" && count !== null && (
              <span className="feat-count" style={{ color: ACCENT }}>{count}<small>人</small></span>
            )}
            {!f.ready && <span className="feat-soon">近日</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
