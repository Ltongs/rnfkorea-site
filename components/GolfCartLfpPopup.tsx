import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

const DISMISS_KEY = "golfcartLfpPopupDismissedUntil";

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const until = window.localStorage.getItem(DISMISS_KEY);
  if (!until) return false;
  return Date.now() < Number(until);
}

function dismissForToday() {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  window.localStorage.setItem(DISMISS_KEY, String(endOfDay.getTime()));
}

export const GolfCartLfpPopup: React.FC = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;
    const timer = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const close = () => {
    setEntered(false);
    setTimeout(() => setVisible(false), 200);
  };

  const closeForToday = () => {
    dismissForToday();
    close();
  };

  const goToPage = () => {
    close();
    navigate("/golfcart-battery");
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[10050] flex items-center justify-center px-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="골프카트용 LFP 배터리 광고"
    >
      <button
        type="button"
        aria-label="배경 닫기"
        onClick={close}
        className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm"
      />

      <div
        className={`relative w-full max-w-[420px] rounded-3xl overflow-hidden bg-navy-900 shadow-[0_30px_80px_rgba(0,0,0,0.4)] transition-all duration-200 ${
          entered ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.98]"
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={goToPage}
          className="block w-full text-left group"
        >
          <div className="relative h-52 overflow-hidden">
            <img
              src="/battery/golfcart-lfp/hero-mobile.webp"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/10 to-transparent" />
          </div>

          <div className="px-6 pt-1 pb-6">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-brand-lime">
              SPIDERWAY LFP BATTERY
            </p>
            <h3 className="mt-2 text-2xl font-black text-white leading-tight break-keep">
              골프카트용 LFP 배터리
              <br />
              51.2V 150Ah
            </h3>
            <ul className="mt-4 space-y-1.5 text-[13px] text-gray-300">
              <li>· 5년(60개월) 무상 보증 · CE·FCC·UL·RoHS 인증</li>
              <li>· 초기비용 0원, 월 88,000원 렌탈</li>
              <li>· 타미우스 CC 20대 1년 운영 검증 완료</li>
            </ul>

            <span className="mt-5 inline-flex items-center justify-center w-full px-6 py-3 rounded-full bg-orange-500 text-white font-bold group-hover:bg-orange-600 transition-colors">
              자세히 보기
            </span>
          </div>
        </button>

        <div className="px-6 pb-5 -mt-1 flex justify-center">
          <button
            type="button"
            onClick={closeForToday}
            className="text-[12px] text-gray-400 hover:text-gray-300 transition-colors"
          >
            오늘 하루 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
};

export default GolfCartLfpPopup;
