// src/pages/Login/index.tsx
// 범용 로그인 페이지 — /login
// 브라우저/앱 모두 사용, 로그인 후 이전 페이지 또는 기본 경로로 이동

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function LoginPage() {
  const { user, login, loading } = useAuth() as any;
  const nav  = useNavigate();
  const loc  = useLocation();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      const from = (loc.state as any)?.from ?? "/work/secretary";
      nav(from, { replace: true });
    }
  }, [user, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("이메일과 비밀번호를 입력해주세요."); return; }
    setSubmitting(true);
    setError("");
    try {
      await login(email.trim(), password);
      // onAuthStateChange → useEffect에서 리다이렉트 처리
    } catch (err: any) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a192f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="text-white text-3xl font-bold tracking-wide">RNF KOREA</div>
          <div className="text-blue-300 text-sm mt-1">INDUSTRIAL ENERGY & MOBILITY SOLUTION</div>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-lg font-bold text-[#0a192f] mb-6 text-center">로그인</h1>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                autoComplete="email"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#0a192f] hover:bg-[#1a3a5f] text-white py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 mt-2"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            주식회사 알앤에프코리아 · 1551-1873
          </p>
        </div>
      </div>
    </div>
  );
}