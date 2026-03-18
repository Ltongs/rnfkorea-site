import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;

  // role flags
  isAdmin: boolean;
  isNarumi: boolean;
  isLotte: boolean;
  isInternal: boolean;

  // page permissions
  canViewAll: boolean;
  canCreate: boolean;
  canEditExisting: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;

  // auth actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

function getRoleFlags(emailRaw?: string | null) {
  const email = normalizeEmail(emailRaw);

  const isAdmin = email === "admin@rnfkorea.co.kr";
  const isNarumi = email.endsWith("@narmimotors.com");
  const isLotte = email.endsWith("@lotte.net");

  const isInternal = isAdmin || isNarumi || isLotte;

  return {
    email,
    isAdmin,
    isNarumi,
    isLotte,
    isInternal,
  };
}

function getPermissions(emailRaw?: string | null) {
  const { isAdmin, isNarumi, isLotte, isInternal } = getRoleFlags(emailRaw);

  return {
    isAdmin,
    isNarumi,
    isLotte,
    isInternal,

    canViewAll: isInternal,
    canCreate: isAdmin || isNarumi,
    canEditExisting: isAdmin,
    canDelete: isAdmin,
    canChangeStatus: isAdmin,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("[auth] getSession error:", error.message);
      }

      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const permissionState = useMemo(() => {
    return getPermissions(user?.email);
  }, [user?.email]);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.error("[auth] signInWithPassword error:", error.message);
      throw error;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth] signOut error:", error.message);
      throw error;
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,

      isAdmin: permissionState.isAdmin,
      isNarumi: permissionState.isNarumi,
      isLotte: permissionState.isLotte,
      isInternal: permissionState.isInternal,

      canViewAll: permissionState.canViewAll,
      canCreate: permissionState.canCreate,
      canEditExisting: permissionState.canEditExisting,
      canDelete: permissionState.canDelete,
      canChangeStatus: permissionState.canChangeStatus,

      login,
      logout,
    }),
    [user, session, loading, permissionState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}