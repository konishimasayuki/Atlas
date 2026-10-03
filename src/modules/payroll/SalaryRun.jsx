import { useEffect, useMemo, useState } from "react";
import PrintDoc, { yenP } from "../../shared/print/PrintDoc.jsx";

const ACCENT = "#B23A48";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();

function thisYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalaryRun({ onBack }) {
  const [ym, setYm] = useState(thisYm());
  const [runs, setRuns] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [slip, setSlip] = useState(null);

  async function loadRuns() {
    const r = await fetch("/api/payroll/salary", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function loadMonth(m) {
    const r = await fetch(`/api/payroll/salary?ym=${m}`, { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : null;
  }
  async function init() {
    setLoading(true);
    const rs = await loadRuns();
    setRuns(rs);
    const target = rs.includes(ym) ? ym : (rs[0] || ym);
    setYm(target);
    setData(rs.length ? await loadMonth(target) : null);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  async function selectMonth(m) { setYm(m); setData(await loadMonth(m)); }

  async function run() {
    setRunning(true);
    await fetch("/api/payroll/salary", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ym }) });
    const rs = await loadRuns(); setRuns(rs);
    setData(await loadMonth(ym));
    setRunning(false);
  }

  if (slip) return <Payslip slip={slip} onBack={() => setSlip(null)} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 労務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>給与計算</h2>
      </div>

      <div className="pay-runbar">
        <label className="fld" style={{ margin: 0 }}><span>対象年月</span>
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></label>
        <button className="btn-primary" style={{ background: ACCENT, width: "auto" }} disabled={running} onClick={run}>
          {running ? "計算中…" : (data && data.ym === ym ? "再計算" : "この月を計算")}
        </button>
      </div>
      {runs.length > 0 && (
        <div className="tabs">
          {runs.map((m) => (
            <button key={m} className={"tab" + (m === ym ? " on" : "")} onClick={() => selectMonth(m)}
              style={m === ym ? { background: ACCENT, borderColor: ACCENT } : undefined}>{m}</button>
          ))}
        </div>
      )}

      {loading ? <p className="muted">読み込み中…</p> : !data || data.count === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>{ym} の給与はまだ計算されていません。</b></p>
          <p className="muted">「この月を計算」を押すと、給与設定済みの社員の給与を計算します。</p>
        </div>
      ) : (
        <>
          <div className="pay-totals">
            <div className="pt-item"><span className="pt-l">総支給</span><span className="pt-v">{yen(data.totals.gross)}</span></div>
            <div className="pt-item"><span className="pt-l">社会保険</span><span className="pt-v">{yen(data.totals.social)}</span></div>
            <div className="pt-item"><span className="pt-l">源泉所得税</span><span className="pt-v">{yen(data.totals.tax)}</span></div>
            <div className="pt-item net"><span className="pt-l">差引支給計</span><span className="pt-v">{yen(data.totals.net)}</span></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "0 0 12px" }}>{data.count}名・社保料率と源泉所得税は概算です。</p>

          <div className="cust-list">
            {data.slips.map((s) => (
              <button key={s.empId} className="cust-row" onClick={() => setSlip(s)}>
                <div className="cust-main">
                  <span className="cust-code">{s.code}</span>
                  <span className="cust-name">{s.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{s.department}・{s.position}</span>
                </div>
                <div className="cust-sub">
                  総支給 {yen(s.calc.gross)}　控除 {yen(s.calc.deductionTotal)}　<b style={{ color: ACCENT }}>手取り {yen(s.calc.net)}</b>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Payslip({ slip, onBack }) {
  const c = slip.calc;
  const [printing, setPrinting] = useState(false);
  const Row = ({ l, v, strong }) => (
    <div className={"ps-row" + (strong ? " strong" : "")}><span>{l}</span><span>{yen(v)}</span></div>
  );
  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>給与明細</h2>
        <button className="btn-primary sm" style={{ background: ACCENT, marginLeft: "auto" }} onClick={() => setPrinting(true)}>PDF出力</button>
      </div>
      {printing && (
        <PrintDoc title="給与明細書" to={`${slip.name} 様`} seal={false}
          meta={[["対象年月", slip.ym], ["社員番号", slip.code], ["所属", `${slip.department}・${slip.position}`]]}
          fileName={`給与明細_${slip.ym}_${slip.name}`} onClose={() => setPrinting(false)}>
          <div className="pd-2col">
            <table className="pd-table">
              <thead><tr><th colSpan={2}>支給</th></tr></thead>
              <tbody>
                <tr><td>基本給</td><td className="num">{yenP(c.base)}</td></tr>
                {c.posA > 0 && <tr><td>役職手当</td><td className="num">{yenP(c.posA)}</td></tr>}
                {c.otherA > 0 && <tr><td>その他手当</td><td className="num">{yenP(c.otherA)}</td></tr>}
                {c.commute > 0 && <tr><td>通勤手当（非課税）</td><td className="num">{yenP(c.commute)}</td></tr>}
                <tr className="sum"><td>総支給額</td><td className="num">{yenP(c.gross)}</td></tr>
              </tbody>
            </table>
            <table className="pd-table">
              <thead><tr><th colSpan={2}>控除</th></tr></thead>
              <tbody>
                <tr><td>健康保険</td><td className="num">{yenP(c.health)}</td></tr>
                {c.nursing > 0 && <tr><td>介護保険</td><td className="num">{yenP(c.nursing)}</td></tr>}
                <tr><td>厚生年金</td><td className="num">{yenP(c.pension)}</td></tr>
                <tr><td>雇用保険</td><td className="num">{yenP(c.employment)}</td></tr>
                <tr><td>源泉所得税</td><td className="num">{yenP(c.incomeTax)}</td></tr>
                <tr><td>住民税</td><td className="num">{yenP(c.residentTax)}</td></tr>
                <tr className="sum"><td>控除合計</td><td className="num">{yenP(c.deductionTotal)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="pd-grand"><span>差引支給額</span><span>{yenP(c.net)}</span></div>
        </PrintDoc>
      )}
      <div className="payslip">
        <div className="ps-head">
          <div><b>{slip.name}</b>　<span className="muted">{slip.code}・{slip.department}・{slip.position}</span></div>
          <div className="ps-ym">{slip.ym}</div>
        </div>
        <div className="ps-sec">支給</div>
        <Row l="基本給" v={c.base} />
        {c.posA > 0 && <Row l="役職手当" v={c.posA} />}
        {c.otherA > 0 && <Row l="その他手当" v={c.otherA} />}
        {c.commute > 0 && <Row l="通勤手当（非課税）" v={c.commute} />}
        <Row l="総支給額" v={c.gross} strong />
        <div className="ps-sec">控除</div>
        <Row l="健康保険" v={c.health} />
        {c.nursing > 0 && <Row l="介護保険" v={c.nursing} />}
        <Row l="厚生年金" v={c.pension} />
        <Row l="雇用保険" v={c.employment} />
        <Row l="源泉所得税" v={c.incomeTax} />
        <Row l="住民税" v={c.residentTax} />
        <Row l="控除合計" v={c.deductionTotal} strong />
        <div className="ps-net"><span>差引支給額（手取り）</span><span>{yen(c.net)}</span></div>
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>※ 社会保険料・源泉所得税は概算です。正式な計算は協会けんぽ料率・源泉徴収税額表に基づいて行ってください。</p>
    </div>
  );
}
