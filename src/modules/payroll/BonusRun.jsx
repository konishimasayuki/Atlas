import { useEffect, useMemo, useState } from "react";

const ACCENT = "#B23A48";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();

export default function BonusRun({ onBack }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openBid, setOpenBid] = useState(null);

  async function load() {
    const r = await fetch("/api/payroll/bonus", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() { setLoading(true); setRuns(await load()); setLoading(false); }
  useEffect(() => { init(); }, []);

  if (creating) return <BonusEditor onBack={() => { setCreating(false); init(); }} />;
  if (openBid) return <BonusDetail bid={openBid} onBack={() => setOpenBid(null)} />;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 労務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>賞与計算</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={() => setCreating(true)}>＋ 賞与を計算</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : runs.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>賞与の記録がありません。</b></p>
          <p className="muted">「＋ 賞与を計算」から、対象者と支給額を入力します。</p>
        </div>
      ) : (
        <div className="cust-list">
          {runs.map((r) => (
            <button key={r.bid} className="cust-row" onClick={() => setOpenBid(r.bid)}>
              <div className="cust-main"><span className="cust-name">{r.label}</span>{r.ym && <span className="muted" style={{ fontSize: 12 }}>{r.ym}</span>}</div>
              <div className="cust-sub">対象 {r.count} 名</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BonusEditor({ onBack }) {
  const [label, setLabel] = useState("");
  const [ym, setYm] = useState("");
  const [rows, setRows] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/payroll/settings", { credentials: "include" });
      const j = await r.json();
      const data = j.ok ? j.data.filter((x) => x.setting) : [];
      setRows(data);
      // 初期値：基本給×1ヶ月を提案
      const init = {};
      for (const x of data) init[x.empId] = x.setting.base || 0;
      setAmounts(init);
      setLoading(false);
    })();
  }, []);

  const total = useMemo(() => Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0), [amounts]);

  async function save() {
    setBusy(true);
    await fetch("/api/payroll/bonus", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ label: label || "賞与", ym, amounts }) });
    setBusy(false);
    onBack();
  }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>賞与を計算</h2>
      </div>
      <div className="form2">
        <label className="fld"><span>名称</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="夏季賞与 など" /></label>
        <label className="fld"><span>支給年月</span><input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></label>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : (
        <>
          <p className="muted" style={{ fontSize: 12 }}>支給額を入力（初期値は基本給1ヶ月分）。0の人は対象外になります。</p>
          <div className="cust-list">
            {rows.map((r) => (
              <div key={r.empId} className="bonus-row">
                <div className="bonus-info"><span className="cust-code">{r.code}</span>{r.name}<small className="muted"> {r.department}</small></div>
                <input className="st-input" inputMode="numeric" value={amounts[r.empId] ?? ""} onChange={(e) => setAmounts((p) => ({ ...p, [r.empId]: e.target.value.replace(/[^0-9]/g, "") }))} />
              </div>
            ))}
          </div>
          <div className="exp-total">支給総額 <b>{yen(total)}</b></div>
          <div className="st-actions">
            <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || total === 0} onClick={save}>{busy ? "計算中…" : "賞与を計算して保存"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function BonusDetail({ bid, onBack }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/payroll/bonus?bid=${bid}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) setData(j.data);
    })();
  }, [bid]);
  if (!data) return <div className="page"><p className="muted">読み込み中…</p></div>;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 一覧</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>{data.run?.label || "賞与"}</h2>
      </div>
      <div className="pay-totals">
        <div className="pt-item"><span className="pt-l">支給総額</span><span className="pt-v">{yen(data.totals.gross)}</span></div>
        <div className="pt-item"><span className="pt-l">社会保険</span><span className="pt-v">{yen(data.totals.social)}</span></div>
        <div className="pt-item"><span className="pt-l">源泉所得税</span><span className="pt-v">{yen(data.totals.tax)}</span></div>
        <div className="pt-item net"><span className="pt-l">差引支給計</span><span className="pt-v">{yen(data.totals.net)}</span></div>
      </div>
      <div className="cust-list">
        {data.rows.map((r) => (
          <div key={r.empId} className="cust-row" style={{ cursor: "default" }}>
            <div className="cust-main"><span className="cust-code">{r.code}</span><span className="cust-name">{r.name}</span></div>
            <div className="cust-sub">支給 {yen(r.calc.gross)}　社保 {yen(r.calc.socialTotal)}　源泉 {yen(r.calc.incomeTax)}　<b style={{ color: ACCENT }}>手取り {yen(r.calc.net)}</b></div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>※ 賞与の社会保険料・源泉所得税は概算です。</p>
    </div>
  );
}
