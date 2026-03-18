// pages/Narumi/login.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import PageTitle from "../../components/PageTitle";

const inputClass =
  "h-[52px] w-full px-4 rounded-xl border border-gray-200 bg-white " +
  "focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none";

export default function NarumiLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading, isInternal } = useAuth() as any;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const redirectTo =
    (location.state as any)?.from && typeof (location.state as any)?.from === "string"
      ? (location.state as any).from
      : "/narumi";

  useEffect(() => {
    if (!loading && user && isInternal) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, user, isInternal, navigate, redirectTo]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim()) {
      setErr("이메일을 입력해주세요.");
      return;
    }

    if (!password.trim()) {
      setErr("비밀번호를 입력해주세요.");
      return;
    }

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
    <div className="container mx-auto px-4 py-10">
      <PageTitle
        title="Narumi 업무 로그인"
        desc="나르미 업무 페이지 접근을 위한 로그인 화면입니다."
      />

      <div className="max-w-md mx-auto mt-8 border border-gray-200 rounded-2xl bg-white shadow-sm p-6">
        <div className="text-lg font-extrabold text-navy-900 mb-2">
          계정 로그인
        </div>

        <div className="text-sm text-gray-500 mb-6 leading-relaxed">
          관리자 / 나르미모터스 / 롯데오토리스 계정만 접근 가능합니다.
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-extrabold text-gray-500 block mb-2">
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
            <label className="text-xs font-extrabold text-gray-500 block mb-2">
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
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold whitespace-pre-wrap">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full px-6 py-3 rounded-xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 disabled:opacity-60"
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}