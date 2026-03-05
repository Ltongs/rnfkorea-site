// pages/Export/ExportShopPage.tsx
import React, { useEffect, useMemo, useState, createContext, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

type EquipmentType = "forklift" | "excavator";

type SpecRow = {
  key?: string;   // ✅ optional 로 변경
  label: string;
  value?: string;
};

type Filter = "all" | EquipmentType;

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

export default ExportShopPage;