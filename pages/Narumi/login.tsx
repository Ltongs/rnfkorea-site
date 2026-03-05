import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function NarumiLoginPage() {
  const { login, logout, user } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState(user?.email ?? "");
  const [err, setErr] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const { ok, role } = login(email);

    if (!ok) {
      setErr("접근 권한이 없습니다. (내부 사용자만 접근 가능)");
      // 외부로 저장된 상태 남기기 싫으면 바로 로그아웃
      logout();
      return;
    }

    nav("/narumi", { replace: true });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-200 rounded-2xl bg-white p-6 shadow-sm">
        <div className="text-2xl font-extrabold text-navy-900">나르미업무 로그인</div>
        <div className="text-sm text-gray-500 mt-2">
          내부 이메일만 접근 가능합니다.
        </div>

        {!!err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
            {err}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-xs font-extrabold text-gray-500 block mb-2">이메일</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="enter your e-mail adress"
              className="h-[52px] w-full px-4 rounded-xl border border-gray-200 bg-white
                         focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-3 bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all"
          >
            로그인
          </button>

          <div className="text-xs text-gray-400 leading-relaxed">
            * 이 방식은 “메뉴 숨김 + 접근 차단”을 프론트에서 처리합니다.<br />
            * 서버/DB까지 완전 차단하려면 Supabase RLS/서버 검증을 추가해야 합니다.
          </div>
        </form>
      </div>
    </div>
  );
}