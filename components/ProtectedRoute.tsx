import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isInternal } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user || !isInternal) {
    return <Navigate to="/narumi/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}