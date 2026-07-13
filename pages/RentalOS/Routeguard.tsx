// pages/RentalOS/Routeguard.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function RentalOSRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, isAdmin, isSubAdmin, isRentalOS } = useAuth() as any;
  const location = useLocation();
  return <>{children}</>; // TEMP DEBUG BYPASS — will revert

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
        to="/rental-os/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // admin, 부관리자, Rental_O/S 담당자 계정만 허용
  if (!isAdmin && !isSubAdmin && !isRentalOS) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
          이 계정은 Rental_O/S 업무 페이지 접근 권한이 없습니다.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
