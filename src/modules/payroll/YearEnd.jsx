import { useEffect, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#B23A48";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const thisYear = () => String(new Date().getFullYear());

export default function YearEnd({ onBack }) {
  const { user } = useAuth();
  const [year, setYear] = useState(thisYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  async function fetchYear(y) {
    const r = await fetch(`/api/payroll/nencho?year=${y}`, { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : null;
  }
  async function init() {
    setLoading(true);
    let d = await fetchYear(year);
    // デモ(TEST)：当年データが無ければ1年分を自動生成
    if (user.company === "TEST" && (!d || d.count === 0)) {
      await fetch("/api/payroll/salary/seedyear", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ year }) });
      d = await fetchYear(year);
    }
    setData(d);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  async function openDetail(empId) {
    const r = await fetch(`/api/payroll/nencho?year=${year}&empId=${empId}`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setDetail(j.data);
  }

  if (detail) return <YearEndDetail d={detail} onBack={() => setDetail(null)} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 労務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>年末調整 {year}年</h2>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : !data || data.count === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>{year}年の給与データがありません。</b></p>
          <p className="muted">給与計算を実施すると、その実績をもとに年末調整を計算します。</p>
        </div>
      ) : (
        <>
          <div className="pay-totals" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="pt-item"><span className="pt-l">還付 合計</span><span className="pt-v" style={{ color: "#0B6E52" }}>{yen(data.totalRefund)}</span></div>
            <div className="pt-item"><span className="pt-l">追徴 合計</span><span className="pt-v" style={{ color: "#B23A48" }}>{yen(data.totalCollect)}</span></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "0 0 12px" }}>{data.count}名・給与所得控除/基礎控除/扶養控除・復興特別所得税を反映した概算です。保険料控除等は未反映。</p>

          <div className="cust-list">
            {data.rows.map((r) => (
              <button key={r.empId} className="cust-row" onClick={() => openDetail(r.empId)}>
                <div className="cust-main">
                  <span className="cust-code">{r.code}</span>
                  <span className="cust-name">{r.name}</span>
                  <span className={"status " + (r.settlement >= 0 ? "st-active" : "st-low")} style={{ marginLeft: "auto" }}>
                    {r.settlement >= 0 ? `還付 ${yen(r.settlement)}` : `追徴 ${yen(-r.settlement)}`}
                  </span>
                </div>
                <div className="cust-sub">給与収入 {yen(r.salaryIncome)}　年税額 {yen(r.yearTax)}　源泉済 {yen(r.taxWithheld)}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function YearEndDetail({ d, onBack }) {
  const r = d.result;
  const Row = ({ l, v, sign }) => (
    <div className="ps-row"><span>{l}</span><span>{sign === "-" ? "− " : ""}{yen(v)}</span></div>
  );
  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{d.emp.name} の年末調整</h2>
      </div>
      <div className="payslip">
        <div className="ps-head"><div><b>{d.emp.name}</b> <span className="muted">{d.emp.code}・{d.emp.department}</span></div><div className="ps-ym">{d.year}年</div></div>
        <div className="ps-sec">課税所得の計算</div>
        <Row l="給与収入（年間総支給）" v={r.salaryIncome} />
        <Row l="給与所得控除" v={r.empDeduction} sign="-" />
        <div className="ps-row strong"><span>給与所得</span><span>{yen(r.incomeAfterEmp)}</span></div>
        <Row l="社会保険料控除" v={r.socialPaid} sign="-" />
        <Row l="基礎控除" v={r.basic} sign="-" />
        <Row l="扶養控除" v={r.dependentDeduction} sign="-" />
        <div className="ps-row strong"><span>課税所得</span><span>{yen(r.taxableIncome)}</span></div>
        <div className="ps-sec">税額と精算</div>
        <Row l="年税額（復興税込）" v={r.yearTax} />
        <Row l="源泉徴収済み" v={r.taxWithheld} />
        <div className="ps-net" style={{ background: r.settlement >= 0 ? "#0B6E52" : "#B23A48" }}>
          <span>{r.settlement >= 0 ? "還付額" : "追徴額"}</span>
          <span>{yen(Math.abs(r.settlement))}</span>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>※ 生命保険料控除・地震保険料控除・配偶者特別控除・住宅ローン控除等は未反映の概算です。</p>
    </div>
  );
}
