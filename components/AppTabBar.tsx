// components/AppTabBar.tsx
// AI비서 상단 탭바를 현대CM/RentalOS/태산통운/나르미/상담관리 등 다른 업무 페이지에서도
// 그대로 재사용하기 위한 공용 탭바. AI비서 본체(pages/secretary/index.tsx)의 탭바는
// 내부 상태와 얽혀있어 그대로 공유하기 어려워, 라벨/이동 로직만 동일하게 맞춘 경량 버전이다.
// 내부(chat/schedule/...) 탭 클릭 시 sessionStorage("sec_tab")를 미리 심어두고 /work/secretary로
// 이동하면 AI비서가 그 탭을 그대로 열어서 보여준다(AI비서의 tab state 초기화 로직과 동일한 계약).
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export type AppTabKey =
  | "chat" | "schedule" | "status" | "orders" | "jinheung" | "narumi" | "email" | "memo"
  | "financehub" | "exportshop" | "quotation" | "cns" | "performance" | "rentalos"
  | "hyundaicm" | "numbersearch" | "taesan" | "callmanagement";

export const APP_TAB_ORDER: AppTabKey[] = [
  "chat", "schedule", "status", "cns", "orders", "hyundaicm", "jinheung", "narumi",
  "taesan", "quotation", "performance", "rentalos", "exportshop", "financehub",
  "callmanagement", "numbersearch", "email", "memo",
];

// 클릭 시 이 페이지 안에서 렌더링하지 않고 곧바로 다른 라우트로 이동하는 탭
export const APP_EXTERNAL_TAB_LINKS: Partial<Record<AppTabKey, string>> = {
  hyundaicm: "/hyundaicm",
  rentalos: "/rental-os",
  taesan: "/taesan",
  callmanagement: "/work/call-management",
};

const APP_TAB_LABELS: Record<AppTabKey, string> = {
  chat: "💬 채팅", schedule: "📅 일정", status: "📊 업무현황", orders: "📦 주문·상담",
  jinheung: "🔧 진흥주문", narumi: "🚛 나르미", memo: "📝 메모", financehub: "💵 매출/매입",
  exportshop: "🌏 수출장비", quotation: "📋 견적서", cns: "🗂 통합상담", performance: "📈 실적관리",
  rentalos: "🚐 Rental_O/S", hyundaicm: "🏗 현대CM", numbersearch: "🔍 번호검색",
  taesan: "🚚 태산통운", callmanagement: "📞 상담관리", email: "📧 이메일",
};

// pages/secretary/index.tsx의 탭 버튼 스타일(TB/TA/TI)과 완전히 동일하게 맞춘다.
const TB = "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all";
const TA = "bg-[#0f172a] text-white border-[#0f172a]";
const TI = "bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-200";

export default function AppTabBar({ activeTab }: { activeTab: AppTabKey }) {
  const navigate = useNavigate();
  const [unreadEmail, setUnreadEmail] = useState(0);

  useEffect(() => {
    supabase
      .from("email_reports")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .then(({ count }) => setUnreadEmail(count ?? 0));
  }, []);

  const goTab = (t: AppTabKey) => {
    if (t === activeTab) return;
    const link = APP_EXTERNAL_TAB_LINKS[t];
    if (link) { navigate(link); return; }
    try { sessionStorage.setItem("sec_tab", t); } catch {}
    navigate("/work/secretary");
  };

  // AI비서와 동일한 Ctrl+Option(Alt)+←/→ 탭 순환 단축키 — 여기서도 동일하게 동작해야 하므로
  // AI비서 쪽 로직을 그대로 복제한다(배열 끝에서 순환, 외부 탭은 클릭과 동일하게 실제 이동).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      const curIdx = APP_TAB_ORDER.indexOf(activeTab);
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (curIdx + delta + APP_TAB_ORDER.length) % APP_TAB_ORDER.length;
      goTab(APP_TAB_ORDER[nextIdx]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab]);

  return (
    <div
      className="app-tab-scroll flex items-center gap-1.5 overflow-x-auto"
      style={{ scrollbarWidth: "none" }}
    >
      <style>{`.app-tab-scroll::-webkit-scrollbar{display:none;}`}</style>
      {APP_TAB_ORDER.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => goTab(t)}
          className={`${TB} ${activeTab === t ? TA : TI} whitespace-nowrap flex-shrink-0`}
        >
          {t === "email" ? (
            <span className="inline-flex items-center gap-1">
              📧 이메일
              {unreadEmail > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unreadEmail}
                </span>
              )}
            </span>
          ) : (
            APP_TAB_LABELS[t]
          )}
        </button>
      ))}
    </div>
  );
}
