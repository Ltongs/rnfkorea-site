// components/PageHeader.tsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Phone } from "lucide-react";
import { useAuth } from "../lib/auth";

/**
 * =========================
 * 튜닝 포인트
 * =========================
 * ✅ 닫힘이 느리면 CLOSE_DELAY만 더 줄이세요.
 * - 추천: 60~160ms
 */
const OPEN_DELAY = 0;     // hover 열림 지연 (0 추천)
const CLOSE_DELAY = 90;   // ✅ 닫힘 딜레이 (빠르게)
const BRIDGE_H = "h-6";   // 버튼↔드롭다운 사이 "브릿지" 높이

// 상단 버튼 기본 스타일
const topBtnBase =
  "relative inline-flex items-center gap-2 px-4 py-2 rounded-xl " +
  "text-sm font-extrabold text-navy-900 " +
  "hover:bg-gray-50 border border-transparent hover:border-gray-200 " +
  "transition-all whitespace-nowrap";

// ✅ 오렌지 밑줄 (hover / active)
const underlineHover =
  "after:content-[''] after:absolute after:left-0 after:bottom-0 " +
  "after:h-[2px] after:w-full after:bg-orange-500 " +
  "after:scale-x-0 after:origin-left after:transition-transform after:duration-200 " +
  "hover:after:scale-x-100";

const underlineActive = "text-orange-600 after:scale-x-100";

// dropdown item
const dropItem =
  "block w-full text-left px-4 py-3 text-sm font-extrabold text-navy-900 " +
  "hover:bg-gray-50 transition-all whitespace-nowrap";

const dropBox =
  "absolute right-0 top-full mt-0 w-[240px] rounded-2xl border border-gray-200 bg-white " +
  "shadow-[0_18px_50px_rgba(15,23,42,0.10)] z-[9999] pointer-events-auto";

// 드롭다운 공통 타이머 유틸
function useDropdownTimers() {
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpen = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  const clearClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const clearAll = () => {
    clearOpen();
    clearClose();
  };

  return { openTimer, closeTimer, clearOpen, clearClose, clearAll };
}

