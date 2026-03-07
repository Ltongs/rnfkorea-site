import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Phone } from "lucide-react";
import { useAuth } from "../lib/auth";

/**
 * =========================
 * 튜닝 포인트
 * =========================
 */
const OPEN_DELAY = 0;
const CLOSE_DELAY = 90;
const BRIDGE_H = "h-6";

const topBtnBase =
  "relative inline-flex items-center gap-2 px-4 py-2 rounded-xl " +
  "text-sm font-extrabold text-navy-900 " +
  "hover:bg-gray-50 border border-transparent hover:border-gray-200 " +
  "transition-all whitespace-nowrap";

const underlineHover =
  "after:content-[''] after:absolute after:left-0 after:bottom-0 " +
  "after:h-[2px] after:w-full after:bg-orange-500 " +
  "after:scale-x-0 after:origin-left after:transition-transform after:duration-200 " +
  "hover:after:scale-x-100";

const underlineActive = "text-orange-600 after:scale-x-100";

const dropItem =
  "block w-full text-left px-4 py-3 text-sm font-extrabold text-navy-900 " +
  "hover:bg-gray-50 transition-all whitespace-nowrap";

const dropBox =
  "absolute right-0 top-full mt-0 w-[240px] rounded-2xl border border-gray-200 bg-white " +
  "shadow-[0_18px_50px_rgba(15,23,42,0.10)] z-[9999] pointer-events-auto";

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

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = headerRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      closeAll();
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const bizActive = [
    "/tires",
    "/battery",
    "/export",
    "/finance",
    "/cargo-finance",
  ].includes(pathname);

  const shopActive =
    pathname.startsWith("/tires-shop") ||
    pathname.startsWith("/export-shop") ||
    pathname.startsWith("/battery-shop");

  const workActive =
    pathname.startsWith("/work/") ||
    pathname.startsWith("/narumi") ||
    pathname.startsWith("/bson");

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

  const goWorkInternalOnly = (path: string) => {
    closeAll();
    if (user && isInternal) nav(path);
    else nav("/narumi/login");
  };

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
        {/* ======================= 로고 ======================= */}
        <Link
          to="/"
          className="flex items-center gap-0.5"
          onClick={closeAll}
        >
          <img
            src="/logo/RNF_LOGO.png"
            alt="RNF KOREA"
            className="h-20 w-auto object-contain"
          />
          <span className="font-extrabold text-navy-900 leading-none">
  RNF KOREA
</span>
        </Link>

        {/* ======================= 메뉴 ======================= */}
        <nav className="flex items-center gap-2 overflow-visible pb-2">

          {/* 사업영역 */}
          <div
            className="relative"
            onMouseEnter={() => hoverOpen("biz")}
            onMouseLeave={() => hoverClose(setOpenBiz)}
          >
            <button
              type="button"
              className={`${topBtnBase} ${underlineHover} ${bizActive ? underlineActive : ""}`}
            >
              사업영역
              <ChevronDown size={16} />
            </button>

            {openBiz && (
              <>
                <div className={`absolute right-0 top-full w-[240px] ${BRIDGE_H}`} />
                <div className={dropBox}>
                  <Link to="/tires" className={dropItem}>타이어</Link>
                  <Link to="/battery" className={dropItem}>배터리</Link>
                  <Link to="/export" className={dropItem}>노후장비 수출사업</Link>
                  <Link to="/finance" className={dropItem}>금융솔루션</Link>
                  <Link to="/cargo-finance" className={dropItem}>
                    개인(개별)협회 전용 금융상품
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* 쇼핑몰 */}
          <div
            className="relative"
            onMouseEnter={() => hoverOpen("shop")}
            onMouseLeave={() => hoverClose(setOpenShop)}
          >
            <button
              type="button"
              className={`${topBtnBase} ${underlineHover} ${shopActive ? underlineActive : ""}`}
            >
              쇼핑몰
              <ChevronDown size={16} />
            </button>

            {openShop && (
              <>
                <div className={`absolute right-0 top-full w-[240px] ${BRIDGE_H}`} />
                <div className={dropBox}>
                  <Link to="/tires-shop" className={dropItem}>타이어 쇼핑몰</Link>
                  <Link to="/export-shop" className={dropItem}>수출용 쇼핑몰</Link>
                  <Link to="/battery-shop" className={dropItem}>
                    배터리 쇼핑몰 (준비중)
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* 업무용 */}
          <div
            className="relative"
            onMouseEnter={() => hoverOpen("work")}
            onMouseLeave={() => hoverClose(setOpenWork)}
          >
            <button
              type="button"
              className={`${topBtnBase} ${underlineHover} ${workActive ? underlineActive : ""}`}
            >
              업무용
              <ChevronDown size={16} />
            </button>

            {openWork && (
              <>
                <div className={`absolute right-0 top-full w-[240px] ${BRIDGE_H}`} />
                <div className={dropBox}>
                  <button
                    type="button"
                    className={dropItem}
                    onClick={() => goWorkInternalOnly("/work/narumi")}
                  >
                    나르미업무
                  </button>

                  <button
                    type="button"
                    className={dropItem}
                    onClick={goBsonPublic}
                  >
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
          >
            <Phone size={16} />
            1551-1873
          </a>

        </nav>
      </div>
    </header>
  );
}