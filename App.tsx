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
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

// ✅ SEO: react-helmet-async (yarn add react-helmet-async / npm i react-helmet-async)
import { Helmet, HelmetProvider } from "react-helmet-async";

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
import HyundaiCMPage from "./pages/HyundaiCM/index";
import HyundaiCMLoginPage from "./pages/HyundaiCM/Login";
import HyundaiCMRouteGuard from "./pages/HyundaiCM/Routeguard";
import SitemapPage from "./pages/Sitemap";
import IndividualCargoFinancePage from "./pages/IndividualCargoFinance/index";
import TireShopPage from "./pages/TireShop/index";
import TireShopDetailPage from "./pages/TireShop/detail";
import CallManagementPage from "./pages/CallManagement/index";
import CallManagementLoginPage from "./pages/CallManagement/Login";
import KakaoCallbackPage from "./pages/KakaoCallback";
import KakaoConnectPage from "./pages/HyundaiCM/KakaoConnect";
import DashboardPage from "./pages/Dashboard";
import BatteryPage from "./pages/Battery/index";
import HomePage from "./pages/Home";
import FinancePage from "./pages/Finance/index";
import TiresPage from "./pages/Tires/index";
import ExportPage from "./pages/Export/index";
import ExportShopPage from "./pages/Export/ExportShopPage";
import ExportInquiryPage from "./pages/Export/ExportInquiryPage";
import ExportListingNewPage from "./pages/Export/ExportListingNewPage";
import ExportListingManagePage from "./pages/Export/ExportListingManagePage";
import BatteryShopPage from "./pages/battery-shop";
import TireRentalPage from "./pages/TireRental/index";
import SecretaryPage from "./pages/secretary/index";
import SecretaryInsPage from "./pages/secretary-ins/index";
import OrdersPage from "./pages/Orders/index";
import OrderConfirmPage from "./pages/OrderConfirm/index";
import FinanceHubPage from "./pages/FinanceHub/index";

/* utils / config */
import { fetchTireRows } from "./lib/tiresCsv";
import { TIRE_CSV_URL } from "./pages/TireShop/config";

import TiresShopPage from "./pages/TireShop";