export default function PageHeader() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { user, isInternal } = useAuth() as any;

  const [openBiz, setOpenBiz] = useState(false);
  const [openShop, setOpenShop] = useState(false);
  const [openWork, setOpenWork] = useState(false);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const timers = useDropdownTimers();

  const closeAll = () => {
    setOpenBiz(false);
    setOpenShop(false);
    setOpenWork(false);
    timers.clearAll();
  };

  // ✅ 헤더 밖 클릭하면 닫기
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = headerRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      closeAll();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active 판정
  const bizActive = ["/tires", "/battery", "/export", "/finance", "/cargo-finance"].includes(pathname);
  const shopActive =
    pathname === "/tires-shop" ||
    pathname.startsWith("/tires-shop/") ||
    pathname === "/export-shop" ||
    pathname.startsWith("/export-shop/") ||
    pathname === "/battery-shop" ||
    pathname.startsWith("/battery-shop/");
  const workActive =
    pathname.startsWith("/work/") ||
    pathname.startsWith("/narumi") ||
    pathname === "/bson" ||
    pathname.startsWith("/bson/");

  // ✅ hover open/close
  const hoverOpen = (which: "biz" | "shop" | "work") => {
    timers.clearClose();

    if (OPEN_DELAY <= 0) {
      setOpenBiz(which === "biz");
      setOpenShop(which === "shop");
      setOpenWork(which === "work");
      return;
    }

    timers.clearOpen();
    timers.openTimer.current = setTimeout(() => {
      setOpenBiz(which === "biz");
      setOpenShop(which === "shop");
      setOpenWork(which === "work");
    }, OPEN_DELAY);
  };

  const hoverClose = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    timers.clearOpen();
    timers.clearClose();
    timers.closeTimer.current = setTimeout(() => setter(false), CLOSE_DELAY);
  };

  // ✅ 업무용 이동 (내부 사용자만 허용)
  const goWorkInternalOnly = (path: string) => {
    closeAll();
    if (user && isInternal) nav(path);
    else nav("/narumi/login");
  };

  // ✅ BS_ON (누구나 접근)
  const goBsonPublic = () => {
    closeAll();
    nav("/bson");
  };

  return (
    <header className="sticky top-0 z-[9999] bg-white/90 backdrop-blur border-b border-gray-200">
      <div
        ref={headerRef}
        className="container mx-auto px-4 h-16 flex items-center justify-between overflow-visible"
      >
        {/* 로고 */}
        <Link to="/" className="font-extrabold text-navy-900" onClick={closeAll}>
          RNF KOREA
        </Link>

        {/* ✅ pb-2: 밑줄/드롭다운이 잘리지 않게 */}
        <nav className="flex items-center gap-2 overflow-visible pb-2">
          {/* ========================= 사업영역 ========================= */}
          <div
            className="relative overflow-visible"
            onMouseEnter={() => hoverOpen("biz")}
            onMouseLeave={() => hoverClose(setOpenBiz)}
          >
            <button
              type="button"
              className={`${topBtnBase} ${underlineHover} ${bizActive ? underlineActive : ""}`}
              aria-expanded={openBiz}
              onPointerDown={(e) => {
                e.stopPropagation();
                timers.clearAll();
                setOpenBiz((v) => !v);
                setOpenShop(false);
                setOpenWork(false);
              }}
            >
              사업영역
              <ChevronDown size={16} className={`${openBiz ? "rotate-180" : ""} transition-transform`} />
            </button>

            {openBiz && (
  <>
    <div
      className={`absolute right-0 top-full w-[240px] ${BRIDGE_H} pointer-events-auto`}
      onMouseEnter={() => timers.clearClose()}
      onMouseLeave={() => hoverClose(setOpenBiz)}
    />
    <div
      className={dropBox}
      role="menu"
      onMouseEnter={() => timers.clearClose()}
      onMouseLeave={() => hoverClose(setOpenBiz)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Link to="/tires" className={dropItem} onClick={closeAll}>
        타이어
      </Link>

      <Link to="/battery" className={dropItem} onClick={closeAll}>
        배터리
      </Link>

      <Link to="/export" className={dropItem} onClick={closeAll}>
        노후장비 수출사업
      </Link>

      <Link to="/finance" className={dropItem} onClick={closeAll}>
        금융솔루션
      </Link>

      <Link to="/cargo-finance" className={dropItem} onClick={closeAll}>
        개인(개별)협회 전용 금융상품
      </Link>
    </div>
  </>
)}
          </div>

          {/* ========================= 쇼핑몰 ========================= */}
          <div
            className="relative overflow-visible"
            onMouseEnter={() => hoverOpen("shop")}
            onMouseLeave={() => hoverClose(setOpenShop)}
          >
            <button
              type="button"
              className={`${topBtnBase} ${underlineHover} ${shopActive ? underlineActive : ""}`}
              aria-expanded={openShop}
              onPointerDown={(e) => {
                e.stopPropagation();
                timers.clearAll();
                setOpenShop((v) => !v);
                setOpenBiz(false);
                setOpenWork(false);
              }}
            >
              쇼핑몰
              <ChevronDown size={16} className={`${openShop ? "rotate-180" : ""} transition-transform`} />
            </button>

            {openShop && (
              <>
                <div
                  className={`absolute right-0 top-full w-[240px] ${BRIDGE_H} pointer-events-auto`}
                  onMouseEnter={() => timers.clearClose()}
                  onMouseLeave={() => hoverClose(setOpenShop)}
                />
                <div
                  className={dropBox}
                  role="menu"
                  onMouseEnter={() => timers.clearClose()}
                  onMouseLeave={() => hoverClose(setOpenShop)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Link to="/tires-shop" className={dropItem} onClick={closeAll}>타이어 쇼핑몰</Link>
                  <Link to="/export-shop" className={dropItem} onClick={closeAll}>수출용 쇼핑몰</Link>
                  <Link to="/battery-shop" className={dropItem} onClick={closeAll}>배터리 쇼핑몰 (준비중)</Link>
                </div>
              </>
            )}
          </div>

          {/* ========================= 업무용 ========================= */}
          <div
            className="relative overflow-visible"
            onMouseEnter={() => hoverOpen("work")}
            onMouseLeave={() => hoverClose(setOpenWork)}
          >
            <button
              type="button"
              className={`${topBtnBase} ${underlineHover} ${workActive ? underlineActive : ""}`}
              aria-expanded={openWork}
              onPointerDown={(e) => {
                e.stopPropagation();
                timers.clearAll();
                setOpenWork((v) => !v);
                setOpenBiz(false);
                setOpenShop(false);
              }}
            >
              업무용
              <ChevronDown size={16} className={`${openWork ? "rotate-180" : ""} transition-transform`} />
            </button>

            {openWork && (
              <>
                <div
                  className={`absolute right-0 top-full w-[240px] ${BRIDGE_H} pointer-events-auto`}
                  onMouseEnter={() => timers.clearClose()}
                  onMouseLeave={() => hoverClose(setOpenWork)}
                />
                <div
                  className={dropBox}
                  role="menu"
                  onMouseEnter={() => timers.clearClose()}
                  onMouseLeave={() => hoverClose(setOpenWork)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button type="button" className={dropItem} onClick={() => goWorkInternalOnly("/work/narumi")}>
                    나르미업무
                  </button>

                  {/* ✅ BS_ON: 누구나 접근 */}
                  <button type="button" className={dropItem} onClick={goBsonPublic}>
                    BS_ON 업무
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 전화 */}
          <a
            href="tel:1551-1873"
            className="ml-2 hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-navy-900 text-navy-900 font-extrabold text-sm hover:bg-navy-900 hover:text-white transition-all"
            title="대표번호 1551-1873"
          >
            <Phone size={16} />
            1551-1873
          </a>
        </nav>
      </div>
    </header>
  );
}