import { useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { MODULES } from "../modules.js";
import UsersPage from "../settings/UsersPage.jsx";
import { MODULE_COMPONENTS } from "../../modules/registry.js";

export default function AppShell() {
  const { user, logout } = useAuth();
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
          <ModuleView moduleId={active} module={cur} />
        </main>
      </div>
    </div>
  );
}

function ModuleView({ moduleId, module }) {
  const { user } = useAuth();

  // 設定はコアが担当
  if (moduleId === "settings") {
    return (
      <div className="page">
        <h2 className="page-h" style={{ color: "#334155" }}>⑦ 設定</h2>
        {user.canManageUsers
          ? <UsersPage enabledModules={user.enabledModules} />
          : <p className="muted">ユーザー管理の権限がありません。</p>}
      </div>
    );
  }

  // 各モジュール（登録済みならそのコンポーネント）
  const Comp = MODULE_COMPONENTS[moduleId];
  if (Comp) return <Comp module={module} />;

  // 未実装モジュールのプレースホルダ
  if (!module) return null;
  return (
    <div className="page">
      <h2 className="page-h" style={{ color: module.color }}>{module.no} {module.label}</h2>
      <div className="placeholder" style={{ borderColor: module.color }}>
        <p><b>{module.label}</b>（{module.desc}）</p>
        <p className="muted">この画面は担当者が実装します。接続仕様書の名前空間「{module.id}」で作成してください。</p>
      </div>
    </div>
  );
}
