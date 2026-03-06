import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  Phone,
  Battery,
  Truck,
  Wallet,
  Check,
  Download,
  Loader2,
  Send,
  User,
  Mail,
  MapPin,
  Leaf,
} from "lucide-react";

import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate
} from "react-router-dom";

/* 아이콘 */
import {
  IconConsult,
  IconReview,
  IconProposal,
  IconContract
} from "./ProcessIcons";

/* auth */
import { AuthProvider, useAuth } from "./lib/auth";

/* ✅ Header */
import PageHeader from "./components/PageHeader";

/* Pages — 반드시 직접 파일 경로로 */
import NarumiPage from "./pages/Narumi";
import BsonWorkPage from "./pages/BsonWork/index";
import NarumiLoginPage from "./pages/Narumi/login";
import SitemapPage from "./pages/Sitemap";
import IndividualCargoFinancePage from "./pages/IndividualCargoFinance";

import TireShopPage from "./pages/TireShop/index";
import TireShopDetailPage from "./pages/TireShop/detail";
import { fetchTireRows } from "./lib/tiresCsv";
import { TIRE_CSV_URL } from "./pages/TireShop/config";
import { ProjectConsultForm } from "./components/ProjectConsultForm";

const CARD_H = "h-[168px] md:h-[176px]"; // ✅ 완전 고정 높이 (원하면 숫자만 조절)

const cardBase =
  `
  group border border-gray-200 rounded-xl bg-white overflow-hidden text-left
  ${CARD_H}
  transition-all duration-200
  hover:shadow-md hover:border-gray-300 hover:-translate-y-[2px]
  focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50
  `;

const cardTitle =
  "text-lg font-extrabold text-navy-900 transition-colors duration-200 group-hover:text-orange-600";

const cardDesc =

  "text-sm text-gray-600 leading-snug line-clamp-2"; // ✅ 텍스트 길어져도 높이 유지 (2줄 컷)
const CardShell: React.FC<{
  title: string;
  desc: string;
  imgSrc: string;
  imgAlt: string;
}> = ({ title, desc, imgSrc, imgAlt }) => (
  <div className="flex h-full">
    {/* LEFT */}
    <div className="flex-1 min-w-0 p-6 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-1 rounded bg-orange-500" />
        <h3 className={cardTitle}>{title}</h3>
      </div>
      <p className={cardDesc}>{desc}</p>
    </div>

    {/* RIGHT */}
    <div className="relative w-[40%] min-w-[110px] h-full">
      <img
        src={imgSrc}
        alt={imgAlt}
        className="
          h-full w-full object-cover
          transition-transform duration-500
          group-hover:scale-[1.04]
        "
        loading="lazy"
      />
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
    </div>
  </div>
);



type TruckCategory = "cargo" | "dump" | "bus";
// =========================
// Inventory CSV (Google Sheets) Utils  ✅ (Single Source of Truth)
// =========================

type InventoryCsvRow = {
  id: string;
  type: "forklift" | "excavator";
  title: string;

  year?: string;
  brand?: string;
  capacity?: string;
  mast?: string;
  hours?: string;
  condition?: string;
  remarks?: string;

  imgCount?: number; // ✅ number로 통일
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => (c ?? "").trim()));
}

async function fetchInventoryRows(csvUrl: string): Promise<InventoryCsvRow[]> {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

  const text = await res.text();
  const grid = parseCSV(text);
  if (grid.length < 2) return [];

  return grid
    .slice(1)
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) => {
      const id = (r[0] ?? "").trim();
      const typeRaw = (r[1] ?? "forklift").trim().toLowerCase();
      const type: "forklift" | "excavator" =
        typeRaw === "excavator" ? "excavator" : "forklift";

      const imgCountNum = Number((r[10] ?? "").trim());
      const imgCount = Number.isFinite(imgCountNum) && imgCountNum > 0 ? imgCountNum : 5;

      return {
        id,
        type,
        title: (r[2] ?? "").trim() || `${type} (${type === "forklift" ? "F" : "X"})${id}`,
        year: (r[3] ?? "").trim(),
        brand: (r[4] ?? "").trim(),
        capacity: (r[5] ?? "").trim(),
        mast: (r[6] ?? "").trim(),
        hours: (r[7] ?? "").trim(),
        condition: (r[8] ?? "").trim(),
        remarks: (r[9] ?? "").trim(),
        imgCount,
      };
    });
}

type TruckProduct = {
  brand: string;
  model: string;
  thumb: string;
  use: string;
  use2?: string;
  use2Img?: string[];
};



// =========================
// Inventory CSV (Google Sheets) Utils
// =========================



function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener("scroll", onScroll);
    onScroll(); // 초기 1회
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
  type="button"
  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
  className="
    fixed bottom-6 right-6 z-[999999]
    h-12 px-5
    rounded-xl
    bg-orange-500 text-white font-extrabold
    shadow-lg
    hover:bg-orange-600 hover:-translate-y-0.5
    active:translate-y-0
    transition-all duration-200
  "
  aria-label="Back to top"
  title="맨 위로"
>
  to TOP↑
</button>
  );
}

/**
 * Shared Components
 */

// SVG Logo Component recreating the RNF KOREA brand identity based on the provided image
const RnfLogo: React.FC<{ className?: string }> = ({ className = "h-10" }) => (
  <svg viewBox="0 0 300 85" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="RNF KOREA Logo">
    {/* Icon Group */}
    <g transform="translate(5, 5)">
      {/* Forklift Cabin (Yellow Frame) */}
      <path d="M15 35 V22 C15 14 20 10 30 10 H40 V35" stroke="#FDB913" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 35 H40" stroke="#FDB913" strokeWidth="4" />
      
      {/* Forklift Body (Navy) */}
      <path d="M5 35 H45 V52 H15 L5 48 Z" fill="#0A192F" /> 
      
      {/* Steering Detail */}
      <path d="M25 35 V28 H32" stroke="#0A192F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Wheels */}
      <circle cx="15" cy="52" r="7" fill="#0A192F" />
      <circle cx="15" cy="52" r="2.5" fill="white" />
      <circle cx="40" cy="52" r="7" fill="#0A192F" />
      <circle cx="40" cy="52" r="2.5" fill="white" />
      
      {/* Mast (Navy) */}
      <rect x="46" y="5" width="5" height="48" rx="1" fill="#0A192F" />
      
      {/* Forks (Navy) */}
      <path d="M48 48 H62" stroke="#0A192F" strokeWidth="4" strokeLinecap="round" />
      
      {/* Battery (Red) with Lightning Bolt */}
      <g transform="translate(54, 18)">
         <rect x="0" y="3" width="22" height="26" rx="2" fill="#DC2626" />
         <rect x="6" y="0" width="10" height="3" fill="#DC2626" /> {/* Battery Terminal */}
         {/* White Lightning Bolt */}
         <path d="M12 6 L7 15 H13 L10 23 L17 12 H11 L15 6 Z" fill="white" />
      </g>
    </g>

    {/* Text Group */}
    <g transform="translate(90, 0)">
       <text x="0" y="40" fontFamily="sans-serif" fontWeight="900" fontSize="40" fill="#0A192F">RNF</text>
       <text x="2" y="62" fontFamily="sans-serif" fontWeight="700" fontSize="17" fill="#0A192F" letterSpacing="0.05em">KOREA</text>
    </g>

    {/* Tagline Group */}
    <text x="5" y="80" fontFamily="sans-serif" fontWeight="700" fontSize="10.5" fill="#0A192F" letterSpacing="0.01em">BATTERY & PARTS • FINANCIAL SERVICE</text>
  </svg>
);

// Primary Call-to-Action Button
const PrimaryButton: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className = '' }) => (
  <button 
    onClick={onClick}
    className={`bg-brand-lime text-navy-900 font-bold text-lg px-8 py-3.5 rounded-md hover:bg-lime-400 hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${className}`}
  >
    {children}
  </button>
);

const SectionTitle: React.FC<{ children: React.ReactNode; subtitle?: string; className?: string; centered?: boolean }> = ({ children, subtitle, className = '', centered = false }) => (
  <div className={`mb-16 ${centered ? 'text-center' : ''} ${className}`}>
    {subtitle && <span className="text-brand-lime font-bold text-sm tracking-widest uppercase mb-3 block">{subtitle}</span>}
    <h2 className="text-3xl md:text-4xl font-bold text-navy-900 leading-tight">
      {children}
    </h2>
  </div>
);

/**
 * Sub-Components
 */


const COPY = {
  ko: {
    // ✅ COPY.ko.menu 안에 추가/수정
menu: {
  biz: "사업영역",
  tires: "타이어",
  battery: "배터리",
  export: "노후장비 수출사업",
  finance: "금융솔루션",
  narumi: "나르미업무",

  shop: "쇼핑몰",
  tiresShop: "타이어 쇼핑몰",
  exportShop: "수출용 쇼핑몰",
  batteryShop: "배터리 쇼핑몰 (준비중)",
},
    companyLine: "BATTERY & PARTS · FINANCIAL SERVICE",
    phoneLabel: "대표번호",
    phone: "1551-1873",
    homeHeroTag: "INDUSTRIAL ENERGY & MOBILITY SOLUTION",
    homeHeroTitle1: "산업재에 관한 모든 것",
    homeHeroTitle2: "RNF KOREA가 책임집니다.",
    homeHeroDesc:
      "물류기기용 LFP배터리, 산업용/화물용 타이어 그리고 그 모든 것에 대한 렌탈과 금융 서비스.",
    pages: {
      tires: { crumb: "HOME/타이어", title: "타이어", subtitle: "카고/덤프/버스 타이어 라인업" },
      battery: { crumb: "HOME/배터리", title: "배터리", subtitle: "LFP 배터리 솔루션" },
      export: { crumb: "HOME/장비수출", title: "장비수출", subtitle: "Used Forklift Export" },
      finance: { crumb: "HOME/금융솔루션", title: "금융솔루션", subtitle: "Finance & Rental" },
    },
    exportIntro: {
      companyName: "RNFKorea Co Ltd",
      founded: "2022",
      address: "Sandanro 325, Danwongu, Ahsan, Gyreonggi, Koeea",
      oneLine: "노후 디젤지게차 수출 전문",
      strengths: [
        "Korea-based rental operator exporting directly",
        "Largest domestic pool of used equipment",
        "Partnerships with major rental/finance groups (Lotte Rental, Hyundai Commercial, etc.)",
      ],
    },
  },

  en: {
    menu: {
      biz: "Business",
      tires: "Tires",
      battery: "Battery",
      export: "Export",
      finance: "Finance",
      narumi: "Narumi",
      sitemap: "Sitemap",
      shop: "Shop",
tiresShop: "Tires Shop",
exportShop: "Export Shop",
batteryShop: "Battery Shop",
    },
    companyLine: "BATTERY & PARTS · FINANCIAL SERVICE",
    phoneLabel: "Main",
    phone: "1551-1873",
    homeHeroTag: "INDUSTRIAL ENERGY & MOBILITY SOLUTION",
    homeHeroTitle1: "Everything for Industrial Assets",
    homeHeroTitle2: "RNF KOREA delivers end-to-end.",
    homeHeroDesc:
      "LFP batteries for logistics equipment, industrial/truck tires, plus rental & finance services.",
    pages: {
      tires: { crumb: "HOME/Tires", title: "Tires", subtitle: "Cargo / Dump / Bus tire lineup" },
      battery: { crumb: "HOME/Battery", title: "Battery", subtitle: "LFP battery solutions" },
      export: { crumb: "HOME/Export", title: "Export", subtitle: "Used Forklift Export" },
      finance: { crumb: "HOME/Finance", title: "Finance", subtitle: "Finance & Rental" },
    },
    exportIntro: {
      companyName: "RNFKorea Co Ltd",
      founded: "2022",
      address: "Sandanro 325, Danwongu, Ahsan, Gyreonggi, Koeea",
      oneLine: "Specialized in exporting used diesel forklifts",
      strengths: [
        "Direct exporter operating a rental business in Korea",
        "One of the largest used-equipment pools domestically",
        "Partnerships with major groups (Lotte Rental, Hyundai Commercial, etc.)",
      ],
    },
  },
  
} as const;

type Lang = "ko" | "en";
type CopyKey = keyof typeof COPY["ko"];

const LangContext = createContext<{
  lang: Lang;
  setLang: React.Dispatch<React.SetStateAction<Lang>>;
  t: (key: CopyKey) => any; // ✅ string → any (menu/pages 같이 객체도 반환 가능)
} | null>(null);

