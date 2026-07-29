import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  isSubAdmin: boolean;         // 부관리자 (ltongs7@gmail.com) - admin과 동일 권한
  isNarumi: boolean;
  isLotte: boolean;
  isInsuranceManager: boolean;
  isHyundaiCM: boolean;   // 현대건설기계 (배성구 팀장)
  isNhCapital: boolean;   // 농협캐피탈 (강신규 소장)
  isNhCapitalStaff: boolean; // NH캐피탈 직원 (NH캐피탈 건만, 상태변경·다운로드는 가능하나 서류 업로드는 불가)
  isInsAI: boolean;       // AI 비서 (Ins) 전용 (everyasset.fc@gmail.com)
  isTaesan: boolean;      // 태산통운 (yj565012@naver.com) - 태산통운 탭 전용, 신규등록/자료첨부만 가능
  isRentalOS: boolean;    // Rental_O/S (kohd1222@naver.com) - 렌탈 딜 아웃소싱 페이지 전용
  isOrixAdmin: boolean;   // ORIX 인센티브 페이지 관리자 (admin@rnfkorea.co.kr, ltongs7@gmail.com만 — everyasset.fc@gmail.com 제외)
  isOrixPartner: boolean; // ORIX 인센티브 페이지 파트너 (yongbaek_jo@orix.co.kr) - isNhCapital과는 별개 권한
  isInternal: boolean;

  // page permissions
  canViewAll: boolean;
  canViewHyundaiCM: boolean;
  canCreate: boolean;
  canEditExisting: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canEditMemo: boolean;
  canUploadVehicleDoc: boolean;
  canUploadVehicleRegDoc: boolean; // 확정 후 차량등록증 업로드 (isHyundaiCM 전용, 72시간 후 자동삭제)
  canUploadTaxInvoice: boolean;   // 세금계산서 업로드 (isHyundaiCM 전용, 72시간 후 자동삭제)

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
  const isSubAdmin         = email === "ltongs7@gmail.com"          // 부관리자 (admin과 동일 권한)
                          || email === "everyasset.fc@gmail.com";  // AI 비서(보험) 계정, admin과 동일 권한으로 전체 개방(2026-07-18)
  const isNarumi           = email.endsWith("@narmimotors.com");
  const isLotte            = email.endsWith("@lotte.net");
  const isInsuranceManager = email === "inhyang1004@hanmail.net";
  const isHyundaiCM        = email === "p2001103@hanmail.net";   // 현대건설기계 배성구 팀장
  const isNhCapital        = email === "allbar7555@naver.com"      // 농협캐피탈 강신규 소장
                          || email === "yongbaek_jo@orix.co.kr";  // ORIX 조용백
  const isNhCapitalStaff   = email === "ehddhks1115@nhcapital.co.kr"; // NH캐피탈 직원 (상태변경·다운로드 가능, 업로드 불가)
  const isInsAI            = email === "everyasset.fc@gmail.com"; // AI 비서 (Ins) 전용
  const isTaesan            = email === "yj565012@naver.com";      // 태산통운 (신규등록완료) - 태산통운 탭 전용
  const isRentalOS          = email === "kohd1222@naver.com";      // Rental_O/S (렌탈 딜 아웃소싱) 전용
  // ORIX 인센티브 페이지 전용 권한 — isSubAdmin(everyasset.fc@gmail.com 포함)을 그대로 쓰지 않고
  // "이 메뉴는 두 사람만" 요구사항에 맞춰 admin@rnfkorea.co.kr + ltongs7@gmail.com만 명시적으로 좁힘.
  const isOrixAdmin         = isAdmin || email === "ltongs7@gmail.com";
  const isOrixPartner       = email === "yongbaek_jo@orix.co.kr";

  // isHyundaiCM / isNhCapital / isTaesan / isRentalOS 는 각자 전용 페이지만 볼 수 있으므로
  // isInternal(나르미 공통 접근)에는 포함하지 않음
  const isInternal = isAdmin || isSubAdmin || isNarumi || isLotte || isInsuranceManager || isInsAI;

  return {
    email,
    isAdmin,
    isSubAdmin,
    isNarumi,
    isLotte,
    isInsuranceManager,
    isHyundaiCM,
    isNhCapital,
    isNhCapitalStaff,
    isInsAI,
    isTaesan,
    isRentalOS,
    isOrixAdmin,
    isOrixPartner,
    isInternal,
  };
}

