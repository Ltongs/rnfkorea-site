// pages/Export/ExportShopPage.tsx
import React, { useCallback, useEffect, useMemo, useState, createContext, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, Plus, Settings } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

// ── Supabase Storage CDN 베이스 URL ──────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const IMG_BASE = `${SUPABASE_URL}/storage/v1/object/public/export-images`;

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "수출용 중고 지게차·굴삭기 쇼핑몰 | 중고장비 해외 수출 재고 | RNF KOREA";
const SEO_DESC =
  "수출용 중고 지게차·굴삭기 재고 목록. 연식·브랜드·용량·마스트·작동시간별 상세 스펙 확인. 정비·등급화(A/B/C) 완료. 해외 바이어 직거래 가능. 수출 문의 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/export-shop";
const SEO_KEYWORDS =
  "중고지게차수출,수출용지게차,used forklift export,중고굴삭기수출,지게차재고,굴삭기재고,중고지게차,중고장비수출,지게차해외수출,Korea used forklift";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

/**
 * ✅ JSON-LD: ItemList — 수출 장비 카테고리 구조화 데이터
 * CSV 재고는 JS로 렌더링되어 봇이 읽지 못하므로
 * 장비 카테고리 정보를 JSON-LD로 제공
 */
const JSON_LD_ITEM_LIST = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "RNF KOREA 수출용 중고 산업장비 쇼핑몰",
  url: "https://www.rnfkorea.co.kr/export-shop",
  description: "한국 내 중고 디젤 지게차·굴삭기를 정비·등급화하여 신흥국에 수출하는 중고장비 재고 목록",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Product",
        name: "수출용 중고 디젤 지게차 (Used Forklift for Export)",
        description: "연식 8~15년, 2.5~7톤 현대·두산 중심 디젤 지게차. A/B/C 등급 정비 완료. 부품 패키지 포함 납품 가능.",
        category: "중고 지게차",
        brand: { "@type": "Brand", name: "현대/두산/도요타/클라크 등" },
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          seller: { "@type": "Organization", name: "(주)알앤에프코리아" },
          description: "PDI 정비 완료, A/B/C 등급 판정. 소모품·타이어 패키지 옵션 가능.",
        },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Product",
        name: "수출용 중고 굴삭기 (Used Excavator for Export)",
        description: "수출 가능 중고 굴삭기. 정비·등급화 후 해외 바이어에 직공급.",
        category: "중고 굴삭기",
        offers: {
          "@type": "Offer",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          seller: { "@type": "Organization", name: "(주)알앤에프코리아" },
        },
      },
    },
  ],
};

/**
 * ✅ JSON-LD: BreadcrumbList
 */
const JSON_LD_BREADCRUMB = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈",         item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "수출용 쇼핑몰", item: "https://www.rnfkorea.co.kr/export-shop" },
  ],
};

// ====================================================
// 타입 정의
// ====================================================
type EquipmentType = "forklift" | "mini_excavator" | "excavator";

type DbListing = {
  id: string;
  category: "excavator";
  brand: string;
  model: string | null;
  year: number | null;
  tonnage: number | null;
  engine_type: string | null;
  condition_grade: string | null;
  price_usd: number | null;
  price_negotiable: boolean;
  stock_qty: number;
  description_en: string | null;
  images: string[];
  status: string;
};

type SpecRow = {
  key?: string;
  label: string;
  value?: string;
};

type Filter = "all" | EquipmentType;

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

