// pages/HyundaiCM/KakaoConnect.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

const EDGE_FN_URL = "https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao";

export default function KakaoConnectPage() {
  const { user, isAdmin, isHyundaiCM } = useAuth() as any;
  const userRole = isAdmin ? "admin" : isHyundaiCM ? "hyundaicm" : null;

  const [connected,    setConnected]    = useState<boolean | null>(null);
  const [checking,     setChecking]     = useState(true);
  const [accessToken,  setAccessToken]  = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState("");
  const [testMsg,      setTestMsg]      = useState("");
  const [testing,      setTesting]      = useState(false);

  useEffect(() => {
    if (!userRole) { setChecking(false); return; }
    supabase.from("kakao_tokens").select("user_role")
      .eq("user_role", userRole).maybeSingle()
      .then(({ data }) => { setConnected(!!data); setChecking(false); });
  }, [userRole]);

  const handleSave = async () => {
    if (!accessToken.trim()) { setSaveMsg("Access Token을 입력해주세요."); return; }
    setSaving(true); setSaveMsg("");
    const { error } = await supabase.from("kakao_tokens").upsert(
      { user_role: userRole, access_token: accessToken.trim(),
        refresh_token: refreshToken.trim() || null,
        updated_at: new Date().toISOString() },
      { onConflict: "user_role" }
    );
    setSaving(false);
    if (error) { setSaveMsg(`저장 실패: ${error.message}`); }
    else { setConnected(true); setSaveMsg("✓ 저장 완료! 이제 신규등록/단계변경 시 카카오톡 알림이 발송됩니다."); setAccessToken(""); setRefreshToken(""); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("카카오 연결을 해제하시겠습니까?")) return;
    await supabase.from("kakao_tokens").delete().eq("user_role", userRole);
    setConnected(false); setSaveMsg("");
  };

  const handleTest = async () => {
    setTesting(true); setTestMsg("");
    try {
      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new", caseNo: "TEST-001",
          customerName: "테스트고객", customerType: "개인", equipmentTon: "20톤",
          financeCompany: "NH캐피탈", salesRep: "홍길동", installmentPrincipal: 50000000,
        }),
      });
      const data = await res.json();
      if (data.success) setTestMsg("✓ 테스트 메시지 발송 성공! 카카오톡을 확인해주세요.");
      else setTestMsg(`발송 실패: ${data.error ?? data.warning ?? JSON.stringify(data)}`);
    } catch (e: any) { setTestMsg(`오류: ${e?.message ?? e}`); }
    setTesting(false);
  };

  if (!userRole) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-6 py-4 text-sm font-medium">
        관리자 또는 현대건설기계 담당자만 접근할 수 있습니다.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative bg-[#0a192f] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-400">Settings</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold leading-[1.15] text-white break-keep">카카오톡 알림 설정</h1>
          <p className="mt-3 text-base leading-7 text-white/75 break-keep">신규등록 및 단계변경 시 카카오톡으로 알림을 받습니다.</p>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-4 py-12 space-y-6">

        {/* 상태 카드 */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Status</p>
          <h2 className="text-xl font-semibold text-navy-900 mb-4">연결 상태</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div><span className="font-medium text-navy-900 w-20 inline-block">계정:</span>{user?.email}</div>
            <div><span className="font-medium text-navy-900 w-20 inline-block">역할:</span>{isAdmin ? "관리자" : "현대건설기계 담당자"}</div>
            <div><span className="font-medium text-navy-900 w-20 inline-block">상태:</span>
              {checking ? "확인 중..." : connected
                ? <span className="text-emerald-600 font-semibold">✓ 연결됨</span>
                : <span className="text-gray-400">미연결</span>}
            </div>
          </div>
          {connected && (
            <div className="mt-4 flex gap-3">
              <button onClick={handleTest} disabled={testing}
                className="inline-flex items-center justify-center px-4 py-2 rounded-2xl bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-all disabled:opacity-50">
                {testing ? "전송 중..." : "테스트 메시지 발송"}
              </button>
              <button onClick={handleDisconnect}
                className="inline-flex items-center justify-center px-4 py-2 rounded-2xl border border-gray-300 bg-white text-navy-900 font-semibold text-sm hover:bg-gray-50 transition-all">
                연결 해제
              </button>
            </div>
          )}
          {testMsg && <p className={`mt-3 text-sm font-medium ${testMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{testMsg}</p>}
        </div>

        {/* 토큰 발급 안내 */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
          <p className="text-sm font-semibold text-orange-700 mb-3">📋 Access Token 발급 방법</p>
          <ol className="text-sm text-orange-800 space-y-1.5 leading-relaxed list-decimal list-inside">
            <li>아래 버튼으로 카카오 로그인 페이지 열기</li>
            <li>카카오 계정으로 로그인 후 동의</li>
            <li>이동된 페이지(빈 화면)의 주소창에서 <code className="bg-orange-100 px-1 rounded">code=</code> 뒤 값 복사</li>
            <li>복사한 code 값을 아래 입력란에 붙여넣고 저장</li>
          </ol>
          <a
            href={`https://kauth.kakao.com/oauth/authorize?client_id=b5d04de0bc091155983d5a1240b78a15&redirect_uri=https://www.rnfkorea.co.kr/kakao-callback&response_type=code&scope=talk_message&state=${userRole}`}
            target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FEE500] text-[#191919] font-semibold text-sm hover:bg-[#fada00] transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.607 5.082 4.032 6.566L5.1 21l4.478-2.394C10.32 18.858 11.148 19 12 19c5.523 0 10-3.477 10-7.8S17.523 3 12 3z"/>
            </svg>
            카카오 로그인 페이지 열기
          </a>
        </div>

        {/* 토큰 입력 */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <p className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500 mb-2">Token</p>
          <h2 className="text-xl font-semibold text-navy-900 mb-5">토큰 등록</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">Access Token <span className="text-red-500">*</span></label>
              <input type="text" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                placeholder="카카오 access_token 붙여넣기"
                className="h-[48px] w-full px-4 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-900 mb-2">Refresh Token <span className="text-gray-400 font-normal">(선택 — 자동 갱신용)</span></label>
              <input type="text" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="refresh_token 붙여넣기 (선택)"
                className="h-[48px] w-full px-4 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-navy-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50 focus:border-orange-400 transition-all" />
            </div>
            {saveMsg && <p className={`text-sm font-medium ${saveMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{saveMsg}</p>}
            <button onClick={handleSave} disabled={saving}
              className="w-full inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base hover:bg-orange-600 transition-all disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 leading-relaxed">
          관리자와 담당자 각각 한 번씩 등록해야 합니다.<br/>
          Refresh Token 등록 시 만료 후 자동 갱신됩니다.
        </p>
      </div>
    </div>
  );
}