import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Phone,
  Battery,
  Truck,
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
  useNavigate,
} from "react-router-dom";

/* 아이콘 */
import {
  IconConsult,
  IconReview,
  IconProposal,
  IconContract,
} from "./ProcessIcons";

/* auth */
import { AuthProvider, useAuth } from "./lib/auth";

/* components */
import PageHeader from "./components/PageHeader";
import { ProjectConsultForm } from "./components/ProjectConsultForm";

/* pages */
import NarumiPage from "./pages/Narumi";
import BsonWorkPage from "./pages/BsonWork/index";
import NarumiLoginPage from "./pages/Narumi/login";
import SitemapPage from "./pages/Sitemap";
import IndividualCargoFinancePage from "./pages/IndividualCargoFinance/index";
import TireShopPage from "./pages/TireShop/index";
import TireShopDetailPage from "./pages/TireShop/detail";
import CallManagementPage from "./pages/CallManagement/index";
import DashboardPage from "./pages/Dashboard";
import BatteryPage from "./pages/Battery/index";
import HomePage from "./pages/Home";
import FinancePage from "./pages/Finance/index";
import TiresPage from "./pages/Tires/index";
import ExportPage from "./pages/Export/index";
import BatteryShopPage from "./pages/battery-shop";

/* utils / config */
import { fetchTireRows } from "./lib/tiresCsv";
import { TIRE_CSV_URL } from "./pages/TireShop/config";

import TiresShopPage from "./pages/TireShop";

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

type ExportFilter = "all" | "forklift" | "excavator";

type SpecRow = {
  label: string;
  value: string;
};

