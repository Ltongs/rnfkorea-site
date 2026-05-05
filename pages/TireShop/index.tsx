import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

// ====================================================
// SEO 설정
// ====================================================
const SEO_TITLE = "타이어 쇼핑몰 | 상용·화물·산업용 타이어 온라인 구매 | RNF KOREA";
const SEO_DESC =
  "카고·덤프·버스·트레일러용 상용 타이어 온라인 쇼핑몰. 금호타이어 12R22.5, 385/65R22.5 등 다양한 규격 재고 보유. 수량별 예상금액 즉시 확인, 상담 1551-1873.";
const SEO_CANONICAL = "https://www.rnfkorea.co.kr/tires-shop";
const SEO_KEYWORDS =
  "타이어쇼핑몰,상용타이어구매,화물타이어,카고타이어,덤프타이어,버스타이어,트레일러타이어,금호타이어,12R22.5,385/65R22.5,타이어온라인,산업용타이어";
const SEO_OG_IMAGE = "https://www.rnfkorea.co.kr/og-image.jpg";

/**
 * ✅ JSON-LD: ItemList — 주요 타이어 규격 구조화 데이터
 * CSV는 JS로 렌더링되어 봇이 읽지 못하므로,
 * 핵심 상품 정보를 JSON-LD로 하드코딩하여 검색엔진에 노출
 */
const JSON_LD_ITEM_LIST = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "RNF KOREA 타이어 쇼핑몰 주요 상품",
  url: "https://www.rnfkorea.co.kr/tires-shop",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Product",
        name: "금호타이어 KRS55 12R22.5",
        description: "카고·트레일러용 고마일리지 타이어. 특수 컴파운드 적용.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Product",
        name: "금호타이어 KRA60 12R22.5",
        description: "카고·트레일러용 내구성 타이어. 마일리지 및 내구성 향상.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Product",
        name: "금호타이어 KXA11 385/65R22.5",
        description: "덤프용 올시즌 타이어. 3PMSF 및 M+S 인증.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem",
      position: 4,
      item: {
        "@type": "Product",
        name: "금호타이어 KRS50 385/65R22.5",
        description: "덤프용 고마일리지 타이어. 케이싱 보호 설계.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
      },
    },
    {
      "@type": "ListItem",
      position: 5,
      item: {
        "@type": "Product",
        name: "금호타이어 KRA53 12R22.5",
        description: "버스용 중장거리 노선 최적화 타이어.",
        brand: { "@type": "Brand", name: "금호타이어" },
        offers: { "@type": "Offer", priceCurrency: "KRW", availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "(주)알앤에프코리아" } },
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
    { "@type": "ListItem", position: 1, name: "홈",          item: "https://www.rnfkorea.co.kr/" },
    { "@type": "ListItem", position: 2, name: "타이어 쇼핑몰", item: "https://www.rnfkorea.co.kr/tires-shop" },
  ],
};

// ====================================================
// 타입 정의
// ====================================================
type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

type TireRow = {
  brand: string;
  model_line: string;
  size: string;
  axle: string;
  position_type: string;
  vehicle_type: string;
  ton_class: string;
  pattern_type: string;
  season: string;
  load_index: string;
  speed_symbol: string;
  pr: string;
  tube_type: string;
  oe_fitment: string;
  main_thumb_url: string;
  price: string;
  supply_price: string;
  shipping_type: string;
  shipping_fee: string;
  stock_qty: string;
  lead_time_days: string;
  sku: string;
  position_image_url: string;
  tags: string;
  keyword: string;
  shop_title: string;
  short_desc: string;
  spec_summary: string;
  features: string;
  notes: string;
};

type VehicleGroup =
  | "전체"
  | "1톤~3.5톤 이하"
  | "5톤~10톤 이하"
  | "11톤 초과"
  | "트레일러"
  | "덤프"
  | "버스";

type AxleFilter = "전체" | "전륜" | "후륜" | "All";

// ====================================================
// 상수
// ====================================================
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=306191113&single=true&output=csv";

const vehicleGroups: VehicleGroup[] = [
  "전체", "1톤~3.5톤 이하", "5톤~10톤 이하", "11톤 초과", "트레일러", "덤프", "버스",
];

