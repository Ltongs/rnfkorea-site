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
  isInsuranceManager: boolean;
  isHyundaiCM: boolean;   // 현대건설기계 (배성구 팀장)
  isNhCapital: boolean;   // 농협캐피탈 (강신규 소장)
  isInternal: boolean;

  // page permissions
  canViewAll: boolean;
  canCreate: boolean;
  canEditExisting: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canEditMemo: boolean;
  canUploadVehicleDoc: boolean;
  canUploadVehicleRegDoc: boolean; // 확정 후 차량등록증 업로드 (isHyundaiCM 전용, 72시간 후 자동삭제)

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

  const isAdmin            = email === "admin@rnfkorea.co.kr";
  const isNarumi           = email.endsWith("@narmimotors.com");
  const isLotte            = email.endsWith("@lotte.net");
  const isInsuranceManager = email === "inhyang1004@hanmail.net";
  const isHyundaiCM        = email === "p2001103@hanmail.net";   // 현대건설기계 배성구 팀장
  const isNhCapital        = email === "allbar7555@naver.com";   // 농협캐피탈 강신규 소장

  // isHyundaiCM / isNhCapital 은 각자 전용 페이지만 볼 수 있으므로
  // isInternal(나르미 공통 접근)에는 포함하지 않음
  const isInternal = isAdmin || isNarumi || isLotte || isInsuranceManager;

  return {
    email,
    isAdmin,
    isNarumi,
    isLotte,
    isInsuranceManager,
    isHyundaiCM,
    isNhCapital,
    isInternal,
  };
}

function getPermissions(emailRaw?: string | null) {
  const {
    isAdmin,
    isNarumi,
    isLotte,
    isInsuranceManager,
    isHyundaiCM,
    isNhCapital,
    isInternal,
  } = getRoleFlags(emailRaw);

  return {
    isAdmin,
    isNarumi,
    isLotte,
    isInsuranceManager,
    isHyundaiCM,
    isNhCapital,
    isInternal,

    canViewAll: isInternal || isHyundaiCM,           // isHyundaiCM: 현대건설기계 전용 페이지 전체 조회 허용
    canCreate: isAdmin || isNarumi || isInsuranceManager || isHyundaiCM,  // isHyundaiCM: 신규 입력 허용
    canEditExisting: isAdmin || isInsuranceManager,  // isHyundaiCM: 기존 데이터 수정 불가
    canDelete: isAdmin || isInsuranceManager,
    canChangeStatus: isAdmin || isInsuranceManager,  // isHyundaiCM: 진행단계 변경 불가
    canEditMemo: isAdmin || isInsuranceManager,
    canUploadVehicleDoc: isAdmin || isInsuranceManager,  // isHyundaiCM: 증빙서류 업로드 불가
    canUploadVehicleRegDoc: isHyundaiCM || isAdmin,  // 확정 후 차량등록증 업로드 (72시간 후 자동삭제)
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

      isAdmin:            permissionState.isAdmin,
      isNarumi:           permissionState.isNarumi,
      isLotte:            permissionState.isLotte,
      isInsuranceManager: permissionState.isInsuranceManager,
      isHyundaiCM:        permissionState.isHyundaiCM,
      isNhCapital:        permissionState.isNhCapital,
      isInternal:         permissionState.isInternal,

      canViewAll:         permissionState.canViewAll,
      canCreate:          permissionState.canCreate,
      canEditExisting:    permissionState.canEditExisting,
      canDelete:          permissionState.canDelete,
      canChangeStatus:    permissionState.canChangeStatus,
      canEditMemo:        permissionState.canEditMemo,
      canUploadVehicleDoc: permissionState.canUploadVehicleDoc,
      canUploadVehicleRegDoc: permissionState.canUploadVehicleRegDoc,

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