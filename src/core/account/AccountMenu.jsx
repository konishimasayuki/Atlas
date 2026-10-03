// src/core/account/AccountMenu.jsx ── 右上のアカウントメニュー（パスワード変更・お問い合わせ・ログアウト）
import { useEffect, useState } from "react";

export default function AccountMenu({ user, logout, allowInquiry = true }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // "password" | "inquiry"

  return (
    <div className="acct">
      <button className="btn-ghost acct-btn" onClick={() => setOpen((v) => !v)}>
        {user.name} <span className="acct-caret">▾</span>
      </button>
      {open && (
        <>
          <div className="acct-scrim" onClick={() => setOpen(false)} />
          <div className="acct-menu">
            {!(user.scope === "super" && user.id === "z") && (
              <button onClick={() => { setModal("password"); setOpen(false); }}>パスワード変更</button>
            )}
            {allowInquiry && <button onClick={() => { setModal("inquiry"); setOpen(false); }}>お問い合わせ</button>}
            <button className="danger" onClick={logout}>ログアウト</button>
          </div>
        </>
      )}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} />}
      {modal === "inquiry" && <InquiryModal onClose={() => setModal(null)} />}
    </div>
  );
}

function PasswordModal({ onClose }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setMsg(null);
    if (next !== next2) { setMsg({ ok: false, text: "新しいパスワードが一致しません" }); return; }
    setBusy(true);
    const r = await fetch("/api/core/auth/password", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setMsg({ ok: true, text: "パスワードを変更しました" }); setCur(""); setNext(""); setNext2(""); }
    else setMsg({ ok: false, text: { wrong_current: "現在のパスワードが違います", weak_password: "新しいパスワードは6文字以上にしてください", fixed_account: "固定の運営アカウントは変更できません" }[j.error] || "変更に失敗しました" });
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>パスワード変更</h3>
        <label className="fld"><span>現在のパスワード</span><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
        <label className="fld"><span>新しいパスワード（6文字以上）</span><input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
        <label className="fld"><span>新しいパスワード（確認）</span><input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} autoComplete="new-password" /></label>
        {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>閉じる</button>
          <button className="btn-primary" disabled={busy || !cur || next.length < 6 || !next2} onClick={save}>{busy ? "変更中…" : "変更する"}</button>
        </div>
      </div>
    </div>
  );
}

const CATS = ["使い方", "不具合", "要望", "契約・請求", "その他"];
const ST_CLASS = { "未対応": "st-low", "対応中": "st-prospect", "対応済": "st-active" };

function InquiryModal({ onClose }) {
  const [tab, setTab] = useState("new");
  const [category, setCategory] = useState(CATS[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadList() {
    const r = await fetch("/api/core/inquiry", { credentials: "include" });
    const j = await r.json();
    setList(j.ok ? j.data : []);
  }
  useEffect(() => { if (tab === "list") loadList(); }, [tab]);

  async function send() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/core/inquiry", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ category, subject, body }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setMsg({ ok: true, text: `送信しました（受付番号 ${j.data.id}）。回答は「送信履歴」で確認できます。` }); setSubject(""); setBody(""); }
    else setMsg({ ok: false, text: "送信に失敗しました" });
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>お問い合わせ</h3>
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button className={"tab" + (tab === "new" ? " on" : "")} onClick={() => setTab("new")}>新規</button>
          <button className={"tab" + (tab === "list" ? " on" : "")} onClick={() => setTab("list")}>送信履歴・回答</button>
        </div>
        {tab === "new" ? (
          <>
            <label className="fld"><span>種別</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="fld"><span>件名</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="fld"><span>内容</span><textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></label>
            {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
            <div className="modal-actions">
              <span style={{ flex: 1 }} />
              <button className="btn-ghost" onClick={onClose}>閉じる</button>
              <button className="btn-primary" disabled={busy || !subject || !body} onClick={send}>{busy ? "送信中…" : "送信"}</button>
            </div>
          </>
        ) : (
          <>
            {!list ? <p className="muted">読み込み中…</p> : list.length === 0 ? <p className="muted">送信した問い合わせはありません。</p> : (
              <div className="inq-list">
                {list.map((q) => (
                  <div key={q.id} className="inq-item">
                    <div className="inq-head">
                      <span className="cust-code">{q.id}</span>
                      <b>{q.subject}</b>
                      <span className={"status " + (ST_CLASS[q.status] || "")} style={{ marginLeft: "auto" }}>{q.status}</span>
                    </div>
                    <div className="inq-meta">{q.category}　{new Date(q.createdAt).toLocaleString("ja-JP")}</div>
                    <div className="inq-body">{q.body}</div>
                    {q.reply && <div className="inq-reply"><b>運営からの回答</b>{"\n"}{q.reply}</div>}
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions"><span style={{ flex: 1 }} /><button className="btn-ghost" onClick={onClose}>閉じる</button></div>
          </>
        )}
      </div>
    </div>
  );
}