function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangContext.Provider");
  return ctx;
}
const Header: React.FC = () => {
  const { lang } = useLang();
  const nav = useNavigate();
  const { user, isInternal, logout } = useAuth() as any;
  const { pathname } = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);

  // dropdown states
  const [bizOpen, setBizOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const [workOpen, setWorkOpen] = useState(false);
  // ✅ close delay timer (ONLY ONE)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ for outside click
  const headerRef = useRef<HTMLDivElement | null>(null);

  const scheduleClose = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setter(false), 180);
  };

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const goWork = (path: string) => {
    // ✅ BS_ON은 당분간 로그인 없이 열람 허용
    if (path === "/work/bson") {
      nav(path);
      return;
    }
    if (user && isInternal) nav(path);
    else nav("/narumi/login");
  };

  const closeAll = () => {
    setBizOpen(false);
    setShopOpen(false);
    setWorkOpen(false);
    cancelClose();
  };

  // Active states
  const bizActive = ["/tires", "/battery", "/export", "/finance"].includes(pathname);
  const shopActive =
    pathname === "/tires-shop" ||
    pathname.startsWith("/tires-shop/") ||
    pathname === "/battery-shop" ||
    pathname.startsWith("/battery-shop/") ||
    pathname === "/export-shop" ||
    pathname.startsWith("/export-shop/");


  const workActive = pathname.startsWith("/work/") || pathname.startsWith("/narumi");
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ✅ 헤더 밖 터치/클릭하면 드롭다운 닫기 (모바일 UX + 꼬임 방지)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = headerRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return; // 헤더 안이면 무시
      closeAll();
    };

    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItemBase =
    "text-lg md:text-xl font-bold whitespace-nowrap px-2 py-2 transition-all duration-200";
  const navItemActive = "text-orange-600";
  const underlineBase =
    "absolute left-0 -bottom-1 h-[2px] w-full bg-orange-500 transform transition-transform duration-300 origin-left";

  // ✅ pointer-events-auto 추가 (덮임 방지)
  const dropBox =
    "absolute left-0 top-full mt-2 bg-white shadow-lg rounded-xl py-2 min-w-[240px] " +
    "z-[999999] border border-gray-200 pointer-events-auto";
  const dropItem =
    "block w-full text-left px-4 py-2 hover:bg-gray-50 text-navy-900 font-bold";

  return (
    <header
      className={`relative w-full z-[999999] transition-all duration-300 border-b ${
        isScrolled
          ? "bg-gray-50 border-gray-100 shadow-sm"
          : "bg-gray-50/95 backdrop-blur-sm border-transparent"
      }`}
    >
      <div ref={headerRef} className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          {/* Top Row */}
          <div className="flex justify-between items-center py-3 md:py-4">
            <Link to="/" className="flex items-center gap-2 z-50 group" onClick={closeAll}>
              <RnfLogo className="h-12 md:h-14 w-auto" />
            </Link>

            {/* Mobile Right */}
            <div className="md:hidden flex items-center justify-end gap-2 flex-wrap">
              {user && isInternal && (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    nav("/narumi/login", { replace: true });
                  }}
                  className="
                    h-9 px-3 rounded-full
                    border border-gray-200
                    bg-white text-gray-700
                    font-extrabold text-sm
                    whitespace-nowrap
                  "
                >
                  로그아웃
                </button>
              )}

              <Link
                to="/sitemap"
                onClick={closeAll}
                className="
                  h-9 px-4 rounded-full
                  border border-navy-900 text-navy-900
                  bg-white
                  font-bold text-sm
                  flex items-center
                  whitespace-nowrap
                  hover:bg-navy-900 hover:text-white
                  transition-all
                "
              >
                사이트맵
              </Link>

              <a
                href="tel:1551-1873"
                className="
                  h-9 px-3 rounded-full
                  border border-navy-900 text-navy-900
                  bg-white
                  font-bold text-sm
                  flex items-center gap-1.5
                  flex-1 min-w-0 max-w-[56vw]
                  hover:bg-navy-900 hover:text-white
                  transition-all
                "
                title="대표번호 1551-1873"
              >
                <Phone size={14} className="shrink-0" />
                <span className="truncate">1551-1873</span>
              </a>
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="
              flex items-center
              gap-4 md:gap-8
              text-navy-900 font-bold text-base md:text-lg
              whitespace-nowrap
              overflow-visible
              pb-2
            "
          >
            {/* ===================== 사업영역 (드롭다운) ===================== */}
            <div
              className="relative z-[999999]"
              onMouseEnter={() => {
                cancelClose();
                setBizOpen(true);
                setShopOpen(false);
                setWorkOpen(false);
              }}
              onMouseLeave={() => scheduleClose(setBizOpen)}
            >
              <button
                type="button"
                className={`relative group ${navItemBase} ${
                  bizActive ? navItemActive : "text-navy-900"
                }`}
                // ✅ 모바일 포함: pointerdown에서만 토글 (버블링 차단)
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelClose();
                  setBizOpen((v) => !v);
                  setShopOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={bizOpen}
              >
                {COPY[lang].menu.biz}
                <span
                  className={`${underlineBase} ${
                    bizActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </button>

              {bizOpen && (
                <div
                  className={dropBox}
                  role="menu"
                  // ✅ 드롭박스 내부 터치가 위로 올라가 토글되는 것 방지
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={cancelClose}
                  onMouseLeave={() => scheduleClose(setBizOpen)}
                >
                  <Link to="/tires" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.tires}
                  </Link>
                  <Link to="/battery" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.battery}
                  </Link>
                  <Link to="/export" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.export}
                  </Link>
                  <Link to="/finance" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.finance}
                  </Link>
                </div>
              )}
            </div>

            {/* ===================== 쇼핑몰 (드롭다운) ===================== */}
            <div
              className="relative z-[999999]"
              onMouseEnter={() => {
                cancelClose();
                setShopOpen(true);
                setBizOpen(false);
                setWorkOpen(false);
              }}
              onMouseLeave={() => scheduleClose(setShopOpen)}
            >
              <button
                type="button"
                className={`relative group ${navItemBase} ${
                  shopActive ? navItemActive : "text-navy-900"
                }`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelClose();
                  setShopOpen((v) => !v);
                  setBizOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={shopOpen}
              >
                {COPY[lang].menu.shop ?? "쇼핑몰"}
                <span
                  className={`${underlineBase} ${
                    shopActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </button>

              {shopOpen && (
                <div
                  className={dropBox}
                  role="menu"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={cancelClose}
                  onMouseLeave={() => scheduleClose(setShopOpen)}
                >
                  <Link to="/tires-shop" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.tiresShop ?? "타이어 쇼핑몰"}
                  </Link>

                  <Link to="/export-shop" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.exportShop ?? "수출용 쇼핑몰"}
                  </Link>

                  <Link to="/battery-shop" className={dropItem} onClick={closeAll}>
                    {COPY[lang].menu.batteryShop ?? "배터리 쇼핑몰 (준비중)"}
                  </Link>
                </div>
              )}
            </div>

            
            {/* ===================== 업무용 ===================== */}
            <div
              className="relative overflow-visible"
              onMouseEnter={() => {
                cancelClose();
                setWorkOpen(true);
                setBizOpen(false);
                setShopOpen(false);
              }}
              onMouseLeave={() => scheduleClose(setWorkOpen)}
            >
              <button
                type="button"
                className={`relative group ${navItemBase} ${
                  workActive ? navItemActive : "text-navy-900"
                }`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelClose();
                  setWorkOpen((v) => !v);
                  setBizOpen(false);
                  setShopOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={workOpen}
              >
                업무용
                <span
                  className={`${underlineBase} ${
                    workActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </button>

              {workOpen && (
                <div
                  className={dropBox}
                  role="menu"
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={cancelClose}
                  onMouseLeave={() => scheduleClose(setWorkOpen)}
                >
                  <button
                    type="button"
                    className={dropItem}
                    onClick={() => {
                      closeAll();
                      goWork("/narumi");
                    }}
                  >
                    나르미업무
                  </button>

                  <button
                    type="button"
                    className={dropItem}
                    onClick={() => {
                      closeAll();
                      goWork("/work/bson");
                    }}
                  >
                    BS_ON 업무
                  </button>
                </div>
              )}
            </div>
</nav>

          {/* Desktop Right Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/sitemap"
              onClick={closeAll}
              className="
                px-5 py-2.5 rounded
                text-base font-bold transition-all
                border border-navy-900 text-navy-900
                hover:bg-navy-900 hover:text-white
                flex items-center gap-2
                whitespace-nowrap
              "
            >
              사이트맵
            </Link>

            {user && isInternal && (
              <div className="text-xs font-bold text-gray-500 px-3 py-2 rounded-lg bg-white border border-gray-200">
                로그인: <span className="text-navy-900">{user.email}</span>
              </div>
            )}

            {user && isInternal && (
              <button
                type="button"
                onClick={() => {
                  logout();
                  nav("/narumi/login", { replace: true });
                }}
                className="px-4 py-2.5 rounded text-base font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-all whitespace-nowrap"
              >
                로그아웃
              </button>
            )}

            <a
              href="tel:1551-1873"
              className="px-5 py-2.5 rounded text-base font-bold transition-all border border-navy-900 text-navy-900 hover:bg-navy-900 hover:text-white flex items-center gap-2 whitespace-nowrap"
            >
              <Phone size={18} />
              대표번호 1551-1873
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};


const Hero: React.FC = () => {
  return (
    <section
  className="
    relative
    min-h-[56vh] md:min-h-[60vh]
    flex items-center justify-center
    bg-[#0a192f] overflow-hidden
    py-8 md:py-0
  "
>
  <div className="absolute inset-0 z-0">
    <img
      src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
      alt="Industrial Warehouse"
      className="w-full h-full object-contain md:object-cover object-center opacity-30"
      loading="lazy"
    />
    <div className="absolute inset-0 bg-[#0a192f]/60 mix-blend-multiply" />
    <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-transparent to-transparent" />
  </div>

  <div className="container mx-auto px-4 relative z-10">
    <div className="max-w-3xl mx-auto text-center">
      <span className="animate-fadeUp text-[#a3e635] font-medium tracking-wider text-sm md:text-base mb-5 block uppercase">
        Industrial Energy & Mobility Solution
      </span>

      <h1 className="animate-fadeUp delay-150 text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
        산업재에 관한 모든 것<br />
        <span className="text-[#a3e635]">RNF KOREA</span>가 책임집니다.
      </h1>

      <p className="animate-fadeUp delay-300 text-lg md:text-xl text-gray-300 mb-0 leading-relaxed font-light max-w-2xl mx-auto">
        물류기기용 LFP배터리, 산업용/화물용 타이어<br className="hidden md:block" />
        그리고 그 모든 것에 대한 렌탈과 금융 서비스.<br className="hidden md:block" />
        현장 운영비 절감을 위한 가장 합리적인 선택.
      </p>
    </div>
  </div>
</section>
  );
};

interface BrandInfo {
  name: string;
  desc: string;
  bgColor: string;
  textColor: string;
}

const ServiceCard: React.FC<{ 
  id?: string;
  icon: React.ReactNode; 
  title: string; 
  desc: string; 
  features: string[];
  brands?: BrandInfo[];
  isDark?: boolean;
}> = ({ id, icon, title, desc, features, brands, isDark }) => (
  <div id={id} className={`p-8 rounded-lg transition-all duration-300 h-full border flex flex-col scroll-mt-40
    ${isDark 
      ? 'bg-navy-800 border-navy-700 text-white' 
      : 'bg-white border-gray-100 text-navy-900 hover:border-gray-300 hover:shadow-lg'
    }`}>
    <div className={`mb-6 inline-flex p-3 rounded-lg w-fit ${isDark ? 'bg-navy-700 text-brand-lime' : 'bg-gray-50 text-navy-900'}`}>
      {icon}
    </div>
    <h3 className="text-2xl font-bold mb-3">{title}</h3>
    <p className={`text-base mb-8 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{desc}</p>
    
    <ul className="space-y-4 mb-8 flex-1">
      {features.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3 text-base">
          <Check className={`shrink-0 mt-1 w-4 h-4 ${isDark ? 'text-brand-lime' : 'text-navy-900'}`} />
          <span className={`${isDark ? 'text-gray-300' : 'text-gray-600'} leading-snug`}>{item}</span>
        </li>
      ))}
    </ul>

    {brands && (
      <div className={`pt-6 border-t ${isDark ? 'border-navy-700' : 'border-gray-100'}`}>
         <div className="flex flex-col gap-2">
           {brands.map((brand, idx) => (
             <div key={idx} className={`flex items-center justify-between p-3 rounded-md ${brand.bgColor}`}>
               <span className={`font-black ${brand.textColor}`}>{brand.name}</span>
               <span className={`text-xs font-medium ${brand.textColor} opacity-80`}>{brand.desc}</span>
             </div>
           ))}
         </div>
      </div>
    )}
  </div>
);

const Services: React.FC = () => {
  return (
    <section id="products" className="py-24 bg-white scroll-mt-20">
      <div className="container mx-auto px-4">
        <SectionTitle centered subtitle="Our Solutions">
          현장 효율을 극대화하는<br className="md:hidden" /> 3대 핵심 서비스
        </SectionTitle>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LFP Battery (Also Primary Product) */}
          <ServiceCard 
            icon={<Battery size={32} strokeWidth={1.5} />}
            title="LFP 배터리"
            desc="납산 배터리 대비 3배 긴 수명. 유지보수가 필요 없는 고효율 솔루션."
            features={[
              "증류수 보충 불필요 (Zero Maintenance)",
              "휴게시간 활용 고속 충전",
              "5년 이상 수명 보장 (3000 Cycle)",
              "납산배터리 사용 전 모델 적용 가능"
            ]}
            isDark={true}
          />
          {/* Tires - ID added for navigation */}
          <ServiceCard 
            id="tires"
            icon={<Truck size={32} strokeWidth={1.5} />}
            title="타이어 솔루션"
            desc="트럭부터 지게차까지. 최적의 성능을 보장하는 프리미엄 브랜드 라인업."
            features={[
              "산업용 특수 타이어 전문 유통",
              "현장 환경 맞춤형 패턴 추천",
              "대량 발주 시 특별 단가 적용"
            ]}
            brands={[
              { name: 'KUMHO TIRE', desc: '상용차(트럭/덤프/트레일러)', bgColor: 'bg-red-50', textColor: 'text-red-700' },
              { name: 'NEXEN', desc: '지게차용 솔리드', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
              { name: 'MAXAM', desc: '지게차 및 특수물류기계', bgColor: 'bg-orange-50', textColor: 'text-orange-700' }
            ]}
          />
          {/* Finance - ID added for navigation */}
          <ServiceCard 
            id="finance"
            icon={<Wallet size={32} strokeWidth={1.5} />}
            title="금융 솔루션"
            desc="장비 렌탈 및 고객 맞춤형 할부금융 서비스를 제공하여 운용 효율을 개선합니다."
            features={[
              "산업·물류 장비 렌탈 프로그램",
              "상용차 할부금융 및 리스 상품 중개",
              "개별화물협회 회원 전용 상품",
              "(서울/광주/경북 MOU 체결)"
            ]}
          />
        </div>
      </div>
    </section>
  );
};

