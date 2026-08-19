import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { MODULES } from "../modules.js";

export default function SuperConsole() {
  const { user, logout } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/core/companies", { credentials: "include" });
    const j = await r.json();
    setCompanies(j.ok ? j.data : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="super">
      <header className="topbar super-bar">
        <span className="topbar-brand">Atlas</span>
        <span className="super-badge">運営コンソール</span>
        <div className="topbar-right">
          <span className="topbar-user">{user.name}</span>
          <button className="btn-ghost" onClick={logout}>ログアウト</button>
        </div>
      </header>

      <main className="content super-content">
        <div className="users-head">
          <h2 className="page-h" style={{ margin: 0 }}>会社管理</h2>
          <button className="btn-primary sm" onClick={() => setShowAdd(true)}>＋ 会社を追加</button>
        </div>

        {loading ? (
          <p className="muted">読み込み中…</p>
        ) : companies.length === 0 ? (
          <p className="muted">会社がまだありません。「＋ 会社を追加」から登録してください。</p>
        ) : (
          <div className="company-list">
            {companies.map((c) => (
              <div key={c.code} className={"company-card" + (c.isActive ? "" : " off")}>
                <div className="cc-head">
                  <div>
                    <span className="cc-code">{c.code}</span>
                    <span className="cc-name">{c.name}</span>
                  </div>
                  <span className={"cc-status" + (c.isActive ? " on" : "")}>{c.isActive ? "有効" : "停止中"}</span>
                </div>
                <div className="cc-mods">
                  {MODULES.filter((m) => c.enabledModules.includes(m.id)).map((m) => (
                    <span key={m.id} className="cc-chip" style={{ "--mc": m.color }}>{m.no} {m.label}</span>
                  ))}
                </div>
                <div className="cc-foot">
                  <span className="muted">ユーザー {c.userCount} 名</span>
                  <button className="btn-ghost sm" onClick={() => setEditing(c)}>契約機能を編集</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdd && <AddCompany onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {editing && <EditCompany company={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ModulePicker({ mods, toggle }) {
  return (
    <div className="modgrid">
      {MODULES.map((m) => (
        <label key={m.id} className={"modchk" + (mods.includes(m.id) ? " on" : "")} style={{ "--mc": m.color }}>
          <input type="checkbox" checked={mods.includes(m.id)} onChange={() => toggle(m.id)} disabled={m.id === "settings"} />
          <span>{m.no} {m.label}{m.id === "settings" ? "（必須）" : ""}</span>
        </label>
      ))}
    </div>
  );
}

function AddCompany({ onClose, onDone }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mods, setMods] = useState(["settings"]);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    if (id === "settings") return;
    setMods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setErr("");
    setBusy(true);
    const r = await fetch("/api/core/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: code.trim(), name, enabledModules: mods, adminId: adminId.trim(), adminPassword }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) {
      setErr(
        j.error === "exists" ? "その会社コードは既に存在します"
        : j.error === "invalid_code" ? "会社コードは英数・ハイフンで2〜20文字（z.zは不可）"
        : "登録に失敗しました"
      );
      return;
    }
    onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>会社を追加</h3>
        <label className="fld"><span>会社コード（ログイン時に使用）</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: abc001" autoCapitalize="off" /></label>
        <label className="fld"><span>会社名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} /></label>

        <div className="fld">
          <span>契約する機能（使える画面）</span>
          <ModulePicker mods={mods} toggle={toggle} />
        </div>

        <div className="sub-sep">この会社の初期管理者</div>
        <label className="fld"><span>管理者ID</span>
          <input value={adminId} onChange={(e) => setAdminId(e.target.value)} /></label>
        <label className="fld"><span>管理者パスワード</span>
          <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></label>

        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy || !code || !name || !adminId || !adminPassword} onClick={save}>
            {busy ? "作成中…" : "会社を作成"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCompany({ company, onClose, onDone }) {
  const [mods, setMods] = useState(company.enabledModules || ["settings"]);
  const [isActive, setIsActive] = useState(company.isActive !== false);
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    if (id === "settings") return;
    setMods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setBusy(true);
    await fetch("/api/core/companies/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: company.code, enabledModules: mods, isActive }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{company.code}（{company.name}）</h3>
        <div className="fld">
          <span>契約する機能</span>
          <ModulePicker mods={mods} toggle={toggle} />
        </div>
        <label className="chk-row">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>この会社を有効にする（オフでログイン停止）</span>
        </label>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
