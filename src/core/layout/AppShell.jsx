import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { MODULES } from "../modules.js";
import UsersPage from "../settings/UsersPage.jsx";

export default function AppShell() {
  const { user, logout } = useAuth();
  // 実際に使える画面 = 会社契約 ∩ 本人許可（サーバで計算済みの effectiveModules）
  const visible = MODULES.filter((m) => user.effectiveModules.includes(m.id));
  const [active, setActive] = useState(visible[0]?.id || null);
  const [menuOpen, setMenuOpen] = useState(false);

  const cur = MODULES.find((m) => m.id === active) || null;

  return (
    <div className="shell">
      <header className="topbar">
        <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="メニュー">≡</button>
        <span className="topbar-brand">Atlas</span>
        {cur && <span className="topbar-cur" style={{ color: cur.color }}>{cur.no} {cur.label}</span>}
        <div className="topbar-right">
          <span className="topbar-company">{user.companyName}</span>
          <span className="topbar-user">{user.name}</span>
          <button className="btn-ghost" onClick={logout}>ログアウト</button>
        </div>
      </header>

      <div className="body">
        <nav className={"sidenav" + (menuOpen ? " open" : "")}>
          {visible.map((m) => (
            <button
              key={m.id}
              className={"navitem" + (m.id === active ? " active" : "")}
              style={{ "--mc": m.color }}
              onClick={() => { setActive(m.id); setMenuOpen(false); }}
            >
              <span className="navno">{m.no}</span>
              <span className="navlabel">{m.label}<small>{m.desc}</small></span>
            </button>
          ))}
          {visible.length === 0 && <p className="nav-empty">表示できる画面がありません</p>}
        </nav>
        {menuOpen && <div className="nav-scrim" onClick={() => setMenuOpen(false)} />}

        <main className="content">
          {active === "settings" ? <SettingsView /> : <ModulePlaceholder module={cur} />}
        </main>
      </div>
    </div>
  );
}

function SettingsView() {
  const { user } = useAuth();
  return (
    <div className="page">
      <h2 className="page-h" style={{ color: "#334155" }}>⑦ 設定</h2>
      {user.canManageUsers ? (
        <UsersPage enabledModules={user.enabledModules} />
      ) : (
        <p className="muted">ユーザー管理の権限がありません。</p>
      )}
    </div>
  );
}

function ModulePlaceholder({ module }) {
  if (!module) return null;
  return (
    <div className="page">
      <h2 className="page-h" style={{ color: module.color }}>{module.no} {module.label}</h2>
      <div className="placeholder" style={{ borderColor: module.color }}>
        <p><b>{module.label}</b>（{module.desc}）</p>
        <p className="muted">
          この画面は担当者が実装します。接続仕様書の名前空間「{module.id}」で作成してください。
        </p>
      </div>
    </div>
  );
}
