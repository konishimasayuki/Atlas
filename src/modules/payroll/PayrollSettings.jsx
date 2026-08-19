import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#B23A48";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();

export default function PayrollSettings({ onBack }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);

  async function fetchRows() {
    const r = await fetch("/api/payroll/settings", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchRows();
    const unset = data.filter((r) => !r.setting).length;
    // デモ(TEST)：未設定が全員なら自動生成
    if (user.company === "TEST" && data.length > 0 && unset === data.length) {
      await fetch("/api/payroll/settings/seed", { method: "POST", credentials: "include" });
      data = await fetchRows();
    }
    setRows(data);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setRows(await fetchRows()); }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => !kw || [r.code, r.name, r.department, r.position].join(" ").toLowerCase().includes(kw));
  }, [rows, q]);
  const setCount = rows.filter((r) => r.setting).length;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 労務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>給与設定</h2>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : rows.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>人事台帳に社員がいません。</b></p>
          <p className="muted">先に人事管理⑤の人事台帳へ社員を登録してください。</p>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>対象 {rows.length}人</span>
            <span className="pill active">設定済 {setCount}</span>
            <span className="pill dormant">未設定 {rows.length - setCount}</span>
          </div>
          <div className="ledger-tools">
            <input className="search" placeholder="氏名・部署・役職で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="cust-list">
            {filtered.map((r) => (
              <button key={r.empId} className="cust-row" onClick={() => setEditing(r)}>
                <div className="cust-main">
                  <span className="cust-code">{r.code}</span>
                  <span className="cust-name">{r.name}</span>
                  {r.setting ? <span className="status st-active">設定済</span> : <span className="status st-low">未設定</span>}
                </div>
                <div className="cust-sub">
                  {r.department}・{r.position}　{r.setting ? `基本給 ${yen(r.setting.base)}／総支給目安 ${yen(r.setting.base + (r.setting.positionAllowance||0) + (r.setting.otherAllowance||0) + (r.setting.commuteAllowance||0))}` : "給与設定が必要です"}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {editing && <SettingForm row={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function SettingForm({ row, onClose, onDone }) {
  const s = row.setting || {};
  const [f, setF] = useState({
    base: s.base || 0, positionAllowance: s.positionAllowance || 0, commuteAllowance: s.commuteAllowance || 0,
    otherAllowance: s.otherAllowance || 0, dependents: s.dependents || 0, residentTax: s.residentTax || 0,
    taxTable: s.taxTable || "甲", over40: s.over40 || false,
    healthPension: s.healthPension !== false, employmentIns: s.employmentIns !== false,
  });
  const [busy, setBusy] = useState(false);
  function setN(k, v) { setF((p) => ({ ...p, [k]: v === "" ? "" : Number(v) })); }
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function save() {
    setBusy(true);
    await fetch("/api/payroll/settings", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ empId: row.empId, ...f }) });
    setBusy(false);
    onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{row.code}　{row.name} の給与設定</h3>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>{row.department}・{row.position}・{row.employmentType}</p>
        <div className="form2">
          <label className="fld"><span>基本給</span><input inputMode="numeric" value={f.base} onChange={(e) => setN("base", e.target.value)} /></label>
          <label className="fld"><span>役職手当</span><input inputMode="numeric" value={f.positionAllowance} onChange={(e) => setN("positionAllowance", e.target.value)} /></label>
          <label className="fld"><span>通勤手当（非課税）</span><input inputMode="numeric" value={f.commuteAllowance} onChange={(e) => setN("commuteAllowance", e.target.value)} /></label>
          <label className="fld"><span>その他手当</span><input inputMode="numeric" value={f.otherAllowance} onChange={(e) => setN("otherAllowance", e.target.value)} /></label>
          <label className="fld"><span>扶養人数</span><input inputMode="numeric" value={f.dependents} onChange={(e) => setN("dependents", e.target.value)} /></label>
          <label className="fld"><span>住民税（月額）</span><input inputMode="numeric" value={f.residentTax} onChange={(e) => setN("residentTax", e.target.value)} /></label>
          <label className="fld"><span>源泉徴収 税額表</span><select value={f.taxTable} onChange={(e) => set("taxTable", e.target.value)}><option value="甲">甲欄（扶養控除等申告書 提出）</option><option value="乙">乙欄</option></select></label>
          <label className="fld"><span>介護保険（40歳以上）</span><select value={f.over40 ? "1" : "0"} onChange={(e) => set("over40", e.target.value === "1")}><option value="0">対象外</option><option value="1">対象</option></select></label>
          <label className="chk-row" style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={f.healthPension} onChange={(e) => set("healthPension", e.target.checked)} /><span>健康保険・厚生年金に加入</span></label>
          <label className="chk-row" style={{ gridColumn: "1 / -1", margin: 0 }}><input type="checkbox" checked={f.employmentIns} onChange={(e) => set("employmentIns", e.target.checked)} /><span>雇用保険に加入</span></label>
        </div>
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !f.base} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
