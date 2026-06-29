import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api from "@/lib/api";
import type { User } from "@/types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    api.get<User>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password });
    const { data } = await api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    const me = await api.get<User>("/auth/me");
    setUser(me.data);
  };

  const logout = () => {
    // best-effort server-side revocation (bumps token_version), then clear local
    api.post("/auth/logout").catch(() => {}).finally(() => {
      localStorage.clear();
      setUser(null);
    });
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