const axleOptions: AxleFilter[] = ["전체", "전륜", "후륜", "All"];
const popularSizes = ["12R22.5", "385/65R22.5"];
const SHIPPING_PER_UNIT = 10000;

const FALLBACK_POSITION_IMAGE_MAP: Record<string, string> = {
  STEER: "https://www.rnfkorea.co.kr/asset/tire-position/steer.png",
  DRIVE: "https://www.rnfkorea.co.kr/asset/tire-position/drive.png",
  ALL:   "https://www.rnfkorea.co.kr/asset/tire-position/all.png",
};

// ====================================================
// 유틸 함수 (원본 그대로 유지)
// ====================================================
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i += 1; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.trim());
}

function parseCSV(text: string): TireRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = values[index] ?? ""; });
    return row as TireRow;
  });
}

function normalize(value: string) { return String(value || "").trim(); }
function normalizeSizeKey(value: string) { return String(value || "").trim().replace(/\s+/g, "").toUpperCase(); }
function upper(value: string) { return normalize(value).toUpperCase(); }

function cleanTonClass(value: string) {
  return upper(value).replace(/\s+/g, "").replace(/톤/g, "T").replace(/TON/g, "T").replace(/[~～−–—]/g, "-");
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function toNumber(value: string) {
  const num = Number(String(value || "").replace(/,/g, ""));
  if (!num || Number.isNaN(num)) return 0;
  return num;
}

function formatPrice(value: string | number) {
  const num = typeof value === "number" ? value : toNumber(value);
  if (!num || Number.isNaN(num)) return "문의";
  return `${num.toLocaleString("ko-KR")}원`;
}

function getVehicleGroup(row: TireRow): Exclude<VehicleGroup, "전체"> {
  const vehicleType = upper(row.vehicle_type);
  const tonClass = cleanTonClass(row.ton_class);
  const fitment = cleanTonClass(row.oe_fitment);
  const combined = `${vehicleType}|${tonClass}|${fitment}`;

  if (vehicleType === "BUS"     || combined.includes("버스"))    return "버스";
  if (vehicleType === "TRAILER" || combined.includes("트레일러")) return "트레일러";
  if (vehicleType === "DUMP"    || combined.includes("덤프"))    return "덤프";

  if (includesAny(combined, ["1-3.5","1T-3.5T","1T~3.5T","1~3.5","1T","2.5T","3.5T","1-3.5T","1.0-3.5"])) return "1톤~3.5톤 이하";
  if (includesAny(combined, ["5-10","5T-10T","5~10","5T","8T","10T"])) return "5톤~10톤 이하";

  return "11톤 초과";
}

function getAxleCode(value: string) {
  const axle = upper(value);
  if (axle === "STEER") return "STEER";
  if (axle === "DRIVE") return "DRIVE";
  return "ALL";
}

function getAxleLabel(value: string) {
  const axle = getAxleCode(value);
  if (axle === "STEER") return "전륜";
  if (axle === "DRIVE") return "후륜";
  return "All";
}

function getStockBadge(stockQty: string) {
  const qty = Number(stockQty);
  if (!Number.isNaN(qty) && qty > 0) {
    return { label: "재고 있음", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  return { label: "재고 문의", className: "border-amber-200 bg-amber-50 text-amber-700" };
}

function getBrandShortName(brand: string) {
  const v = normalize(brand);
  if (v.includes("금호")) return "금호";
  return v;
}

function getPositionImage(row: TireRow) {
  const explicit = normalize(row.position_image_url);
  if (explicit) return explicit;
  return FALLBACK_POSITION_IMAGE_MAP[getAxleCode(row.axle)] || FALLBACK_POSITION_IMAGE_MAP.ALL;
}

function normalizeFitmentText(value: string) {
  return normalize(value)
    .replace(/^11T\s*카고/i, "11~25T 카고")
    .replace(/^11톤\s*카고/i, "11~25T 카고");
}

function matchesAxleFilter(row: TireRow, axleFilter: AxleFilter) {
  if (axleFilter === "전체") return true;
  const axleCode = getAxleCode(row.axle);
  if (axleFilter === "전륜") return axleCode === "STEER";
  if (axleFilter === "후륜") return axleCode === "DRIVE";
  return axleCode === "ALL";
}

function splitList(value: string) {
  return normalize(value).split(/[|,\n]/).map((item) => item.trim()).filter(Boolean);
}

function getShippingFee(_row: TireRow, quantity: number) { return SHIPPING_PER_UNIT * quantity; }

function buildConsultMemo(row: TireRow, quantity: number) {
  const unitPrice = toNumber(row.price);
  const productTotal = unitPrice * quantity;
  const shippingTotal = getShippingFee(row, quantity);
  const estimatedTotal = productTotal + shippingTotal;
  const title = normalize(row.shop_title) || `${normalize(row.brand)} ${normalize(row.model_line)} ${normalize(row.size)}`;

  return [
    `[타이어 상담] ${title} / ${quantity}개`, "",
    "타이어 상담 요청드립니다.", "",
    "[상품 정보]",
    `상품명: ${title}`,
    `SKU: ${normalize(row.sku) || "-"}`,
    `브랜드: ${normalize(row.brand) || "-"}`,
    `모델: ${normalize(row.model_line) || "-"}`,
    `사이즈: ${normalize(row.size) || "-"}`,
    `PR: ${normalize(row.pr) || "-"}`,
    `위치: ${getAxleLabel(row.axle)}`,
    `적용차종: ${normalizeFitmentText(row.oe_fitment) || "-"}`, "",
    "[예상 금액]",
    `수량: ${quantity}개`,
    `단가: ${formatPrice(unitPrice)}`,
    `상품금액: ${formatPrice(productTotal)}`,
    `배송비: ${formatPrice(shippingTotal)} (10,000원/개)`,
    `예상합계: ${formatPrice(estimatedTotal)}`,
  ].join("\n");
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
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-start">
          <div className="lg:col-span-7">

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
                  <span itemProp="name">타이어 쇼핑몰</span>
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
      </div>
    </section>
  );
}

// ====================================================
// 메인 페이지 컴포넌트
// ====================================================
export default function TiresShop() {
  const [rows, setRows] = useState<TireRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicleFilter, setVehicleFilter] = useState<VehicleGroup>("전체");
  const [axleFilter, setAxleFilter] = useState<AxleFilter>("전체");
  const [sizeFilterKey, setSizeFilterKey] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<TireRow | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false);
  const [consultForm, setConsultForm] = useState({ name: "", phone: "", region: "", vehicle: "", memo: "" });

  useEffect(() => {
    let alive = true;

    fetch(CSV_URL)
      .then((res) => res.text())
      .then((text) => {
        if (!alive) return;
        const data = parseCSV(text).filter((row) =>
          normalize(row.model_line) !== "" &&
          normalize(row.size) !== "" &&
          normalize(row.vehicle_type) !== "" &&
          normalize(row.ton_class) !== ""
        );
        const deduped = Array.from(
          new Map(
            data.map((row) => {
              const key = [
                normalizeSizeKey(row.size),
                normalize(row.pr),
                normalize(row.brand),
                normalize(row.model_line),
                String(row.price ?? "").trim(),
              ].join("||");
              return [key, row];
            })
          ).values()
        );
        setRows(deduped);
      })
      .catch((err) => { console.error("CSV load error:", err); if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, []);

  const sizeOptions = useMemo(() => {
    const scoped = rows.filter((row) => {
      if (vehicleFilter !== "전체" && getVehicleGroup(row) !== vehicleFilter) return false;
      if (!matchesAxleFilter(row, axleFilter)) return false;
      return true;
    });

    const sizeMap = new Map<string, string>();
    scoped.forEach((row) => {
      const label = normalize(row.size);
      const key = normalizeSizeKey(label);
      if (label && key && !sizeMap.has(key)) sizeMap.set(key, label);
    });

    const sizes = Array.from(sizeMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));

    return [{ key: "ALL", label: "전체" }, ...sizes];
  }, [rows, vehicleFilter, axleFilter]);

  useEffect(() => {
    if (!sizeOptions.some((option) => option.key === sizeFilterKey)) setSizeFilterKey("ALL");
  }, [sizeOptions, sizeFilterKey]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (vehicleFilter !== "전체") result = result.filter((row) => getVehicleGroup(row) === vehicleFilter);
    result = result.filter((row) => matchesAxleFilter(row, axleFilter));
    if (sizeFilterKey !== "ALL") result = result.filter((row) => normalizeSizeKey(row.size) === sizeFilterKey);

    if (search.trim()) {
      const keyword = search.toLowerCase();
      result = result.filter(
        (row) =>
          normalize(row.size).toLowerCase().includes(keyword) ||
          normalize(row.model_line).toLowerCase().includes(keyword)
      );
    }

    result.sort((a, b) => {
      const stockA = Number(a.stock_qty);
      const stockB = Number(b.stock_qty);
      if (stockA > 0 && stockB === 0) return -1;
      if (stockB > 0 && stockA === 0) return 1;
      return stockB - stockA;
    });

    return result;
  }, [rows, vehicleFilter, axleFilter, sizeFilterKey, search]);

  const selectedPrice = selectedRow ? toNumber(selectedRow.price) : 0;
  const selectedProductTotal = selectedPrice * quantity;
  const selectedShippingTotal = selectedRow ? getShippingFee(selectedRow, quantity) : 0;
  const selectedEstimatedTotal = selectedProductTotal + selectedShippingTotal;

  const handleConsultInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConsultForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConsultSubmit = async () => {
    if (!selectedRow) return;
    if (!consultForm.phone.trim()) { alert("연락처를 입력해주세요."); return; }

    const productMemo = buildConsultMemo(selectedRow, quantity);
    const customerMemo = [
      "", "",
      "[고객 입력 정보]",
      `성함: ${consultForm.name || "(미입력)"}`,
      `연락처: ${consultForm.phone || "(미입력)"}`,
      `장착 지역: ${consultForm.region || "(미입력)"}`,
      `차종/톤수: ${consultForm.vehicle || "(미입력)"}`,
      `문의 내용: ${consultForm.memo || "(미입력)"}`,
    ].join("\n");

    setIsSubmittingConsult(true);

    try {
      const response = await fetch("/.netlify/functions/send-consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: "TIRES",
          name: consultForm.name,
          phone: consultForm.phone,
          email: "",
          memo: `${productMemo}${customerMemo}`,
        }),
      });

      if (!response.ok) throw new Error("상담 신청 전송 실패");

      alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");
      setConsultForm({ name: "", phone: "", region: "", vehicle: "", memo: "" });
      setSelectedRow(null);
    } catch (error) {
      console.error("Consult submit error:", error);
      alert("전송에 실패했습니다.\n대표번호 1551-1873 으로 문의 부탁드립니다.");
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  // ====================================================
  // 렌더
  // ====================================================
  return (
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

        {/* ✅ JSON-LD: 주요 상품 목록 (봇이 읽을 수 있는 구조화 데이터) */}
        <script type="application/ld+json">{JSON.stringify(JSON_LD_ITEM_LIST)}</script>
        <script type="application/ld+json">{JSON.stringify(JSON_LD_BREADCRUMB)}</script>
      </Helmet>

      {/* ========================================================
          Hero
          ======================================================== */}
      <PageHero
        eyebrow="Tire Shop"
        title="상용차 타이어 쇼핑몰"
        description="필요한 제품을 빠르게 찾고, 수량과 배송비를 포함한 예상금액 확인 후 바로 상담을 요청할 수 있습니다."
      />

      {/* ========================================================
          상품 목록 및 필터
          ======================================================== */}
      <section className="py-6 md:py-8 border-t border-gray-100" aria-label="타이어 상품 목록">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-8">

          {/* ✅ 인기 규격 버튼 — aria-label로 검색엔진·접근성 모두 대응 */}
          <div className="flex items-center gap-3 flex-wrap" aria-label="인기 타이어 규격 빠른 선택">
            <span className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
              Popular Sizes
            </span>
            {popularSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSizeFilterKey(normalizeSizeKey(size))}
                className="h-10 px-4 rounded-full border border-orange-300 bg-orange-50 text-orange-700 font-semibold hover:bg-orange-500 hover:text-white"
                aria-label={`${size} 규격으로 필터`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* ✅ 필터 영역 — role="group"으로 논리적 묶음 처리 */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-5">

            {/* 차종 / 축 필터 */}
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="차종 및 축 위치 필터"
            >
              {vehicleGroups.map((v) => {
                const active = vehicleFilter === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVehicleFilter(v)}
                    aria-pressed={active}
                    className={`h-10 px-4 rounded-full text-sm font-semibold border ${
                      active
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}

              <div className="w-px h-6 bg-gray-300 mx-2" aria-hidden="true" />

              {axleOptions.map((v) => {
                const active = axleFilter === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAxleFilter(v)}
                    aria-pressed={active}
                    className={`h-10 px-4 rounded-full text-sm font-semibold border ${
                      active
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>

            {/* 사이즈 필터 */}
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="타이어 규격 필터"
            >
              {sizeOptions.map((option) => {
                const active = sizeFilterKey === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSizeFilterKey(option.key)}
                    aria-pressed={active}
                    className={`h-10 px-4 rounded-full text-sm font-semibold border ${
                      active
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* ✅ 검색바 — role="search" 로 검색엔진·스크린리더가 검색 영역으로 인식 */}
            <div role="search" aria-label="타이어 사이즈·모델 검색">
              <label htmlFor="tire-search" className="sr-only">
                타이어 사이즈 또는 모델 검색
              </label>
              <input
                id="tire-search"
                type="search"
                placeholder="사이즈 또는 모델 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-96 h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-orange-200/50"
                aria-label="사이즈 또는 모델명으로 검색"
              />
            </div>
          </div>

          {/* ✅ 상품 목록 — ul/li로 시맨틱 처리, 각 상품 article + h3 */}
          {loading ? (
            <p className="text-sm text-gray-500" aria-live="polite">상품 정보를 불러오는 중입니다...</p>
          ) : (
            <>
              {/* 검색 결과 수 — 스크린리더에 알림 */}
              <p className="sr-only" aria-live="polite">
                {filteredRows.length}개 타이어 상품이 표시됩니다.
              </p>

              <ul
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 list-none p-0"
                role="list"
                aria-label="타이어 상품 목록"
              >
                {filteredRows.map((row, i) => {
                  const isBestModel = upper(row.model_line) === "KRS55";
                  const isHotSize = popularSizes.includes(normalize(row.size));
                  const stockBadge = getStockBadge(row.stock_qty);
                  const brandShort = getBrandShortName(row.brand);
                  const positionImage = getPositionImage(row);
                  const productTitle = normalize(row.shop_title) || `${normalize(row.brand)} ${normalize(row.model_line)} ${normalize(row.size)}`;

                  return (
                    <li key={normalize(row.sku) || `${normalize(row.model_line)}-${i}`}>
                      {/* ✅ article — 독립적인 상품 단위로 마크업 */}
                      <article>
                        <button
                          type="button"
                          onClick={() => { setSelectedRow(row); setQuantity(1); }}
                          className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-orange-200/60"
                          aria-label={`${productTitle} 상세보기`}
                        >
                          <div className="group relative h-40 md:aspect-[4/3] md:h-auto overflow-hidden bg-gray-50">
                            {normalize(row.main_thumb_url) ? (
                              <>
                                <img
                                  src={row.main_thumb_url}
                                  alt={productTitle}
                                  className="h-full w-full object-contain p-2.5 md:p-3"
                                  loading="lazy"
                                  width={300}
                                  height={240}
                                />
                                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-white">
                                  <img
                                    src={row.main_thumb_url}
                                    alt={`${productTitle} 확대`}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-extrabold text-gray-400">
                                NO IMAGE
                              </div>
                            )}
                          </div>

                          <div className="flex flex-1 flex-col p-3 md:p-4 space-y-2.5 md:space-y-3">
                            <div className="flex flex-wrap gap-2" aria-label="상품 뱃지">
                              {isBestModel && (
                                <span className="px-3 py-1 text-xs font-bold bg-red-50 border border-red-200 text-red-600 rounded-full">BEST</span>
                              )}
                              {!isBestModel && isHotSize && (
                                <span className="px-3 py-1 text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-600 rounded-full">HOT</span>
                              )}
                              <span className="px-3 py-1 text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-600 rounded-full">
                                {getVehicleGroup(row)}
                              </span>
                              <span className={`px-3 py-1 text-xs font-bold rounded-full border ${stockBadge.className}`}>
                                {stockBadge.label}
                              </span>
                            </div>

                            {/* ✅ h3 — 상품명 명시 */}
                            <div className="flex items-baseline gap-2">
                              <h3 className="text-base md:text-lg font-semibold text-navy-900 leading-tight">
                                {normalize(row.size)}
                              </h3>
                              {normalize(row.pr) && (
                                <span className="text-sm md:text-base font-semibold text-gray-500">{normalize(row.pr)}</span>
                              )}
                            </div>

                            <p className="text-xs md:text-sm font-bold text-gray-600 leading-snug">
                              {getAxleLabel(row.axle)} · {brandShort} · {normalize(row.model_line)}
                            </p>

                            {/* ✅ dl/dt/dd — 상품 스펙을 key-value로 마크업 */}
                            <dl className="rounded-2xl bg-gray-50 p-2.5 md:p-3 text-xs md:text-sm text-gray-700 space-y-1.5 md:space-y-2">
                              <div className="flex justify-between gap-3">
                                <dt className="text-gray-500">브랜드</dt>
                                <dd className="font-semibold text-right">{normalize(row.brand) || "-"}</dd>
                              </div>
                              <div className="flex justify-between gap-3">
                                <dt className="text-gray-500">모델</dt>
                                <dd className="font-semibold text-right">{normalize(row.model_line) || "-"}</dd>
                              </div>
                              <div className="flex justify-between gap-3">
                                <dt className="text-gray-500">적용차종</dt>
                                <dd className="font-semibold text-right">{normalizeFitmentText(row.oe_fitment) || "-"}</dd>
                              </div>
                            </dl>

                            <div className="text-center bg-orange-50 border border-orange-100 rounded-xl p-2.5 md:p-3">
                              <p className="text-xs font-semibold text-orange-700">공급가 기준</p>
                              <p className="text-lg md:text-xl font-semibold">{formatPrice(row.price)}</p>
                              <p className="text-xs text-gray-500">배송비 10,000원/개 / 장착비 별도</p>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-2.5 md:p-3">
                              <p className="mb-2 text-xs font-extrabold text-gray-500">타이어 위치정보</p>
                              <div className="flex justify-center">
                                <img
                                  src={positionImage}
                                  alt={`${getAxleLabel(row.axle)} 타이어 위치 다이어그램`}
                                  className="h-12 md:h-14 object-contain"
                                  loading="lazy"
                                />
                              </div>
                            </div>

                            <div className="mt-auto block text-center bg-navy-900 text-white rounded-xl py-2.5 md:py-3 font-semibold text-base md:text-lg">
                              상세보기 / 상담하기
                            </div>
                          </div>
                        </button>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* 모바일 하단 고정 전화 버튼 */}
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-orange-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <a
              href="tel:1551-1873"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-orange-500 text-base font-semibold text-white shadow-lg"
              aria-label="전화 상담 연결 1551-1873"
            >
              ☎ 상담연결 1551-1873
            </a>
          </div>
        </div>
      </section>

      {/* ========================================================
          상품 상세 모달
          ======================================================== */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 px-4 py-4 md:items-center"
          onClick={() => setSelectedRow(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${normalize(selectedRow.shop_title) || normalize(selectedRow.model_line)} 상세 정보`}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur md:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-500">Tire Detail</p>
                <h2 className="mt-1 text-xl font-semibold text-navy-900 md:text-2xl">
                  {normalize(selectedRow.shop_title) || `${normalize(selectedRow.brand)} ${normalize(selectedRow.model_line)}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-500 hover:bg-gray-50"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.05fr] md:p-7">
              <div className="space-y-4">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  {normalize(selectedRow.main_thumb_url) ? (
                    <img
                      src={selectedRow.main_thumb_url}
                      alt={normalize(selectedRow.shop_title) || normalize(selectedRow.model_line)}
                      className="h-64 w-full object-contain md:h-80"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm font-extrabold text-gray-400 md:h-80">NO IMAGE</div>
                  )}
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
                  <p className="text-sm font-extrabold text-navy-900">상세정보</p>

                  {/* ✅ 모달 내 스펙도 dl/dt/dd 처리 */}
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["사이즈", normalize(selectedRow.size) || "-"],
                      ["PR",     normalize(selectedRow.pr)   || "-"],
                      ["브랜드", normalize(selectedRow.brand) || "-"],
                      ["모델",   normalize(selectedRow.model_line) || "-"],
                      ["위치",   getAxleLabel(selectedRow.axle)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-gray-50 p-3">
                        <dt className="text-xs font-semibold text-gray-500">{label}</dt>
                        <dd className="mt-1 font-semibold text-navy-900 break-keep">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {splitList(selectedRow.features).length > 0 && (
                    <div className="mt-3 rounded-2xl bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-500">특징</p>
                      <ul className="mt-2 space-y-1.5 text-sm font-semibold text-navy-900 list-none p-0">
                        {splitList(selectedRow.features).map((feature) => (
                          <li key={feature} className="break-keep">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                      {getVehicleGroup(selectedRow)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStockBadge(selectedRow.stock_qty).className}`}>
                      {getStockBadge(selectedRow.stock_qty).label}
                    </span>
                  </div>
                </div>

                <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4 md:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-extrabold text-navy-900">구매수량 선택</p>
                      <p className="mt-1 text-xs text-gray-500">배송비 포함 예상가격을 자동 산출합니다.</p>
                    </div>

                    <div className="flex items-center overflow-hidden rounded-2xl border border-orange-200 bg-white">
                      <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-11 w-11 text-xl font-semibold text-gray-600 hover:bg-gray-50" aria-label="수량 감소">−</button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quantity}
                        onChange={(e) => {
                          const nextValue = e.target.value.replace(/\D/g, "");
                          setQuantity(Math.max(1, Number(nextValue) || 1));
                        }}
                        className="h-11 w-16 border-x border-orange-100 text-center font-semibold outline-none"
                        aria-label="구매 수량"
                      />
                      <button type="button" onClick={() => setQuantity((q) => q + 1)} className="h-11 w-11 text-xl font-semibold text-gray-600 hover:bg-gray-50" aria-label="수량 증가">+</button>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-2 rounded-2xl bg-white p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">단가</dt>
                      <dd className="font-semibold">{formatPrice(selectedPrice)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">상품금액</dt>
                      <dd className="font-semibold">{formatPrice(selectedProductTotal)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">배송비</dt>
                      <dd className="font-semibold">{formatPrice(selectedShippingTotal)}</dd>
                    </div>
                    <div className="border-t border-gray-100 pt-3 flex justify-between gap-3 text-base">
                      <dt className="font-extrabold text-navy-900">예상합계</dt>
                      <dd className="font-extrabold text-orange-600">{formatPrice(selectedEstimatedTotal)}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-xs leading-5 text-gray-500 break-keep">
                    ※ 배송비는 10,000원/개 기준으로 산출됩니다. 예상금액은 공급가 기준이며, 실제 견적은 재고·배송지역·장착 여부에 따라 달라질 수 있습니다.
                  </p>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
                  <p className="text-sm font-extrabold text-navy-900">상담 정보 입력</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input name="name"    value={consultForm.name}    onChange={handleConsultInputChange} placeholder="성함"      className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" disabled={isSubmittingConsult} aria-label="성함" />
                    <input name="phone"   value={consultForm.phone}   onChange={handleConsultInputChange} placeholder="연락처"    className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" disabled={isSubmittingConsult} aria-label="연락처" required />
                    <input name="region"  value={consultForm.region}  onChange={handleConsultInputChange} placeholder="장착 지역" className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" disabled={isSubmittingConsult} aria-label="장착 지역" />
                    <input name="vehicle" value={consultForm.vehicle} onChange={handleConsultInputChange} placeholder="차종/톤수"  className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400" disabled={isSubmittingConsult} aria-label="차종 및 톤수" />
                    <textarea name="memo" value={consultForm.memo} onChange={handleConsultInputChange} placeholder="요청사항" rows={3} className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-orange-400 sm:col-span-2" disabled={isSubmittingConsult} aria-label="요청사항" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">연락처는 필수입니다.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleConsultSubmit}
                    disabled={isSubmittingConsult}
                    className="flex h-13 items-center justify-center rounded-2xl bg-orange-500 px-5 py-4 text-center font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmittingConsult ? "전송 중..." : "상담요청"}
                  </button>
                  <a
                    href="tel:1551-1873"
                    className="flex h-13 items-center justify-center rounded-2xl bg-navy-900 px-5 py-4 text-center font-semibold text-white shadow-sm hover:bg-navy-800"
                    aria-label="전화 상담 1551-1873"
                  >
                    전화 상담 1551-1873
                  </a>
                </div>

                {normalize(selectedRow.notes) && (
                  <p className="rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-500 break-keep">
                    {normalize(selectedRow.notes)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}