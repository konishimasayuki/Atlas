import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../core/auth/AuthContext.jsx";

const ACCENT = "#6A34A0";
const DEPTS = ["営業部","開発部","製造部","管理部","総務部","人事部","経理部","カスタマーサポート部"];
const POSITIONS = ["部長","課長","係長","主任","リーダー","一般"];
const EMP_TYPES = ["正社員","契約社員","パート"];
const STATUSES = ["在籍","休職","退職"];
const AVATAR_COLORS = ["#6A34A0","#1657B0","#0B6E52","#B23A48","#9A5A0B","#2A6F8E","#7A3E9A","#385B8C"];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initial(name) {
  return (name || "?").trim().replace(/\s/g, "").slice(0, 1);
}
function age(birthDate) {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

const EMPTY = { name:"", kana:"", gender:"男性", department:"営業部", position:"一般", employmentType:"正社員", joinDate:"", birthDate:"", email:"", phone:"", location:"", skills:[], qualifications:[], hobbies:"", bio:"", status:"在籍" };

export default function EmployeeBook({ onBack }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("すべて");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);

  async function load() {
    const r = await fetch("/api/hr/employees", { credentials: "include" });
    const j = await r.json();
    return j.ok ? j.data : [];
  }

  async function init() {
    setLoading(true);
    let data = await load();
    // デモ会社(TEST)は空なら自動で50人投入（ボタン不要）
    if (data.length === 0 && user.company === "TEST") {
      await fetch("/api/hr/employees/seed", { method: "POST", credentials: "include" });
      data = await load();
    }
    setList(data);
    setLoading(false);
  }
  useEffect(() => { init(); }, []);

  async function reload() { setList(await load()); }

  async function seed() {
    await fetch("/api/hr/employees/seed", { method: "POST", credentials: "include" });
    reload();
  }

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return list.filter((e) => {
      if (dept !== "すべて" && e.department !== dept) return false;
      if (!kw) return true;
      const hay = [e.code, e.name, e.kana, e.department, e.position, e.hobbies,
        (e.skills || []).join(","), (e.qualifications || []).join(",")].join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [list, q, dept]);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openView(e) { setEditing(e); setIsNew(false); }

  return (
    <div className="page ledger">
      <div className="ledger-top">
        <button className="back-btn" onClick={onBack}>← 人事管理</button>
        <h2 className="page-h" style={{ color: ACCENT, margin: 0 }}>人事台帳</h2>
        <button className="btn-primary sm" style={{ background: ACCENT }} onClick={openNew}>＋ 社員を追加</button>
      </div>

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : list.length === 0 ? (
        <div className="placeholder" style={{ borderColor: ACCENT }}>
          <p><b>社員がまだ登録されていません。</b></p>
          <button className="btn-primary sm" style={{ background: ACCENT, marginTop: 10 }} onClick={seed}>サンプル50人を投入</button>
        </div>
      ) : (
        <>
          <div className="stat-pills">
            <span className="pill" style={{ background: ACCENT, color: "#fff", borderColor: ACCENT }}>合計 {list.length}人</span>
            <span className="pill">在籍 {list.filter((e) => e.status === "在籍").length}</span>
            <span className="pill">部署 {new Set(list.map((e) => e.department)).size}</span>
          </div>

          <div className="ledger-tools">
            <input className="search" placeholder="名前・部署・役職・スキル・資格で検索" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="tabs">
            {["すべて", ...DEPTS].map((d) => (
              <button key={d} className={"tab" + (dept === d ? " on" : "")} onClick={() => setDept(d)}
                style={dept === d ? { background: ACCENT, borderColor: ACCENT } : undefined}>{d}</button>
            ))}
          </div>

          <div className="emp-grid">
            {filtered.map((e) => (
              <button key={e.id} className="emp-card" onClick={() => openView(e)}>
                <span className="emp-avatar" style={{ background: avatarColor(e.name) }}>{initial(e.name)}</span>
                <span className="emp-info">
                  <span className="emp-name">{e.name}{e.status !== "在籍" && <em className="emp-flag">{e.status}</em>}</span>
                  <span className="emp-kana">{e.kana}</span>
                  <span className="emp-meta">{e.department}・{e.position}</span>
                  <span className="emp-skills">
                    {(e.skills || []).slice(0, 3).map((s) => <em key={s} className="skill-chip">{s}</em>)}
                  </span>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="muted">該当する社員がいません。</p>}
          </div>
        </>
      )}

      {editing && (
        <EmployeeForm initial={editing} isNew={isNew} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}

function chipsToText(arr) { return (arr || []).join("、"); }
function textToChips(t) { return (t || "").split(/[、,]/).map((s) => s.trim()).filter(Boolean); }

function EmployeeForm({ initial, isNew, onClose, onDone }) {
  const [f, setF] = useState({
    name: initial.name || "", kana: initial.kana || "", gender: initial.gender || "男性",
    department: initial.department || "営業部", position: initial.position || "一般",
    employmentType: initial.employmentType || "正社員", joinDate: initial.joinDate || "",
    birthDate: initial.birthDate || "", email: initial.email || "", phone: initial.phone || "",
    location: initial.location || "", skills: chipsToText(initial.skills),
    qualifications: chipsToText(initial.qualifications), hobbies: initial.hobbies || "",
    bio: initial.bio || "", status: initial.status || "在籍",
  });
  const [edit, setEdit] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function save() {
    setErr(""); setBusy(true);
    const payload = { ...f, skills: textToChips(f.skills), qualifications: textToChips(f.qualifications) };
    const url = isNew ? "/api/hr/employees" : `/api/hr/employees/${initial.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) { setErr("保存に失敗しました"); return; }
    onDone();
  }
  async function remove() {
    if (!confirm(`${initial.name} を削除しますか？`)) return;
    setBusy(true);
    await fetch(`/api/hr/employees/${initial.id}`, { method: "DELETE", credentials: "include" });
    setBusy(false);
    onDone();
  }

  // ---- 閲覧モード（プロフィール表示） ----
  if (!edit) {
    return (
      <div className="modal-back" onClick={onClose}>
        <div className="modal wide" onClick={(e) => e.stopPropagation()}>
          <div className="profile-head">
            <span className="emp-avatar lg" style={{ background: avatarColor(initial.name) }}>{initial.name ? initial.name.trim().slice(0,1) : "?"}</span>
            <div>
              <div className="profile-name">{initial.name} {initial.status !== "在籍" && <em className="emp-flag">{initial.status}</em>}</div>
              <div className="profile-kana">{initial.kana}</div>
              <div className="profile-role">{initial.department}・{initial.position}・{initial.employmentType}</div>
            </div>
          </div>
          <div className="profile-rows">
            <Row label="社員番号" value={initial.code} />
            <Row label="年齢 / 性別" value={`${age(initial.birthDate) || "—"}歳 / ${initial.gender || "—"}`} />
            <Row label="入社日" value={initial.joinDate || "—"} />
            <Row label="勤務地" value={initial.location || "—"} />
            <Row label="連絡先" value={`${initial.email || "—"} / ${initial.phone || "—"}`} />
          </div>
          {(initial.skills || []).length > 0 && (
            <div className="profile-block"><span className="pb-label">スキル</span>
              <div className="chips-row">{initial.skills.map((s) => <em key={s} className="skill-chip lg">{s}</em>)}</div></div>
          )}
          {(initial.qualifications || []).length > 0 && (
            <div className="profile-block"><span className="pb-label">資格</span>
              <div className="chips-row">{initial.qualifications.map((s) => <em key={s} className="qual-chip">{s}</em>)}</div></div>
          )}
          {initial.hobbies && <div className="profile-block"><span className="pb-label">趣味・特技</span><div>{initial.hobbies}</div></div>}
          {initial.bio && <div className="profile-block"><span className="pb-label">ひとこと</span><div>{initial.bio}</div></div>}
          <div className="modal-actions">
            <span style={{ flex: 1 }} />
            <button className="btn-ghost" onClick={onClose}>閉じる</button>
            <button className="btn-primary" style={{ background: ACCENT }} onClick={() => setEdit(true)}>編集</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 編集/追加モード ----
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "社員を追加" : `${initial.code}　編集`}</h3>
        <div className="form2">
          <label className="fld"><span>氏名</span><input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="fld"><span>フリガナ</span><input value={f.kana} onChange={(e) => set("kana", e.target.value)} /></label>
          <label className="fld"><span>部署</span><select value={f.department} onChange={(e) => set("department", e.target.value)}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label className="fld"><span>役職</span><select value={f.position} onChange={(e) => set("position", e.target.value)}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="fld"><span>雇用形態</span><select value={f.employmentType} onChange={(e) => set("employmentType", e.target.value)}>{EMP_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="fld"><span>性別</span><select value={f.gender} onChange={(e) => set("gender", e.target.value)}><option>男性</option><option>女性</option><option>その他</option></select></label>
          <label className="fld"><span>入社日</span><input type="date" value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} /></label>
          <label className="fld"><span>生年月日</span><input type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></label>
          <label className="fld"><span>メール</span><input value={f.email} onChange={(e) => set("email", e.target.value)} inputMode="email" /></label>
          <label className="fld"><span>電話</span><input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></label>
          <label className="fld"><span>勤務地</span><input value={f.location} onChange={(e) => set("location", e.target.value)} /></label>
          <label className="fld"><span>ステータス</span><select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="fld wide-col"><span>スキル（読点・カンマ区切り）</span><input value={f.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Excel、簿記、英語" /></label>
          <label className="fld wide-col"><span>資格（読点・カンマ区切り）</span><input value={f.qualifications} onChange={(e) => set("qualifications", e.target.value)} placeholder="日商簿記2級、宅建" /></label>
          <label className="fld wide-col"><span>趣味・特技</span><input value={f.hobbies} onChange={(e) => set("hobbies", e.target.value)} /></label>
          <label className="fld wide-col"><span>ひとこと</span><textarea rows={2} value={f.bio} onChange={(e) => set("bio", e.target.value)} /></label>
        </div>
        {err && <p className="login-err">{err}</p>}
        <div className="modal-actions">
          {!isNew && <button className="btn-ghost danger" onClick={remove} disabled={busy}>削除</button>}
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" style={{ background: ACCENT }} disabled={busy || !f.name} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="prow">
      <span className="prow-l">{label}</span>
      <span className="prow-v">{value}</span>
    </div>
  );
}
