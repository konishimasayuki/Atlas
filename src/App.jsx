import { useAuth } from "./core/auth/AuthContext.jsx";
import LoginPage from "./core/auth/LoginPage.jsx";
import AppShell from "./core/layout/AppShell.jsx";
import SuperConsole from "./core/super/SuperConsole.jsx";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">読み込み中…</div>;
  if (!user) return <LoginPage />;
  if (user.scope === "super") return <SuperConsole />;
  return <AppShell />;
}
