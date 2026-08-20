import { useEffect, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#B23A48";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const thisYear = () => String(new Date().getFullYear());

export default function Gensen({ onBack }) {
  const { user } = useAuth();
  const [year] = useState(thisYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  async function fetchData(y) {
    const r = await fetch(`/api/payroll/gensen?year=${y}`, { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : null;
  }
  async function init() {
    setLoading(true);
    let d = await fetchData(year);
    if (user.company === "TEST" && (!d || d.count === 0)) {
      await fetch("/api/payroll/salary/seedyear", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ year }) });
      d = await fetchData(year);
    }
    setData(d);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  if (loading) return <div className="page"><p className="muted">読み込み中…</p></div>;
  if (!data || data.count === 0) {
    return (
      <div className="page ledger">
        <div className="ledger-top"><button className="back-btn" onClick={onBack}>← 労務管理</button><h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>源泉業務</h2></div>
        <div className="placeholder" style={{ borderColor: ACCENT }}><p><b>{year}年の源泉データがありません。</b></p><p className="muted">給与計算を実施すると源泉徴収簿に集計されます。</p></div>
      </div>
    );
  }

  const open = openId ? data.rows.find((r) => r.empId === openId) : null;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 労務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>源泉業務 {year}年</h2>
      </div>

      <div className="stat-pills">
        <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>年間源泉税 {yen(data.grandTotal)}</span>
        <span className="pill">対象 {data.count}名</span>
      </div>

      {/* 月次納付額（会社の源泉所得税） */}
      <div className="pb-label">月次の納付額（源泉所得税の合計）</div>
      <div className="gensen-months">
        {data.months.map((ym) => (
          <div key={ym} className="gm-cell">
            <span className="gm-ym">{ym.slice(5)}月</span>
            <span className="gm-v">{yen(data.monthlyTotal[ym] || 0)}</span>
          </div>
        ))}
      </div>

      {/* 社員別 源泉徴収簿 */}
      <div className="pb-label" style={{ marginTop: 16 }}>社員別 源泉徴収簿</div>
      <div className="cust-list">
        {data.rows.map((r) => (
          <button key={r.empId} className="cust-row" onClick={() => setOpenId(openId === r.empId ? null : r.empId)}>
            <div className="cust-main">
              <span className="cust-code">{r.code}</span>
              <span className="cust-name">{r.name}</span>
              <b style={{ marginLeft: "auto", color: ACCENT, fontFamily: "ui-monospace" }}>{yen(r.total)}</b>
            </div>
            <div className="cust-sub">給与源泉 {yen(r.salaryTax)}　賞与源泉 {yen(r.bonusTax)}</div>
            {open && open.empId === r.empId && (
              <div className="gensen-detail">
                {data.months.map((ym) => (
                  <div key={ym} className="gd-row"><span>{ym.slice(5)}月</span><span>{yen(r.months[ym] || 0)}</span></div>
                ))}
                {r.bonusTax > 0 && <div className="gd-row bonus"><span>賞与</span><span>{yen(r.bonusTax)}</span></div>}
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>※ 源泉所得税額は概算です。納期の特例や端数処理は実務に合わせて調整してください。</p>
    </div>
  );
}
