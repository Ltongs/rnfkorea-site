// components/PageHeader.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Phone } from "lucide-react";
import { useAuth } from "../lib/auth";

const OPEN_DELAY = 0;
const CLOSE_DELAY = 90;
const BRIDGE_H = "h-4";

const topBtnBase =
  "relative inline-flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 rounded-xl " +
  "text-[13px] md:text-sm font-extrabold text-navy-900 " +
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
  "hover:bg-gray-50 transition-all break-keep";

const desktopDropBoxBase =
  "absolute left-0 top-full mt-1 w-[240px] rounded-2xl border border-gray-200 bg-white " +
  "shadow-[0_18px_50px_rgba(15,23,42,0.10)] z-[9999] pointer-events-auto " +
  "opacity-100 translate-y-0 transition-all duration-180 ease-out";

const mobileDropBoxBase =
  "fixed rounded-2xl border border-gray-200 bg-white " +
  "shadow-[0_18px_50px_rgba(15,23,42,0.18)] z-[10000] pointer-events-auto " +
  "opacity-100 translate-y-0 transition-all duration-180 ease-out";

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

type MobileMenuStyle = React.CSSProperties;

function calcMobileMenuStyle(btnEl: HTMLButtonElement | null): MobileMenuStyle {
  const vw = window.innerWidth;
  const gutter = 8;
  const maxWidth = 288; // 18rem
  const width = Math.min(maxWidth, vw - gutter * 2);

  if (!btnEl) {
    return {
      top: 68,
      left: gutter,
      width,
    };
  }

  const rect = btnEl.getBoundingClientRect();
  const top = rect.bottom + 6;

  // 버튼의 왼쪽 기준으로 열되, 화면 밖으로 나가지 않도록 clamp
  const desiredLeft = rect.left;
  const clampedLeft = Math.max(gutter, Math.min(desiredLeft, vw - width - gutter));

  return {
    top,
    left: clampedLeft,
    width,
  };
}

