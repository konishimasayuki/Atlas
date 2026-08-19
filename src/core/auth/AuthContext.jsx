import { createContext, useContext, useEffect, useState, useCallback } from "react";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/core/auth/me", { credentials: "include" });
      const j = await r.json();
      setUser(j.data || null);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (loginId, password) => {
    const r = await fetch("/api/core/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ loginId, password }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "login_failed");
    setUser(j.data);
    return j.data;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/core/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}
