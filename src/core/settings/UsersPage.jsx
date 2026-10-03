import { useEffect, useState } from "react";
import { MODULES } from "../modules.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function UsersPage({ enabledModules = [] }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const { user: me } = useAuth();

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
              <tr><th>ID</th><th>名前</th><th>アクセス可能な画面</th><th>ユーザー管理</th><th>状態</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "u-off"}>
                  <td className="mono">{u.id}{u.id === me.id ? "（自分）" : ""}</td>
                  <td>{u.name}</td>
                  <td>{u.allowedModules.map((id) => MODULES.find((m) => m.id === id)?.no).join(" ")}</td>
                  <td>{u.canManageUsers ? "○" : "—"}</td>
                  <td><span className={"u-badge" + (u.isActive ? " on" : "")}>{u.isActive ? "有効" : "停止中"}</span></td>
                  <td><button className="btn-ghost sm" onClick={() => setEditing(u)}>編集</button></td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="muted">ユーザーがいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditUser
          target={editing}
          isSelf={editing.id === me.id}
          enabledModules={enabledModules}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); load(); }}
        />
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

const USER_ERR = {
  self_admin: "自分自身の管理権限は外せません",
  self_stop: "自分自身は停止できません",
  self_delete: "自分自身は削除できません",
  last_admin: "有効な管理者が1人もいなくなるため変更できません",
  weak_password: "パスワードは6文字以上にしてください",
  not_found: "ユーザーが見つかりません",
};

function EditUser({ target, isSelf, enabledModules, onClose, onDone }) {
  const [name, setName] = useState(target.name);
  const [mods, setMods] = useState(target.allowedModules);
  const [canMng, setCanMng] = useState(target.canManageUsers);
  const [isActive, setIsActive] = useState(target.isActive);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const selectable = MODULES.filter((m) => enabledModules.includes(m.id));

  function toggle(id) {
    setMods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setErr(""); setBusy(true);
    const body = { name, allowedModules: mods, canManageUsers: canMng, isActive };
    if (password) body.password = password;
    const r = await fetch(`/api/core/users/${encodeURIComponent(target.id)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(body),
    });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr(USER_ERR[j.error] || "保存に失敗しました"); return; }
    onDone();
  }

  async function remove() {
    if (!confirm(`ユーザー「${target.name}（${target.id}）」を削除しますか？\nこの操作は元に戻せません。`)) return;
    setErr(""); setBusy(true);
    const r = await fetch(`/api/core/users/${encodeURIComponent(target.id)}`, { method: "DELETE", credentials: "include" });
    const j = await r.json(); setBusy(false);
    if (!j.ok) { setErr(USER_ERR[j.error] || "削除に失敗しました"); return; }
    onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>ユーザー編集　<span className="mono" style={{ fontSize: 14 }}>{target.id}</span></h3>
        <label className="fld"><span>名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} /></label>

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
          <input type="checkbox" checked={canMng} disabled={isSelf} onChange={(e) => setCanMng(e.target.checked)} />
          <span>ユーザー管理を許可する{isSelf ? "（自分自身は変更不可）" : ""}</span>
        </label>
        <label className="chk-row">
          <input type="checkbox" checked={isActive} disabled={isSelf} onChange={(e) => setIsActive(e.target.checked)} />
          <span>有効（チェックを外すと停止：ログインできなくなります）{isSelf ? "（自分自身は変更不可）" : ""}</span>
        </label>

        <label className="fld"><span>パスワード再設定（変更する場合のみ・6文字以上）</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>

        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          {!isSelf && <button className="btn-ghost danger" disabled={busy} onClick={remove}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy || !name} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