export default function PageHeader() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { user, isInternal } = useAuth() as any;

  const [openBiz, setOpenBiz] = useState(false);
  const [openShop, setOpenShop] = useState(false);
  const [openWork, setOpenWork] = useState(false);
  const [isMobileMenuMode, setIsMobileMenuMode] = useState(false);

  const [bizMenuStyle, setBizMenuStyle] = useState<MobileMenuStyle>({});
  const [shopMenuStyle, setShopMenuStyle] = useState<MobileMenuStyle>({});
  const [workMenuStyle, setWorkMenuStyle] = useState<MobileMenuStyle>({});

  const headerRef = useRef<HTMLDivElement | null>(null);
  const bizBtnRef = useRef<HTMLButtonElement | null>(null);
  const shopBtnRef = useRef<HTMLButtonElement | null>(null);
  const workBtnRef = useRef<HTMLButtonElement | null>(null);

  const timers = useDropdownTimers();

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobileMenuMode(window.innerWidth < 768);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  const closeAll = () => {
    setOpenBiz(false);
    setOpenShop(false);
    setOpenWork(false);
    timers.clearAll();
  };

  const handleMenuNavigate = () => {
    closeAll();
  };

  useEffect(() => {
    closeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = headerRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      closeAll();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 모바일에서 열려 있는 메뉴 위치를 항상 다시 계산
  useLayoutEffect(() => {
    if (!isMobileMenuMode) return;

    const updatePositions = () => {
      if (openBiz) setBizMenuStyle(calcMobileMenuStyle(bizBtnRef.current));
      if (openShop) setShopMenuStyle(calcMobileMenuStyle(shopBtnRef.current));
      if (openWork) setWorkMenuStyle(calcMobileMenuStyle(workBtnRef.current));
    };

    updatePositions();
    window.addEventListener("resize", updatePositions);
    window.addEventListener("scroll", updatePositions, true);

    return () => {
      window.removeEventListener("resize", updatePositions);
      window.removeEventListener("scroll", updatePositions, true);
    };
  }, [isMobileMenuMode, openBiz, openShop, openWork]);

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

  const hoverOpen = (which: "biz" | "shop" | "work") => {
    if (isMobileMenuMode) return;

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
    if (isMobileMenuMode) return;

    timers.clearOpen();
    timers.clearClose();
    timers.closeTimer.current = setTimeout(() => setter(false), CLOSE_DELAY);
  };

  const toggleMenu = (which: "biz" | "shop" | "work") => {
    timers.clearAll();

    if (which === "biz") {
      const next = !openBiz;
      setOpenBiz(next);
      setOpenShop(false);
      setOpenWork(false);
      if (isMobileMenuMode && next) {
        setBizMenuStyle(calcMobileMenuStyle(bizBtnRef.current));
      }
    }

    if (which === "shop") {
      const next = !openShop;
      setOpenShop(next);
      setOpenBiz(false);
      setOpenWork(false);
      if (isMobileMenuMode && next) {
        setShopMenuStyle(calcMobileMenuStyle(shopBtnRef.current));
      }
    }

    if (which === "work") {
      const next = !openWork;
      setOpenWork(next);
      setOpenBiz(false);
      setOpenShop(false);
      if (isMobileMenuMode && next) {
        setWorkMenuStyle(calcMobileMenuStyle(workBtnRef.current));
      }
    }
  };

  const goWorkInternalOnly = (path: string) => {
    handleMenuNavigate();
    if (user && isInternal) nav(path);
    else nav("/narumi/login");
  };

  const goBsonPublic = () => {
    handleMenuNavigate();
    nav("/bson");
  };

  return (
    <header className="sticky top-0 z-[9999] bg-white/95 backdrop-blur border-b border-gray-200">
      <div
        ref={headerRef}
        className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between overflow-visible"
      >
        <Link
          to="/"
          className="flex items-center shrink-0"
          onClick={closeAll}
          aria-label="RNF KOREA 홈으로 이동"
        >
          <img
            src="/logo/RNF_LOGO.png"
            alt="RNF KOREA"
            className="h-14 md:h-[72px] lg:h-[80px] w-auto object-contain"
          />
        </Link>

        <nav className="flex items-center gap-1 md:gap-2 overflow-visible">
          {/* 사업영역 */}
          <div
            className="relative overflow-visible"
            onMouseEnter={() => hoverOpen("biz")}
            onMouseLeave={() => hoverClose(setOpenBiz)}
          >
            <button
              ref={bizBtnRef}
              type="button"
              className={`${topBtnBase} ${underlineHover} ${bizActive ? underlineActive : ""}`}
              aria-expanded={openBiz}
              onPointerDown={(e) => {
                e.stopPropagation();
                toggleMenu("biz");
              }}
            >
              사업영역
              <ChevronDown
                size={16}
                className={`${openBiz ? "rotate-180" : ""} transition-transform`}
              />
            </button>

            {openBiz && (
              <>
                {!isMobileMenuMode && (
                  <div
                    className={`absolute left-0 top-full w-[240px] ${BRIDGE_H} pointer-events-auto`}
                    onMouseEnter={() => timers.clearClose()}
                    onMouseLeave={() => hoverClose(setOpenBiz)}
                  />
                )}

                <div
                  className={isMobileMenuMode ? mobileDropBoxBase : desktopDropBoxBase}
                  style={isMobileMenuMode ? bizMenuStyle : undefined}
                  role="menu"
                  onMouseEnter={() => {
                    if (!isMobileMenuMode) timers.clearClose();
                  }}
                  onMouseLeave={() => hoverClose(setOpenBiz)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Link to="/tires" className={dropItem} onClick={handleMenuNavigate}>
                    타이어
                  </Link>

                  <Link to="/battery" className={dropItem} onClick={handleMenuNavigate}>
                    배터리
                  </Link>

                  <Link to="/export" className={dropItem} onClick={handleMenuNavigate}>
                    노후장비 수출사업
                  </Link>

                  <Link to="/finance" className={dropItem} onClick={handleMenuNavigate}>
                    금융솔루션
                  </Link>

                  <Link to="/cargo-finance" className={dropItem} onClick={handleMenuNavigate}>
                    개인(개별)협회 전용 금융상품
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* 쇼핑몰 */}
          <div
            className="relative overflow-visible"
            onMouseEnter={() => hoverOpen("shop")}
            onMouseLeave={() => hoverClose(setOpenShop)}
          >
            <button
              ref={shopBtnRef}
              type="button"
              className={`${topBtnBase} ${underlineHover} ${shopActive ? underlineActive : ""}`}
              aria-expanded={openShop}
              onPointerDown={(e) => {
                e.stopPropagation();
                toggleMenu("shop");
              }}
            >
              쇼핑몰
              <ChevronDown
                size={16}
                className={`${openShop ? "rotate-180" : ""} transition-transform`}
              />
            </button>

            {openShop && (
              <>
                {!isMobileMenuMode && (
                  <div
                    className={`absolute left-0 top-full w-[240px] ${BRIDGE_H} pointer-events-auto`}
                    onMouseEnter={() => timers.clearClose()}
                    onMouseLeave={() => hoverClose(setOpenShop)}
                  />
                )}

                <div
                  className={isMobileMenuMode ? mobileDropBoxBase : desktopDropBoxBase}
                  style={isMobileMenuMode ? shopMenuStyle : undefined}
                  role="menu"
                  onMouseEnter={() => {
                    if (!isMobileMenuMode) timers.clearClose();
                  }}
                  onMouseLeave={() => hoverClose(setOpenShop)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Link to="/tires-shop" className={dropItem} onClick={handleMenuNavigate}>
                    타이어 쇼핑몰
                  </Link>
                  <Link to="/export-shop" className={dropItem} onClick={handleMenuNavigate}>
                    수출용 쇼핑몰
                  </Link>
                  <Link to="/battery-shop" className={dropItem} onClick={handleMenuNavigate}>
                    배터리 쇼핑몰 (준비중)
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* 업무용 */}
          <div
            className="relative overflow-visible"
            onMouseEnter={() => hoverOpen("work")}
            onMouseLeave={() => hoverClose(setOpenWork)}
          >
            <button
              ref={workBtnRef}
              type="button"
              className={`${topBtnBase} ${underlineHover} ${workActive ? underlineActive : ""}`}
              aria-expanded={openWork}
              onPointerDown={(e) => {
                e.stopPropagation();
                toggleMenu("work");
              }}
            >
              업무용
              <ChevronDown
                size={16}
                className={`${openWork ? "rotate-180" : ""} transition-transform`}
              />
            </button>

            {openWork && (
              <>
                {!isMobileMenuMode && (
                  <div
                    className={`absolute left-0 top-full w-[240px] ${BRIDGE_H} pointer-events-auto`}
                    onMouseEnter={() => timers.clearClose()}
                    onMouseLeave={() => hoverClose(setOpenWork)}
                  />
                )}

                <div
                  className={isMobileMenuMode ? mobileDropBoxBase : desktopDropBoxBase}
                  style={isMobileMenuMode ? workMenuStyle : undefined}
                  role="menu"
                  onMouseEnter={() => {
                    if (!isMobileMenuMode) timers.clearClose();
                  }}
                  onMouseLeave={() => hoverClose(setOpenWork)}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={dropItem}
                    onClick={() => goWorkInternalOnly("/narumi")}
                  >
                    나르미업무
                  </button>

                  <button type="button" className={dropItem} onClick={goBsonPublic}>
                    BS_ON 업무
                  </button>
                </div>
              </>
            )}
          </div>

          <a
            href="tel:1551-1873"
            className="ml-1 md:ml-2 hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-navy-900 text-navy-900 font-extrabold text-sm hover:bg-navy-900 hover:text-white transition-all"
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