// pages/OrixIncentive/Routeguard.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function OrixIncentiveRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, isOrixAdmin, isOrixPartner } = useAuth() as any;
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
        to="/orix/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // 이 페이지는 admin(admin@rnfkorea.co.kr, ltongs7@gmail.com)과
  // ORIX 조용백(yongbaek_jo@orix.co.kr) 단 두 사람만 접근 가능합니다.
  if (!isOrixAdmin && !isOrixPartner) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
          이 계정은 ORIX 인센티브 관리 페이지 접근 권한이 없습니다.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