type InventoryItem = {
  id: string;
  type: "forklift" | "excavator";
  title: string;
  folder: string;
  images: string[];
  specs: SpecRow[];
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
  const { user, canViewAll, logout } = useAuth() as any;
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

  // 나르미는 새 경로로 이동
  if (path === "/work/narumi") {
    if (user && canViewAll) nav("/narumi");
    else nav("/narumi/login");
    return;
  }

  if (user && canViewAll) nav(path);
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
              {user && canViewAll && (
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

            {user && canViewAll && (
              <div className="text-xs font-bold text-gray-500 px-3 py-2 rounded-lg bg-white border border-gray-200">
                로그인: <span className="text-navy-900">{user.email}</span>
              </div>
            )}

            {user && canViewAll && (
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
    return okSet.size > 0 ? item.images.filter((src: string) => okSet.has(src)) : item.images;
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
    {displayImages.slice(0, 6).map((src: string) => (
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
                {item.specs.map((row: SpecRow) => (
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
  const [filter, setFilter] = useState<ExportFilter>("all");
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

  const inventory: InventoryItem[] = useMemo(() => {
    return rows.map((r: InventoryCsvRow) => {
      const count = r.imgCount ?? 5;
      const prefix = r.type === "forklift" ? "F" : "X";
      const folder = `(${prefix})${r.id}`;

      const images = Array.from(
        { length: count },
        (_, i) => `/image/${folder}/${prefix}_${r.id}_${i + 1}.jpg`
      );

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
  const forkliftCount = inventory.filter((x: InventoryItem) => x.type === "forklift").length;
  const excavatorCount = inventory.filter((x: InventoryItem) => x.type === "excavator").length;
  const filtered = filter === "all" ? inventory : inventory.filter((x: InventoryItem) => x.type === filter);

  const pillBase =
    "px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200";
  const pillOn = "bg-orange-500 text-white border-orange-500 shadow-sm";
  const pillOff =
    "bg-white text-navy-900 border-gray-200 hover:border-orange-300 hover:text-orange-600";

  return (
    <LightboxProvider>
      <div className="bg-white text-navy-900">
        <section className="pt-16 pb-14 md:pt-20 md:pb-16 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
            <div className="max-w-3xl">
              <div className="text-sm text-gray-500">
                <Link to="/" className="hover:text-orange-500 transition-colors">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <span className="text-gray-700 font-semibold">수출용 쇼핑몰</span>
              </div>

              <div className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
                Export Shop
              </div>

              <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-navy-900 break-keep">
                수출용 쇼핑몰
              </h1>

              <p className="mt-4 text-base md:text-lg leading-7 text-gray-600 max-w-3xl break-keep">
                수출용 매물을 확인하고, 필요 시 스펙·가격·선적 조건을 요청하실 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="http://www.cleanearth.kr/"
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-gray-200 bg-white px-5 py-4 hover:border-orange-300 hover:shadow-sm transition-all min-h-[110px] flex flex-col justify-center"
                  title="(주)크린어스 홈페이지로 이동"
                >
                  <div className="flex items-center">
                    <img
                      src="/logo/cleanearth.png"
                      alt="(주)크린어스 로고"
                      className="h-10 md:h-9 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>

                  <div className="mt-3 text-sm font-semibold text-navy-900 leading-snug break-keep">
                    이 사업은 지구를 깨끗하게 크린어스(CleanEarth)
                    <br />
                    (주)크린어스와 함께합니다.
                  </div>

                  <div className="mt-1 text-xs font-semibold text-navy-900">
                    www.cleanearth.kr
                  </div>
                </a>

                <a
                  href="http://www.brotherlift.com"
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-gray-200 bg-white px-5 py-4 hover:border-orange-300 hover:shadow-sm transition-all min-h-[110px] flex flex-col justify-center"
                  title="현대지게차 경기북부판매 – 웹사이트 바로가기"
                >
                  <div className="flex items-center">
                    <img
                      src="/logo/brotherlift.png"
                      alt="현대지게차 경기북부판매 로고"
                      className="h-12 md:h-10 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>

                  <div className="mt-3 text-sm font-semibold text-navy-900 leading-snug break-keep">
                    아래 차량들은 국내 최고의 지게차 정비업체
                    <br />
                    현대지게차 경기북부판매(형제중기)에서 관리합니다.
                  </div>

                  <div className="text-xs font-medium text-gray-600 mt-1">
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

                  <div className="mt-1 text-xs font-semibold text-navy-900">
                    www.brotherlift.com
                  </div>
                </a>
              </div>

              {loading && (
                <div className="text-sm text-gray-500 mt-4">상품 정보를 불러오는 중입니다...</div>
              )}
              {!!errMsg && <div className="text-sm text-red-600 mt-4">{errMsg}</div>}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  className={`${pillBase} ${filter === "all" ? pillOn : pillOff}`}
                  onClick={() => setFilter("all")}
                >
                  전체 ({totalCount})
                </button>
                <button
                  className={`${pillBase} ${filter === "forklift" ? pillOn : pillOff}`}
                  onClick={() => setFilter("forklift")}
                >
                  지게차 ({forkliftCount})
                </button>
                <button
                  className={`${pillBase} ${filter === "excavator" ? pillOn : pillOff}`}
                  onClick={() => setFilter("excavator")}
                >
                  굴삭기 ({excavatorCount})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filtered.map((item) => (
                <InventoryCard key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </section>
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




const Footer: React.FC = () => {
  const nav = useNavigate();
  const { user, canViewAll } = useAuth() as any;

const goNarumi = () => {
  if (user && canViewAll) nav("/narumi");
  else nav("/narumi/login");
};

const goWork = (path: string) => {
  if (path === "/work/narumi") {
    if (user && canViewAll) nav("/narumi");
    else nav("/narumi/login");
    return;
  }

  if (user && canViewAll) nav(path);
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
              <li>
                <Link
                  to="/cargo-finance"
                  className="font-bold text-orange-600 hover:text-orange-500 transition-colors"
                >
                  - 개인(개별)협회 전용 금융상품
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
  const { user, loading, canViewAll } = useAuth() as any;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user || !canViewAll) {
    return <Navigate to="/narumi/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAdmin } = useAuth() as any;

  return (
    <BrowserRouter>
      <div className="min-h-screen overflow-x-hidden bg-white">
        <ScrollToTop />
        <ScrollToTopButton />
        <PageHeader />

        <main className="w-full">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tires" element={<TiresPage />} />
            <Route path="/battery" element={<BatteryPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/export-shop" element={<ExportShopPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/cargo-finance" element={<IndividualCargoFinancePage />} />
            <Route path="/sitemap" element={<SitemapPage />} />

            {/* Shop */}
            <Route path="/tires-shop" element={<TireShopPage />} />
            <Route path="/tires-shop/:sku" element={<TireShopDetailPage />} />
            <Route path="/battery-shop" element={<BatteryShopPage />} />

            {/* Narumi */}
            <Route path="/narumi/login" element={<NarumiLoginPage />} />
            <Route
              path="/narumi"
              element={
                <ProtectedRoute>
                  <NarumiPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/narumi/admin"
              element={
                <ProtectedRoute>
                  <NarumiPage />
                </ProtectedRoute>
              }
            />

            {/* BS_ON */}
            <Route path="/bson" element={<BsonWorkPage />} />
            <Route path="/work/bson" element={<Navigate to="/bson" replace />} />

            <Route path="/work/call-management" element={<CallManagementPage />} />
            <Route
              path="/work/dashboard"
              element={isAdmin ? <DashboardPage /> : <Navigate to="/" replace />}
            />

            {/* legacy */}
            <Route path="/Narumi" element={<Navigate to="/narumi" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
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
        <AppRoutes />
      </AuthProvider>
    </LangContext.Provider>
  );
};

export default App;