// pages/HyundaiCM/Login.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";

const inputClass =
  "h-[52px] w-full px-4 rounded-2xl border border-gray-200 bg-white text-sm " +
  "font-medium text-navy-900 placeholder:text-gray-400 " +
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 " +
  "disabled:opacity-50 disabled:bg-gray-50 transition-all";

export default function HyundaiCMLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading, isHyundaiCM, isAdmin, isSubAdmin, isNhCapital, isNhCapitalStaff, isOrixPartner } = useAuth() as any;

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");

  const redirectTo =
    (location.state as any)?.from && typeof (location.state as any)?.from === "string"
      ? (location.state as any).from
      : "/hyundaicm";

  useEffect(() => {
    if (!loading && user && (isHyundaiCM || isAdmin || isSubAdmin || isNhCapital || isNhCapitalStaff || isOrixPartner)) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, user, isHyundaiCM, isAdmin, isSubAdmin, isNhCapital, isNhCapitalStaff, isOrixPartner, navigate, redirectTo]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim())    { setErr("이메일을 입력해주세요."); return; }
    if (!password.trim()) { setErr("비밀번호를 입력해주세요."); return; }

    setErr("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 히어로 헤더 ── */}
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
            Business
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">
            현대건기(부산경남) 업무
          </h1>
          <p className="mt-3 text-base leading-7 text-white/75 break-keep">
            HD건설기계 부산/경남 대리점 업무 전용 페이지입니다.
          </p>
        </div>
      </section>

      {/* ── 로그인 카드 ── */}
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-8">
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">
            Login
          </p>
          <h2 className="text-2xl font-semibold text-navy-900 mb-1">계정 로그인</h2>
          <p className="text-sm leading-6 text-gray-600 mb-8">
            관리자 / 현대건기(부산경남) 담당자만 접근 가능합니다.
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@company.com"
                className={inputClass}
                autoComplete="username"
                disabled={submitting || loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className={inputClass}
                autoComplete="current-password"
                disabled={submitting || loading}
              />
            </div>

            {!!err && (
              <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base hover:bg-orange-600 transition-all disabled:opacity-50"
            >
              {submitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}