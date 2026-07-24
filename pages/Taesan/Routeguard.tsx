// pages/Taesan/Routeguard.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function TaesanRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, isSubAdmin, isTaesan, isNhCapital } = useAuth() as any;
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a192f] text-gray-400">
        Loading...
      </div>
    );
  }

  const canAccess = isAdmin || isSubAdmin || isTaesan || isNhCapital;

  if (!user || !canAccess) {
    return <Navigate to="/taesan/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}