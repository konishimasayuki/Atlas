// src/shared/print/PrintDoc.jsx ── 帳票（給与明細・経費精算書・発注書など）の印刷／PDF保存
// ブラウザの印刷機能を使う方式：「印刷 / PDF保存」→ 印刷ダイアログで「PDFとして保存」
// （iPhone は 共有 → プリント → ピンチアウト or 共有でPDF保存）。日本語フォントもそのまま出る。
// 自社情報（会社名・住所・ロゴ・社印・登録番号）は ⑦設定 > 会社情報 の内容を自動で差し込む。
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let profileCache = null;
export async function loadProfile() {
  if (profileCache) return profileCache;
  try {
    const r = await fetch("/api/core/profile", { credentials: "include" });
    const j = await r.json();
    profileCache = j.ok ? j.data : {};
  } catch { profileCache = {}; }
  return profileCache;
}
export function clearProfileCache() { profileCache = null; }

export const yenP = (n) => "¥" + (Math.round(Number(n) || 0)).toLocaleString();
export const fmtDate = (v) => {
  const d = v ? new Date(v) : new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

/**
 * props:
 *  title    帳票名（例：給与明細書）
 *  docNo    番号（任意）
 *  date     発行日（任意・既定は今日）
 *  to       宛先（例：「〇〇 御中」「山田 太郎 様」）
 *  meta     右上に並べる追加項目 [[ラベル, 値], ...]
 *  seal     社印を表示するか（既定 true）
 *  fileName 保存時の推奨ファイル名（ブラウザのタイトルに反映）
 */
export default function PrintDoc({ title, docNo, date, to, meta = [], seal = true, fileName, onClose, children }) {
  const [p, setP] = useState(null);

  useEffect(() => {
    loadProfile().then(setP);
    document.body.classList.add("printing");
    const prevTitle = document.title;
    if (fileName) document.title = fileName; // PDF保存時の既定ファイル名になる
    return () => {
      document.body.classList.remove("printing");
      document.title = prevTitle;
    };
  }, [fileName]);

  return createPortal(
    <div className="print-root">
      <div className="print-bar">
        <span className="print-hint">「印刷 / PDF保存」→ 印刷画面で「PDFとして保存」を選択</span>
        <button className="btn-ghost" onClick={onClose}>閉じる</button>
        <button className="btn-primary" onClick={() => window.print()}>印刷 / PDF保存</button>
      </div>

      <div className="print-paper">
        {!p ? <p>読み込み中…</p> : (
          <>
            <div className="pd-top">
              <div className="pd-logo">{p.logo ? <img src={p.logo} alt="" /> : null}</div>
              <h1 className="pd-title">{title}</h1>
              <div className="pd-docmeta">
                {docNo && <div><span>No.</span>{docNo}</div>}
                <div><span>発行日</span>{fmtDate(date)}</div>
                {meta.map(([l, v]) => <div key={l}><span>{l}</span>{v}</div>)}
              </div>
            </div>

            <div className="pd-parties">
              <div className="pd-to">{to && <div className="pd-to-name">{to}</div>}</div>
              <div className="pd-from">
                <div className="pd-from-name">
                  {p.companyName || ""}
                  {seal && p.seal ? <img className="pd-seal" src={p.seal} alt="" /> : null}
                </div>
                {p.representative && <div>{p.representative}</div>}
                {(p.postal || p.address) && <div>{p.postal ? "〒" + p.postal + " " : ""}{p.address}</div>}
                {(p.tel || p.fax) && <div>{p.tel ? "TEL " + p.tel : ""}{p.tel && p.fax ? "　" : ""}{p.fax ? "FAX " + p.fax : ""}</div>}
                {p.email && <div>{p.email}</div>}
                {p.invoiceNo && <div>登録番号 {p.invoiceNo}</div>}
              </div>
            </div>

            <div className="pd-body">{children}</div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
