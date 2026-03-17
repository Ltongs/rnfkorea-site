import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type Role = "admin" | "narumi" | "lotte";

export type User = {
  email: string;
  role: Role;
};

type LoginResult = {
  ok: boolean;
  role?: Role;
  message?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;

  isAdmin: boolean;
  isNarumi: boolean;
  isLotte: boolean;

  canViewAll: boolean;
  canCreate: boolean;
  canEditExisting: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeEmail(email: string) {
  return (email || "").toLowerCase().trim();
}

const USER_ROLE_MAP: Record<string, Role> = {
  "admin@rnfkorea.co.kr": "admin",
  "ltongs7@gmail.com": "admin",
  "sales@narmimotors.com": "narumi",
  "youngjin.heo@lotte.net": "lotte",
};

function getRoleByEmail(email: string): Role | null {
  return USER_ROLE_MAP[normalizeEmail(email)] ?? null;
}

function isValidRole(role: unknown): role is Role {
  return role === "admin" || role === "narumi" || role === "lotte";
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = normalizeEmail(data?.user?.email || "");
        const role = getRoleByEmail(email);

        if (mounted && email && role) {
          setUser({ email, role });
        } else if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = normalizeEmail(session?.user?.email || "");
      const role = getRoleByEmail(email);

      if (email && role) {
        setUser({ email, role });
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const normalized = normalizeEmail(email);
    const role = getRoleByEmail(normalized);

    if (!role) {
      return { ok: false, message: "허용되지 않은 계정입니다." };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });

    if (error || !data.user) {
      return { ok: false, message: error?.message || "로그인 실패" };
    }

    setUser({ email: normalized, role });
    return { ok: true, role };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAdmin = useMemo(() => user?.role === "admin", [user]);
  const isNarumi = useMemo(() => user?.role === "narumi", [user]);
  const isLotte = useMemo(() => user?.role === "lotte", [user]);

  const canViewAll = useMemo(() => isAdmin || isNarumi || isLotte, [isAdmin, isNarumi, isLotte]);
  const canCreate = useMemo(() => isAdmin || isNarumi, [isAdmin, isNarumi]);
  const canEditExisting = useMemo(() => isAdmin, [isAdmin]);
  const canDelete = useMemo(() => isAdmin, [isAdmin]);
  const canChangeStatus = useMemo(() => isAdmin, [isAdmin]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin,
        isNarumi,
        isLotte,
        canViewAll,
        canCreate,
        canEditExisting,
        canDelete,
        canChangeStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}