type InventoryCsvRow = {
  id: string;
  type: "forklift" | "mini_excavator" | "excavator";
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

type InventoryItem = {
  id: string;
  type: EquipmentType;
  title: string;
  folder: string;
  images: string[];
  specs?: SpecRow[];
};

// ====================================================
// CSV 파싱
// ====================================================
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && ch === ",") { row.push(cell); cell = ""; continue; }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
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
      const type: "forklift" | "mini_excavator" | "excavator" = 
        typeRaw === "excavator" ? "excavator" :
        typeRaw === "mini_excavator" ? "mini_excavator" : "forklift";
      const imgCountNum = Number((r[10] ?? "").trim());
      const imgCount = Number.isFinite(imgCountNum) && imgCountNum > 0 ? imgCountNum : 5;

      return {
        id, type,
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

// ====================================================
// 공통 컴포넌트
// ====================================================
function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section
      className="relative bg-[#0a192f] text-white overflow-hidden"
      aria-label="페이지 헤더"
    >
      {/* 배경 패턴 */}
      <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true">
        <div className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)",
          backgroundSize: "24px 24px",
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-12 md:py-16">
        <div className="max-w-3xl">

          {/* Breadcrumb */}
          <nav aria-label="breadcrumb">
            <ol
              className="flex items-center text-sm text-white/60"
              itemScope
              itemType="https://schema.org/BreadcrumbList"
            >
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                <Link to="/" className="hover:text-white transition-colors" itemProp="item">
                  <span itemProp="name">Home</span>
                </Link>
                <meta itemProp="position" content="1" />
              </li>
              <li aria-hidden="true" className="mx-2">/</li>
              <li
                className="text-white/90 font-semibold"
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
                aria-current="page"
              >
                <span itemProp="name">수출용 쇼핑몰</span>
                <meta itemProp="position" content="2" />
              </li>
            </ol>
          </nav>

          {eyebrow && (
            <p className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-400">
              {eyebrow}
            </p>
          )}

          <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-white break-keep">
            {title}
          </h1>

          {description && (
            <p className="mt-4 text-base md:text-lg leading-7 text-white/75 max-w-3xl break-keep">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ====================================================
// ClickableThumb
// ====================================================
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

  useEffect(() => { setOk(true); }, [src]);

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
          <p className="text-sm font-semibold">Image unavailable</p>
          {src && <p className="text-[11px] mt-1 break-all px-3 opacity-80">{src}</p>}
        </div>
      )}
    </button>
  );
};