function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k] ?? "")}`)
    .join("&");
}

const CatalogForm: React.FC = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone && !formData.email) {
      alert("연락처 또는 이메일 주소 중 하나는 반드시 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        "form-name": "catalog",
        companyName: formData.companyName || "(미입력)",
        contactName: formData.contactName || "(미입력)",
        phone: formData.phone || "(미입력)",
        email: formData.email || "(미입력)",
      };

      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(payload),
      });

      alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");
      setFormData({ companyName: "", contactName: "", phone: "", email: "" });
    } catch {
      alert("전송에 실패했습니다.\n대표번호 1551-1873 으로 문의 부탁드립니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ 높이 줄인 버전
  const inputBase =
    "w-full px-4 pt-4 pb-2.5 rounded-xl bg-white border border-gray-200 " +
    "focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40 outline-none transition-all";

  const labelBase =
    "absolute left-4 top-2.5 text-[11px] font-bold text-gray-500 pointer-events-none";

  return (
    <section id="catalog-form">
      <div className="w-full bg-white overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 md:px-8 py-6 md:py-7 bg-navy-900">
          <h2 className="text-2xl font-bold text-[#0a192f]">
  견적 및 상담신청
</h2>
          <p className="text-gray-500 mt-2">
  연락처 또는 이메일만 입력하셔도 접수됩니다.
</p>
        </div>

        {/* 폼 */}
        <form
          ref={formRef}
          name="catalog"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={handleSubmit}
          className="px-6 md:px-8 py-6 md:py-7 space-y-4 flex flex-col"
        >
          <input type="hidden" name="form-name" value="catalog" />

          <p className="hidden">
            <label>
              Don’t fill this out:
              <input name="bot-field" />
            </label>
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <label className={labelBase}>회사명</label>
              <input
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>

            <div className="relative">
              <label className={labelBase}>담당자명</label>
              <input
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <label className={labelBase}>연락처</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>

            <div className="relative">
              <label className={labelBase}>이메일 주소</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder=" "
                className={inputBase}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="
              w-full rounded-2xl py-3.5 font-extrabold text-base
              bg-orange-500 text-white
              hover:bg-orange-600 transition-all
              disabled:opacity-60
              flex items-center justify-center gap-2
              mt-2
            "
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Send size={18} />
                문의하기
              </>
            )}
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            * 연락처 또는 이메일 중 하나만 입력하셔도 됩니다.
          </p>
        </form>
      </div>
    </section>
  );
};

const CTASection: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-white text-center px-7 md:px-10 py-10 md:py-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-4">
        지금 바로 비용 절감을 시작하세요
      </h2>

      <p className="text-base text-gray-300 mb-6 font-light leading-relaxed max-w-[34rem]">
        전문 상담원이 대표님의 현장 상황에 딱 맞는 최적의 솔루션을 제안해 드립니다.
      </p>

      <a
        href="tel:1551-1873"
        className="
          bg-lime-300 text-[#0a192f] font-bold text-lg
          px-8 py-3.5 rounded-xl
          hover:bg-lime-400 transition-colors
          shadow-[0_12px_30px_rgba(0,0,0,0.22)]
          flex items-center justify-center gap-3
          focus:outline-none focus-visible:ring-4 focus-visible:ring-lime-200/60
        "
      >
        <Phone size={20} />
        상담문의 1551-1873
      </a>

      <p className="mt-6 text-gray-300/80 text-sm">
        상담가능시간 : 09:00 - 20:00 (연중무휴)
      </p>
    </div>
  );
};
const HomePage: React.FC = () => (
  <>
    <Hero />

<section id="business" className="pt-14 pb-12 md:pb-14 bg-white">
  <div className="container mx-auto px-4">
    <h2 className="text-3xl font-bold text-navy-900 mb-10">사업영역</h2>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

      {/* 타이어 */}
      <Link
        to="/tires"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="타이어 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  타이어 구매 프로젝트
</h3>
<p className="text-gray-600">
  타이어 공급 + 금융 적용 구조
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/tires.jpg"
            alt="타이어"
            className="h-full w-full object-cover scale-100 group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

      {/* LFP 배터리 */}
      <Link
        to="/battery"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="배터리 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  배터리 전환 프로젝트
</h3>
<p className="text-gray-600">
  LFP 전환 + 금융 결합 구조 설계
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/battery.jpg"
            alt="배터리"
            className="h-full w-full object-cover scale-100 hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

      {/* 장비 수출 */}
      <Link
        to="/export"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="장비수출 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  장비 재상품화 프로젝트
</h3>
<p className="text-gray-600">
  노후 산업장비 선별·정비·수출 구조 설계
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/export.jpg"
            alt="장비수출"
            className="h-full w-full object-cover scale-100 hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

      {/* 금융 솔루션 */}
      <Link
        to="/finance"
        className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
        aria-label="금융솔루션 페이지로 이동"
      >
        <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
          <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
  프로젝트 금융 구조
</h3>
<p className="text-gray-600">
  배터리·타이어 도입을 위한 렌탈·할부 설계
</p>
        </div>

        <div className="absolute top-0 right-0 h-full w-[48%]">
          <img
            src="/home/finance.jpg"
            alt="금융솔루션"
            className="h-full w-full object-cover scale-100 hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
        </div>
      </Link>

{/* 개인(개별)화물협회 금융상품 */}
<Link
  to="/cargo-finance"
  className="relative p-0 border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow
             focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
  aria-label="개인화물협회 금융상품 페이지로 이동"
>
  <div className="relative z-10 p-6 md:p-7 pr-24 md:pr-40">
    <h3 className="text-xl font-semibold mb-2 hover:text-orange-600 transition-colors">
      개인(개별)화물협회 금융상품
    </h3>
    <p className="text-gray-600">
      화물운송 종사자 전용 협약 금융 프로그램
    </p>
  </div>

  <div className="absolute top-0 right-0 h-full w-[48%]">
    <img
      src="/home/indivi.jpg"
      alt="화물협회 금융"
      className="h-full w-full object-cover hover:scale-[1.03] transition-transform duration-500"
      loading="lazy"
    />
    <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent" />
  </div>
</Link>

    </div>
  </div>
</section>

<ContactSplitSection />
  </>
);

const ContactSplitSection: React.FC = () => {
  const cardShadow = "shadow-[0_12px_40px_rgba(15,23,42,0.10)]";

  return (
    <section className="bg-gray-50 py-14 md:py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-10 items-stretch">
          {/* LEFT */}
          <div className={`h-full rounded-3xl overflow-hidden bg-white ${cardShadow}`}>
            <CatalogForm />
          </div>

          {/* RIGHT */}
          <div className={`h-full rounded-3xl overflow-hidden bg-[#0a192f] ${cardShadow}`}>
  <CTASection />
</div>
        </div>
      </div>
    </section>
  );
};
const BusinessPage: React.FC = () => (
  <div className="container mx-auto px-4 py-16">
    <h1 className="text-3xl font-bold text-navy-900">사업영역</h1>
    <p className="text-gray-600 mt-4">RNF KOREA의 4대 사업영역을 소개합니다.</p>
  </div>
);

type ProductCardProps = { p: TruckProduct };

/**
 * 중앙 영역(가로/세로 각각 ratio) 안에 마우스가 들어왔는지 판별
 * ratio=0.4 -> 중앙 40%
 */
function isInCenterArea(e: React.MouseEvent, ratio = 0.4) {
  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cx0 = rect.width * (0.5 - ratio / 2);
  const cx1 = rect.width * (0.5 + ratio / 2);
  const cy0 = rect.height * (0.5 - ratio / 2);
  const cy1 = rect.height * (0.5 + ratio / 2);

  return x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;
}

export const ProductCard: React.FC<ProductCardProps> = ({ p }) => {
  const [hover, setHover] = useState(false);

  const [activeSrc, setActiveSrc] = useState(p.thumb);
  useEffect(() => {
    setActiveSrc(p.thumb);
  }, [p.thumb]);

  const CENTER_RATIO = 0.3;
  const DIM_MS = 1200;
  const ZOOM_MS = 1500;
  const START_SCALE = 0.99;
  const SOFT_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* 텍스트 */}
      <div className="p-4 space-y-1">
        <div className="text-sm text-gray-500">{p.brand}</div>
        <div className="text-lg font-bold text-navy-900">{p.model}</div>
      </div>

      {/* hover 감지 영역 */}
      <div
        className="relative"
        onMouseMove={(e) => {
          const inCenter = isInCenterArea(e, CENTER_RATIO);
          if (inCenter && !hover) setHover(true);
          if (!inCenter && hover) setHover(false);
        }}
        onMouseLeave={() => setHover(false)}
        onMouseEnter={() => setActiveSrc(p.thumb)}
      >
        <img src={p.thumb} alt={`${p.brand} ${p.model}`} className="w-full h-44 object-cover" loading="lazy" />
      </div>

      {/* 내용 */}
      <div className="p-4">
        <div className="text-sm text-gray-600 whitespace-pre-line">{p.use}</div>

        {p.use2 && <div className="h-4" />}
        {p.use2 && <div className="text-sm text-gray-700 font-bold">{p.use2}</div>}

        {p.use2Img && p.use2Img.length > 0 && (
          <div className="flex gap-2 mt-2">
            {p.use2Img.map((img, idx) => (
              <img key={idx} src={img} alt="" className="w-28 h-14 object-contain block" loading="lazy" />
            ))}
          </div>
        )}
      </div>

      {/* 중앙 프리뷰 오버레이 (1개만 유지) */}
      <div
        className={`
          fixed inset-0 z-[99999]
          flex items-center justify-center
          pointer-events-none
          transition-opacity
          ${hover ? "opacity-100" : "opacity-0"}
        `}
        style={{
          transitionDuration: `${DIM_MS}ms`,
          transitionTimingFunction: SOFT_EASE,
        }}
      >
        <div className="absolute inset-0 bg-black/30" />

        <div
          className="relative bg-white p-3 rounded-2xl shadow-2xl"
          style={{
            transitionProperty: "transform, opacity",
            transitionDuration: `${ZOOM_MS}ms`,
            transitionTimingFunction: SOFT_EASE,
            transform: hover ? "scale(1)" : `scale(${START_SCALE})`,
            opacity: hover ? 1 : 0,
            willChange: "transform, opacity",
          }}
        >
          <img
            key={activeSrc}
            src={activeSrc}
            alt={`${p.brand} ${p.model} preview`}
            className="block rounded-xl object-contain w-[76vw] max-w-[980px] h-auto max-h-[74vh]"
            style={{
              transitionProperty: "opacity",
              transitionDuration: `${ZOOM_MS}ms`,
              transitionTimingFunction: SOFT_EASE,
              opacity: hover ? 1 : 0,
              willChange: "opacity",
            }}
          />
        </div>
      </div>
    </div>
  );
};

