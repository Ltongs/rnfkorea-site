import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Role = "internal" | "external";

export type User = {
  email: string;
  role: Role;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string) => { ok: boolean; role: Role };
  logout: () => void;
  isInternal: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

// ✅ 내부 사용자 화이트리스트 (여기에 추가)
const INTERNAL_USERS = [
  "admin@rnfkorea.co.kr",
  "ltongs7@gmail.com",
].map((x) => x.toLowerCase().trim());

function normalizeEmail(email: string) {
  return (email || "").toLowerCase().trim();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("narumi_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.email && parsed?.role) setUser(parsed);
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, []);

  const login = (email: string) => {
  const e = normalizeEmail(email);
  const role: Role = INTERNAL_USERS.includes(e) ? "internal" : "external";

  // ✅ 외부 이메일이면 상태 저장 자체를 하지 않음 (핵심)
  if (role !== "internal") {
    return { ok: false, role };
  }

  const newUser: User = { email: e, role };

  localStorage.setItem("narumi_user", JSON.stringify(newUser));
  setUser(newUser);

  return { ok: true, role };
};

  const logout = () => {
    localStorage.removeItem("narumi_user");
    setUser(null);
  };

  const isInternal = useMemo(() => user?.role === "internal", [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isInternal }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}