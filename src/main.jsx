import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./core/auth/AuthContext.jsx";
import App from "./App.jsx";
import BootstrapPage from "./core/bootstrap/BootstrapPage.jsx";
import "./styles.css";

// /bootstrap は通常のログイン・認証チェックを一切経由しない緊急用ページ。
// それ以外は今まで通り通常のAppを表示する。
const isBootstrap = window.location.pathname.replace(/\/+$/, "") === "/bootstrap";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isBootstrap ? (
      <BootstrapPage />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>
);
