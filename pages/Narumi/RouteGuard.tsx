import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function NarumiRouteGuard() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm font-semibold text-gray-500">
        로딩 중...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/narumi/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}