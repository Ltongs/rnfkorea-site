// pages/HyundaiCM/RouteGuard.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function HyundaiCMRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, isAdmin, isSubAdmin, isHyundaiCM, isNhCapital, isNhCapitalStaff } = useAuth() as any;
  const location = useLocation();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/hyundaicm/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // admin, 부관리자, 현대건설기계, 농협캐피탈(파트너), NH캐피탈 직원(상태변경·다운로드만 가능) 계정만 허용
  if (!isAdmin && !isSubAdmin && !isHyundaiCM && !isNhCapital && !isNhCapitalStaff) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
          이 계정은 현대건설기계 업무 페이지 접근 권한이 없습니다.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}