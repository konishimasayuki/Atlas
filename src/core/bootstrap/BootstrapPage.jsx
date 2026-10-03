// src/core/bootstrap/BootstrapPage.jsx ── /bootstrap で開く、ログイン不要の会社作成ページ
// 秘密キーなし。このURLを知っている人は誰でも会社を作成できる。
import { useState } from "react";
import { MODULES } from "../modules.js";

export default function BootstrapPage() {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <div className="login-brand">
          <span className="login-logo">Atlas</span>
          <span className="login-tag">会社を追加（/bootstrap）</span>
        </div>
        <p className="setup-note">
          このページは通常のログインを経由せず、会社（テナント）と初期管理者を作成します。
        </p>
        <CompanyForm />
        <div className="sub-sep" style={{ marginTop: 28 }}>スーパー管理者（運営）を作成</div>
        <p className="setup-note">ログイン画面で <b>会社コード z</b> と、ここで決めたID・パスワードで運営コンソールに入れます。AI設定（Claude APIキー）は運営コンソールから行います。</p>
        <SuperAdminForm />
      </div>
    </div>
  );
}

function CompanyForm() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mods, setMods] = useState(["settings"]);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);

  function toggle(id) {
    if (id === "settings") return;
    setMods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setMsg(null); setBusy(true);
    try {
      const r = await fetch("/api/core/bootstrap/company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name, enabledModules: mods, adminId: adminId.trim(), adminPassword }),
      });
      const j = await r.json();
      if (!j.ok) {
        const map = {
          exists: "その会社コードは既に存在します", invalid_code: "会社コードの形式が不正です（英数・ハイフンで2〜20文字）",
          missing: "未入力の項目があります",
        };
        setMsg({ ok: false, text: map[j.error] || "作成に失敗しました" });
      } else {
        setMsg({ ok: true, text: `会社「${j.data.name}」（コード: ${j.data.code}）を作成しました。通常のログイン画面から会社コード・管理者ID・パスワードでログインできます。` });
      }
    } catch {
      setMsg({ ok: false, text: "通信エラーが発生しました" });
    }
    setBusy(false);
  }

  return (
    <>
      <label className="fld"><span>会社コード（ログイン時に使用）</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: abc001" autoCapitalize="off" /></label>
      <label className="fld"><span>会社名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="fld">
        <span>契約する機能（使える画面）</span>
        <div className="modgrid">
          {MODULES.map((m) => (
            <label key={m.id} className={"modchk" + (mods.includes(m.id) ? " on" : "")} style={{ "--mc": m.color }}>
              <input type="checkbox" checked={mods.includes(m.id)} onChange={() => toggle(m.id)} disabled={m.id === "settings"} />
              <span>{m.no} {m.label}{m.id === "settings" ? "（必須）" : ""}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="sub-sep">この会社の初期管理者</div>
      <label className="fld"><span>管理者ID</span><input value={adminId} onChange={(e) => setAdminId(e.target.value)} /></label>
      <label className="fld"><span>管理者パスワード</span><input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></label>

      {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy || !code || !name || !adminId || !adminPassword} onClick={submit}>
        {busy ? "作成中…" : "会社を作成"}
      </button>
    </>
  );
}

function SuperAdminForm() {
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMsg(null); setBusy(true);
    try {
      const r = await fetch("/api/core/bootstrap/superadmin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: loginId.trim(), name, password }),
      });
      const j = await r.json();
      if (!j.ok) {
        const map = { exists: "そのIDのスーパー管理者は既に存在します", weak_password: "パスワードは8文字以上にしてください", missing: "未入力の項目があります" };
        setMsg({ ok: false, text: map[j.error] || "作成に失敗しました" });
      } else {
        setMsg({ ok: true, text: `作成しました。ログイン画面で 会社コード「z」／ID「${j.data.id}」／設定したパスワード でログインしてください。` });
      }
    } catch {
      setMsg({ ok: false, text: "通信エラーが発生しました" });
    }
    setBusy(false);
  }

  return (
    <>
      <label className="fld"><span>ユーザーID</span><input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoCapitalize="off" /></label>
      <label className="fld"><span>名前</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="fld"><span>パスワード（8文字以上）</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy || !loginId || password.length < 8} onClick={submit}>
        {busy ? "作成中…" : "スーパー管理者を作成"}
      </button>
    </>
  );
}
