import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#1657B0";
const yen = (n) => "¥" + (Number(n) || 0).toLocaleString();
const PHASES = ["見込み", "商談中", "提案", "受注", "失注"];
const PHASE_COLOR = { "見込み": "#8a94a5", "商談中": "#1657B0", "提案": "#9A5A0B", "受注": "#0B6E52", "失注": "#B23A48" };
const PHASE_PROB = { "見込み": 20, "商談中": 50, "提案": 70, "受注": 100, "失注": 0 };
const EMPTY = { title:"", customerId:"", customerName:"", phase:"見込み", amount:0, probability:20, owner:"", expectedDate:"", nextAction:"", note:"" };

export default function DealPipeline({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("すべて");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/sales/deals", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function fetchCustomers() {
    const r = await fetch("/api/sales/customers", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }
  async function init() {
    setLoading(true);
    let data = await fetchList();
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/sales/deals/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data);
    setCustomers(await fetchCustomers());
    setLoading(false);
  }
  useEffect(() => { init(); }, []);
  async function reload() { setList(await fetchList()); }

  const active = useMemo(() => list.filter((d) => !["受注", "失注"].includes(d.phase)), [list]);
  const pipeline = useMemo(() => active.reduce((s, d) => s + d.amount, 0), [active]);
  const weighted = useMemo(() => active.reduce((s, d) => s + d.amount * (d.probability / 100), 0), [active]);
  const won = useMemo(() => list.filter((d) => d.phase === "受注").reduce((s, d) => s + d.amount, 0), [list]);

  const filtered = useMemo(() => phase === "すべて" ? list : list.filter((d) => d.phase === phase), [list, phase]);
  const byPhase = useMemo(() => {
    const m = {}; for (const p of PHASES) m[p] = { count: 0, amount: 0 };
    for (const d of list) if (m[d.phase]) { m[d.phase].count++; m[d.phase].amount += d.amount; }
    return m;
  }, [list]);

  function openNew() { setEditing({ ...EMPTY, owner: user.name }); setIsNew(true); }
  function openEdit(d) { setEditing(d); setIsNew(false); }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 営業管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>商談管理</h2>
        <button className="btn-primary sm" onClick={openNew}>＋ 商談を追加</button>
      </div>

      {loading ? <p className="muted">読み込み中…</p> : (
        <>
          <div className="pay-totals">
            <div className="pt-item"><span className="pt-l">進行中 件数</span><span className="pt-v">{active.length}</span></div>
            <div className="pt-item"><span className="pt-l">パイプライン</span><span className="pt-v">{yen(pipeline)}</span></div>
            <div className="pt-item"><span className="pt-l">加重見込</span><span className="pt-v">{yen(Math.round(weighted))}</span></div>
            <div className="pt-item net" style={{ background: "#E3F4EC", borderColor: "#a9d9c6" }}><span className="pt-l">受注済</span><span className="pt-v" style={{ color: "#0B6E52" }}>{yen(won)}</span></div>
          </div>

          {/* フェーズ別ミニ集計 */}
          <div className="phase-bar">
            {PHASES.map((p) => (
              <button key={p} className={"phase-cell" + (phase === p ? " on" : "")} style={{ "--pc": PHASE_COLOR[p] }} onClick={() => setPhase(phase === p ? "すべて" : p)}>
                <span className="phase-name">{p}</span>
                <span className="phase-count">{byPhase[p].count}</span>
                <span className="phase-amt">{yen(byPhase[p].amount)}</span>
              </button>
            ))}
          </div>

          <div className="cust-list" style={{ marginTop: 14 }}>
            {filtered.map((d) => (
              <button key={d.id} className="cust-row" onClick={() => openEdit(d)}>
                <div className="cust-main">
                  <span className="cust-code">{d.code}</span>
                  <span className="cust-name">{d.title}</span>
                  <span className="phase-tag" style={{ background: PHASE_COLOR[d.phase] }}>{d.phase} {d.probability}%</span>
                </div>
                <div className="cust-sub">{d.customerName}　{yen(d.amount)}　{d.owner}{d.nextAction ? `　次: ${d.nextAction}` : ""}{d.expectedDate ? `　〜${d.expectedDate}` : ""}</div>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">該当する商談がありません。</p>}
          </div>
        </>
      )}

      {editing && <DealForm initial={editing} isNew={isNew} customers={customers} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function DealForm({ initial, isNew, customers, onClose, onDone }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }
  function setPhase(p) { setF((prev) => ({ ...prev, phase: p, probability: PHASE_PROB[p] })); }
  function setCustomer(id) {
    const c = customers.find((x) => x.id === id);
    setF((prev) => ({ ...prev, customerId: id, customerName: c ? c.name : "" }));
  }
  async function save() {
    setBusy(true);
    const url = isNew ? "/api/sales/deals" : `/api/sales/deals/${initial.id}`;
    await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(f) });
    setBusy(false); onDone();
  }
  async function remove() {
    if (!confirm("この商談を削除しますか？")) return;
    setBusy(true);
    await fetch(`/api/sales/deals/${initial.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false); onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "商談を追加" : `${initial.code}　${initial.title}`}</h3>
        <div className="form2">
          <label className="fld wide-col"><span>案件名</span><input value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label className="fld"><span>顧客</span>
            <select value={f.customerId} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">（選択）</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="fld"><span>フェーズ</span><select value={f.phase} onChange={(e) => setPhase(e.target.value)}>{PHASES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="fld"><span>金額</span><input inputMode="numeric" value={f.amount} onChange={(e) => set("amount", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} /></label>
          <label className="fld"><span>確度（%）</span><input inputMode="numeric" value={f.probability} onChange={(e) => set("probability", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} /></label>
          <label className="fld"><span>担当</span><input value={f.owner} onChange={(e) => set("owner", e.target.value)} /></label>
          <label className="fld"><span>受注予定日</span><input type="date" value={f.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} /></label>
          <label className="fld wide-col"><span>次のアクション</span><input value={f.nextAction} onChange={(e) => set("nextAction", e.target.value)} /></label>
          <label className="fld wide-col"><span>メモ</span><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          {!isNew && <button className="btn-ghost danger" onClick={remove} disabled={busy}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy || !f.title} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
