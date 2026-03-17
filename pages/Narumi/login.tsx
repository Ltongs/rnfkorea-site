import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

const STORAGE_KEY = "narumi_saved_email";

export default function NarumiLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ 저장된 이메일 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await login(email, password);

      if (!res.ok) {
        setErr(res.message || "로그인 실패");
        return;
      }

      // ✅ 아이디 기억 처리
      if (remember) {
        localStorage.setItem(STORAGE_KEY, email);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      navigate("/narumi", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">나르미 로그인</h1>
          <p className="text-sm text-gray-500 mt-2">
            이메일과 비밀번호로 로그인하세요.
          </p>
        </div>

        {/* 이메일 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-2">
            이메일
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-orange-400"
          />
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="text-sm font-bold text-gray-700 block mb-2">
            비밀번호
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:border-orange-400"
          />
        </div>

        {/* ✅ 아이디 기억하기 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-orange-500"
          />
          <span className="text-sm font-bold text-gray-700">
            아이디 기억하기
          </span>
        </div>

        {!!err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}