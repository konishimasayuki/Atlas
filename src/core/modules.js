// 入口メニュー ①〜⑦ の定義。接続仕様書 §3 の名前空間(id)と一致させる。
export const MODULES = [
  { id: "sales",      no: "①", label: "営業管理",       desc: "顧客台帳", color: "#1657B0" },
  { id: "inventory",  no: "②", label: "在庫・供給管理", desc: "棚卸管理", color: "#9A5A0B" },
  { id: "accounting", no: "③", label: "会計管理",       desc: "仕訳・経費精算", color: "#0B6E52" },
  { id: "payroll",    no: "④", label: "労務管理",       desc: "給与・社保・年末調整", color: "#B23A48" },
  { id: "hr",         no: "⑤", label: "人事管理",       desc: "勤怠・人事台帳・ストレスチェック", color: "#6A34A0" },
  { id: "ga",         no: "⑥", label: "総務管理",       desc: "電子契約・リーガル・eラーニング・資産", color: "#2A6F8E" },
  { id: "settings",   no: "⑦", label: "設定",           desc: "ユーザー・マスタ管理", color: "#334155" },
];
