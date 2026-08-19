// 共通UIの最小セット。各モジュール担当はここから使う（接続仕様書 §10）。
export function Button({ variant = "primary", size, className = "", ...p }) {
  const cls = variant === "ghost" ? "btn-ghost" : "btn-primary";
  return <button className={`${cls}${size === "sm" ? " sm" : ""} ${className}`} {...p} />;
}

export function FormField({ label, children }) {
  return (
    <label className="fld">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Card({ title, children }) {
  return (
    <div className="ui-card">
      {title && <h3 className="ui-card-h">{title}</h3>}
      {children}
    </div>
  );
}
