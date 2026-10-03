// src/core/super/SuperInquiries.jsx ── 運営：全社からの問い合わせ一覧・対応状況・返信
import { useEffect, useState } from "react";

const STATUSES = ["未対応", "対応中", "対応済"];
const ST_CLASS = { "未対応": "st-low", "対応中": "st-prospect", "対応済": "st-active" };

export default function SuperInquiries({ onCount }) {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("未対応");
  const [open, setOpen] = useState(null);

  async function load() {
    const r = await fetch("/api/core/super/inquiries", { credentials: "include" });
    const j = await r.json();
    const data = j.ok ? j.data : [];
    setList(data);
    onCount && onCount(data.filter((x) => x.status === "未対応").length);
  }
  useEffect(() => { load(); }, []);

  if (!list) return <p className="muted">読み込み中…</p>;
  const shown = filter === "すべて" ? list : list.filter((x) => x.status === filter);
  return (
    <>
      <div className="tabs" style={{ marginBottom: 10 }}>
        {["未対応", "対応中", "対応済", "すべて"].map((t) => (
          <button key={t} className={"tab" + (filter === t ? " on" : "")} onClick={() => setFilter(t)}>
            {t}{t !== "すべて" ? `（${list.filter((x) => x.status === t).length}）` : ""}
          </button>
        ))}
      </div>
      <div className="inq-list">
        {shown.map((q) => (
          <button key={q.id} className="inq-item clickable" onClick={() => setOpen(q)}>
            <div className="inq-head">
              <span className="cust-code">{q.id}</span><b>{q.subject}</b>
              <span className={"status " + (ST_CLASS[q.status] || "")} style={{ marginLeft: "auto" }}>{q.status}</span>
            </div>
            <div className="inq-meta">{q.companyName}（{q.company}）／{q.userName}（{q.userId}）　{q.category}　{new Date(q.createdAt).toLocaleString("ja-JP")}</div>
          </button>
        ))}
        {shown.length === 0 && <p className="muted">該当する問い合わせはありません。</p>}
      </div>
      {open && <Detail q={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
    </>
  );
}

function Detail({ q, onClose, onDone }) {
  const [status, setStatus] = useState(q.status);
  const [reply, setReply] = useState(q.reply || "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await fetch("/api/core/super/inquiries", {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ id: q.id, status, reply }),
    });
    setBusy(false); onDone();
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{q.id}　{q.subject}</h3>
        <p className="muted" style={{ marginTop: -4 }}>{q.companyName}（{q.company}）／{q.userName}（{q.userId}）／{q.category}／{new Date(q.createdAt).toLocaleString("ja-JP")}</p>
        <div className="inq-body">{q.body}</div>
        <label className="fld" style={{ marginTop: 12 }}><span>対応状況</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="fld"><span>回答（送信者の「送信履歴・回答」に表示されます）</span>
          <textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} /></label>
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>閉じる</button>
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
