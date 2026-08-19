import { useState } from "react";
import PayrollSettings from "./PayrollSettings.jsx";
import SalaryRun from "./SalaryRun.jsx";
import BonusRun from "./BonusRun.jsx";

const FEATURES = [
  { id: "settings", no: "1", label: "給与設定", desc: "各人の基本給・手当・控除・社保（人事台帳ベース）", ready: true },
  { id: "salary",   no: "2", label: "給与計算", desc: "月次給与・給与明細・手取り計算", ready: true },
  { id: "bonus",    no: "3", label: "賞与計算", desc: "賞与の社保・源泉・手取り計算", ready: true },
  { id: "nencho",   no: "4", label: "年末調整", desc: "年間精算・過不足（近日）", ready: false },
  { id: "gensen",   no: "5", label: "源泉業務", desc: "源泉徴収簿・納付集計（近日）", ready: false },
];

const ACCENT = "#B23A48";

export default function PayrollModule() {
  const [view, setView] = useState("dashboard");
  if (view === "settings") return <PayrollSettings onBack={() => setView("dashboard")} />;
  if (view === "salary") return <SalaryRun onBack={() => setView("dashboard")} />;
  if (view === "bonus") return <BonusRun onBack={() => setView("dashboard")} />;

  return (
    <div className="page mod-dash">
      <h2 className="page-h" style={{ color: ACCENT }}>④ 労務管理</h2>
      <p className="mod-dash-sub">計算対象は人事台帳の社員です。まず「給与設定」で各人の基本給などを設定します。</p>
      <div className="feat-grid">
        {FEATURES.map((f) => (
          <button key={f.id} className={"feat-card" + (f.ready ? "" : " soon")} style={{ "--fc": ACCENT }}
            disabled={!f.ready} onClick={() => f.ready && setView(f.id)}>
            <span className="feat-no">{f.no}</span>
            <span className="feat-body">
              <span className="feat-label">{f.label}</span>
              <span className="feat-desc">{f.desc}</span>
            </span>
            {!f.ready && <span className="feat-soon">近日</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
