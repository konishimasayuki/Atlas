import { useEffect, useState } from "react";
import Expenses from "./Expenses.jsx";

const FEATURES = [
  { id: "expenses", no: "1", label: "経費精算", desc: "申請・承認・立替精算（ガソリン自動計算）", ready: true },
  { id: "journal",  no: "2", label: "仕訳・帳簿", desc: "仕訳入力・元帳・試算表（近日）", ready: false },
  { id: "financial",no: "3", label: "財務三表", desc: "B/S・P/L・C/F（近日）", ready: false },
  { id: "cash",     no: "4", label: "資金繰り", desc: "資金繰り表・予算（近日）", ready: false },
];

const ACCENT = "#0B6E52";

export default function AccountingModule() {
  const [view, setView] = useState("dashboard");
  const [pending, setPending] = useState(null);

  async function loadPending() {
    try {
      const r = await fetch("/api/accounting/expenses", { credentials: "include" });
      const j = await r.json();
      setPending(j.ok ? j.data.filter((e) => e.status === "申請中").length : 0);
    } catch { setPending(0); }
  }
  useEffect(() => { loadPending(); }, []);

  if (view === "expenses") return <Expenses onBack={() => { setView("dashboard"); loadPending(); }} />;

  return (
    <div className="page mod-dash">
      <h2 className="page-h" style={{ color: ACCENT }}>③ 会計管理</h2>
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
            {f.id === "expenses" && pending !== null && pending > 0 && (
              <span className="feat-badge">未承認 {pending}</span>
            )}
            {!f.ready && <span className="feat-soon">近日</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