// =========================
// SEO 상수
// =========================
const SITE_URL = "https://www.rnfkorea.co.kr";
const SITE_NAME = "(주)알앤에프코리아";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`; // 1200×630 권장

/**
 * ✅ 라우트별 SEO 메타 정보
 * - title: 브라우저 탭 + 검색결과 제목 (40~55자 권장)
 * - description: 검색결과 설명문 (80~155자 권장)
 * - canonical: 정규 URL (중복 페이지 방지)
 * - keywords: 네이버 웹마스터 보조 (구글은 무시하지만 네이버는 일부 반영)
 */
interface RouteSeoMeta {
  title: string;
  description: string;
  canonical: string;
  keywords?: string;
  ogImage?: string;
}

const ROUTE_SEO: Record<string, RouteSeoMeta> = {
  "/": {
    title: "RNF KOREA | 산업용 배터리·타이어·금융솔루션 전문기업",
    description:
      "(주)알앤에프코리아는 물류기기용 LFP배터리, 산업용·화물용 타이어, 렌탈 및 금융 서비스를 제공하는 산업재 전문기업입니다. 장비의 구입부터 유지·보수·매각까지 전 LifeCycle을 지원합니다.",
    canonical: `${SITE_URL}/`,
    keywords: "LFP배터리,산업용타이어,화물타이어,지게차배터리,렌탈,금융솔루션,알앤에프코리아",
  },
  "/tires": {
    title: "타이어 | 카고·덤프·버스 타이어 라인업 | RNF KOREA",
    description:
      "카고, 덤프, 버스용 산업용 타이어 전 라인업. 융하인리히·니찌유·Yale·Hyster 등 주요 고객사 납품 실적. 타이어 전문 상담 1551-1873.",
    canonical: `${SITE_URL}/tires`,
    keywords: "카고타이어,덤프타이어,버스타이어,산업용타이어,지게차타이어,화물타이어,타이어쇼핑몰",
  },
  "/battery": {
    title: "LFP 배터리 | 물류기기용 리튬인산철 배터리 | RNF KOREA",
    description:
      "지게차·물류기기 전용 LFP(리튬인산철) 배터리 솔루션. 배터리 교체·렌탈·유지보수 서비스. 국내 최대 규모 운영 풀 보유. 문의 1551-1873.",
    canonical: `${SITE_URL}/battery`,
    keywords: "LFP배터리,리튬인산철배터리,지게차배터리,물류기기배터리,배터리렌탈,배터리교체",
  },
  "/export": {
    title: "중고장비 수출 | 중고 지게차·굴삭기 해외수출 | RNF KOREA",
    description:
      "국내 중고 디젤 지게차·굴삭기 해외 수출 전문. 롯데렌탈·현대캐피탈 등 대형 렌탈사 직수출 파트너. 수출 재고 문의 1551-1873.",
    canonical: `${SITE_URL}/export`,
    keywords: "중고지게차수출,중고지게차,굴삭기수출,중고장비수출,used forklift export,Korea",
  },
  "/finance": {
    title: "금융솔루션 | 장비 렌탈·할부·리스 | RNF KOREA",
    description:
      "산업장비 구매를 위한 렌탈·할부·리스 금융솔루션. 롯데렌탈·현대캐피탈 등 주요 금융사 연계. 개인(개별)화물협회 전용 상품 운영. 1551-1873.",
    canonical: `${SITE_URL}/finance`,
    keywords: "장비렌탈,지게차할부,지게차리스,산업기기금융,화물금융,개인화물협회",
  },
  "/cargo-finance": {
    title: "개인(개별)화물협회 전용 금융상품 | RNF KOREA",
    description:
      "개인화물·개별화물 협회 회원 전용 금융상품. 지게차·화물차량 구매 시 우대 금리 및 맞춤형 할부·렌탈 상품 제공. 문의 1551-1873.",
    canonical: `${SITE_URL}/cargo-finance`,
    keywords: "개인화물협회,개별화물협회,화물금융,지게차금융,우대금리,화물차금융",
  },
  "/tires-shop": {
    title: "타이어 쇼핑몰 | 산업용·화물용 타이어 온라인 구매 | RNF KOREA",
    description:
      "카고·덤프·버스·산업용 타이어를 온라인으로 간편하게 구매하세요. 다양한 규격·브랜드 재고 보유. 빠른 배송. RNF KOREA 공식 쇼핑몰.",
    canonical: `${SITE_URL}/tires-shop`,
    keywords: "타이어쇼핑몰,산업용타이어구매,화물타이어온라인,카고타이어가격,덤프타이어",
  },
  "/export-shop": {
    title: "수출용 중고장비 쇼핑몰 | 지게차·굴삭기 재고 | RNF KOREA",
    description:
      "수출용 중고 지게차·굴삭기 재고 목록. 연식·브랜드·용량별 필터 검색. 해외 바이어 직거래 가능. 수출 문의 admin@rnfkorea.co.kr",
    canonical: `${SITE_URL}/export-shop`,
    keywords: "중고지게차재고,수출용지게차,used forklift inventory,굴삭기재고,장비수출",
  },
  "/export-shop/inquiry": {
    title: "수출 상담/견적 요청 | RNF KOREA",
    description: "수출용 중고 지게차·굴삭기 상담 및 견적 요청. 수량·기종·예산을 알려주시면 빠르게 안내해 드립니다.",
    canonical: `${SITE_URL}/export-shop/inquiry`,
    keywords: "수출견적요청,지게차수출상담,중고장비수출문의",
  },
  "/battery-shop": {
    title: "배터리 쇼핑몰 | RNF KOREA",
    description:
      "물류기기용 LFP 배터리 온라인 쇼핑몰. 배터리 문의는 1551-1873으로 연락주세요.",
    canonical: `${SITE_URL}/battery-shop`,
    keywords: "LFP배터리쇼핑몰,지게차배터리구매,배터리온라인",
  },
  "/sitemap": {
    title: "사이트맵 | RNF KOREA",
    description: "(주)알앤에프코리아 전체 페이지 사이트맵입니다.",
    canonical: `${SITE_URL}/sitemap`,
  },
  "/tire-rental": {
    title: "화물차 타이어 렌탈 | 월 납입·초기비용 0원 | RNF KOREA",
    description:
      "카고·덤프·버스 화물차 타이어를 월 렌탈료로. 초기비용 없이 12개월 분납. 대한민국 최초 화물차 타이어 렌탈 서비스. 상담 1551-1873.",
    canonical: `${SITE_URL}/tire-rental`,
    keywords: "화물차타이어렌탈,카고타이어렌탈,덤프타이어렌탈,타이어월납입,타이어분납,상용차타이어렌탈",
  },
};

// =========================
// ✅ SEO Head 컴포넌트
// 각 라우트에서 <SeoHead /> 를 렌더링하면 해당 페이지의 메타태그가 주입됩니다.
// 각 pages/*/index.tsx 에서도 동일하게 사용하세요.
// =========================
export const SeoHead: React.FC<Partial<RouteSeoMeta> & { jsonLd?: object }> = ({
  title,
  description,
  canonical,
  keywords,
  ogImage = DEFAULT_OG_IMAGE,
  jsonLd,
}) => {
  const { pathname } = useLocation();
  const routeMeta = ROUTE_SEO[pathname] ?? ROUTE_SEO["/"];

  const resolvedTitle = title ?? routeMeta.title;
  const resolvedDesc = description ?? routeMeta.description;
  const resolvedCanonical = canonical ?? routeMeta.canonical;
  const resolvedKeywords = keywords ?? routeMeta.keywords;

  return (
    <Helmet>
      {/* ── 기본 메타 ── */}
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDesc} />
      {resolvedKeywords && <meta name="keywords" content={resolvedKeywords} />}
      <link rel="canonical" href={resolvedCanonical} />

      {/* ── Open Graph (카카오·네이버·페이스북 미리보기) ── */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDesc} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="ko_KR" />

      {/* ── Twitter Card ── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDesc} />
      <meta name="twitter:image" content={ogImage} />

      {/* ── 네이버 웹마스터 도구 (naver-site-verification은 index.html에 넣을 것) ── */}
      <meta name="robots" content="index, follow" />

      {/* ── JSON-LD 구조화 데이터 (선택) ── */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

// =========================
// ✅ 사이트 전역 JSON-LD (Organization + LocalBusiness)
// 구글 지식 패널, 네이버 플레이스 연동에 도움
// =========================
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  name: "(주)알앤에프코리아",
  alternateName: "RNF KOREA",
  url: SITE_URL,
  logo: `${SITE_URL}/logo/rnf-logo.png`,
  image: DEFAULT_OG_IMAGE,
  description:
    "물류기기용 LFP배터리, 산업용·화물용 타이어, 중고장비 수출, 렌탈·금융솔루션을 제공하는 산업재 전문기업",
  foundingDate: "2022",
  telephone: "1551-1873",
  email: "admin@rnfkorea.co.kr",
  address: {
    "@type": "PostalAddress",
    streetAddress: "산단로 325, 제에프동 1167호 (신길동)",
    addressLocality: "안산시 단원구",
    addressRegion: "경기도",
    postalCode: "15434",
    addressCountry: "KR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 37.3219,
    longitude: 126.8309,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
  ],
  sameAs: [
    // 네이버 플레이스, 카카오맵 등 등록 후 URL 추가
    // "https://place.naver.com/...",
  ],
};

// =========================
// ✅ 라우트별 SeoHead를 자동 주입하는 래퍼
// AppRoutes 내부의 <Route> 마다 별도 SeoHead를 넣는 대신
// 이 컴포넌트가 pathname을 보고 자동으로 주입합니다.
// 개별 페이지에서 더 상세한 메타가 필요하면 각 pages/*/index.tsx 안에
// <SeoHead title="..." description="..." /> 를 추가로 넣으면 마지막 것이 우선합니다.
// =========================
const AutoSeoHead: React.FC = () => {
  const { pathname } = useLocation();

  // /tires-shop/:sku 같은 동적 라우트는 detail 페이지에서 별도 처리
  if (pathname.startsWith("/tires-shop/") && pathname !== "/tires-shop") return null;
  // 업무용 페이지는 검색 노출 차단
  if (
    pathname.startsWith("/narumi") ||
    pathname.startsWith("/bson") ||
    pathname.startsWith("/work/")
  ) {
    return (
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
    );
  }

  return <SeoHead />;
};

// =========================
// 기존 코드 (수정 없음)
// =========================

const CARD_H = "h-[168px] md:h-[176px]";

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
  "text-sm text-gray-600 leading-snug line-clamp-2";

const CardShell: React.FC<{
  title: string;
  desc: string;
  imgSrc: string;
  imgAlt: string;
}> = ({ title, desc, imgSrc, imgAlt }) => (
  <div className="flex h-full">
    <div className="flex-1 min-w-0 p-6 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-1 rounded bg-orange-500" />
        <h3 className={cardTitle}>{title}</h3>
      </div>
      <p className={cardDesc}>{desc}</p>
    </div>
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
  imgCount?: number;
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

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

function ScrollToTopButton() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const hideEntirely = pathname.startsWith("/work/secretary")
    || pathname.startsWith("/work/call-management")
    || pathname.startsWith("/hyundaicm");
  const hideOnMobile = pathname.startsWith("/tires-shop");

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (hideEntirely) return null;
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`
        ${hideOnMobile ? "hidden md:inline-flex" : "inline-flex"}
        fixed bottom-6 right-6 z-[999999]
        h-12 px-5
        items-center justify-center
        rounded-xl
        bg-orange-500 text-white font-extrabold
        shadow-lg
        hover:bg-orange-600 hover:-translate-y-0.5
        active:translate-y-0
        transition-all duration-200
      `}
      aria-label="Back to top"
      title="맨 위로"
    >
      to TOP↑
    </button>
  );
}

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

const COPY = {
  ko: {
    menu: {
      biz: "사업영역",
      tires: "타이어",
      battery: "배터리",
      export: "중고장비 수출사업",
      finance: "금융솔루션",
      narumi: "나르미업무",
      shop: "쇼핑몰",
      tiresShop: "타이어 쇼핑몰",
      exportShop: "수출용 쇼핑몰",
      batteryShop: "배터리 쇼핑몰",
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
      address: "Sandanro 325, Danwongu, Ahsan, Gyreonggi, Korea",
      oneLine: "중고 디젤지게차 수출 전문",
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
      address: "Sandanro 325, Danwongu, Ahsan, Gyreonggi, Korea",
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
  t: (key: CopyKey) => any;
} | null>(null);

function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangContext.Provider");
  return ctx;
}

type LogoSpec = {
  src: string;
  alt: string;
  size?: string;
  opacity?: string;
  className?: string;
};

const BusinessPage: React.FC = () => (
  <div className="container mx-auto px-4 py-16">
    <h1 className="text-3xl font-bold text-navy-900">사업영역</h1>
    <p className="text-gray-600 mt-4">RNF KOREA의 4대 사업영역을 소개합니다.</p>
  </div>
);

type ProductCardProps = { p: TruckProduct };

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
      <div className="p-4 space-y-1">
        <div className="text-sm text-gray-500">{p.brand}</div>
        <div className="text-lg font-bold text-navy-900">{p.model}</div>
      </div>

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
    { logo: "/logo/TLS.png", name: "티엘에스주식회사 : 융하인리히" },
    { logo: "/logo/NICHIYU.jpg", name: "혁신상사 : 니찌유(NICHIYU)" },
    { logo: "/logo/yale.png", name: "예일이큅먼트 : Yale" },
    { logo: "/logo/Hyster.png", name: "하이스터코리아 : Hyster" },
    { logo: "/logo/brotherlift.png", name: "현대지게차 경기북부판매" },
    { logo: "/logo/dpl.png", name: "DPL : TOYOTA" },
  ];

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-6 w-1.5 rounded bg-orange-500" />
        <div className="w-full">
          <div className="text-lg font-extrabold text-navy-900">산업용 타이어 주요 고객사</div>
          <div className="text-sm text-gray-600 mt-1">실제 공급 및 운영 레퍼런스 기반</div>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-6">
            {clients.map((c) => (
              <div key={c.name} className="flex flex-col items-start">
                {c.logo && (
                  <img src={c.logo} alt={c.name} loading="lazy" className="h-8 w-auto object-contain" />
                )}
                <div className="mt-2 text-sm font-extrabold text-navy-900 leading-tight">{c.name}</div>
                <div className="text-xs text-gray-500 font-bold" />
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
            수출 가능 물량 선별 및 매입 단계에서 파트너와 협력하여 공급 안정성과 품질 기준을 강화합니다.
          </div>
          <div className="mt-2 text-xs font-extrabold text-navy-900">www.cleanearth.kr</div>
        </div>
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
// InventoryCard
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
          <div className="flex gap-2" onMouseLeave={() => setHeroIndex(0)}>
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


const PartnerLogos: React.FC<{ logos: string[]; label?: string }> = ({ logos, label }) => (
  <div className="mt-5 pt-4 border-t border-gray-100">
    {label && <div className="text-xs font-bold text-gray-500 mb-2">{label}</div>}
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

const Footer: React.FC = () => {
  const nav = useNavigate();
  const { user, canViewAll } = useAuth() as any;

  const goNarumi = () => {
    if (user && canViewAll) nav("/narumi");
    else nav("/narumi/login");
  };

  const goWork = (path: string) => {
    if (path === "/narumi") {
      if (user && canViewAll) nav("/narumi");
      else nav("/narumi/login");
      return;
    }
    if (path === "/hyundaicm") {
      nav("/hyundaicm/login");
      return;
    }
    if (user && canViewAll) nav(path);
    else nav("/narumi/login");
  };

  return (
    // ✅ id="company" 유지 (앵커 링크), itemScope/itemType으로 Schema.org LocalBusiness 마크업
    <footer
      id="company"
      className="bg-white text-navy-900 py-16 border-t border-gray-100"
      itemScope
      itemType="https://schema.org/LocalBusiness"
    >
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12 text-sm">
        {/* 회사 정보 */}
        <div className="col-span-1 md:col-span-2">
          <div className="mb-6">
            <div className="font-extrabold text-lg" itemProp="name">RNF KOREA</div>
            <meta itemProp="legalName" content="(주)알앤에프코리아" />
            <meta itemProp="url" content={SITE_URL} />
          </div>
          <p className="text-gray-500 max-w-sm leading-relaxed mb-6" itemProp="description">
            (주)알앤에프코리아는 장비의 구입부터 유지/보수/매각까지
            장비의 모든 LifeCycle을 함께하는 산업재 전문 기업입니다.
            <br />
            고객의 성공적인 비즈니스를 위해 최선을 다하겠습니다.
          </p>
        </div>

        {/* 연락처 */}
        <div>
          <h4 className="font-bold text-base mb-6">Contact Info</h4>
          <address
            className="not-italic"
            itemProp="address"
            itemScope
            itemType="https://schema.org/PostalAddress"
          >
            <ul className="space-y-4 text-gray-600">
              <li className="flex items-start gap-3">
                <Phone size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <a
                  href="tel:1551-1873"
                  className="font-bold hover:text-orange-500 transition-colors"
                  itemProp="telephone"
                >
                  1551-1873
                </a>
              </li>
              <li className="flex items-start gap-3">
                <User size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>사이트관리자: 이동수</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <a
                  href="mailto:admin@rnfkorea.co.kr"
                  className="hover:text-orange-500 transition-colors break-all"
                  itemProp="email"
                >
                  admin@rnfkorea.co.kr
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span className="leading-relaxed" itemProp="streetAddress">
                  경기도 안산시 단원구 산단로 325
                  <br />
                  제에프동 1167호 (신길동)
                </span>
              </li>
            </ul>
          </address>
        </div>

        {/* 메뉴 */}
        <nav aria-label="푸터 메뉴" className="space-y-8">
          <div>
            <h4 className="font-bold text-base mb-4">Business</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/tires" className="hover:text-orange-500 transition-colors">- 타이어</Link></li>
              <li><Link to="/battery" className="hover:text-orange-500 transition-colors">- 배터리</Link></li>
              <li><Link to="/export" className="hover:text-orange-500 transition-colors">- 중고장비 수출사업</Link></li>
              <li><Link to="/finance" className="hover:text-orange-500 transition-colors">- 금융솔루션</Link></li>
              <li><Link to="/cargo-finance" className="hover:text-orange-500 transition-colors">- 개인(개별)협회 전용 금융상품</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-base mb-4">Shop</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/tires-shop" className="hover:text-orange-500 transition-colors">- 타이어 쇼핑몰</Link></li>
              <li><Link to="/tire-rental" className="hover:text-orange-500 transition-colors">- 화물차 타이어 렌탈</Link></li>
              <li><Link to="/export-shop" className="hover:text-orange-500 transition-colors">- 수출용 쇼핑몰</Link></li>
              <li><Link to="/battery-shop" className="hover:text-orange-500 transition-colors">- 배터리 쇼핑몰</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-base mb-4">Etc</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link to="/sitemap" className="hover:text-orange-500 transition-colors">- 사이트맵</Link></li>
              <li><Link to="/work/secretary" className="hover:text-orange-500 transition-colors">- AI 비서</Link></li>
              <li>
                <button type="button" onClick={goNarumi} className="hover:text-orange-500 transition-colors text-left">
                  - 나르미업무
                </button>
              </li>
              <li>
                <Link to="/hyundaicm/login" className="hover:text-orange-500 transition-colors">
                  - 현대건설기계업무
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      {/* ✅ 법적 고지 — 전자상거래법 필수 표시 항목 */}
      <div className="container mx-auto px-4 mt-16 pt-8 border-t border-gray-100 text-center text-gray-400 text-xs space-y-2">
        <p className="leading-relaxed">
          <span className="font-semibold text-gray-500">(주)알앤에프코리아</span>
          &nbsp;|&nbsp; 대표: 이동수
          &nbsp;|&nbsp; 사업자등록번호: 316-88-02901
          &nbsp;|&nbsp; 통신판매업 신고번호: 신고 준비중
        </p>
        <p className="leading-relaxed">
          경기도 안산시 단원구 산단로 325 제에프동 1167호 (신길동)
          &nbsp;|&nbsp;
          <a href="tel:1551-1873" className="hover:text-orange-400 transition-colors">
            1551-1873
          </a>
          &nbsp;|&nbsp;
          <a href="mailto:admin@rnfkorea.co.kr" className="hover:text-orange-400 transition-colors">
            admin@rnfkorea.co.kr
          </a>
        </p>
        <p>&copy; {new Date().getFullYear()} (주)알앤에프코리아. All rights reserved.</p>
      </div>
    </footer>
  );
};

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  loginPath?: string;
}> = ({ children, loginPath = "/narumi/login" }) => {
  const { user, loading, canViewAll } = useAuth() as any;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user || !canViewAll) {
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAdmin, isSubAdmin, isInsAI, loading } = useAuth() as any;
  const isAdminLevel = isAdmin || isSubAdmin;
  // ✅ useLocation은 early return(아래 loading 분기) 이전, 컴포넌트 최상단에서
  //    단 한 번만 호출한다. early return 뒤에서 호출하거나 본문 여러 곳에서
  //    인라인으로 useLocation()을 반복 호출하면, loading 값이 바뀔 때마다
  //    렌더마다 호출되는 Hook의 개수/순서가 달라져 React의 "Rules of Hooks"를
  //    위반하게 되고, 그 결과 컴포넌트가 깨진 상태로 강제 리마운트되면서
  //    스크롤 위치가 예기치 않게 초기화되는 등의 부작용이 발생한다.
  const { pathname } = useLocation();

  // 로딩 중에는 리디렉션 판단 보류
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  // "/" 는 항상 홈페이지 (브라우저든 앱이든 동일)
  // PWA 앱은 manifest.json의 start_url(/work/secretary, /work/secretary-ins 등)로
  // 곧바로 진입하므로 "/"로 들어올 일이 거의 없고, 들어오더라도 홈페이지를 보여주는 것이 맞음.
  // 즉 "/"에서 계정 기준 강제 리다이렉트는 하지 않는다 — 브라우저에서 admin이 전체 사이트를 볼 수 있어야 함.
  const rootElement = <HomePage />;

  const hideHeader =
    pathname.startsWith("/work/secretary")
    || pathname.startsWith("/work/call-management")
    || pathname.startsWith("/hyundaicm")
    || pathname.startsWith("/narumi");

  const hideFooter =
    pathname.startsWith("/work/")
    || pathname.startsWith("/hyundaicm")
    || pathname.startsWith("/narumi");

  return (
    <div className="min-h-screen bg-white">
      <ScrollToTop />
      <ScrollToTopButton />

      {/* ✅ 라우트별 SEO 메타 자동 주입 */}
      <AutoSeoHead />

      {/* ✅ 사이트 전역 구조화 데이터 (Organization/LocalBusiness) */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(ORGANIZATION_JSON_LD)}
        </script>
      </Helmet>

      {!hideHeader && <PageHeader />}

      {/* ✅ <main> 에 id와 role 명시 → 스크린리더 + 검색엔진 본문 인식 */}
      <main id="main-content" role="main" className="w-full overflow-x-hidden">
        <Routes>
          <Route path="/" element={rootElement} />
          <Route path="/tires" element={<TiresPage />} />
          <Route path="/battery" element={<BatteryPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/export-shop" element={<ExportShopPage />} />
          <Route path="/export-shop/inquiry" element={<ExportInquiryPage />} />
          <Route path="/export-shop/listing/new" element={<ExportListingNewPage />} />
          <Route path="/export-shop/listing/edit/:id" element={<ExportListingNewPage />} />
          <Route path="/export-shop/listing/manage" element={<ExportListingManagePage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/cargo-finance" element={<IndividualCargoFinancePage />} />
          <Route path="/sitemap" element={<SitemapPage />} />

          {/* Shop */}
          <Route path="/tires-shop" element={<TireShopPage />} />
          <Route path="/tires-shop/:sku" element={<TireShopDetailPage />} />
          <Route path="/battery-shop" element={<BatteryShopPage />} />

          {/* 화물차 타이어 렌탈 랜딩페이지 */}
          <Route path="/tire-rental" element={<TireRentalPage />} />

          {/* Narumi (noindex는 AutoSeoHead에서 처리) */}
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

          {/* 현대건설기계 */}
          <Route path="/hyundaicm/login" element={<HyundaiCMLoginPage />} />
          <Route
            path="/hyundaicm"
            element={
              <HyundaiCMRouteGuard>
                <HyundaiCMPage />
              </HyundaiCMRouteGuard>
            }
          />
          <Route path="/hyundaicm/kakao-connect" element={
            <HyundaiCMRouteGuard>
              <KakaoConnectPage />
            </HyundaiCMRouteGuard>
          } />
          <Route path="/kakao-callback" element={<KakaoCallbackPage />} />

          {/* BS_ON */}
          <Route path="/bson" element={<BsonWorkPage />} />
          <Route path="/work/bson" element={<Navigate to="/bson" replace />} />
          <Route path="/work/call-management/login" element={<CallManagementLoginPage />} />
          <Route
            path="/work/call-management"
            element={
              <ProtectedRoute loginPath="/work/call-management/login">
                <CallManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/work/dashboard"
            element={isAdminLevel ? <DashboardPage /> : <Navigate to="/" replace />}
          />

          {/* AI 비서 */}
          <Route
            path="/work/secretary"
            element={isAdminLevel ? <SecretaryPage /> : <Navigate to="/" replace />}
          />

          {/* AI 비서 (Ins) — everyasset.fc@gmail.com 전용 */}
          <Route
            path="/work/secretary-ins"
            element={isInsAI ? <SecretaryInsPage /> : <Navigate to="/" replace />}
          />

          {/* 주문 관리 (진흥 타이어) */}
          <Route
            path="/work/orders"
            element={isAdminLevel ? <OrdersPage /> : <Navigate to="/" replace />}
          />

          {/* 매출 관리 (legacy redirect) */}
          <Route path="/work/sales" element={<Navigate to="/work/finance-hub" replace />} />

          {/* 매입 관리 (legacy redirect) */}
          <Route path="/work/purchases" element={<Navigate to="/work/finance-hub" replace />} />

          {/* 매출/매입 통합 관리 */}
          <Route
            path="/work/finance-hub"
            element={isAdminLevel ? <FinanceHubPage /> : <Navigate to="/" replace />}
          />

          {/* 물품발송/휠반납 확인 페이지 (진흥 전용, 인증 불필요) */}
          <Route path="/order/confirm/:action/:id" element={<OrderConfirmPage />} />
          <Route path="/order/confirm" element={<OrderConfirmPage />} />

          {/* legacy */}
          <Route path="/Narumi" element={<Navigate to="/narumi" replace />} />
        </Routes>
      </main>

      {!hideFooter && <Footer />}
    </div>
  );
};

// ── 스플래시 스크린 (PWA standalone 모드) ──────────────────────
// index.html 인라인 스플래시는 타이머(2초)로 자동 제거됨 — 별도 처리 불필요
const usePwaSplash = () => {
  useEffect(() => {
    // 혹시 __hidePwaSplash가 남아있으면 정리
    return () => { (window as any).__hidePwaSplash = undefined; };
  }, []);
};

const App = () => {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ko";
    const saved = window.localStorage.getItem("lang");
    return saved === "en" || saved === "ko" ? saved : "ko";
  });

  // index.html 인라인 스플래시를 React 마운트 후 제거
  usePwaSplash();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("lang", lang);
    }
  }, [lang]);

  const t = (key: CopyKey) => COPY[lang][key];

  return (
    <HelmetProvider>
      <LangContext.Provider value={{ lang, setLang, t }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LangContext.Provider>
    </HelmetProvider>
  );
};

export default App;