const IndustrialTireClients: React.FC = () => {
  const clients = [
    {
      logo: "/logo/TLS.png",
      name: "티엘에스주식회사 : 융하인리히",
    
    },
    {
      logo: "/logo/NICHIYU.jpg",
      name: "혁신상사 : 니찌유(NICHIYU)",
      
    },
    {
      logo: "/logo/yale.png",
      name: "예일이큅먼트 : Yale",
      
    },
    {
      logo: "/logo/Hyster.png",
      name: "하이스터코리아 : Hyster",
      
    },
    {
      logo: "/logo/brotherlift.png",
      name: "현대지게차 경기북부판매",
      
    },
    {
      logo: "/logo/dpl.png",
      name: "DPL : TOYOTA",
      
    },
  ];

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />

        <div className="w-full">
          <div className="text-lg font-extrabold text-navy-900">
            산업용 타이어 주요 고객사
          </div>

          <div className="text-sm text-gray-600 mt-1">
            실제 공급 및 운영 레퍼런스 기반
          </div>

          {/* ✅ 로고 + 상호 정렬 */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-6">
            {clients.map((c) => (
              <div key={c.name} className="flex flex-col items-start">
                {c.logo && (
  <img
    src={c.logo}
    alt={c.name}
    loading="lazy"
    className="h-8 w-auto object-contain"
  />
)}

                <div className="mt-2 text-sm font-extrabold text-navy-900 leading-tight">
                  {c.name}
                </div>

                <div className="text-xs text-gray-500 font-bold">
                  
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-[11px] text-gray-500">
            ※ 고객사 표기는 납품 및 운영 기준 레퍼런스 안내 목적입니다.
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * ✅ 프로젝트에 이미 있는 것들 가정:
 * - TIRE_CSV_URL (env or const)
 * - fetchTireRows(url) -> rows[]
 *
 * ✅ 페이지 내부에서 이미 쓰고 있는 것들:
 * - ProductCard
 * - TruckCategory, TruckProduct
 * - Link (react-router-dom)
 */

const TiresPage: React.FC = () => {
  const subImages = useMemo(
    () => ({
      cargo: "/home/cargo.jpg",
      dump: "/home/dump.jpg",
      bus: "/home/bus.jpg",
    }),
    []
  );

  // ✅ 타이어 쇼핑몰(상품) 등록 개수 집계
  const [tireCount, setTireCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!TIRE_CSV_URL) throw new Error("TIRE_CSV_URL is empty");

        // ✅ 캐시 방지(구글시트/CSV 업데이트 즉시 반영용)
        const url = `${TIRE_CSV_URL}${TIRE_CSV_URL.includes("?") ? "&" : "?"}v=${Date.now()}`;

        const rows = await fetchTireRows(url);

        // ✅ CSV 값 흔들림(공백/대소문자/TRUE/1/Y 등) 방어
        const norm = (v: any) => String(v ?? "").trim().toUpperCase();
        const isActive = (v: any) => {
          const s = norm(v);
          return s === "TRUE" || s === "1" || s === "Y" || s === "YES" || s === "T";
        };
        const isCommercialVehicle = (v: any) => {
          const s = norm(v);
          return s === "CARGO" || s === "DUMP" || s === "BUS" || s === "TRAILER";
        };

        const commercial = rows.filter(
          (x: any) => isActive(x.is_active) && isCommercialVehicle(x.vehicle_type)
        );

        if (!alive) return;
        setTireCount(commercial.length);

        // 디버그 필요 시만 사용
        console.log("[TIRE] rows:", rows.length);
        console.log("[TIRE] sample:", rows?.[0]);
      } catch (e) {
        console.warn("[TIRE] count error:", e);
        if (!alive) return;
        setTireCount(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const truckProducts: Record<TruckCategory, TruckProduct[]> = {
    cargo: [
      {
        brand: "금호타이어",
        model: "KRS55 (12R22.5)",
        thumb: "https://www.kumhotire.com/upload/product/20140326_61217551.jpg?v=",
        use: ` · 특수 컴파운드 적용으로 고(高)마일리지 실현
 · 고속주행 안정성 및 핸들링 성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: [
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago1.gif",
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago4.gif",
        ],
      },
      {
        brand: "금호타이어",
        model: "KRA60 (12R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1626918120840_2155353698801451578.png?v=",
        use: ` · 마일리지 및 내구성 향상
 · 신개발 고무 적용으로 컷&칩핑, 뜯김 방지
 · 숄더부 이상 마모 방지와 주행성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: [
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago3.gif",
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago6.gif",
        ],
      },
      {
        brand: "금호타이어",
        model: "KRD55 (12R22.5)",
        thumb: "https://www.kumhotire.com/upload/product/20160408_37725649.jpg?v=",
        use: ` · 18PR 적용으로 내구성 및 재생성 향상
 · 신개발 고무 적용
 · 센터부 블럭 강성 증가/굴곡 사이프 적용`,
        use2: `[타이어 위치정보]`,
        use2Img: [
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago2.gif",
          "https://www.kumhotire.com/resources/images/tire/icon/bigcago5.gif",
        ],
      },
    ],
    dump: [
      {
        brand: "금호타이어",
        model: "KXA11 (385/65R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1724736907113_1488323251954799719.png?v=",
        use: ` · 3PMSF 및 M+S에 따른 Allseason 성능
 · 원단 내구성 향상 및 마일리지 향상
 · Wet 및 Winter 성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/dump4.gif"],
      },
      {
        brand: "금호타이어",
        model: "KRS50 (385/65R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1724736515408_4036362849833123991.png?v=",
        use: ` · 원단 내구성 및 재생성 향상
 · 특수 컴파운드 적용으로 고(高)마일리지 실현
 · 케이싱 보호`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/dump4.gif"],
      },
      {
        brand: "금호타이어",
        model: "KRA60 (385/65R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1714709713410_606693494195882325.gif?v=",
        use: ` · 마일리지 및 내구성 향상
 · 신개발 고무 적용으로 컷&칩핑,뜯김 방지
 · 접지압 최적화 설계로 편마모 감소/수명증가`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/dump4.gif"],
      },
    ],
    bus: [
      {
        brand: "금호타이어",
        model: "KRA53 (12R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1669793942291_746001193636015016.png?v=",
        use: ` · 마일리지 향상 및 고속주행 안정성 우수
 · 원단 내구성 및 배수성 향상
 · 중·장거리 노선에 최적화`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/bus8.gif"],
      },
      {
        brand: "금호타이어",
        model: "KRA50 (12R22.5)",
        thumb: "https://www.kumhotire.com/upload/product/20160408_37205351.jpg?v=",
        use: ` · 중·단거리 가혹노선 (커브/오르막)에 최적화
 · 신개발 고무 적용으로 마일리지, 내구성 향상
 · 숄더부 이상 마모 방지와 주행성능 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/bus8.gif"],
      },
      {
        brand: "금호타이어",
        model: "KXA10 (12R22.5)",
        thumb:
          "https://www.kumhotire.com/upload/product/1724737012036_4839557132438415813.png?v=",
        use: ` · 물결무늬 적용으로 제동력 향상
 · 가성비 우수, 고(高)마일리지의 중·장거리 버스용
 · 고강도 18PR 적용으로 내구성 및 재생성 향상`,
        use2: `[타이어 위치정보]`,
        use2Img: ["https://www.kumhotire.com/resources/images/tire/icon/bus8.gif"],
      },
    ],
  };

  // ✅ 섹션 이동용 ref
  const cargoRef = useRef<HTMLDivElement | null>(null);
  const dumpRef = useRef<HTMLDivElement | null>(null);
  const busRef = useRef<HTMLDivElement | null>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ✅ 산업용 타이어 주요고객
  const industrialKeyClients = [
    { key: "tls", name: "티엘에스코리아", sub: "융하인리히", inlinePair: true, logo: "/logo/TLS.png" },
    { key: "nichiyu", name: "혁신상사", sub: "니찌유 총판", inlinePair: true, logo: "/logo/NICHIYU.jpg" },
    { key: "hyundai_nb", name: "현대지게차경기북부판매", sub: "현대사이트솔루션", inlinePair: true, logo: "/logo/brotherlift.png" },
    { key: "yale", name: "예일이큅먼트", sub: "YALE", inlinePair: true, logo: "/logo/yale.png" },
    { key: "hyster", name: "하이스터코리아", sub: "HYSTER", inlinePair: true, logo: "/logo/Hyster.png" },
    { key: "dpl", name: "DPL", sub: "TOYOTA 총판", inlinePair: true, logo: "/logo/dpl.png" },
  ] as const;

  // ✅ “주요제품 박스” 공통 래퍼(양식 통일)
  const ProductsBlock = ({
    title,
    desc,
    sectionRef,
    products,
  }: {
    title: string;
    desc: string;
    sectionRef: React.RefObject<HTMLDivElement | null>;
    products: TruckProduct[];
  }) => (
    <section ref={sectionRef} className="space-y-0 scroll-mt-28">
      <div className="border border-gray-200 rounded-xl bg-white p-6 w-full">
        <div className="relative pl-5">
          <div className="absolute left-0 top-1 h-5 w-1.5 rounded bg-orange-500" />

          <h3 className="text-lg md:text-xl font-extrabold text-navy-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-2">{desc}</p>

          <div className="mt-6 grid md:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.model} p={p} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="container mx-auto px-4 py-16 space-y-16">
      {/* ===================== 페이지 헤더 + 쇼핑몰 배너 ===================== */}
      <div className="border-b border-gray-200 pb-6">
        <div className="grid md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-7 space-y-3">
            <div className="text-sm text-gray-500">
              <Link to="/" className="hover:text-orange-500 transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700 font-semibold">타이어</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">타이어</h1>

            <p className="text-gray-600 text-base md:text-lg max-w-3xl">
              운송 환경과 산업 현장의 다양한 조건에 최적화된 타이어 솔루션을 제공합니다.
            </p>
          </div>

          <div className="md:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div
                className="
                  absolute inset-0 opacity-70
                  bg-[radial-gradient(circle_at_20%_30%,rgba(249,115,22,0.22),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(14,165,233,0.16),transparent_40%)]
                  animate-[pulse_3s_ease-in-out_infinite]
                "
              />
              <div className="relative p-5 md:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
                      TIRE SHOP
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500 -ml-4" />
                    </div>

                    <div className="text-xl md:text-2xl font-extrabold text-navy-900 leading-tight">
                      타이어 쇼핑몰 바로가기
                    </div>

                    <div className="pt-1">
                      <div className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-700">
                        <span className="text-gray-500">등록 상품</span>
                        <span className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
                          {typeof tireCount === "number" ? `${tireCount}개` : "집계중…"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Link
                      to="/tires-shop"
                      className="
                        group inline-flex items-center justify-center gap-2
                        px-4 py-2.5 rounded-2xl
                        bg-orange-500 text-white font-extrabold text-sm
                        hover:bg-orange-600 transition-all
                        shadow-md hover:shadow-lg
                        active:scale-[0.99]
                        whitespace-nowrap
                      "
                    >
                      바로가기
                      <span className="inline-block transform transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 타이어 구매 Project ===================== */}
      <section className="space-y-8">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7 min-w-0">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight break-keep">
                  타이어 구매 Project!
                </h2>
                <p className="text-gray-600 mt-3 leading-relaxed break-keep">
                  단순 구매가 아니라 “구매 프로젝트 + 금융”으로 설계합니다.<br />
                  RNF KOREA가 물량/운행조건/교체주기 기반으로 최적의 조합과 결제 구조까지 함께 제안합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 min-w-0">
            <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6">
              <p className="text-navy-900 font-extrabold text-lg break-keep">
                화물차 타이어도 “렌탈”이 가능합니다. <br />
                몫돈 아끼시고 1년으로 나눠내세요.
              </p>
              <p className="text-sm text-gray-600 mt-2 break-keep">
                교체주기, 현금흐름까지 포함해 가장 유리한 구조로 설계합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: "STEP 01", title: "운행 조건 진단", desc: "노선/하중/주행거리/도로 조건을 기반으로 교체주기·운영 리스크를 분석합니다." },
            { step: "STEP 02", title: "제품 조합 설계", desc: "차종·축 위치·운행 패턴에 맞는 전/후륜 조합 및 규격을 제안합니다." },
            { step: "STEP 03", title: "금융 결합 구조", desc: "구매와 렌탈 옵션을 결합해 초기 부담을 낮추고 현금흐름을 최적화합니다." },
            { step: "STEP 04", title: "운영 최적화", desc: "교체주기·정비·관리 기준을 함께 잡아 운행 효율성을 높여드립니다." },
          ].map((x) => (
            <div key={x.step} className="border border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-all">
              <div className="text-orange-500 font-extrabold text-sm mb-2">{x.step}</div>
              <h3 className="font-extrabold text-navy-900 mb-2">{x.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{x.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-2xl bg-orange-50 border border-orange-200 p-6 text-center">
          <p className="text-navy-900 font-extrabold text-lg">타이어 구매는 비용이 아니라 구조입니다.</p>
          <p className="text-sm text-gray-600 mt-2">소모품 구매비용을 분납 구조로 전환하여 현금흐름 안정화를 설계합니다.</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="tel:1551-1873"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-orange-500 text-white font-extrabold text-lg hover:bg-orange-600 transition-all"
          >
            타이어 구매 프로젝트 상담 1551-1873
          </a>

          <Link
            to="/finance"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-gray-300 bg-white text-navy-900 font-extrabold text-lg hover:shadow-md transition-all"
          >
            금융 결합 구조 보기 →
          </Link>
        </div>
      </section>

      {/* ===================== 화물용 타이어 (상단 이동 버튼 영역) ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">화물용 타이어</h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              장거리 운송, 고하중 적재, 내구성 및 경제성을 고려한 상용차 타이어 라인업.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={() => scrollToRef(cargoRef)}
            className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden text-left
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
          >
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">카고 & 트레일러용</h3>
                </div>
                <p className="text-sm text-gray-600">마일리지, 연비 효율, 주행 안정성의 균형을 고려한 표준 운송 솔루션.</p>
              </div>
              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src={subImages.cargo}
                  alt="카고 & 트레일러용"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => scrollToRef(dumpRef)}
            className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden text-left
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
          >
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">덤프용</h3>
                </div>
                <p className="text-sm text-gray-600">험로 및 건설 현장 대응을 위한 내절상·내충격 강화 설계.</p>
              </div>
              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src={subImages.dump}
                  alt="덤프용"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => scrollToRef(busRef)}
            className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden text-left
                       focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50"
          >
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">버스용</h3>
                </div>
                <p className="text-sm text-gray-600">승차감, 소음 저감, 안전성을 중시한 여객 운송 전용 타이어.</p>
              </div>
              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src={subImages.bus}
                  alt="버스용"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* ===================== 산업용 타이어 ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">산업용 타이어</h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              지게차, 물류장비, 특수장비 등 고하중·고내구 환경 대응 산업 특화 솔루션.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: "솔리드 타이어", desc: "펑크 리스크 제거 및 유지보수 최소화를 위한 고내구 구조.", img: "/home/solid.jpg" },
            { title: "공기압 타이어", desc: "충격 흡수 및 승차감 개선에 유리한 범용 산업 장비 대응 타입.", img: "/home/air.jpg" },
            { title: "특수장비용 타이어", desc: "작업 환경 및 장비 특성에 맞춘 맞춤 규격 및 제품 제안 가능.", img: "/home/special.jpg" },
          ].map((x) => (
            <div key={x.title} className="group border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all overflow-hidden">
              <div className="flex h-full">
                <div className="flex-1 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 w-1 rounded bg-orange-500" />
                    <h3 className="text-lg font-extrabold text-navy-900">{x.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{x.desc}</p>
                </div>

                <div className="relative w-[40%] min-w-[110px]">
                  <img
                    src={x.img}
                    alt={x.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ✅ 산업용 타이어 주요 고객사 (1번만!) */}
      <div className="border border-gray-200 rounded-xl bg-white p-6 w-full">
        <div className="relative pl-5">
          <div className="absolute left-0 top-1 h-5 w-1.5 rounded bg-orange-500" />

          <h3 className="text-lg md:text-xl font-extrabold text-navy-900">산업용 타이어 주요 고객사</h3>
          <p className="text-sm text-gray-600 mt-2">
            산업용 타이어는 주요 물류·장비 운영사 및 공식 유통망을 중심으로 공급합니다.
          </p>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4">
            {industrialKeyClients.map((c) => (
              <div
                key={c.key}
                className="border border-gray-200 rounded-xl bg-white px-4 py-4 flex flex-col items-center justify-center text-center"
              >
                <div className="h-14 w-full flex items-center justify-center mb-3">
                  <img
                    src={c.logo}
                    alt={`${c.name} ${c.sub}`}
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                <div className="text-sm font-extrabold text-navy-900">
                  {c.inlinePair ? `${c.name} : ${c.sub}` : c.name}
                </div>
                {!c.inlinePair && <div className="text-xs font-bold text-gray-500 mt-1">{c.sub}</div>}
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-gray-400">
            * 로고 및 상호는 각 사의 상표권을 존중하며, 협업/공급 관계 안내 목적입니다.
          </div>
        </div>
      </div>

      {/* ===================== 주요제품(✅ 고객사 박스 밖 / ✅ 양식 통일) ===================== */}
      <ProductsBlock
        title="카고 & 트레일러용 주요제품"
        desc="장거리 운송 환경에 최적화된 마일리지·연비 효율 중심 제품 라인업."
        sectionRef={cargoRef}
        products={truckProducts.cargo}
      />

      <ProductsBlock
        title="덤프용 주요제품"
        desc="험로 및 건설 현장 대응을 위한 내절상·내충격 강화 라인업."
        sectionRef={dumpRef}
        products={truckProducts.dump}
      />

      <ProductsBlock
        title="버스용 주요제품"
        desc="승차감·정숙성·제동 안정성을 중시한 여객 운송 전용 라인업."
        sectionRef={busRef}
        products={truckProducts.bus}
      />

      {/* ✅ 여기 아래에 “공동 프로젝트 상담 폼(ProjectConsultForm)” 붙이면 끝 */}
      {/* <ProjectConsultForm project="TIRE_PURCHASE" /> */}
    </div>
  );
};



const CleanEarthPartnerBox: React.FC = () => {
  return (
    <a
      href="http://www.cleanearth.kr/"
      target="_blank"
      rel="noreferrer"
      className="
        group block
        rounded-3xl border border-gray-200 bg-white
        px-6 py-5
        shadow-[0_10px_30px_rgba(15,23,42,0.06)]
        hover:border-orange-300 hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)]
        transition-all
        focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50
      "
      title="(주)크린어스 홈페이지로 이동"
      aria-label="이 사업은 (주)크린어스와 함께합니다 (클릭 시 홈페이지 이동)"
    >
      <div className="flex items-start justify-between gap-4">
        {/* LEFT */}
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
            PARTNER
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500 -ml-4" />
          </div>

          <div className="mt-3 text-lg md:text-xl font-extrabold text-navy-900 leading-snug">
            이 사업은 <span className="text-orange-600">(주)크린어스</span>와 함께합니다.
          </div>

          <div className="mt-2 text-sm text-gray-600 leading-relaxed">
            수출 가능 물량 선별 및 매입 단계에서 파트너와 협력하여
            공급 안정성과 품질 기준을 강화합니다.
          </div>

          <div className="mt-2 text-xs font-extrabold text-navy-900">
            www.cleanearth.kr
          </div>
        </div>

        {/* RIGHT */}
        <div className="shrink-0 flex items-center">
          <div className="h-12 md:h-14 w-[160px] md:w-[180px] rounded-2xl border border-gray-200 bg-white flex items-center justify-center px-4">
            <img
              src="/logo/cleanearth.png"
              alt="(주)크린어스 로고"
              className="h-10 md:h-11 w-auto object-contain"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-gray-400 leading-relaxed">
        * 로고 및 상호는 협업 관계 안내 목적이며, 각 사의 상표권을 존중합니다.
      </div>
    </a>
  );
};

const ExportOverviewPage: React.FC = () => {
  const card =
    "border border-gray-200 rounded-2xl bg-white p-6 " +
    "shadow-[0_10px_30px_rgba(15,23,42,0.06)]";

  // ✅ 동일 높이 + 내부 요소 정렬을 위해 flex + h-full 사용
  const stepCard =
    "relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 " +
    "shadow-sm hover:shadow-md transition-all h-full flex flex-col";

  const iconWrap =
    "h-11 w-11 rounded-2xl border border-gray-200 bg-white flex items-center justify-center shadow-sm";

  // ✅ 밸류체인 카드 하단 영역(로고/전화) 높이 고정 (3카드 완전 동일)
  const bottomBar = "mt-auto pt-4 border-t border-gray-100 min-h-[56px] flex items-center";

  return (
    <div className="container mx-auto px-4 py-16 space-y-12">
      {/* ===================== PAGE HEADER ===================== */}
      <div className="border-b border-gray-200 pb-8 space-y-6">
        <div className="grid md:grid-cols-12 gap-6 items-start">
          {/* LEFT: 타이틀/소개 */}
          <div className="md:col-span-7 space-y-3">
            <div className="text-sm text-gray-500">
              <Link to="/" className="hover:text-orange-500 transition-colors">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-700 font-semibold">노후장비 수출사업</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
              노후장비 수출사업
            </h1>

            <p className="text-gray-600 text-base md:text-lg max-w-3xl leading-relaxed">
              한국에서 노후 디젤 지게차를 매입하고, 정비·등급화(A/B/C)한 뒤 신흥국 산업 현장에 안정적으로 공급합니다.
              “정비 완료 + 부품 패키지”로 품질 불균형 시장을 정면 공략합니다.
            </p>

            {/* ✅ 버튼 영역 삭제 (요청 반영) */}
          </div>

          {/* RIGHT: Export shop banner + CleanEarth box */}
          <div className="md:col-span-5 space-y-4">
            <Link
              to="/export-shop"
              className="
                group block
                relative overflow-hidden rounded-3xl border border-gray-200 bg-white
                shadow-sm hover:shadow-md transition-shadow
                focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200/50
              "
              aria-label="수출용 쇼핑몰(매물) 보기"
            >
              <div
                className="
                  absolute inset-0 opacity-70
                  bg-[radial-gradient(circle_at_20%_30%,rgba(249,115,22,0.22),transparent_35%),radial-gradient(circle_at_80%_60%,rgba(14,165,233,0.16),transparent_40%)]
                  animate-[pulse_3s_ease-in-out_infinite]
                "
              />
              <div className="relative p-5 md:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
                      EXPORT SHOP
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500 -ml-4" />
                    </div>
                    <div className="text-xl md:text-2xl font-extrabold text-navy-900 leading-tight">
                      수출용 쇼핑몰 보기
                    </div>
                    <div className="pt-1">
                      <div className="text-sm font-extrabold text-gray-700">
                        정비·등급화된 매물을 바로 확인하세요
                      </div>
                    </div>
                  </div>

                  <div
                    className="
                      shrink-0
                      inline-flex items-center gap-2
                      px-4 py-2.5 rounded-2xl
                      bg-orange-500 text-white font-extrabold text-sm
                      shadow-md
                      transition-transform
                      group-hover:translate-x-0.5
                      whitespace-nowrap
                      min-w-[92px]
                      justify-center
                    "
                    aria-hidden="true"
                  >
                    바로가기 <span>→</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  * 클릭 시 수출용 쇼핑몰로 이동합니다.
                </div>
              </div>
            </Link>

            {/* ✅ 크린어스 박스: 오렌지 톤 통일 + 줄바꿈 개선 */}
            <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
                <div className="min-w-0 w-full">
                  <div className="text-sm font-extrabold text-navy-900">
                    이 사업은 (주)크린어스와 함께합니다
                  </div>

                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                    수출 가능 물량 선별·매입을 <b className="text-navy-900">(주)크린어스</b>와 협업하여 안정적으로 진행합니다.
                  </p>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src="/logo/cleanearth.png"
                        alt="(주)크린어스 로고"
                        className="h-9 w-auto object-contain"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] text-gray-600"></div>
                      </div>
                    </div>

                    <a
                      href="http://www.cleanearth.kr/"
                      target="_blank"
                      rel="noreferrer"
                      className="
                        inline-flex items-center justify-center
                        px-4 py-2 rounded-xl
                        bg-orange-500 text-white
                        font-extrabold text-sm
                        hover:bg-orange-600 transition-all
                        w-full sm:w-auto
                        whitespace-nowrap
                      "
                      title="(주)크린어스 홈페이지로 이동"
                    >
                      파트너사 홈페이지 바로가기 →
                    </a>
                  </div>

                  <div className="mt-3 text-[11px] text-gray-500">
                    * 파트너 표기는 협업/공급 체계를 안내하기 위한 목적입니다.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== 시장 개요 ===================== */}
      <section className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              시장 개요
            </h2>
            <p className="text-gray-600 mt-2 leading-relaxed">
              국내는 환경규제 강화로 노후 디젤 장비 교체가 가속화되고,
              신흥국은 제조·물류 인프라 확대로 지게차 수요가 증가합니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            <div className="text-xs font-extrabold tracking-wider text-blue-600 mb-3">
              STEP 1 · 국내 공급
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 mb-3">
              연간 약 1만 대 폐차 대상 발생
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              국내에서 매년 약 1만 대 이상의 노후 지게차가 교체 또는 폐차 대상으로 분류됩니다.
              단순 폐기 시 자원 손실과 비용 부담이 발생합니다.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-orange-400 bg-orange-50 p-6 shadow-md hover:shadow-lg transition-all">
            <div className="text-xs font-extrabold tracking-wider text-orange-600 mb-3">
              STEP 2 · RNF 재상품화
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 mb-3">
              정비 · 등급화 · 수출 표준화
            </h3>
            <p className="text-gray-700 leading-relaxed text-sm">
              전문 정비(PDI) 및 등급화를 통해 수출 가능한 상품으로 재탄생시킵니다.
              가격 경쟁력과 품질 신뢰를 동시에 확보합니다.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all">
            <div className="text-xs font-extrabold tracking-wider text-green-600 mb-3">
              STEP 3 · 해외 수요
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 mb-3">
              신흥국 산업·물류 인프라 확대
            </h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              제조 및 물류 인프라가 빠르게 성장하는 신흥국 시장에 재공급함으로써
              자원 재생·순환 경제에 기여하는 수출 모델을 구축합니다.
            </p>
            <div className="mt-5 flex items-center gap-2 text-green-600 text-sm font-bold">
              <span className="text-base">♻</span>
              자원 재생 · 순환 경제 기여
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 수출 대상 장비 ===================== */}
      <section className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              수출 대상 장비
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
              국내 사용/유통이 제한된 장비에 새로운 생명력을 부여합니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["연식", "8년~15년"],
            ["엔진", "디젤"],
            ["톤수", "2.5~7톤"],
            ["브랜드", "현대/두산 중심"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-xs font-extrabold text-gray-500">{k}</div>
              <div className="mt-2 text-lg font-extrabold text-navy-900">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="text-sm font-extrabold text-navy-900">등급 체계</div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            A/B/C 등급으로 상태를 표준화하고, 정비 리포트/부품 패키지로 “품질 불균형” 문제를 줄입니다.
          </p>
        </div>
      </section>

      {/* ===================== 정비/부품 패키지 ===================== */}
      <section className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              정비 패키지 & 부품 패키지
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
              “장비만”이 아니라, 운영 가능 상태로 납품하는 구조입니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className={card}>
            <div className="text-lg font-extrabold text-navy-900">정비 패키지(예시)</div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• Basic: 엔진/미션/누유 기본 점검</li>
              <li>• Standard: 유압·브레이크·마스트·전장 (+$700)</li>
              <li>• Premium: 도장·오버홀 (+$1,500)</li>
            </ul>
          </div>

          <div className={card}>
            <div className="text-lg font-extrabold text-navy-900">부품 패키지(예시)</div>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 소모품 패키지 (+$1,000)</li>
              <li>• 타이어 패키지 (+$600)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== 밸류체인 ===================== */}
<section className="space-y-6">
  <div className="flex items-start gap-3">
    <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
    <div>
      <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
        운영 구조(밸류체인)
      </h2>
      <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
        매입 → 정비/상품화 → 수출/계약/물류를 하나의 파이프라인으로 묶어
        리드타임과 품질 리스크를 줄입니다.
      </p>
    </div>
  </div>

  <div className="rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
    {/* DESKTOP CONNECTOR */}
    <div className="relative hidden md:block mb-6">
      <div className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="h-[2px] w-16 bg-gray-200" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-[2px] w-16 bg-gray-200" />
      </div>

      <div className="absolute left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="h-[2px] w-16 bg-gray-200" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-[2px] w-16 bg-gray-200" />
      </div>
    </div>

    {/* CARDS */}
    <div className="grid md:grid-cols-3 gap-4 items-stretch">
      {/* STEP 1 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-xl">🧲</span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-gray-500">STEP 1</div>
            <div className="text-lg font-extrabold text-navy-900">매입</div>
          </div>
        </div>

        <div className="mt-5 text-base font-extrabold text-navy-900">
          (주)크린어스
        </div>

        <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed">
          <li>• 수출 가능 물량 선별</li>
          <li>• 매입 및 인수 절차 관리</li>
          <li>• 입고 스케줄 통합 관리</li>
        </ul>

        <div className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
          국내 공급 파트너
        </div>
      </div>

      {/* STEP 2 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-xl">🛠️</span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-gray-500">STEP 2</div>
            <div className="text-lg font-extrabold text-navy-900">정비 / 상품화</div>
          </div>
        </div>

        <div className="mt-5 text-base font-extrabold text-navy-900">
          현대지게차경기북부판매 (형제중기)
        </div>

        <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed">
          <li>• A/B/C 등급 구분</li>
          <li>• PDI 및 리컨디션</li>
          <li>• 품질 리포트 및 부품 패키지 구성</li>
        </ul>

        <div className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
          정비 및 품질 관리 파트너
        </div>
      </div>

      {/* STEP 3 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-xl">🚢</span>
          </div>
          <div>
            <div className="text-xs font-extrabold text-gray-500">STEP 3</div>
            <div className="text-lg font-extrabold text-navy-900">수출 / 계약 / 물류</div>
          </div>
        </div>

        <div className="mt-5 text-base font-extrabold text-navy-900">
          RNF KOREA
        </div>

        <ul className="mt-4 text-sm text-gray-600 space-y-2 leading-relaxed">
          <li>• 해외 바이어 개발</li>
          <li>• 계약 및 수출 서류 관리</li>
          <li>• 선적 및 클레임 대응</li>
        </ul>

        <div className="mt-auto pt-6 border-t border-gray-100 text-xs text-gray-500 font-medium">
          수출 총괄 운영
        </div>
      </div>
    </div>

    {/* MOBILE CONNECTOR */}
    <div className="md:hidden mt-6 flex flex-col items-center gap-4">
      <div className="w-[2px] h-8 bg-gray-200" />
      <div className="flex gap-2">
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
        <div className="h-2 w-2 rounded-full bg-gray-300" />
      </div>
      <div className="w-[2px] h-8 bg-gray-200" />
    </div>

    {/* KPI STRIP */}
    <div className="mt-8 grid md:grid-cols-3 gap-4">
      {[
        ["리드타임", "입고 → 선적", "프로세스 표준화"],
        ["품질", "A/B/C 등급 판정 및 상품화", "정비 리포트 제공"],
        ["신뢰", "부품 패키지 포함", "운영 가능 상태 납품"],
      ].map(([k, v, d]) => (
        <div key={k} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 h-full">
          <div className="text-xs font-extrabold text-gray-500">{k}</div>
          <div className="mt-1 text-sm font-extrabold text-navy-900">{v}</div>
          <div className="mt-1 text-xs text-gray-600">{d}</div>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* ===================== 3개년 로드맵 ===================== */}
      <section className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              3개년 확장 로드맵
            </h2>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            ["[1년차]", "150대/y", "표준화/레퍼런스 확보, 핵심 거래선 구축"],
            ["[2년차]", "300대/y", "현지 파트너십 확장, 운영 효율화"],
            ["[3년차]", "800대/y", "수출국 확대/거점센터, 품목 확장"],
          ].map(([y, n, d]) => (
            <div key={y} className={card}>
              <div className="text-sm font-extrabold text-gray-500">{y}</div>
              <div className="mt-2 text-2xl font-extrabold text-navy-900">{n}</div>
              <div className="mt-3 text-sm text-gray-600 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== (하단) 상담 폼으로 유도 ===================== */}
      <section className="border-t border-gray-200 pt-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-navy-900">문의 안내</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                수출 대상 장비(톤수/연식/수량)와 희망 선적 조건을 알려주시면,
                정비 등급/부품 패키지 포함 견적과 리드타임을 함께 제안드립니다.
              </p>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("catalog-form");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all"
              >
                상담/견적 폼으로 이동 →
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// ✅ BatteryPage 복구(타이어 페이지 타이틀 스타일 기준)

// ✅ 타이어 페이지처럼 "중앙 영역"에서만 프리뷰 ON + 딜레이 적용
// ✅ Hover 전용 프리뷰 (클릭 없음)
const HoverPreviewGrid: React.FC<{
  images: string[];
  alt?: string;
  thumbClassName?: string;
  centerRatio?: number;   // 중앙 반응 영역(0.2~0.5)
  openDelayMs?: number;   // 열림 딜레이
  closeDelayMs?: number;  // 닫힘 딜레이
}> = ({
  images,
  alt = "설치사례",
  thumbClassName = "h-28 md:h-36",
  centerRatio = 0.7,
  openDelayMs = 10,
  closeDelayMs = 100,
}) => {
  const [hover, setHover] = useState(false);
  const [activeSrc, setActiveSrc] = useState<string>("");

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const isInCenter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx0 = rect.width * (0.5 - centerRatio / 2);
    const cx1 = rect.width * (0.5 + centerRatio / 2);
    const cy0 = rect.height * (0.5 - centerRatio / 2);
    const cy1 = rect.height * (0.5 + centerRatio / 2);

    return x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1;
  };

  const handleMove = (e: React.MouseEvent, src: string) => {
    if (isInCenter(e)) {
      clearTimers();
      openTimer.current = setTimeout(() => {
        setActiveSrc(src);
        setHover(true);
      }, openDelayMs);
    } else {
      clearTimers();
      closeTimer.current = setTimeout(() => {
        setHover(false);
      }, closeDelayMs);
    }
  };

  const handleLeave = () => {
    clearTimers();
    setHover(false);
  };

  return (
    <>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {images.map((src) => (
          <div
            key={src}
            onMouseMove={(e) => handleMove(e, src)}
            onMouseLeave={handleLeave}
            className="
              group overflow-hidden rounded-2xl
              border border-gray-200 bg-white
              hover:shadow-md hover:border-gray-300
              transition-all
            "
          >
            <div className={`${thumbClassName} w-full bg-gray-50 overflow-hidden`}>
              <img
                src={src}
                alt={alt}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Hover 프리뷰 오버레이 */}
      <div
        className={`
          fixed inset-0 z-[99999]
          flex items-center justify-center
          pointer-events-none
          transition-opacity duration-200
          ${hover ? "opacity-100" : "opacity-0"}
        `}
      >
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative bg-white p-3 rounded-2xl shadow-2xl">
          <img
            src={activeSrc}
            alt="preview"
            className="block rounded-xl object-contain w-[70vw] max-w-[900px] max-h-[70vh]"
          />
        </div>
      </div>
    </>
  );
};

const BatteryPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16 space-y-20">
      {/* 페이지 제목 */}
      <div className="space-y-3 border-b border-gray-200 pb-6">
        <div className="text-sm text-gray-500">
          <Link to="/" className="hover:text-orange-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 font-semibold">배터리</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          배터리
        </h1>

        <p className="text-gray-600 text-base md:text-lg max-w-3xl"></p>
      </div>

      {/* ===================== LFP 배터리 라인업 ===================== */}
      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              LFP 배터리 라인업
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl">
              안전성/수명/운영효율 관점에서 현장 적용에 최적화된 구성으로 제안합니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 지게차용 배터리 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    지게차용 배터리
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  교체/전환(납산→LFP) 컨설팅 및 현장 조건 기반 스펙 제안
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/forklift.jpg"
                  alt="지게차용 배터리"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* 고소작업대용 배터리 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    고소작업대용 배터리
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  고소작업대 제조사, 높이별 전압/용량 최적화
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/awp.jpg"
                  alt="고소작업대용 배터리"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* 골프카트용 배터리 */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    골프카트용 배터리
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  골프카트/저속 전동차량용 LFP 전환 및 맞춤 용량 구성 제안
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/golfcart.jpg"
                  alt="골프카트용 배터리"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* ✅ 렌탈 상품 (복구: 일반 1칸 카드로) */}
          <div className="group border rounded-lg bg-white hover:shadow-md transition-all overflow-hidden">
            <div className="flex h-full">
              <div className="flex-1 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-4 w-1 rounded bg-orange-500" />
                  <h3 className="text-lg font-extrabold text-navy-900">
                    렌탈 상품
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  도입 비용 부담을 줄이는 장기렌탈상품 지원
                </p>
              </div>

              <div className="relative w-[40%] min-w-[110px]">
                <img
                  src="/home/rental.jpg"
                  alt="렌탈·금융 연계"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/70 to-transparent" />
              </div>
            </div>
          </div>
        </div>

        {/* ===================== 배터리 파트너사 (위치 이동: 라인업 아래 / 설치사례 위) ===================== */}
        <div className="mt-10 md:mt-12 space-y-8">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
                배터리 공급사
              </h2>
              
            </div>
          </div>

          <div className="grid md:grid-cols-1 gap-6">
            {/* Reten */}
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold tracking-wider text-orange-600 mb-2">
                    PARTNER
                  </div>

                  <h3 className="text-xl font-extrabold text-navy-900">
                    리텐에너지솔루션 (Reten Energy Solution)
                  </h3>

                  <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                    Spiderway 제품을 판매하고 있으며, RNF KOREA는 리텐에너지솔루션의 총판입니다.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {[
                      "브랜드 : Spiderway",
                      "분야 : 산업용 배터리 솔루션",
                      "RNF 역할 : 국내 총판 / 공급·현장 적용 지원",
                    ].map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-extrabold border border-orange-200 bg-white text-navy-900"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <a
                  href="https://www.retenensol.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-orange-500 text-white font-extrabold text-sm hover:bg-orange-600 transition-all whitespace-nowrap"
                >
                  홈페이지 바로가기 →
                </a>
              </div>
            </div>

            {/* Spiderway (제품/브랜드 설명 카드) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
                <div className="min-w-0">
                  <h3 className="text-xl font-extrabold text-navy-900">
                    Spiderway (제품/브랜드)
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    현장 적용을 전제로 한 배터리 구성/세팅/운영 최적화에 초점을 둔 제품 라인업입니다.
                    RNF KOREA는 요구 조건(장비/전압/용량/충전환경) 기반으로 스펙을 제안합니다.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "적용 : 지게차 / AWP / 골프카트 등",
                      "지원 : 스펙 제안 · 설치/배선 · 세팅",
                      "운영 : 충전환경/사용패턴 기반 최적화",
                    ].map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-extrabold border border-gray-200 bg-white text-navy-900"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

{/* ===================== Battery Conversion Project ===================== */}
<section className="mt-16 space-y-10">
  <div className="flex items-start gap-3">
    <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
    <div>
      <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
        배터리 교체 Project!
      </h2>
      <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
        제품 판매가 아니라, 전환 프로젝트입니다.  
        RNF KOREA는 배터리 전환을 기술 설계와 금융 구조로 완성합니다.
      </p>
    </div>
  </div>

  <div className="grid md:grid-cols-4 gap-6">
    
    {/* 1 */}
    <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
      <div className="text-orange-500 font-extrabold text-sm mb-2">STEP 01</div>
      <h3 className="font-extrabold text-navy-900 mb-2">현장 진단</h3>
      <p className="text-sm text-gray-600">
        장비 사양, 사용 패턴, 충전 환경을 분석하여
        전환 가능성과 예상 효과를 도출합니다.
      </p>
    </div>

    {/* 2 */}
    <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
      <div className="text-orange-500 font-extrabold text-sm mb-2">STEP 02</div>
      <h3 className="font-extrabold text-navy-900 mb-2">LFP 설계</h3>
      <p className="text-sm text-gray-600">
        Spiderway 기반 최적 스펙 설계 및
        안전성·수명·효율 중심 구성 제안.
      </p>
    </div>

    {/* 3 */}
    <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
      <div className="text-orange-500 font-extrabold text-sm mb-2">STEP 03</div>
      <h3 className="font-extrabold text-navy-900 mb-2">금융 구조 설계</h3>
      <p className="text-sm text-gray-600">
        초기 도입비 부담을 줄이는
        렌탈·분할 상환 구조 설계.
        운영비 절감 기반 상환 모델 제안.
      </p>
    </div>

    {/* 4 */}
    <div className="border rounded-xl p-6 bg-white hover:shadow-md transition-all">
      <div className="text-orange-500 font-extrabold text-sm mb-2">STEP 04</div>
      <h3 className="font-extrabold text-navy-900 mb-2">설치 및 운영 최적화</h3>
      <p className="text-sm text-gray-600">
        설치·배선·세팅 완료 후
        운영 데이터 기반 성능 안정화 지원.
      </p>
    </div>

  </div>

  {/* 하단 강조 블록 */}
  <div className="mt-8 rounded-2xl bg-orange-50 border border-orange-200 p-6 text-center">
    <p className="text-navy-900 font-extrabold text-lg">
      배터리 전환은 비용이 아니라 구조입니다.
    </p>
    <p className="text-sm text-gray-600 mt-2">
      CapEx를 운영 구조로 전환하여 현금흐름 안정화를 설계합니다.
    </p>
  </div>

{/* 전환 프로젝트 상담 CTA */}
<div className="mt-10">
  <ProjectConsultForm
    project="BATTERY"
    defaultFinanceType="RENTAL"
    defaultSegment="STANDARD"
    title="배터리 전환 프로젝트 상담"
    subtitle="연락처 또는 이메일만 입력하셔도 접수됩니다."
  />
</div>

</section>

        {/* ===================== 설치사례 ===================== */}
        <section className="mt-10 md:mt-12">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
            <div className="min-w-0">
              <h3 className="text-xl md:text-2xl font-extrabold text-navy-900 tracking-tight">
                골프카트용 배터리 · 최근 설치사례
              </h3>
              <p className="text-sm md:text-base text-gray-600 mt-2 leading-relaxed">
                기존 리튬이온 → 리튬인산철 전환으로 운영 효율 개선 실현.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "설치장소 : 타미우스CC (제주시 애월읍)",
                  "차종: 골프카트",
                  "배터리: LFP 전환 (기존 리튬인산철_NCM 계열)",
                  "작업: 설치/배선/세팅",
                  "효과: 충전효율↑ 유지보수↓, 기존 충전기 사용으로 불필요한 작업(충전기 교체, 충전소 변경 등) 제거",
                ].map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs md:text-sm font-extrabold border border-gray-200 bg-white text-navy-900"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <HoverPreviewGrid
            images={[
              "/cases/golfcart/1.jpg",
              "/cases/golfcart/2.jpg",
              "/cases/golfcart/3.jpg",
              "/cases/golfcart/4.jpg",
              "/cases/golfcart/5.jpg",
              "/cases/golfcart/6.jpg",
            ]}
            alt="골프카트 배터리 설치사례"
            thumbClassName="h-28 md:h-36"
            centerRatio={0.28}
            openDelayMs={250}
            closeDelayMs={120}
          />

          {/* CTA */}
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a
              href="tel:1551-1873"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-orange-500 text-white font-extrabold hover:bg-orange-600 transition-all"
            >
              설치/견적 문의 1551-1873
            </a>

            <a
              href="https://blog.naver.com/reten_es/224029828603"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-gray-200 bg-white text-navy-900 font-extrabold hover:border-gray-300 hover:shadow-sm transition-all"
              title="네이버 블로그 원문"
            >
              블로그 원문 보기 →
            </a>
          </div>

          <p className="mt-3 text-xs text-gray-400 leading-relaxed">
            * 설치 사례 사진은 현장/고객 정보 보호를 위해 일부 편집될 수 있습니다.
          </p>
        </section>
      </section>
    </div>
  );
};

// =========================
// ExportPage (장비수출) - CLEAN 버전 (통째로 교체)
// =========================

// ⚠️ 파일 최상단 import에 useMemo가 없다면 반드시 추가하세요.
// 이미 React, createContext... 를 상단에서 import하고 있으니,
// "useMemo"만 추가하면 됩니다. (중복 import 금지)

type EquipmentType = "forklift" | "excavator";
type Filter = "all" | EquipmentType;

type SpecRow = { label: string; value: string };

type InventoryItem = {
  id: string;                // "1544"
  type: EquipmentType;       // forklift / excavator
  title: string;             // 카드 제목
  folder: string;            // "(F)1544"
  images: string[];          // "/image/(F)1544/F_1544_1.jpg" ...
  specs?: SpecRow[];         // 스펙 테이블
};

function buildImages(type: EquipmentType, id: string) {
  const prefix = type === "forklift" ? "F" : "X";
  const folder = `(${prefix})${id}`;
  return Array.from({ length: 5 }, (_, i) => `/image/${folder}/${prefix}_${id}_${i + 1}.jpg`);
}

// -------------------------
// ClickableThumb
// - 실패 시 대체 UI
// -------------------------
const ClickableThumb: React.FC<{
  src?: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  title?: string;
}> = ({ src, alt = "", className = "", onClick, onMouseEnter, onFocus, title }) => {
  const [ok, setOk] = useState(true);

  useEffect(() => {
    setOk(true);
  }, [src]);

  return (
    <button
      type="button"
      className={`relative block ${className}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      title={title}
    >
      {src && ok ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500">
          <div className="text-sm font-semibold">Image unavailable</div>
          {src && <div className="text-[11px] mt-1 break-all px-3 opacity-80">{src}</div>}
        </div>
      )}
    </button>
  );
};

// -------------------------
// Lightbox (Provider 방식)
// -------------------------
type LightboxState = {
  isOpen: boolean;
  images: string[];
  index: number;
  title?: string;
};

const LightboxContext = createContext<{
  state: LightboxState;
  openAt: (title: string, images: string[], index?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  setIndex: (i: number) => void;
} | null>(null);

function useLightbox() {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used within <LightboxProvider />");
  return ctx;
}

const LightboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LightboxState>({
    isOpen: false,
    images: [],
    index: 0,
    title: "",
  });

  const openAt = (title: string, images: string[], index = 0) => {
    setState({
      isOpen: true,
      images,
      index: Math.max(0, Math.min(index, images.length - 1)),
      title,
    });
  };

  const close = () => setState((s) => ({ ...s, isOpen: false }));

  const setIndex = (i: number) =>
    setState((s) => ({
      ...s,
      index: Math.max(0, Math.min(i, s.images.length - 1)),
    }));

  const next = () => setState((s) => ({ ...s, index: Math.min(s.index + 1, s.images.length - 1) }));
  const prev = () => setState((s) => ({ ...s, index: Math.max(s.index - 1, 0) }));

  useEffect(() => {
    if (!state.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isOpen, state.images.length, state.index]);

  return (
    <LightboxContext.Provider value={{ state, openAt, close, next, prev, setIndex }}>
      {children}
      <LightboxModal />
    </LightboxContext.Provider>
  );
};

const LightboxModal: React.FC = () => {
  const ctx = useContext(LightboxContext);
  if (!ctx) return null;

  const { state, close, next, prev } = ctx;
  if (!state.isOpen) return null;

  const src = state.images[state.index];

  return (
    <div
      className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-4"
      onMouseDown={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-5xl bg-white rounded-2xl overflow-hidden shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-bold text-navy-900">
            {state.title || "Preview"}{" "}
            <span className="ml-2 text-sm text-gray-500">
              ({state.index + 1}/{state.images.length})
            </span>
          </div>
          <button className="px-3 py-1 rounded-md hover:bg-gray-100" onClick={close}>
            Close
          </button>
        </div>

        <div className="relative bg-black">
          <img src={src} alt="" className="w-full max-h-[75vh] object-contain" />

          {state.images.length > 1 && (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 flex items-center justify-center"
                onClick={prev}
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 flex items-center justify-center"
                onClick={next}
                aria-label="Next"
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------
// InventoryCard (단 1개만)
// - 썸네일 hover 시 대표이미지 변경
// - preload 성공한 이미지들만 Set으로 관리(순서 유지)
// -------------------------
const InventoryCard: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const { openAt } = useLightbox();

  const [okSet, setOkSet] = useState<Set<string>>(new Set());
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    setHeroIndex(0);
    setOkSet(new Set());
  }, [item.id]);

  const preload = useMemo(() => item.images.slice(0, 6), [item.images]);

  const displayImages = useMemo(() => {
    return okSet.size > 0 ? item.images.filter((src) => okSet.has(src)) : item.images;
  }, [item.images, okSet]);

  useEffect(() => {
    if (heroIndex >= displayImages.length) setHeroIndex(0);
  }, [displayImages.length, heroIndex]);

  const heroSrc = displayImages[heroIndex] ?? displayImages[0];

  return (
    <div
      className="border rounded-xl overflow-hidden bg-white hover:shadow-lg transition-shadow"
      onMouseLeave={() => setHeroIndex(0)}
    >
      <ClickableThumb
        src={heroSrc}
        alt={item.title}
        className="w-full h-56"
        onClick={() => openAt(item.title, displayImages, heroIndex)}
      />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">{item.type === "forklift" ? "Forklift" : "Excavator"}</div>
            <div className="text-lg font-extrabold text-navy-900">{item.title}</div>
          </div>
          <span className="text-xs font-bold bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
            {item.type === "forklift" ? "FORKLIFT" : "EXCAVATOR"}
          </span>
        </div>

        {/* preload hidden */}
        <div className="hidden">
          {preload.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              onLoad={() => {
                setOkSet((prev) => {
                  if (prev.has(src)) return prev;
                  const next = new Set(prev);
                  next.add(src);
                  return next;
                });
              }}
            />
          ))}
        </div>

        {displayImages.length > 1 && (
  <div
    className="flex gap-2"
    onMouseLeave={() => setHeroIndex(0)}   // ✅ 썸네일 영역 이탈 시 0번 복귀
  >
    {displayImages.slice(0, 6).map((src) => (
  <ClickableThumb
    key={src}
    src={src}
    className={`w-14 h-14 rounded-md border transition-all ${
      src === heroSrc ? "border-orange-500" : "border-gray-200 hover:border-orange-300"
    }`}
    onMouseEnter={() => {
      const i = displayImages.indexOf(src);
      setHeroIndex(i >= 0 ? i : 0);
    }}
    onFocus={() => {
      const i = displayImages.indexOf(src);
      setHeroIndex(i >= 0 ? i : 0);
    }}
    onClick={() => {
      const i = displayImages.indexOf(src);
      openAt(item.title, displayImages, i >= 0 ? i : 0);
    }}
  />
))}
  </div>
)}

        {item.specs && item.specs.length > 0 && (
          <div className="border-t pt-3">
            <table className="w-full text-sm">
              <tbody>
                {item.specs.map((row) => (
                  <tr key={row.label} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap w-28">{row.label}</td>
                    <td className="py-2 text-navy-900 font-medium">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=0&single=true&output=csv";

const ExportShopPage: React.FC = () => {
  const [filter, setFilter] = useState<Filter>("all");

  // ✅ 구글시트 rows 상태 추가 (여기서 rows가 생깁니다)
  const [rows, setRows] = useState<InventoryCsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrMsg("");
      try {
        const data = await fetchInventoryRows(CSV_URL);
        if (!alive) return;
        setRows(data);
      } catch (e: any) {
        if (!alive) return;
        setErrMsg(e?.message || "CSV load failed");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ rows -> InventoryItem[] 변환
  const inventory: InventoryItem[] = useMemo(() => {
    return rows.map((r) => {
      const count = r.imgCount ?? 5; // ✅ number
      const prefix = r.type === "forklift" ? "F" : "X";
      const folder = `(${prefix})${r.id}`;

      const images = Array.from({ length: count }, (_, i) => `/image/${folder}/${prefix}_${r.id}_${i + 1}.jpg`);

      const specs: SpecRow[] = [
        ...(r.brand ? [{ label: "Brand", value: r.brand }] : []),
        ...(r.year ? [{ label: "Year", value: r.year }] : []),
        ...(r.capacity ? [{ label: "Capacity", value: r.capacity }] : []),
        ...(r.mast ? [{ label: "Mast", value: r.mast }] : []),
        ...(r.hours ? [{ label: "Hours", value: r.hours }] : []),
        ...(r.condition ? [{ label: "Condition", value: r.condition }] : []),
        ...(r.remarks ? [{ label: "Remarks", value: r.remarks }] : []),
      ];

      return {
        id: r.id,
        type: r.type,
        title: r.title,
        folder,
        images,
        specs,
      };
    });
  }, [rows]);

  const totalCount = inventory.length;
  const forkliftCount = inventory.filter((x) => x.type === "forklift").length;
  const excavatorCount = inventory.filter((x) => x.type === "excavator").length;

  const filtered = filter === "all" ? inventory : inventory.filter((x) => x.type === filter);

  const pillBase = "px-4 py-2 rounded-full text-sm font-bold border transition-all duration-200";
  const pillOn = "bg-orange-500 text-white border-orange-500 shadow-sm";
  const pillOff = "bg-white text-navy-900 border-gray-200 hover:border-orange-300 hover:text-orange-600";

  return (
    <LightboxProvider>
      <div className="container mx-auto px-4 py-16 space-y-16">
        <div className="space-y-3 border-b border-gray-200 pb-6">
          <div className="text-sm text-gray-500">
            <Link to="/" className="hover:text-orange-500 transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700 font-semibold">장비수출</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">수출용 쇼핑몰</h1>

          <p className="text-gray-600 text-base md:text-lg max-w-3xl">
            수출용 매물을 확인하고, 필요 시 스펙/가격/선적 조건을 요청하실 수 있습니다.
          </p>
          {/* ✅ Partners Section */}
<div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">

  {/* ===================== CLEANEARTH ===================== */}
  <a
    href="http://www.cleanearth.kr/"
    target="_blank"
    rel="noreferrer"
    className="
      group rounded-2xl border border-gray-200 bg-white
      px-5 py-4
      hover:border-orange-300 hover:shadow-sm
      transition-all
      min-h-[110px]
      flex flex-col justify-center
    "
    title="(주)크린어스 홈페이지로 이동"
  >
    {/* 로고 */}
    <div className="flex items-center">
      <img
        src="/logo/cleanearth.png"
        alt="(주)크린어스 로고"
        className="h-10 md:h-9 w-auto object-contain"
        loading="lazy"
      />
    </div>

    {/* 텍스트 */}
    <div className="mt-3 text-sm font-extrabold text-navy-900 leading-snug">
      이 사업은 지구를 깨끗하게 크린어스(CleanEarth)
      <br />(주)크린어스와 함께합니다.
    </div>

    {/* URL (완전 통일 스타일) */}
    <div className="mt-1 text-xs font-extrabold text-navy-900">
      www.cleanearth.kr
    </div>
  </a>

  {/* ===================== BROTHERLIFT ===================== */}
  <a
    href="http://www.brotherlift.com"
    target="_blank"
    rel="noreferrer"
    className="
      group rounded-2xl border border-gray-200 bg-white
      px-5 py-4
      hover:border-orange-300 hover:shadow-sm
      transition-all
      min-h-[110px]
      flex flex-col justify-center
    "
    title="현대지게차 경기북부판매 – 웹사이트 바로가기"
  >
    {/* 로고 */}
    <div className="flex items-center">
      <img
        src="/logo/brotherlift.png"
        alt="현대지게차 경기북부판매 로고"
        className="h-12 md:h-10 w-auto object-contain"
        loading="lazy"
      />
    </div>

    {/* 텍스트 */}
    <div className="mt-3 text-sm font-extrabold text-navy-900 leading-snug">
      아래 차량들은 국내 최고의 지게차 정비업체<br />
      현대지게차 경기북부판매(형제중기)에서 관리합니다.
    </div>

    {/* 전화번호 */}
    <div className="text-xs font-bold text-gray-600 mt-1">
      📞{" "}
      <span
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <a
          href="tel:1899-1373"
          className="hover:text-orange-600 transition-colors"
        >
          1899-1373
        </a>
      </span>
    </div>

    {/* URL (스타일 완전 통일) */}
    <div className="mt-1 text-xs font-extrabold text-navy-900">
      www.brotherlift.com
    </div>
  </a>

</div>

          {/* ✅ 로딩/에러 표시(원하면 제거 가능) */}
          {loading && <div className="text-sm text-gray-500 mt-2">Loading inventory…</div>}
          {!!errMsg && <div className="text-sm text-red-600 mt-2">{errMsg}</div>}
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-3 items-center">
          <button className={`${pillBase} ${filter === "all" ? pillOn : pillOff}`} onClick={() => setFilter("all")}>
            전체 ({totalCount})
          </button>
          <button className={`${pillBase} ${filter === "forklift" ? pillOn : pillOff}`} onClick={() => setFilter("forklift")}>
            지게차 ({forkliftCount})
          </button>
          <button className={`${pillBase} ${filter === "excavator" ? pillOn : pillOff}`} onClick={() => setFilter("excavator")}>
            굴삭기 ({excavatorCount})
          </button>
        </div>

        {/* 리스트 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <InventoryCard key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </LightboxProvider>
  );
};

const PartnerLogos: React.FC<{ logos: string[]; label?: string }> = ({ logos, label }) => (
  <div className="mt-5 pt-4 border-t border-gray-100">
    {label && <div className="text-xs font-bold text-gray-500 mb-2">{label}</div>}

    {/* ✅ 모바일 줄바꿈 제어: nowrap + 가로 스크롤(필요 시) */}
    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
      {logos.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="
            h-6 w-auto object-contain shrink-0
            opacity-70 grayscale
            transition-all duration-200
            group-hover:opacity-100 group-hover:grayscale-0
            group-hover:contrast-125 group-hover:saturate-125
            hover:opacity-100 hover:grayscale-0 hover:contrast-125 hover:saturate-125
          "
        />
      ))}
    </div>
  </div>
);


type LogoSpec = {
  src: string;
  alt: string;
  size?: string;
  opacity?: string;
  className?: string;
};

const FinancePage: React.FC = () => {
  const partnerAssets = {
    BSON: { src: "/logo/bson.jpg", alt: "BSON" },
    ORIX: { src: "/logo/orix.jpg", alt: "ORIX Capital Korea" },
    LOTTE: { src: "/logo/lotte.jpg", alt: "Lotte Auto Lease" },
  } as const;

  const partnerPills = [
    { label: "렌탈", partnersText: "BSON" },
    { label: "할부금융", partnersText: "롯데오토리스 · 오릭스캐피탈코리아" },
    { label: "리스", partnersText: "롯데오토리스" },
  ] as const;

  const LogosRow: React.FC<{ logos: LogoSpec[]; gap?: string }> = ({
    logos,
    gap = "gap-4",
  }) => {
    if (!logos?.length) return null;
    return (
      <div className={`flex items-center ${gap}`}>
        {logos.map((l) => (
          <img
            key={`${l.src}-${l.size ?? ""}-${l.className ?? ""}`}
            src={l.src}
            alt={l.alt}
            className={`${l.size ?? "h-6"} w-auto object-contain ${
              l.opacity ?? "opacity-80"
            } ${l.className ?? ""}`}
            loading="lazy"
          />
        ))}
      </div>
    );
  };


  
  const PartnerTrustBar: React.FC = () => (
    <div className="mt-6">
      {/* ✅ mt-8 → mt-6 (조금만 타이트하게) */}
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
        <div className="w-full">
          <div className="text-base font-extrabold text-navy-900">협업 파트너</div>

          <div className="mt-4 flex flex-wrap gap-3">
            {partnerPills.map((p) => (
              <span
                key={p.label}
                className="
                  inline-flex items-center
                  px-4 py-3 rounded-full
                  border border-gray-200 bg-white
                  shadow-[0_1px_0_rgba(0,0,0,0.02)]
                  transition-colors
                  hover:border-gray-300
                "
                title={`${p.label} 파트너: ${p.partnersText}`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-gray-500 font-extrabold text-sm whitespace-nowrap">
                    {p.label}
                  </span>
                  <span className="text-navy-900 font-extrabold text-sm">
                    {p.partnersText}
                  </span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  

  const PartnerLineRight: React.FC<{
    label?: string;
    partnersText: string;
    logos?: LogoSpec[];
  }> = ({ label = "Partner", partnersText, logos = [] }) => (
    <div className="mt-5 pt-4 border-t border-gray-100 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 font-extrabold whitespace-nowrap">
          {label}:
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-navy-900 font-bold">{partnersText}</span>
          <LogosRow logos={logos} gap="gap-3" />
        </div>
      </div>
    </div>
  );


  
  const PartnerLineBelow: React.FC<{
    label?: string;
    partnersText: string;
    logos?: LogoSpec[];
  }> = ({ label = "Partners", partnersText, logos = [] }) => (
    <div className="mt-5 pt-4 border-t border-gray-100 text-sm">
      <div className="flex items-start gap-2">
        <span className="text-gray-500 font-extrabold whitespace-nowrap">
          {label}:
        </span>
        <div className="flex flex-col">
          <span className="text-navy-900 font-bold">{partnersText}</span>
          <div className="mt-2">
            <LogosRow logos={logos} gap="gap-5" />
          </div>
        </div>
      </div>
    </div>
  );

  const cardBase =
    "border border-gray-200 rounded-xl p-6 bg-white shadow-sm " +
    "transition-all duration-200 " +
    "hover:shadow-md hover:border-gray-300 hover:-translate-y-[2px]";

  const CardFooterNote: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <div className="mt-auto pt-4 border-t border-gray-100 text-sm text-gray-600">
      {children}
    </div>
  );

  return (
    // ✅ FIX 1) space-y-16 → space-y-10 (여기가 “협업파트너 ↔ 취급상품” 큰 공백의 핵심 원인)
    <div className="container mx-auto px-4 py-16 space-y-16">
      <div className="space-y-3 border-b border-gray-200 pb-8">
        <div className="text-sm text-gray-500">
          <Link to="/" className="hover:text-orange-500 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 font-semibold">금융솔루션</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-navy-900 tracking-tight">
          금융 솔루션
        </h1>

<section className="space-y-8">

  <div className="flex items-start gap-3">
    <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
    <div>
      <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900">
        배터리 전환 금융 구조
      </h2>
      <p className="text-gray-600 mt-2 max-w-3xl">
        RNF KOREA는 배터리 도입을 위한 금융·렌탈 구조를 설계합니다.
        초기 투자 부담을 줄이고, 운영 절감 효과 기반 상환 모델을 제공합니다.
      </p>
    </div>
  </div>

  <div className="grid md:grid-cols-3 gap-6">

    <div className="border rounded-xl p-6 bg-white">
      <h3 className="font-extrabold text-navy-900 mb-2">도입비 분산</h3>
      <p className="text-sm text-gray-600">
        구매비용을 렌탈·분할 구조로 전환하여
        현금 흐름 부담을 완화합니다. (초기비용 0원)
      </p>
    </div>

    <div className="border rounded-xl p-6 bg-white">
      <h3 className="font-extrabold text-navy-900 mb-2">운영비 절감 기반 상환</h3>
      <p className="text-sm text-gray-600">
        LFP 전환으로 절감되는 유지비를
        상환 구조에 반영합니다.
      </p>
    </div>

    <div className="border rounded-xl p-6 bg-white">
      <h3 className="font-extrabold text-navy-900 mb-2">프로젝트 연동</h3>
      <p className="text-sm text-gray-600">
        배터리 전환 프로젝트와 금융을
        하나의 구조로 설계합니다.
      </p>
    </div>

  </div>
</section>

        <p className="text-gray-600 text-base md:text-lg max-w-3xl leading-relaxed">
          장비 도입 비용을 줄이고 운영 효율을 높이기 위한 렌탈·리스·할부금융 구조를 설계합니다.
          현장 조건과 현금흐름에 맞춰 가장 현실적인 선택지를 제안드립니다.
        </p>

        <PartnerTrustBar />


        
      </div>

      <section className="space-y-8">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
              취급상품
            </h2>
            <p className="text-gray-600 mt-2 max-w-3xl leading-relaxed">
              렌탈 (건설기계, 고소작업대, 각종 물류기기), 할부금융 (상용차, 건설기계, 항만장비), 리스
              (개인_개별화물협회 전용) — 목적에 맞는 조달 구조를 한 번에 정리해드립니다.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          <div className={`${cardBase} flex flex-col h-full`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-navy-900">
                  렌탈 (건설기계, 고소작업대 등)
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  필요한 기간만, 필요한 조건으로. 현장 운영에 맞춘 렌탈 구조를 제안합니다.
                </p>
              </div>


              
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 장기 렌탈 (최대 60개월까지)</li>
              <li>• 매월 세금계산서 한 장으로 간편하게 이용</li>
              <li>• 법인/개인사업자 조건별 최적화</li>
              <li>• 모든 건설장비, 물류장비 제공 가능</li>
            </ul>

            <PartnerLineRight
              label="Partner"
              partnersText="BSON"
              logos={[{ ...partnerAssets.BSON, size: "h-11", opacity: "opacity-90" }]}
            />

            <CardFooterNote>
              추천 고객: 법인고객, 단기간 증차, 재무제표 관리 목적
            </CardFooterNote>
          </div>

          <div className={`${cardBase} flex flex-col h-full`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-navy-900">
                  할부금융 (상용차, 건설기계, 항만장비)
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  초기 부담을 낮추고 현금흐름에 맞춰 분할 상환 구조를 설계합니다.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 취급 상품 : 할부금융, 리스(운용)</li>
              <li>• 장비 평가 및 잔가(Residual) 구조 반영 (리스)</li>
              <li>• 담보/보증 구조 및 리스크 조건 정리</li>
              <li>• 세무관련 상담 서비스 지원</li>
            </ul>

            <PartnerLineBelow
              label="Partners"
              partnersText="롯데오토리스 · 오릭스캐피탈코리아"
              logos={[
                {
                  ...partnerAssets.LOTTE,
                  size: "h-[55px]",
                  opacity: "opacity-90",
                  className: "-ml-5",
                },
                {
                  ...partnerAssets.ORIX,
                  size: "h-6",
                  opacity: "opacity-90",
                },
              ]}
            />

            <CardFooterNote>
              추천 고객: 차량(장비) 구입 초기 비용 절감 목적 개인 및 법인
            </CardFooterNote>
          </div>

          <div className={`${cardBase} flex flex-col h-full`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
              <div>
                <h3 className="text-lg md:text-xl font-extrabold text-navy-900">
                  리스 (개인_개별협회 전용 상품)
                </h3>
                <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                  (주)롯데오토리스와 협업으로 개인(개별)화물협회 전용 우대 조건을 제공합니다.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>• 협회 회원에 한하여 제공 가능</li>
              <li>• 금융상품 이용시 우대 조건 제공</li>
              <li>• 쿠팡 지역협의체 물량 우선 공유</li>
              <li>• 협회 회원 전용 프로세스/서류 간소화</li>
            </ul>

            <PartnerLineRight
              label="Partner"
              partnersText="롯데오토리스"
              logos={[{ ...partnerAssets.LOTTE, size: "h-12", opacity: "opacity-90" }]}
            />

            <CardFooterNote>
              추천 고객: 개별화물협회 회원 또는 신규(예정)사업자
            </CardFooterNote>
          </div>
          
          {/* ✅ MOU 협약 지역 (1/3 지도 + 2/3 운영방식, 로고 삽입, 지도 그림자 제거 + 핀 소형/옷핀형, 두 박스 높이 통일) */}
<div className="mt-6 pt-5 border-t border-gray-100 w-full max-w-none col-span-full md:col-span-3">
  {/* Title Row */}
  <div className="flex items-start justify-between mt-16">
  {/* LEFT: 제목 영역 */}
  <div className="flex items-start gap-3">
    <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
    <div>
      <h2 className="text-2xl md:text-3xl font-extrabold text-navy-900 tracking-tight">
        MOU 협약 개인(개별)화물협회 
      </h2>
      <p className="text-gray-600 mt-2 leading-relaxed">
        지역 협회와의 협약을 기반으로 금융 지원을 제공합니다.
      </p>
    </div>
  </div>

  {/* RIGHT: 배지 */}
  <div className="mt-1 shrink-0">
    <span className="inline-flex items-center px-4 py-2 rounded-full bg-orange-50 text-orange-600 text-sm font-extrabold border border-orange-200">
      3개 시도 협약 완료
    </span>
  </div>
</div>

  {/* ✅ 1/3 : 2/3 layout (md+) */}
  <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4 w-full items-stretch">
    {/* ===================== LEFT (1/3) : Map ===================== */}
    <div
  className="
    md:col-span-4
    relative overflow-hidden rounded-2xl border border-gray-200 bg-white
    p-4 w-full h-full
  "
>
      {/* subtle bg */}
      <div
        className="
          absolute inset-0 opacity-70
          
        "
      />

      <div className="relative w-full h-full flex flex-col">
        <div className="text-xs font-extrabold text-gray-500 mb-3">협약 네트워크(지도)</div>

        {/* ✅ 지도 영역: 좌우로 조금 늘림 + (박스의 절반 넓이 정도만 사용) */}
        <div className="relative w-full flex-1 min-h-[190px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[85%] max-w-[380px] mx-auto">
              <svg viewBox="0 0 240 170" className="w-full h-auto" aria-label="South Korea map">
                {/* ✅ 지도 그림자(배경 실루엣) 제거: shadow path 삭제 */}

                {/* main silhouette */}
                <path
                  d="
                    M126 10
                    C112 14,103 24,102 38
                    C101 50,92 62,88 78
                    C84 95,78 112,86 126
                    C96 145,115 156,134 160
                    C153 164,170 158,182 146
                    C192 135,198 120,192 104
                    C187 90,197 82,198 66
                    C199 50,189 38,178 30
                    C168 22,154 12,126 10 Z
                  "
                  fill="rgba(15,23,42,0.06)"
                  stroke="rgba(15,23,42,0.26)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />

                {/* subtle ridge */}
                <path
                  d="M168 24 C180 38,186 56,182 74 C178 92,186 104,184 122 C182 138,172 150,160 156"
                  fill="none"
                  stroke="rgba(15,23,42,0.10)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Jeju */}
                <ellipse
                  cx="108"
                  cy="164"
                  rx="12"
                  ry="5.5"
                  fill="rgba(15,23,42,0.06)"
                  stroke="rgba(15,23,42,0.18)"
                  strokeWidth="1.4"
                />

                

                {/* ✅ 핀: 이미지 같은 "옷핀" 느낌(빨간 머리 + 회색 바늘) + 더 작게 */}
                {(() => {
                  const SEOUL = { x: 132, y: 42, label: "서울", tx: 14, ty: 4 };
                  const GYEONGBUK = { x: 165, y: 84, label: "경북", tx: 14, ty: 4 };
                  const GWANGJU = { x: 118, y: 112, label: "광주", tx: 14, ty: 4 };

                  const PushPin = ({
                    x,
                    y,
                    label,
                    tx,
                    ty,
                  }: {
                    x: number;
                    y: number;
                    label: string;
                    tx: number;
                    ty: number;
                  }) => (
                    <g>
                      {/* red head */}
                      <circle cx={x} cy={y} r="7" fill="rgb(239,68,68)" />
                      {/* subtle highlight */}
                      <circle cx={x - 2.2} cy={y - 2.5} r="2.2" fill="rgba(255,255,255,0.55)" />

                      {/* needle */}
                      <path
                        d={`
                          M ${x + 1.2} ${y + 6}
                          L ${x - 1.2} ${y + 6}
                          L ${x - 0.3} ${y + 26}
                          L ${x + 0.3} ${y + 26}
                          Z
                        `}
                        fill="rgba(148,163,184,0.95)"
                      />
                      <path
                        d={`
                          M ${x + 0.35} ${y + 26}
                          L ${x} ${y + 31}
                          L ${x - 0.35} ${y + 26}
                          Z
                        `}
                        fill="rgba(100,116,139,0.95)"
                      />

                      {/* label */}
                      <text
                        x={x + tx}
                        y={y + ty}
                        fontSize="12"
                        fontWeight="800"
                        fill="rgb(15,23,42)"
                      >
                        {label}
                      </text>
                    </g>
                  );

                  return (
                    <>
                      <PushPin {...SEOUL} />
                      <PushPin {...GYEONGBUK} />
                      <PushPin {...GWANGJU} />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-gray-400 leading-relaxed">
          * 지도는 협약 네트워크 위치를 설명하기 위한 시각화입니다.
        </div>
      </div>
    </div>

    {/* ===================== RIGHT (2/3) : Structure (chips 포함) ===================== */}
    <div className="md:col-span-8 w-full h-full">
      {/* ✅ 오른쪽 박스 하나로 합쳐서(칩 포함) 높이 통일 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 w-full h-full">
        {/* chips (박스 안으로 이동) */}
        <div className="flex flex-wrap gap-2 w-full mb-4">
          {[
            { label: "서울", sub: "협회 MOU" },
            { label: "광주", sub: "협회 MOU" },
            { label: "경북", sub: "협회 MOU" },
          ].map((x) => (
            <span
              key={x.label}
              className="
                inline-flex items-center gap-2
                px-3 py-2 rounded-2xl
                bg-white border border-gray-200
                shadow-[0_1px_0_rgba(0,0,0,0.02)]
              "
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-sm font-extrabold text-navy-900">{x.label}</span>
              <span className="text-xs font-bold text-gray-500">{x.sub}</span>
            </span>
          ))}
        </div>

        <div className="text-sm font-extrabold text-navy-900">협약 구조 (운영 방식)</div>

        <div className="mt-3 space-y-2 text-sm text-gray-700 leading-relaxed">
          <div className="flex gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>
              <b className="text-navy-900">지역 협회</b>를 통해 대상 고객(개별/개인)을 확보하고,
              신청–서류–심사 흐름을 표준화합니다.
            </span>
          </div>

          <div className="flex gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span>
              <b className="text-navy-900">RNF KOREA</b>는 상품 안내/조건 비교/서류 준비를 지원하여
              진행 속도와 승인 가능성을 높입니다.
            </span>
          </div>

          {/* ✅ 롯데오토리스 로고 (텍스트 높이 수준) */}
          <div className="flex gap-2">
            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-2 font-extrabold text-navy-900">
                
                <span>롯데오토리스</span>
              </span>
              <span>는 최종 심사 및 계약을 수행합니다.</span>
              <span className="text-gray-500 font-bold text-xs">
                (금리·한도·기간은 금융사 기준으로 확정)
              </span>
            </span>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-gray-400">* 협약 지역은 지속 확대 예정입니다.</div>
      </div>
    </div>
  </div>
</div>
        </div>
      </section>

      <section className="border-t border-gray-200 pt-10">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-1.5 rounded bg-orange-500" />
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-navy-900">중개 고지</div>
              <p className="text-sm text-gray-600 leading-relaxed">
                RNF Korea는 파트너 금융사/렌탈사 상품을 비교 안내하고, 고객 요청에 따라 서류 준비 및 진행
                절차를 지원하는 중개·상담 역할을 수행합니다. 최종 심사 및 계약 조건(금리, 한도, 기간,
                잔가 등)은 각 금융사/렌탈사의 내부 기준에 따라 확정됩니다.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                ※ 본 페이지의 내용은 안내 목적이며, 실제 조건은 고객 신용도/담보/장비평가 결과 및 시장
                상황에 따라 변동될 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};



const Footer: React.FC = () => {
  const nav = useNavigate();
  const { user, isInternal } = useAuth() as any;
const goNarumi = () => {
  if (user && isInternal) nav("/work/narumi");
  else nav("/narumi/login");
};
  const goWork = (path: string) => {
    // ✅ BS_ON은 당분간 로그인 없이 열람 허용
    if (path === "/work/bson") {
      nav(path);
      return;
    }
    if (user && isInternal) nav(path);
    else nav("/narumi/login");
  };

  return (
    <footer id="company" className="bg-white text-navy-900 py-16 border-t border-gray-100">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12 text-sm">
        {/* 회사 정보 */}
        <div className="col-span-1 md:col-span-2">
          <div className="mb-6">
            <div className="font-extrabold text-lg">RNF KOREA</div>
          </div>

          <p className="text-gray-500 max-w-sm leading-relaxed mb-6">
            (주)알앤에프코리아는 장비의 구입부터 유지/보수/매각까지
            장비의 모든 LifeCycle을 함께하는 산업재 전문 기업입니다.
            <br />
            고객의 성공적인 비즈니스를 위해 최선을 다하겠습니다.
          </p>
        </div>

        {/* 연락처 */}
        <div>
          <h4 className="font-bold text-base mb-6">Contact Info</h4>

          <ul className="space-y-4 text-gray-600">
            <li className="flex items-start gap-3">
              <Phone size={16} className="shrink-0 mt-0.5" />
              <a
                href="tel:1551-1873"
                className="font-bold hover:text-orange-500 transition-colors"
              >
                1551-1873
              </a>
            </li>

            <li className="flex items-start gap-3">
              <User size={16} className="shrink-0 mt-0.5" />
              <span>사이트관리자: 이동수</span>
            </li>

            <li className="flex items-start gap-3">
              <Mail size={16} className="shrink-0 mt-0.5" />
              <a
                href="mailto:admin@rnfkorea.co.kr"
                className="hover:text-orange-500 transition-colors break-all"
              >
                admin@rnfkorea.co.kr
              </a>
            </li>

            <li className="flex items-start gap-3">
              <MapPin size={16} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                경기도 안산시 단원구 산단로 325
                <br />
                제에프동 1167호 (신길동)
              </span>
            </li>
          </ul>
        </div>

        {/* 메뉴 */}
        <div className="space-y-8">
          {/* Business */}
          <div>
            <h4 className="font-bold text-base mb-4">Business</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link to="/tires" className="hover:text-orange-500 transition-colors">
                  - 타이어
                </Link>
              </li>
              <li>
                <Link to="/battery" className="hover:text-orange-500 transition-colors">
                  - 배터리
                </Link>
              </li>
              <li>
                <Link to="/export" className="hover:text-orange-500 transition-colors">
                  - 노후장비 수출사업
                </Link>
              </li>
              <li>
                <Link to="/finance" className="hover:text-orange-500 transition-colors">
                  - 금융솔루션
                </Link>
              </li>
            </ul>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-bold text-base mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link to="/tires-shop" className="hover:text-orange-500 transition-colors">
                  - 타이어 쇼핑몰
                </Link>
              </li>
              <li>
                <Link to="/export-shop" className="hover:text-orange-500 transition-colors">
                  - 수출용 쇼핑몰
                </Link>
              </li>

              {/* 준비중 */}
              <li className="flex items-center gap-2">
                <span className="text-gray-400 font-bold">- 배터리 쇼핑몰</span>
                <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                  준비중
                </span>
              </li>
            </ul>
          </div>

          {/* Etc */}
          <div>
            <h4 className="font-bold text-base mb-4">Etc</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link to="/sitemap" className="hover:text-orange-500 transition-colors">
                  - 사이트맵
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={goNarumi}
                  className="hover:text-orange-500 transition-colors text-left"
                >
                  - 나르미업무
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 하단 */}
      <div className="container mx-auto px-4 mt-16 pt-8 border-t border-gray-100 text-center text-gray-400 text-xs">
        &copy; {new Date().getFullYear()} (주)알앤에프코리아. All rights reserved.
      </div>
    </footer>
  );
};

// =========================
// Narumi (Protected Route)
// =========================
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isInternal } = useAuth() as any;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  // ✅ 로그인 안했거나, 내부사용자 아니면 차단
  if (!user || !isInternal) return <Navigate to="/narumi/login" replace />;

  return <>{children}</>;
};

const App = () => {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return (saved === "en" || saved === "ko") ? saved : "ko";
  });

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const t = (key: CopyKey) => COPY[lang][key];

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <ScrollToTopButton />
        <PageHeader />
        
        <Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/tires" element={<TiresPage />} />
  <Route path="/battery" element={<BatteryPage />} />
  <Route path="/export" element={<ExportOverviewPage />} />
  <Route path="/export-shop" element={<ExportShopPage />} />
  <Route path="/finance" element={<FinancePage />} />

  {/* ✅ 개별(개인)화물협회 */}
  <Route path="/cargo-finance" element={<IndividualCargoFinancePage />} />

  <Route path="/sitemap" element={<SitemapPage />} />

  {/* Narumi (internal) */}
  <Route path="/narumi/login" element={<NarumiLoginPage />} />
  <Route path="/narumi" element={<ProtectedRoute><NarumiPage /></ProtectedRoute>} />

  {/* ✅ BS_ON (public) */}
  <Route path="/bson" element={<BsonWorkPage />} />
  <Route path="/work/bson" element={<Navigate to="/bson" replace />} />

  {/* optional: legacy / case */}
  <Route path="/Narumi" element={<Navigate to="/narumi" replace />} />

  <Route path="/tires-shop" element={<TireShopPage />} />
  <Route path="/tires-shop/:sku" element={<TireShopDetailPage />} />
</Routes>
        <Footer />
            </BrowserRouter>
    </AuthProvider>
    </LangContext.Provider>
  );
};

export default App;