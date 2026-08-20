import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#2A6F8E";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const STATUSES = ["取引中", "取引停止"];
const EMPTY = { name:"", kana:"", category:"", contactPerson:"", phone:"", email:"", address:"", closingDay:"末日", paymentMonth:"翌月", paymentDay:"末日", paymentMethod:"銀行振込", rate:100, creditLimit:0, status:"取引中", note:"" };

export default function SupplierLedger({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/ga/suppliers", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/ga/suppliers/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data); setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((s) => !kw || [s.code, s.name, s.kana, s.category, s.contactPerson].join(" ").toLowerCase().includes(kw));
  }, [list, q]);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(s) { setEditing(s); setIsNew(false); }
  const term = (s) => `${s.closingDay}締／${s.paymentMonth}${s.paymentDay}払・${s.paymentMethod}`;

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 総務管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>仕入・取引条件</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={openNew}>＋ 仕入先を登録</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>仕入先がまだ登録されていません。</b></p>
          <button className="btn-primary sm" style={{ background: ACCENT, marginTop: 10 }}
            onClick={async () => { await fetch("/api/ga/suppliers/seed", { method: "POST", credentials: "include" }); reload(); }}>サンプルを投入</button>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>{list.length}社</span>
            <span className="pill active">取引中 {list.filter((s) => s.status === "取引中").length}</span>
          </div>
          <div className="ledger-tools">
            <input className="search" placeholder="仕入先名・カナ・分類・担当で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="cust-list">
            {filtered.map((s) => (
              <button key={s.id} className="cust-row" onClick={() => openEdit(s)}>
                <div className="cust-main">
                  <span className="cust-code">{s.code}</span>
                  <span className="cust-name">{s.name}</span>
                  {s.status !== "取引中" && <span className="status st-dormant">{s.status}</span>}
                </div>
                <div className="cust-sub">{s.category}／{term(s)}　掛率 {s.rate}%　与信 {yen(s.creditLimit)}</div>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">該当なし。</p>}
          </div>
        </>
      )}

      {editing && <SupplierForm initial={editing} isNew={isNew} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function SupplierForm({ initial, isNew, onClose, onDone }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }
  function setN(k, v) { setF((p) => ({ ...p, [k]: v === "" ? "" : Number(v) })); }

  async function save() {
    setErr(""); setBusy(true);
    const url = isNew ? "/api/ga/suppliers" : `/api/ga/suppliers/${initial.id}`;
    const r = await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(f) });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr("保存に失敗しました"); return; }
    onDone();
  }
  async function remove() {
    if (!confirm(`${initial.name} を削除しますか？`)) return;
    setBusy(true);
    await fetch(`/api/ga/suppliers/${initial.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "仕入先を登録" : `${initial.code}　${initial.name}`}</h3>
        <div className="form2">
          <label className="fld"><span>仕入先名</span><input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="fld"><span>フリガナ</span><input value={f.kana} onChange={(e) => set("kana", e.target.value)} /></label>
          <label className="fld"><span>分類</span><input value={f.category} onChange={(e) => set("category", e.target.value)} /></label>
          <label className="fld"><span>担当者</span><input value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></label>
          <label className="fld"><span>電話</span><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></label>
          <label className="fld"><span>メール</span><input value={f.email} onChange={(e) => set("email", e.target.value)} inputMode="email" /></label>
          <label className="fld wide-col"><span>住所</span><input value={f.address} onChange={(e) => set("address", e.target.value)} /></label>
        </div>
        <div className="sub-sep">取引条件</div>
        <div className="form2">
          <label className="fld"><span>締日</span><select value={f.closingDay} onChange={(e) => set("closingDay", e.target.value)}>{["末日","25日","20日","15日","10日"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="fld"><span>支払月</span><select value={f.paymentMonth} onChange={(e) => set("paymentMonth", e.target.value)}>{["当月","翌月","翌々月"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="fld"><span>支払日</span><select value={f.paymentDay} onChange={(e) => set("paymentDay", e.target.value)}>{["末日","25日","20日","10日","5日"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="fld"><span>支払方法</span><select value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>{["銀行振込","手形","口座振替","現金"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="fld"><span>掛率（%）</span><input inputMode="numeric" value={f.rate} onChange={(e) => setN("rate", e.target.value)} /></label>
          <label className="fld"><span>与信限度額</span><input inputMode="numeric" value={f.creditLimit} onChange={(e) => setN("creditLimit", e.target.value)} /></label>
          <label className="fld"><span>ステータス</span><select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="fld wide-col"><span>備考</span><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        </div>
        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          {!isNew && <button className="btn-ghost danger" onClick={remove} disabled={busy}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !f.name} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
