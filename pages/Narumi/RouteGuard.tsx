// pages/Narumi/RouteGuard.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function NarumiRouteGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, canViewAll } = useAuth();
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
        to="/narumi/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // admin / narumi / lotte 모두 허용
  if (!canViewAll) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
          이 계정은 나르미 업무 페이지 접근 권한이 없습니다.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}