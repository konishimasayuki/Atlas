// src/core/bootstrap/BootstrapPage.jsx ── 【緊急用】/bootstrap で開く、ログイン不要の会社作成ページ
// Vercelの環境変数 BOOTSTRAP_SECRET を知っている人だけが使える。
import { useState } from "react";
import { MODULES } from "../modules.js";

export default function BootstrapPage() {
  const [tab, setTab] = useState("company"); // company | superadmin

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <div className="login-brand">
          <span className="login-logo">Atlas</span>
          <span className="login-tag">緊急用セットアップ（/bootstrap）</span>
        </div>
        <p className="setup-note">
          このページは通常のログインを経由しません。Vercelの環境変数 <code>BOOTSTRAP_SECRET</code> と
          一致する秘密キーを知っている人だけが使えます。使い終わったら、Vercel側で
          <code>BOOTSTRAP_SECRET</code> を削除するか値を変更してください。
        </p>
        <div className="tabs" style={{ marginBottom: 16 }}>
          <button className={"tab" + (tab === "company" ? " on" : "")} onClick={() => setTab("company")}>会社を作成</button>
          <button className={"tab" + (tab === "superadmin" ? " on" : "")} onClick={() => setTab("superadmin")}>スーパー管理者を作成</button>
        </div>
        {tab === "company" ? <CompanyForm /> : <SuperAdminForm />}
      </div>
    </div>
  );
}

function CompanyForm() {
  const [secret, setSecret] = useState("");
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
        body: JSON.stringify({ secret, code: code.trim(), name, enabledModules: mods, adminId: adminId.trim(), adminPassword }),
      });
      const j = await r.json();
      if (!j.ok) {
        const map = {
          invalid_secret: "秘密キーが違います", bootstrap_disabled: "BOOTSTRAP_SECRETが未設定のため無効です",
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
      <label className="fld"><span>秘密キー（BOOTSTRAP_SECRET）</span>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
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
      <button className="btn-primary" disabled={busy || !secret || !code || !name || !adminId || !adminPassword} onClick={submit}>
        {busy ? "作成中…" : "会社を作成"}
      </button>
    </>
  );
}

function SuperAdminForm() {
  const [secret, setSecret] = useState("");
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
        body: JSON.stringify({ secret, loginId: loginId.trim(), name, password }),
      });
      const j = await r.json();
      if (!j.ok) {
        const map = { invalid_secret: "秘密キーが違います", bootstrap_disabled: "BOOTSTRAP_SECRETが未設定のため無効です", missing: "未入力の項目があります" };
        setMsg({ ok: false, text: map[j.error] || "作成に失敗しました" });
      } else {
        setMsg({ ok: true, text: `スーパー管理者「${j.data.name}」を作成しました。会社コード z.z ・このID・パスワードでログインできます。` });
      }
    } catch {
      setMsg({ ok: false, text: "通信エラーが発生しました" });
    }
    setBusy(false);
  }

  return (
    <>
      <label className="fld"><span>秘密キー（BOOTSTRAP_SECRET）</span>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} /></label>
      <label className="fld"><span>ユーザーID</span><input value={loginId} onChange={(e) => setLoginId(e.target.value)} /></label>
      <label className="fld"><span>名前</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="fld"><span>パスワード</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy || !secret || !loginId || !password} onClick={submit}>
        {busy ? "作成中…" : "スーパー管理者を作成"}
      </button>
    </>
  );
}
