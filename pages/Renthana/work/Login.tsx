// pages/Renthana/work/Login.tsx — 렌타나 타이어렌탈 업무페이지 로그인
import React, { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../../lib/auth";

export default function RenthanaWorkLoginPage() {
  const { user, loading, isAdmin, isSubAdmin, isRenthana, login } = useAuth() as any;
  const nav = useNavigate();
  const location = useLocation() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // 이미 로그인 + 접근 권한이 있으면 바로 /renthana/work로
  if (!loading && user && (isAdmin || isSubAdmin || isRenthana)) {
    const dest = location.state?.from || "/renthana/work";
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !password) {
      setErr("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      nav("/renthana/work", { replace: true });
    } catch (e: any) {
      setErr("로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a192f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-white mb-1">🛞 렌타나 타이어렌탈</div>
          <p className="text-sm text-gray-400">RNF Korea · 렌타나 공유 업무</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="••••••••"
            />
          </div>

          {err && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-all"
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          &copy; {new Date().getFullYear()} (주)알앤에프코리아
        </p>
      </div>
    </div>
  );
}