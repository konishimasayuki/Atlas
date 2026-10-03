// src/core/super/SuperUsers.jsx ── 運営：全会社・全ユーザーの一覧／パスワード再設定／ロック解除
import { useEffect, useMemo, useState } from "react";

export default function SuperUsers() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState(null);
  const [msg, setMsg] = useState(null);

  async function load() {
    const r = await fetch("/api/core/super/users", { credentials: "include" });
    const j = await r.json();
    setList(j.ok ? j.data : []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (list || []).filter((u) => !kw || [u.company, u.companyName, u.id, u.name].join(" ").toLowerCase().includes(kw));
  }, [list, q]);

  async function unlock(u) {
    const r = await fetch("/api/core/super/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "unlock", company: u.company, id: u.id }),
    });
    const j = await r.json();
    setMsg(j.ok ? { ok: true, text: `${u.company} / ${u.id} のロックを解除しました` } : { ok: false, text: "解除に失敗しました" });
    load();
  }

  if (!list) return <p className="muted">読み込み中…</p>;
  return (
    <>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>
        パスワードは暗号化して保存しているため表示できません。忘れた場合は「PW再設定」で新しいパスワードを決めて本人に伝えてください。
      </p>
      <input className="search" placeholder="会社コード・会社名・ID・名前で検索" value={q} onChange={(e) => setQ(e.target.value)} />
      {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table className="utable">
          <thead><tr><th>会社コード</th><th>会社名</th><th>ログインID</th><th>名前</th><th>管理者</th><th>状態</th><th></th></tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.company + "/" + u.id} className={u.isActive && u.companyActive ? "" : "u-off"}>
                <td className="mono">{u.company}</td>
                <td>{u.companyName}</td>
                <td className="mono">{u.id}</td>
                <td>{u.name}</td>
                <td>{u.canManageUsers ? "○" : "—"}</td>
                <td>
                  {u.locked
                    ? <span className="u-badge">ロック中（残{u.lockMinutes}分）</span>
                    : <span className={"u-badge" + (u.isActive ? " on" : "")}>{u.isActive ? "有効" : "停止中"}</span>}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {u.locked && <button className="btn-ghost sm" onClick={() => unlock(u)}>ロック解除</button>}
                  <button className="btn-ghost sm" onClick={() => setTarget(u)}>PW再設定</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="muted">該当するユーザーがいません</td></tr>}
          </tbody>
        </table>
      </div>
      {target && <ResetModal u={target} onClose={() => setTarget(null)} onDone={(t) => { setTarget(null); setMsg({ ok: true, text: t }); load(); }} />}
    </>
  );
}

function ResetModal({ u, onClose, onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/core/super/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "reset", company: u.company, id: u.id, newPassword: pw }),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) onDone(`${u.company} / ${u.id} のパスワードを「${pw}」に再設定しました（ロックも解除）`);
    else setErr(j.error === "weak_password" ? "6文字以上にしてください" : "再設定に失敗しました");
  }
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>パスワード再設定</h3>
        <p className="muted" style={{ marginTop: -4 }}>{u.companyName}（{u.company}）／ {u.name}（{u.id}）</p>
        <label className="fld"><span>新しいパスワード（6文字以上）</span>
          <input value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" /></label>
        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy || pw.length < 6} onClick={save}>{busy ? "設定中…" : "再設定"}</button>
        </div>
      </div>
    </div>
  );
}
