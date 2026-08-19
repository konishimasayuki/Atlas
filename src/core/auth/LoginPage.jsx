import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

export default function LoginPage() {
  const { login, setUser } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/core/auth/setup");
        const j = await r.json();
        setNeedsSetup(j.ok && j.data.initialized === false);
      } catch {
        setNeedsSetup(false);
      }
      setChecking(false);
    })();
  }, []);

  if (checking) return <div className="splash">読み込み中…</div>;
  if (needsSetup) return <SetupForm onDone={(u) => setUser(u)} />;
  return <LoginForm login={login} />;
}

function LoginForm({ login }) {
  const [companyCode, setCompanyCode] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      await login(companyCode.trim(), loginId.trim(), password);
    } catch {
      setErr("会社コード・ID・パスワードのいずれかが違います");
    }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">Atlas</span>
          <span className="login-tag">一括業務管理システム</span>
        </div>
        <h1 className="login-title">ログイン</h1>
        <label className="fld">
          <span>会社コード</span>
          <input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} autoCapitalize="off" autoComplete="off" placeholder="例: TEST" />
        </label>
        <label className="fld">
          <span>ユーザーID</span>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" />
        </label>
        <label className="fld">
          <span>パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
        </label>
        {err && <p className="login-err">{err}</p>}
        <button className="btn-primary" disabled={busy || !companyCode || !loginId || !password} onClick={submit}>
          {busy ? "確認中…" : "ログイン"}
        </button>

        {/* デモ案内（不要なら削除してよい） */}
        <div className="demo-hint">
          <b>デモ:</b> 会社コード <code>TEST</code> ／ ID <code>demo</code> ／ PW <code>demo1234</code>
        </div>
      </div>
    </div>
  );
}

function SetupForm({ onDone }) {
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/core/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ loginId: loginId.trim(), name, password }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error();
      onDone(j.data);
    } catch {
      setErr("作成に失敗しました");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo">Atlas</span>
          <span className="login-tag">初回セットアップ</span>
        </div>
        <h1 className="login-title">スーパー管理者を作成</h1>
        <p className="setup-note">
          運営（スーパー管理者）を1人作成します。ログイン時の会社コードは <code>z.z</code> です。
          作成すると、確認用のデモ会社（コード <code>TEST</code>）も自動で用意されます。
        </p>
        <label className="fld"><span>ユーザーID</span>
          <input value={loginId} onChange={(e) => setLoginId(e.target.value)} /></label>
        <label className="fld"><span>名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="fld"><span>パスワード</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="login-err">{err}</p>}
        <button className="btn-primary" disabled={busy || !loginId || !password} onClick={submit}>
          {busy ? "作成中…" : "作成してはじめる"}
        </button>
      </div>
    </div>
  );
}
