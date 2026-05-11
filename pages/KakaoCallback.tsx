// pages/KakaoCallback.tsx
//
// 카카오 OAuth 인가코드를 받아 access_token / refresh_token으로 교환 후
// Supabase kakao_tokens 테이블에 저장합니다.

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const KAKAO_REST_API_KEY  = "b5d04de0bc091155983d5a1240b78a15";
const KAKAO_CLIENT_SECRET = "ZKJZmEKVOGNqlUvayIFj7QUac5iFH8UK";

export default function KakaoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code      = searchParams.get("code");
    const userRole  = searchParams.get("state"); // "admin" | "hyundaicm"
    const errorCode = searchParams.get("error");

    if (errorCode) {
      setStatus("error");
      setMessage("카카오 로그인이 취소되었습니다.");
      return;
    }

    if (!code || !userRole) {
      setStatus("error");
      setMessage("잘못된 접근입니다.");
      return;
    }

    const exchange = async () => {
      try {
        // 1. 인가코드 → 토큰 교환
        const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type:    "authorization_code",
            client_id:     KAKAO_REST_API_KEY,
            client_secret: KAKAO_CLIENT_SECRET,
            redirect_uri:  `${window.location.origin}/kakao-callback`,
            code,
          }),
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json();
          throw new Error(err.error_description ?? "토큰 교환 실패");
        }

        const tokenData = await tokenRes.json();
        const { access_token, refresh_token } = tokenData;

        // 2. Supabase kakao_tokens 테이블에 upsert
        const { error: dbError } = await supabase
          .from("kakao_tokens")
          .upsert(
            {
              user_role:     userRole,
              access_token,
              refresh_token: refresh_token ?? null,
              updated_at:    new Date().toISOString(),
            },
            { onConflict: "user_role" }
          );

        if (dbError) throw new Error(dbError.message);

        setStatus("success");
        setMessage("카카오톡 알림 연결이 완료되었습니다!");

        // 3초 후 연결 페이지로 이동
        setTimeout(() => navigate("/hyundaicm/kakao-connect", { replace: true }), 3000);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "알 수 없는 오류";
        setStatus("error");
        setMessage(msg);
      }
    };

    exchange();
  }, []); // eslint-disable-line

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-orange-200 border-t-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-navy-900">카카오 연결 중...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
            <p className="text-lg font-semibold text-navy-900 mb-2">연결 완료!</p>
            <p className="text-sm text-gray-500">{message}</p>
            <p className="text-xs text-gray-400 mt-3">잠시 후 자동으로 이동합니다...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-2xl">✕</div>
            <p className="text-lg font-semibold text-navy-900 mb-2">연결 실패</p>
            <p className="text-sm text-red-600 mb-4">{message}</p>
            <button
              onClick={() => navigate("/hyundaicm/kakao-connect", { replace: true })}
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all"
            >
              다시 시도
            </button>
          </>
        )}
      </div>
    </div>
  );
}