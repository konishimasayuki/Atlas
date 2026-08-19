import { useEffect, useState } from "react";
import { MODULES } from "../modules.js";

export default function UsersPage({ enabledModules = [] }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/core/users", { credentials: "include" });
    const j = await r.json();
    setUsers(j.ok ? j.data : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="users">
      <div className="users-head">
        <h3>ユーザー管理</h3>
        <button className="btn-primary sm" onClick={() => setShowAdd(true)}>＋ ユーザー追加</button>
      </div>

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : (
        <div className="utable-wrap">
          <table className="utable">
            <thead>
              <tr><th>ID</th><th>名前</th><th>アクセス可能な画面</th><th>ユーザー管理</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.allowedModules.map((id) => MODULES.find((m) => m.id === id)?.no).join(" ")}</td>
                  <td>{u.canManageUsers ? "○" : "—"}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} className="muted">ユーザーがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddUser
          enabledModules={enabledModules}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function AddUser({ enabledModules, onClose, onDone }) {
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mods, setMods] = useState([]);
  const [canMng, setCanMng] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // 会社が契約している機能だけ選択肢に出す
  const selectable = MODULES.filter((m) => enabledModules.includes(m.id));

  function toggle(id) {
    setMods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setErr("");
    setBusy(true);
    const r = await fetch("/api/core/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        loginId: loginId.trim(), name, password,
        allowedModules: mods, canManageUsers: canMng,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) {
      setErr(j.error === "exists" ? "そのIDは既に使われています" : "登録に失敗しました");
      return;
    }
    onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>ユーザー追加</h3>
        <label className="fld"><span>ユーザーID</span>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} /></label>
        <label className="fld"><span>名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="fld"><span>初期パスワード</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>

        <div className="fld">
          <span>アクセスできる画面（自社の契約範囲）</span>
          <div className="modgrid">
            {selectable.map((m) => (
              <label key={m.id} className={"modchk" + (mods.includes(m.id) ? " on" : "")} style={{ "--mc": m.color }}>
                <input type="checkbox" checked={mods.includes(m.id)} onChange={() => toggle(m.id)} />
                <span>{m.no} {m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="chk-row">
          <input type="checkbox" checked={canMng} onChange={(e) => setCanMng(e.target.checked)} />
          <span>ユーザー管理を許可する</span>
        </label>

        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy || !loginId || !password} onClick={save}>
            {busy ? "登録中…" : "登録"}
          </button>
        </div>
      </div>
    </div>
  );
}
