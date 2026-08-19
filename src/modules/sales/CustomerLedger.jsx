import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#1657B0";
const STATUS_CLASS = { "取引中": "active", "見込み": "prospect", "休眠": "dormant" };
const TYPES = ["法人", "個人"];
const RANKS = ["A", "B", "C"];
const STATUSES = ["取引中", "見込み", "休眠"];
const EMPTY = { name: "", kana: "", type: "法人", contactPerson: "", phone: "", email: "", address: "", rank: "B", status: "見込み", note: "" };

export default function CustomerLedger({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("すべて");
  const [editing, setEditing] = useState(null); // customer or {} for new
  const [isNew, setIsNew] = useState(false);

  async function fetchList() {
    const r = await fetch("/api/sales/customers", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }

  async function init() {
    setLoading(true);
    let data = await fetchList();
    // デモ会社(TEST)は空なら自動で50件投入（ボタン不要）
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/sales/customers/seed", { method: "POST", credentials: "include" });
      data = await fetchList();
    }
    setList(data);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  async function load() { setList(await fetchList()); }

  async function seed() {
    setSeeding(true);
    await fetch("/api/sales/customers/seed", { method: "POST", credentials: "include" });
    setSeeding(false);
    load();
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((c) => {
      if (tab !== "すべて" && c.status !== tab) return false;
      if (!kw) return true;
      return [c.code, c.name, c.kana, c.contactPerson, c.phone, c.email]
        .some((v) => (v || "").toLowerCase().includes(kw));
    });
  }, [list, q, tab]);

  const counts = useMemo(() => {
    const c = { 取引中: 0, 見込み: 0, 休眠: 0 };
    for (const x of list) if (c[x.status] !== undefined) c[x.status]++;
    return c;
  }, [list]);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(c) { setEditing(c); setIsNew(false); }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 営業管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>顧客台帳</h2>
        <button className="btn-primary sm" onClick={openNew}>＋ 顧客を追加</button>
      </div>

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>顧客がまだ登録されていません。</b></p>
          <p className="muted">動作確認用にサンプルを投入できます。</p>
          <button className="btn-primary sm" disabled={seeding} onClick={seed} style={{ marginTop: 10 }}>
            {seeding ? "投入中…" : "サンプル50件を投入"}
          </button>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill total">合計 {list.length}</span>
            <span className="pill active">取引中 {counts["取引中"]}</span>
            <span className="pill prospect">見込み {counts["見込み"]}</span>
            <span className="pill dormant">休眠 {counts["休眠"]}</span>
          </div>

          <div className="ledger-tools">
            <input
              className="search"
              placeholder="コード・名前・担当・電話で検索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="tabs">
            {["すべて", "取引中", "見込み", "休眠"].map((t) => (
              <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          <div className="cust-list">
            {filtered.map((c) => (
              <button key={c.id} className="cust-row" onClick={() => openEdit(c)}>
                <div className="cust-main">
                  <span className="cust-code">{c.code}</span>
                  <span className="cust-name">{c.name}</span>
                  <span className={"rank rank-" + c.rank}>{c.rank}</span>
                  <span className={"status st-" + (STATUS_CLASS[c.status] || "prospect")}>{c.status}</span>
                </div>
                <div className="cust-sub">
                  {c.type} ／ 担当: {c.contactPerson || "—"} ／ {c.phone || "—"} ／ {c.address || "—"}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">該当する顧客がいません。</p>}
          </div>
        </>
      )}

      {editing && (
        <CustomerForm
          initial={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CustomerForm({ initial, isNew, onClose, onDone }) {
  const [f, setF] = useState({
    name: initial.name || "", kana: initial.kana || "", type: initial.type || "法人",
    contactPerson: initial.contactPerson || "", phone: initial.phone || "", email: initial.email || "",
    address: initial.address || "", rank: initial.rank || "B", status: initial.status || "見込み",
    note: initial.note || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function set(key, v) { setF((p) => ({ ...p, [key]: v })); }

  async function save() {
    setErr(""); setBusy(true);
    const url = isNew ? "/api/sales/customers" : `/api/sales/customers/${initial.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(f),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) { setErr("保存に失敗しました"); return; }
    onDone();
  }

  async function remove() {
    if (!confirm(`${initial.name} を削除しますか？`)) return;
    setBusy(true);
    await fetch(`/api/sales/customers/${initial.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false);
    onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "顧客を追加" : `${initial.code}　${initial.name}`}</h3>

        <div className="form2">
          <label className="fld"><span>会社名 / 氏名</span>
            <input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="fld"><span>フリガナ</span>
            <input value={f.kana} onChange={(e) => set("kana", e.target.value)} /></label>
          <label className="fld"><span>区分</span>
            <select value={f.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="fld"><span>担当者</span>
            <input value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></label>
          <label className="fld"><span>電話</span>
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></label>
          <label className="fld"><span>メール</span>
            <input value={f.email} onChange={(e) => set("email", e.target.value)} inputMode="email" /></label>
          <label className="fld wide-col"><span>住所</span>
            <input value={f.address} onChange={(e) => set("address", e.target.value)} /></label>
          <label className="fld"><span>ランク</span>
            <select value={f.rank} onChange={(e) => set("rank", e.target.value)}>
              {RANKS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className="fld"><span>ステータス</span>
            <select value={f.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="fld wide-col"><span>メモ</span>
            <textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></label>
        </div>

        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          {!isNew && <button className="btn-ghost danger" onClick={remove} disabled={busy}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy || !f.name} onClick={save}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