// ====================================================
// Lightbox
// ====================================================
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
  const [state, setState] = useState<LightboxState>({ isOpen: false, images: [], index: 0, title: "" });

  const openAt = (title: string, images: string[], index = 0) => {
    setState({ isOpen: true, images, index: Math.max(0, Math.min(index, images.length - 1)), title });
  };
  const close   = () => setState((s) => ({ ...s, isOpen: false }));
  const setIndex = (i: number) => setState((s) => ({ ...s, index: Math.max(0, Math.min(i, s.images.length - 1)) }));
  const next = () => setState((s) => ({ ...s, index: Math.min(s.index + 1, s.images.length - 1) }));
  const prev = () => setState((s) => ({ ...s, index: Math.max(s.index - 1, 0) }));

  useEffect(() => {
    if (!state.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
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
      aria-label={`${state.title || "장비"} 이미지 확대보기`}
    >
      <div
        className="w-full max-w-5xl bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-bold text-navy-900">
            {state.title || "Preview"}{" "}
            <span className="ml-2 text-sm text-gray-500">
              ({state.index + 1}/{state.images.length})
            </span>
          </p>
          <button
            type="button"
            className="px-3 py-1 rounded-md hover:bg-gray-100"
            onClick={close}
            aria-label="닫기"
          >
            Close
          </button>
        </div>

        <div className="relative bg-black">
          <img
            src={src}
            alt={`${state.title || "장비"} 이미지 ${state.index + 1}`}
            className="w-full max-h-[75vh] object-contain"
          />
          {state.images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 flex items-center justify-center"
                onClick={prev}
                aria-label="이전 이미지"
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 flex items-center justify-center"
                onClick={next}
                aria-label="다음 이미지"
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

// ====================================================
// InventoryCard
// ====================================================
const InventoryCard: React.FC<{ item: InventoryItem }> = ({ item }) => {
  const { openAt } = useLightbox();

  const [okSet, setOkSet] = useState<Set<string>>(new Set());
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => { setHeroIndex(0); setOkSet(new Set()); }, [item.id]);

  const preload = useMemo(() => item.images.slice(0, 6), [item.images]);

  const displayImages = useMemo(() => {
    return okSet.size > 0 ? item.images.filter((src) => okSet.has(src)) : item.images;
  }, [item.images, okSet]);

  useEffect(() => {
    if (heroIndex >= displayImages.length) setHeroIndex(0);
  }, [displayImages.length, heroIndex]);

  const heroSrc = displayImages[heroIndex] ?? displayImages[0];
  const typeLabel = item.type === "forklift" ? "지게차 (Forklift)" : item.type === "mini_excavator" ? "미니굴삭기 (Mini Excavator)" : "굴삭기 (Excavator)";

  return (
    // ✅ article + itemScope — 장비 상품 단위 시맨틱 마크업
    <article
      className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all"
      onMouseLeave={() => setHeroIndex(0)}
      itemScope
      itemType="https://schema.org/Product"
    >
      <ClickableThumb
        src={heroSrc}
        alt={`${item.title} 수출용 중고 ${item.type === "forklift" ? "지게차" : "굴삭기"} 사진`}
        className="w-full h-56 bg-gray-50"
        onClick={() => openAt(item.title, displayImages, heroIndex)}
        title={`${item.title} 사진 크게 보기`}
      />

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* ✅ 장비 종류 p태그 */}
            <p className="text-sm text-gray-500">{typeLabel}</p>
            {/* ✅ h3 + itemProp — 장비명 시맨틱 처리 */}
            <h3
              className="text-lg md:text-xl font-semibold text-navy-900 break-keep"
              itemProp="name"
            >
              {item.title}
            </h3>
          </div>
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1 rounded-full">
            {item.type === "forklift" ? "FORKLIFT" : item.type === "mini_excavator" ? "MINI EXC." : "EXCAVATOR"}
          </span>
        </div>

        {/* preload hidden — 이미지 사전 로드 (SEO 영향 없음) */}
        <div className="hidden" aria-hidden="true">
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

        {/* 썸네일 목록 */}
        {displayImages.length > 1 && (
          <div
            className="flex gap-2"
            onMouseLeave={() => setHeroIndex(0)}
            role="group"
            aria-label="장비 사진 목록"
          >
            {displayImages.slice(0, 6).map((src, idx) => (
              <ClickableThumb
                key={src}
                src={src}
                alt={`${item.title} 사진 ${idx + 1}`}
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

        {/* ✅ 스펙 테이블 — dl/dt/dd로 교체 (key-value 구조화) */}
        {item.specs && item.specs.length > 0 && (
          <dl
            className="border-t pt-3 space-y-1"
            itemProp="additionalProperty"
          >
            {item.specs.map((row) => (
              <div key={row.label} className="flex justify-between text-sm py-1 border-b last:border-b-0">
                <dt className="text-gray-500 shrink-0 w-24 break-keep">{row.label}</dt>
                <dd className="text-navy-900 font-medium text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
};

// ====================================================
// DbExcavatorCard — Supabase DB 굴삭기 카드
// ====================================================
const DbExcavatorCard: React.FC<{ item: DbListing }> = ({ item }) => {
  const [imgIdx, setImgIdx] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);
  const hasImages = item.images.length > 0;
  const { openAt } = useLightbox();

  const imageUrls = item.images.map(dbImgUrl);

  return (
    <article className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
      {/* 이미지 */}
      <div
        className="relative w-full h-56 bg-gray-100 cursor-pointer overflow-hidden"
        onClick={() => hasImages && openAt(
          `${item.brand} ${item.model ?? ""}`,
          imageUrls,
          imgIdx
        )}
      >
        {hasImages ? (
          <img
            src={imageUrls[imgIdx]}
            alt={`${item.brand} ${item.model ?? ""}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
            Image unavailable
          </div>
        )}
        {item.condition_grade && (
          <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border ${GRADE_COLOR[item.condition_grade] ?? "bg-gray-100 text-gray-600"}`}>
            Grade {item.condition_grade}
          </span>
        )}
        {item.status === "sold" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-xl tracking-widest">SOLD</span>
          </div>
        )}
      </div>

      {/* 썸네일 */}
      {imageUrls.length > 1 && (
        <div className="flex gap-2 px-4 pt-3">
          {imageUrls.slice(0, 6).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setImgIdx(i)}
              className={`w-14 h-14 rounded-md border overflow-hidden transition-all ${i === imgIdx ? "border-orange-500" : "border-gray-200 hover:border-orange-300"}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* 정보 */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">굴삭기 (Excavator)</p>
            <h3 className="text-lg md:text-xl font-semibold text-navy-900 break-keep">
              {item.brand}{item.model ? ` ${item.model}` : ""}
              {item.year ? ` (${item.year})` : ""}
            </h3>
          </div>
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase bg-orange-50 text-orange-600 border border-orange-200 px-2.5 py-1 rounded-full">
            EXCAVATOR
          </span>
        </div>

        {/* 스펙 */}
        <dl className="border-t pt-3 space-y-1">
          {item.tonnage && (
            <div className="flex justify-between text-sm py-1 border-b">
              <dt className="text-gray-500 w-24">Tonnage</dt>
              <dd className="text-navy-900 font-medium">{item.tonnage}T</dd>
            </div>
          )}
          {item.engine_type && (
            <div className="flex justify-between text-sm py-1 border-b">
              <dt className="text-gray-500 w-24">Engine</dt>
              <dd className="text-navy-900 font-medium capitalize">{item.engine_type}</dd>
            </div>
          )}
          {item.stock_qty > 1 && (
            <div className="flex justify-between text-sm py-1 border-b">
              <dt className="text-gray-500 w-24">Quantity</dt>
              <dd className="text-navy-900 font-medium">{item.stock_qty}대</dd>
            </div>
          )}
          {item.price_usd && (
            <div className="flex justify-between text-sm py-1 border-b">
              <dt className="text-gray-500 w-24">Price</dt>
              <dd className="text-navy-900 font-medium">
                USD {item.price_usd.toLocaleString()}{item.price_negotiable ? " (협의)" : ""}
              </dd>
            </div>
          )}
          {!item.price_usd && (
            <div className="flex justify-between text-sm py-1 border-b">
              <dt className="text-gray-500 w-24">Price</dt>
              <dd className="text-navy-900 font-medium">가격 문의</dd>
            </div>
          )}
          {item.description_en && (
            <div className="py-2 text-sm text-gray-600 leading-relaxed line-clamp-3">
              {item.description_en}
            </div>
          )}
        </dl>
      </div>
    </article>
  );
};

// ====================================================
// 상수
// ====================================================
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=0&single=true&output=csv";

const LISTINGS_STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/export-listings`;

function dbImgUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${LISTINGS_STORAGE_BASE}/${path}`;
}

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
};

// ====================================================
// 메인 페이지 컴포넌트
// ====================================================
const ExportShopPage: React.FC = () => {
  const { isHyundaiCM, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();
  const canManage = isHyundaiCM || isAdmin || isSubAdmin;

  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<InventoryCsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  // DB 굴삭기 매물
  const [dbListings, setDbListings] = useState<DbListing[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    // prerender 환경(Node.js SSG)에서는 외부 fetch 생략 — 무한 대기 방지
    if (typeof window === "undefined") return;

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
    return () => { alive = false; };
  }, []);

  // DB 굴삭기 매물 fetch
  useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true;
    (async () => {
      setDbLoading(true);
      try {
        const { data } = await supabase
          .from("export_listings")
          .select("*")
          .eq("category", "excavator")
          .eq("status", "active")
          .order("created_at", { ascending: false });
        if (!alive) return;
        setDbListings((data as DbListing[]) ?? []);
      } catch (_) {}
      finally { if (alive) setDbLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const inventory: InventoryItem[] = useMemo(() => {
    return rows.map((r) => {
      const count = r.imgCount ?? 5;
      const prefix = r.type === "forklift" ? "F" : "X";
      const folder = `(${prefix})${r.id}`;
      const images = Array.from({ length: count }, (_, i) =>
        `${IMG_BASE}/(${prefix})${r.id}/${prefix}_${r.id}_${i + 1}.jpg`
      );

      const specs: SpecRow[] = [
        ...(r.brand    ? [{ label: "Brand",     value: r.brand    }] : []),
        ...(r.year     ? [{ label: "Year",      value: r.year     }] : []),
        ...(r.capacity ? [{ label: "Capacity",  value: r.capacity }] : []),
        ...(r.mast     ? [{ label: "Mast",      value: r.mast     }] : []),
        ...(r.hours    ? [{ label: "Hours",     value: r.hours    }] : []),
        ...(r.condition? [{ label: "Condition", value: r.condition}] : []),
        ...(r.remarks  ? [{ label: "Remarks",   value: r.remarks  }] : []),
      ];

      return { id: r.id, type: r.type, title: r.title, folder, images, specs };
    });
  }, [rows]);

  const forkliftCount     = inventory.filter((x) => x.type === "forklift").length;
  const miniExcavatorCount = inventory.filter((x) => x.type === "mini_excavator").length;
  const excavatorCount    = dbListings.length;
  const totalCount        = inventory.length + dbListings.length;

  const filtered = useMemo(() => {
    if (filter === "excavator") return [];          // DB로 처리
    if (filter === "all") return inventory.filter((x) => x.type !== "excavator"); // excavator는 DB로
    return inventory.filter((x) => x.type === filter);
  }, [filter, inventory]);

  const pillBase = "px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200";
  const pillOn   = "bg-orange-500 text-white border-orange-500 shadow-sm";
  const pillOff  = "bg-white text-navy-900 border-gray-200 hover:border-orange-300 hover:text-orange-600";

  return (
    <LightboxProvider>
      <div className="bg-white text-navy-900">

        {/* ========================================================
            ✅ SEO HEAD
            ======================================================== */}
        <Helmet>
          <title>{SEO_TITLE}</title>
          <meta name="description" content={SEO_DESC} />
          <meta name="keywords" content={SEO_KEYWORDS} />
          <link rel="canonical" href={SEO_CANONICAL} />
          <meta name="robots" content="index, follow" />

          {/* Open Graph */}
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="(주)알앤에프코리아" />
          <meta property="og:title" content={SEO_TITLE} />
          <meta property="og:description" content={SEO_DESC} />
          <meta property="og:url" content={SEO_CANONICAL} />
          <meta property="og:image" content={SEO_OG_IMAGE} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:locale" content="ko_KR" />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={SEO_TITLE} />
          <meta name="twitter:description" content={SEO_DESC} />
          <meta name="twitter:image" content={SEO_OG_IMAGE} />

          {/* ✅ JSON-LD */}
          <script type="application/ld+json">{JSON.stringify(JSON_LD_ITEM_LIST)}</script>
          <script type="application/ld+json">{JSON.stringify(JSON_LD_BREADCRUMB)}</script>
        </Helmet>

        {/* ========================================================
            Hero
            ======================================================== */}
        <PageHero
          eyebrow={filter === "excavator" ? "Export Shop" : "Export Shop"}
          title={filter === "excavator" ? "Used Excavators for Export" : "수출용 쇼핑몰"}
          description={filter === "excavator"
            ? "Grade-certified (A/B/C), PDI-complete used excavators from Hyundai Construction Equipment. Ready to ship worldwide."
            : "수출용 매물을 확인하고, 필요 시 스펙·가격·선적 조건을 요청하실 수 있습니다."
          }
        />

        {/* ========================================================
            상품 목록
            ======================================================== */}
        <section className="py-16 md:py-20" aria-label="수출용 중고 장비 재고 목록">
          <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-8">

            {/* 파트너 박스 */}
            {filter !== "excavator" && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 크린어스 */}
                  <a
                    href="http://www.cleanearth.kr/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group rounded-2xl border border-gray-200 bg-white px-5 py-4 hover:border-orange-300 hover:shadow-sm transition-all min-h-[110px] flex flex-col justify-center"
                    title="(주)크린어스 홈페이지로 이동"
                    aria-label="파트너사 (주)크린어스 홈페이지 (새 탭)"
                  >
                    <div className="flex items-center">
                      <img
                        src="/logo/cleanearth.png"
                        alt="(주)크린어스 로고"
                        className="h-10 md:h-9 w-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-navy-900 leading-snug">
                      이 사업은 지구를 깨끗하게 크린어스(CleanEarth)
                      <br />(주)크린어스와 함께합니다.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-navy-900">www.cleanearth.kr</p>
                  </a>

                  {/* 형제중기 */}
                  <a
                    href="http://www.brotherlift.com"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group rounded-2xl border border-gray-200 bg-white px-5 py-4 hover:border-orange-300 hover:shadow-sm transition-all min-h-[110px] flex flex-col justify-center"
                    title="현대지게차 경기북부판매 – 웹사이트 바로가기"
                    aria-label="파트너사 현대지게차 경기북부판매(형제중기) 홈페이지 (새 탭)"
                  >
                    <div className="flex items-center">
                      <img
                        src="/logo/brotherlift.png"
                        alt="현대지게차 경기북부판매(형제중기) 로고"
                        className="h-12 md:h-10 w-auto object-contain"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-navy-900 leading-snug">
                      아래 차량들은 국내 최고의 지게차 정비업체
                      <br />현대지게차 경기북부판매(형제중기)에서 관리합니다.
                    </p>
                    <p className="text-xs font-medium text-gray-600 mt-1">
                      📞{" "}
                      <span onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <a href="tel:1899-1373" className="hover:text-orange-600 transition-colors">
                          1899-1373
                        </a>
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-semibold text-navy-900">www.brotherlift.com</p>
                  </a>
                </div>

                {/* 로딩 / 에러 */}
                {loading && (
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-2" aria-live="polite">
                    <Loader2 className="animate-spin h-4 w-4" aria-hidden="true" />
                    상품 정보를 불러오는 중입니다...
                  </p>
                )}
                {!!errMsg && <p className="text-sm text-red-600 mt-2" role="alert">{errMsg}</p>}
              </div>
            )}

            {/* 굴삭기 탭 - 영문 파트너 박스 */}
            {filter === "excavator" && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold tracking-wider text-orange-500 uppercase mb-1">Supplier</p>
                    <p className="font-bold text-slate-900">Hyundai Construction Equipment — Busan/Gyeongnam</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Grade-certified used excavators. PDI complete. Parts package available.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-400">Contact</p>
                    <a href="tel:15511873" className="text-sm font-bold text-slate-800 hover:text-orange-500 transition-colors">
                      +82-1551-1873
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ 필터 — role="group" + aria-label + aria-pressed */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
              <div
                className="flex flex-wrap gap-3 items-center"
                role="group"
                aria-label="장비 종류 필터"
              >
                <button
                  type="button"
                  className={`${pillBase} ${filter === "all" ? pillOn : pillOff}`}
                  onClick={() => setFilter("all")}
                  aria-pressed={filter === "all"}
                >
                  전체 ({totalCount})
                </button>
                <button
                  type="button"
                  className={`${pillBase} ${filter === "forklift" ? pillOn : pillOff}`}
                  onClick={() => setFilter("forklift")}
                  aria-pressed={filter === "forklift"}
                >
                  지게차 ({forkliftCount})
                </button>
                <button
                  type="button"
                  className={`${pillBase} ${filter === "mini_excavator" ? pillOn : pillOff}`}
                  onClick={() => setFilter("mini_excavator")}
                  aria-pressed={filter === "mini_excavator"}
                >
                  미니굴삭기 ({miniExcavatorCount})
                </button>
                <button
                  type="button"
                  className={`${pillBase} ${filter === "excavator" ? pillOn : pillOff}`}
                  onClick={() => setFilter("excavator")}
                  aria-pressed={filter === "excavator"}
                >
                  굴삭기 ({excavatorCount})
                </button>
                {canManage && (
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/export-shop/listing/new")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-all"
                    >
                      <Plus size={13} />
                      굴삭기 등록
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/export-shop/listing/manage")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-all"
                    >
                      <Settings size={13} />
                      관리
                    </button>
                  </div>
                )}
              </div>

              {/* ✅ 스크린리더에 결과 수 알림 */}
              <p className="sr-only" aria-live="polite">
                {filtered.length}개 장비가 표시됩니다.
              </p>

              {/* ✅ ul/li + article — 장비 카드 시맨틱 처리 */}
              <ul
                className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none p-0"
                role="list"
                aria-label="수출용 중고 장비 목록"
              >
                {filtered.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <InventoryCard item={item} />
                  </li>
                ))}
              </ul>

              {/* ── DB 굴삭기 섹션 (현대건설기계 부산/경남) ── */}
              {(filter === "all" || filter === "excavator") && (
                <div className="mt-6 space-y-4">
                  {(filter === "all") && (
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-gray-200" />
                      <p className="text-xs font-semibold text-gray-400 tracking-wider uppercase">굴삭기 (현대건설기계 부산/경남)</p>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                  )}

                  {dbLoading && (
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <Loader2 className="animate-spin h-4 w-4" />
                      굴삭기 매물을 불러오는 중...
                    </p>
                  )}

                  {!dbLoading && dbListings.length === 0 && (
                    <div className="text-center py-10 text-gray-400 text-sm">
                      등록된 굴삭기 매물이 없습니다.
                      {canManage && (
                        <button
                          onClick={() => navigate("/export-shop/listing/new")}
                          className="ml-2 text-orange-500 underline"
                        >
                          첫 매물 등록하기
                        </button>
                      )}
                    </div>
                  )}

                  {!dbLoading && dbListings.length > 0 && (
                    <ul className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none p-0">
                      {dbListings.map((item) => (
                        <li key={item.id}>
                          <DbExcavatorCard item={item} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ── 상담/견적 CTA ── */}
        <section className="mt-16 rounded-3xl bg-[#0a192f] text-white overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)", backgroundSize: "24px 24px" }} />
          <div className="relative px-6 md:px-10 py-10 md:py-14 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold tracking-[0.12em] uppercase text-orange-400">
                {filter === "excavator" ? "Can't find what you need?" : "견적 문의"}
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold break-keep">
                {filter === "excavator"
                  ? "Tell us your requirements"
                  : "원하시는 장비를 찾지 못하셨나요?"}
              </h2>
              <p className="text-white/70 text-sm leading-relaxed break-keep">
                {filter === "excavator"
                  ? "Share your specs, quantity and budget — we'll find the right excavator for you."
                  : "수량·기종·예산을 알려주시면 맞춤 견적을 빠르게 안내해 드립니다."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/export-shop/inquiry"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-all"
              >
                {filter === "excavator" ? "Request a Quote" : "상담 / 견적 요청"}
              </Link>
              <a
                href="tel:15511873"
                className="inline-flex items-center justify-center px-6 py-3 rounded-2xl border border-white/30 text-white font-semibold hover:bg-white/10 transition-all"
              >
                {filter === "excavator" ? "☎ +82-1551-1873" : "☎ 1551-1873"}
              </a>
            </div>
          </div>
        </section>

      </div>
    </LightboxProvider>
  );
};

export default ExportShopPage;