function getPermissions(emailRaw?: string | null) {
  const {
    isAdmin,
    isSubAdmin,
    isNarumi,
    isLotte,
    isInsuranceManager,
    isHyundaiCM,
    isNhCapital,
    isNhCapitalStaff,
    isInsAI,
    isTaesan,
    isRentalOS,
    isOrixAdmin,
    isOrixPartner,
    isInternal,
  } = getRoleFlags(emailRaw);

  const isAdminLevel = isAdmin || isSubAdmin; // admin과 동일 권한 그룹

  return {
    isAdmin,
    isSubAdmin,
    isNarumi,
    isLotte,
    isInsuranceManager,
    isHyundaiCM,
    isNhCapital,
    isNhCapitalStaff,
    isInsAI,
    isTaesan,
    isRentalOS,
    isOrixAdmin,
    isOrixPartner,
    isInternal,

    // 참고: 아래 canXxx 값들은 상담관리/나르미/보험 등 "공용" 페이지에서 쓰는 값입니다.
    // 현대CM 페이지와 마찬가지로, 태산통운 페이지(/taesan)와 Rental_O/S 페이지(/rental-os)는
    // 이 공용 플래그를 쓰지 않고 컴포넌트 내부에서 isTaesan/isRentalOS role flag를 직접
    // 참조해 자체 권한을 계산합니다. 따라서 canCreate 등에 isTaesan/isRentalOS를 추가하지
    // 않았습니다 (다른 공용 페이지에 의도치 않은 권한이 새는 것을 방지).
    canViewAll:          isInternal,
    canViewHyundaiCM:    isInternal || isHyundaiCM || isNhCapital || isNhCapitalStaff,
    canCreate:           isAdminLevel || isNarumi || isInsuranceManager || isHyundaiCM || isNhCapital || isInsAI,
    canEditExisting:     isAdminLevel || isInsuranceManager || isNhCapital,
    canDelete:           isAdminLevel || isInsuranceManager || isNhCapital,
    canChangeStatus:     isAdminLevel || isInsuranceManager || isNhCapital || isNhCapitalStaff || isInsAI,
    canEditMemo:         isAdminLevel || isInsuranceManager || isNhCapital,
    canUploadVehicleDoc: isAdminLevel || isInsuranceManager || isNhCapital,
    canUploadVehicleRegDoc: isHyundaiCM || isAdminLevel || isNhCapital,  // NH캐피탈 직원(isNhCapitalStaff)은 다운로드만 가능, 업로드 불가
    canUploadTaxInvoice: isHyundaiCM || isAdminLevel || isNhCapital,  // 세금계산서: isHyundaiCM + admin + NH캐피탈 (직원 계정 제외)
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // SSR(프리렌더링)에서는 useEffect가 실행되지 않아 bootstrap()이 절대 끝나지 않으므로
  // loading이 true로 고정되어 페이지 전체가 로딩 스피너로만 렌더링된다.
  // Node(prerender) 환경에서는 처음부터 "로그인 안 한 상태"로 간주해 실제 콘텐츠를 렌더링한다.
  const [loading, setLoading] = useState(() => typeof window === "undefined" ? false : true);

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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      // 리디렉션은 App.tsx의 라우트에서 처리
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
      isSubAdmin:         permissionState.isSubAdmin,
      isNarumi:           permissionState.isNarumi,
      isLotte:            permissionState.isLotte,
      isInsuranceManager: permissionState.isInsuranceManager,
      isHyundaiCM:        permissionState.isHyundaiCM,
      isNhCapital:        permissionState.isNhCapital,
      isNhCapitalStaff:   permissionState.isNhCapitalStaff,
      isInsAI:            permissionState.isInsAI,
      isTaesan:           permissionState.isTaesan,
      isRentalOS:         permissionState.isRentalOS,
      isOrixAdmin:        permissionState.isOrixAdmin,
      isOrixPartner:      permissionState.isOrixPartner,
      isInternal:         permissionState.isInternal,

      canViewAll:         permissionState.canViewAll,
      canViewHyundaiCM:   permissionState.canViewHyundaiCM,
      canCreate:          permissionState.canCreate,
      canEditExisting:    permissionState.canEditExisting,
      canDelete:          permissionState.canDelete,
      canChangeStatus:    permissionState.canChangeStatus,
      canEditMemo:        permissionState.canEditMemo,
      canUploadVehicleDoc: permissionState.canUploadVehicleDoc,
      canUploadVehicleRegDoc: permissionState.canUploadVehicleRegDoc,
      canUploadTaxInvoice: permissionState.canUploadTaxInvoice,

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