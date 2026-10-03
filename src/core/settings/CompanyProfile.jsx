// src/core/settings/CompanyProfile.jsx ── 自社情報の設定（帳票PDFのヘッダーに使用）
import { useEffect, useState } from "react";
import { clearProfileCache } from "../../shared/print/PrintDoc.jsx";

// 画像を縮小して dataURL 化（ロゴ・社印用。保存容量を抑える）
function resizeImage(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const FIELDS = [
  ["companyName", "会社名（帳票に表示）", "株式会社〇〇"],
  ["representative", "代表者", "代表取締役 〇〇 〇〇"],
  ["postal", "郵便番号", "841-0000"],
  ["address", "住所", "佐賀県鳥栖市〇〇 1-2-3"],
  ["tel", "電話番号", "0942-00-0000"],
  ["fax", "FAX番号", ""],
  ["email", "メールアドレス", ""],
  ["invoiceNo", "インボイス登録番号（任意）", "T1234567890123"],
];

export default function CompanyProfile({ canEdit }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/core/profile", { credentials: "include" });
      const j = await r.json();
      setF(j.ok ? j.data : {});
    })();
  }, []);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  async function onImage(field, file, maxSize) {
    if (!file) return;
    try { set(field, await resizeImage(file, maxSize)); }
    catch { setMsg({ ok: false, text: "画像の読み込みに失敗しました" }); }
  }

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/core/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(f),
    });
    const j = await r.json(); setBusy(false);
    if (j.ok) { setF(j.data); clearProfileCache(); setMsg({ ok: true, text: "保存しました。帳票（PDF出力）に反映されます。" }); }
    else setMsg({ ok: false, text: j.error === "image_too_large" ? "画像が大きすぎます。小さい画像を選んでください" : "保存に失敗しました" });
  }

  if (!f) return <p className="muted">読み込み中…</p>;

  return (
    <div className="profile-form">
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>
        ここで登録した内容は、給与明細・経費精算書・発注書などのPDF出力のヘッダーに自動で入ります。
      </p>
      <div className="form2">
        {FIELDS.map(([k, label, ph]) => (
          <label key={k} className={"fld" + (k === "address" ? " wide-col" : "")}><span>{label}</span>
            <input value={f[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} disabled={!canEdit} />
          </label>
        ))}
        <label className="fld wide-col"><span>振込先（請求書等に表示）</span>
          <textarea rows={3} value={f.bankInfo || ""} onChange={(e) => set("bankInfo", e.target.value)} placeholder={"〇〇銀行 〇〇支店\n普通 1234567\nカ）〇〇"} disabled={!canEdit} />
        </label>
      </div>

      <div className="img-row">
        {[["logo", "ロゴ", 600], ["seal", "社印（角印）", 300]].map(([k, label, max]) => (
          <div key={k} className="img-box">
            <span className="img-label">{label}</span>
            <div className="img-preview">{f[k] ? <img src={f[k]} alt="" /> : <span className="muted">未登録</span>}</div>
            {canEdit && (
              <div className="img-btns">
                <label className="btn-ghost sm">画像を選択
                  <input type="file" accept="image/*" hidden onChange={(e) => onImage(k, e.target.files[0], max)} />
                </label>
                {f[k] && <button className="btn-ghost sm" onClick={() => set(k, "")}>削除</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5 }}>社印は背景が透明なPNG画像がおすすめです。</p>

      {msg && <p className={msg.ok ? "login-ok" : "login-err"}>{msg.text}</p>}
      {canEdit
        ? <button className="btn-primary" style={{ width: "auto" }} disabled={busy} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        : <p className="muted">編集にはユーザー管理権限が必要です。</p>}
    </div>
  );
}
