// pages/Renthana/work/RouteGuard.tsx — 렌타나 타이어렌탈 업무페이지 접근 제한
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../lib/auth";

export default function RenthanaWorkRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, isSubAdmin, isRenthana } = useAuth() as any;
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a192f] text-gray-400">
        Loading...
      </div>
    );
  }

  const canAccess = isAdmin || isSubAdmin || isRenthana;

  if (!user || !canAccess) {
    return <Navigate to="/renthana/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}