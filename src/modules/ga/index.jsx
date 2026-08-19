import { useEffect, useState } from "react";
import Elearning from "./Elearning.jsx";
import AssetLedger from "./AssetLedger.jsx";

const FEATURES = [
  { id: "elearning", no: "1", label: "eラーニング", desc: "分野別の教材で学習・進捗管理", ready: true },
  { id: "contract",  no: "2", label: "電子契約", desc: "契約の電子化・締結管理（近日）", ready: false },
  { id: "legal",     no: "3", label: "リーガルチェック", desc: "契約書レビュー補助（近日）", ready: false },
  { id: "asset",     no: "4", label: "資産・備品管理", desc: "備品台帳・付番・保管/使用者・減価償却目安", ready: true },
];

const ACCENT = "#2A6F8E";

export default function GaModule() {
  const [view, setView] = useState("dashboard");
  const [count, setCount] = useState(null);

  async function loadCount() {
    try {
      const r = await fetch("/api/ga/elearning", { credentials: "include" });
      const j = await r.json();
      setCount(j.ok ? j.data.length : 0);
    } catch { setCount(0); }
  }
  useEffect(() => { loadCount(); }, []);

  if (view === "elearning") return <Elearning onBack={() => { setView("dashboard"); loadCount(); }} />;
  if (view === "asset") return <AssetLedger onBack={() => setView("dashboard")} />;

  return (
    <div className="page mod-dash">
      <h2 className="page-h" style={{ color: ACCENT }}>⑥ 総務管理</h2>
      <p className="mod-dash-sub">使う機能を選んでください。</p>
      <div className="feat-grid">
        {FEATURES.map((f) => (
          <button key={f.id} className={"feat-card" + (f.ready ? "" : " soon")} style={{ "--fc": ACCENT }}
            disabled={!f.ready} onClick={() => f.ready && setView(f.id)}>
            <span className="feat-no">{f.no}</span>
            <span className="feat-body">
              <span className="feat-label">{f.label}</span>
              <span className="feat-desc">{f.desc}</span>
            </span>
            {f.id === "elearning" && count !== null && (
              <span className="feat-count" style={{ color: ACCENT }}>{count}<small>講座</small></span>
            )}
            {!f.ready && <span className="feat-soon">近日</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
