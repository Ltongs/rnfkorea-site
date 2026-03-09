import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type TireRow = {
  sku: string;
  is_active: string;
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

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=306191113&single=true&output=csv";

// ✅ 실제 보유한 타이어 위치정보 이미지 경로로 교체하세요.
const POSITION_IMAGE_MAP: Record<string, string> = {
  STEER: "/asset/tire-position/steer.png",
  DRIVE: "/asset/tire-position/drive.png",
  TRAILER: "/asset/tire-position/trailer.png",
  ALL: "/asset/tire-position/all.png",
};

const pageWrap = "container mx-auto px-4 py-10 md:py-14 space-y-8";
const sectionCard =
  "rounded-[28px] border border-gray-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]";
const cardBase =
  "overflow-hidden rounded-[26px] border border-gray-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]";
const badgeBase =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold";
const tabBase =
  "h-10 rounded-full px-4 text-sm font-extrabold transition-all border";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row as TireRow;
  });
}

function normalize(value: string) {
  return String(value || "").trim();
}

function upper(value: string) {
  return normalize(value).toUpperCase();
}

function cleanTonClass(value: string) {
  return upper(value).replace(/\s+/g, "");
}

function formatPrice(value: string) {
  const num = Number(String(value || "").replace(/,/g, ""));
  if (!num || Number.isNaN(num)) return "문의";
  return `${num.toLocaleString("ko-KR")}원`;
}

function getVehicleGroup(row: TireRow): Exclude<VehicleGroup, "전체"> {
  const vehicleType = upper(row.vehicle_type);
  const tonClass = cleanTonClass(row.ton_class);

  if (vehicleType === "BUS") return "버스";
  if (vehicleType === "TRAILER") return "트레일러";
  if (vehicleType === "DUMP") return "덤프";
  if (vehicleType === "TRACTOR") return "11톤 초과";

  if (vehicleType === "CARGO") {
    if (
      tonClass === "1T" ||
      tonClass === "1TON" ||
      tonClass === "2.5T" ||
      tonClass === "2.5TON" ||
      tonClass === "2.5T이하" ||
      tonClass === "3.5T" ||
      tonClass === "3.5TON"
    ) {
      return "1톤~3.5톤 이하";
    }

    if (
      tonClass === "5T" ||
      tonClass === "5TON" ||
      tonClass === "8T" ||
      tonClass === "8TON" ||
      tonClass === "10T" ||
      tonClass === "10TON"
    ) {
      return "5톤~10톤 이하";
    }

    return "11톤 초과";
  }

  return "11톤 초과";
}

function getVehicleLabel(row: TireRow) {
  const vehicleType = upper(row.vehicle_type);
  const tonClass = cleanTonClass(row.ton_class);

  if (vehicleType === "BUS") return "버스";
  if (vehicleType === "TRAILER") return "트레일러";
  if (vehicleType === "DUMP") return "덤프";
  if (vehicleType === "TRACTOR") return "트랙터";

  if (vehicleType === "CARGO") {
    if (tonClass === "2.5T" || tonClass === "2.5TON" || tonClass === "2.5T이하") {
      return "2.5톤 이하";
    }
    if (tonClass === "3.5T" || tonClass === "3.5TON") return "3.5톤 카고";
    if (tonClass === "5T" || tonClass === "5TON") return "5톤 카고";
    if (tonClass === "8T" || tonClass === "8TON") return "8톤 카고";
    if (tonClass === "10T" || tonClass === "10TON") return "10톤 카고";
    if (tonClass === "11T" || tonClass === "11TON") return "11톤 카고";
    return "카고";
  }

  return normalize(row.vehicle_type) || "기타";
}

function getAxleCode(row: TireRow) {
  const axle = upper(row.axle);
  if (axle === "STEER" || axle === "DRIVE" || axle === "TRAILER" || axle === "ALL") {
    return axle;
  }
  return axle || "ALL";
}

function getAxleLabel(value: string) {
  const axle = upper(value);
  if (axle === "STEER") return "전륜";
  if (axle === "DRIVE") return "후륜";
  if (axle === "TRAILER") return "트레일러";
  if (axle === "ALL") return "전체";
  return normalize(value) || "-";
}

function getBrandShortName(brand: string) {
  const v = normalize(brand);
  if (v.includes("금호")) return "금호";
  if (v.includes("MAXAM")) return "MAXAM";
  if (v.includes("KENEX")) return "KENEX";
  return v;
}

function getStockBadge(stockQty: string) {
  const qty = Number(stockQty);

  if (!Number.isNaN(qty) && qty > 0) {
    return {
      label: "재고 있음",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "재고 문의",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function getSizeBucket(size: string) {
  return normalize(size) || "기타";
}

function makeDetailPath(row: TireRow) {
  return `/tires-shop/${encodeURIComponent(normalize(row.sku))}`;
}

function getPositionImage(row: TireRow) {
  const axleCode = getAxleCode(row);
  return POSITION_IMAGE_MAP[axleCode] || POSITION_IMAGE_MAP.ALL;
}

const TiresShopPage: React.FC = () => {
  const [rows, setRows] = useState<TireRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleGroupFilter, setVehicleGroupFilter] =
    useState<VehicleGroup>("전체");
  const [sizeFilter, setSizeFilter] = useState("전체");

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(CSV_URL, { cache: "no-store" });
        const text = await res.text();
        const parsed = parseCSV(text);

        if (!alive) return;

        const activeRows = parsed.filter((row) => {
          if (upper(row.is_active) !== "TRUE") return false;

          const hasModel = normalize(row.model_line) !== "";
          const hasSize = normalize(row.size) !== "";
          const hasVehicleType = normalize(row.vehicle_type) !== "";
          const hasTonClass = normalize(row.ton_class) !== "";

          return hasModel && hasSize && hasVehicleType && hasTonClass;
        });

        setRows(activeRows);
      } catch (error) {
        console.error("Failed to load tires CSV:", error);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, []);

  const vehicleGroupOptions: VehicleGroup[] = [
    "전체",
    "1톤~3.5톤 이하",
    "5톤~10톤 이하",
    "11톤 초과",
    "트레일러",
    "덤프",
    "버스",
  ];

  const sizeOptions = useMemo(() => {
    const sourceRows =
      vehicleGroupFilter === "전체"
        ? rows
        : rows.filter((row) => getVehicleGroup(row) === vehicleGroupFilter);

    const sizes = Array.from(
      new Set(sourceRows.map((row) => getSizeBucket(row.size)))
    ).sort((a, b) => a.localeCompare(b, "ko"));

    return ["전체", ...sizes];
  }, [rows, vehicleGroupFilter]);

  useEffect(() => {
    if (!sizeOptions.includes(sizeFilter)) {
      setSizeFilter("전체");
    }
  }, [sizeOptions, sizeFilter]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (vehicleGroupFilter !== "전체") {
      result = result.filter((row) => getVehicleGroup(row) === vehicleGroupFilter);
    }

    if (sizeFilter !== "전체") {
      result = result.filter((row) => getSizeBucket(row.size) === sizeFilter);
    }

    result.sort((a, b) => {
      const stockA = Number(a.stock_qty);
      const stockB = Number(b.stock_qty);

      const hasStockA = !Number.isNaN(stockA) && stockA > 0 ? 1 : 0;
      const hasStockB = !Number.isNaN(stockB) && stockB > 0 ? 1 : 0;

      if (hasStockA !== hasStockB) return hasStockB - hasStockA;
      if (!Number.isNaN(stockA) && !Number.isNaN(stockB) && stockA !== stockB) {
        return stockB - stockA;
      }

      return normalize(a.model_line).localeCompare(normalize(b.model_line), "ko");
    });

    return result;
  }, [rows, vehicleGroupFilter, sizeFilter]);

  return (
    <div className={pageWrap}>
      <section className="rounded-[32px] border border-gray-200 bg-gradient-to-br from-white via-orange-50/40 to-white px-6 py-8 md:px-10 md:py-10">
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold text-orange-700">
            RNF KOREA TIRES SHOP
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-navy-900">
            차종별 추천 상용 타이어
          </h1>

          <p className="max-w-3xl text-sm md:text-base leading-7 text-gray-600">
            차종군과 사이즈 기준으로 많이 찾는 규격과 대표 모델을 빠르게 확인할 수 있습니다.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="tel:1551-1873"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white transition hover:bg-orange-600"
            >
              상담문의 1551-1873
            </a>

            <a
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-300 bg-white px-5 text-sm font-extrabold text-gray-800 transition hover:border-orange-400 hover:text-orange-600"
            >
              재고 및 납기 문의
            </a>
          </div>
        </div>
      </section>

      <section className={`${sectionCard} p-4 md:p-5 space-y-4`}>
        <div className="flex flex-wrap gap-2">
          {vehicleGroupOptions.map((item) => {
            const active = vehicleGroupFilter === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setVehicleGroupFilter(item)}
                className={`${tabBase} ${
                  active
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {sizeOptions.map((item) => {
            const active = sizeFilter === item;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setSizeFilter(item)}
                className={`${tabBase} ${
                  active
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-navy-900">
            추천 타이어
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            재고 있는 상품이 먼저 보이도록 정렬했습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-bold text-gray-500">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1">
            총 {filteredRows.length}개
          </span>
          {vehicleGroupFilter !== "전체" && (
            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-orange-700">
              차종군: {vehicleGroupFilter}
            </span>
          )}
          {sizeFilter !== "전체" && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-gray-700">
              사이즈: {sizeFilter}
            </span>
          )}
        </div>
      </section>

      {loading ? (
        <section className={`${sectionCard} p-10 text-center text-gray-500`}>
          데이터를 불러오는 중입니다.
        </section>
      ) : filteredRows.length === 0 ? (
        <section className={`${sectionCard} p-10 text-center text-gray-500`}>
          조건에 맞는 상품이 없습니다.
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredRows.map((row) => {
            const vehicleGroup = getVehicleGroup(row);
            const axleLabel = getAxleLabel(row.axle);
            const stockBadge = getStockBadge(row.stock_qty);
            const brandShort = getBrandShortName(row.brand);
            const detailPath = makeDetailPath(row);
            const positionImage = getPositionImage(row);

            return (
              <article key={normalize(row.sku) || `${row.model_line}-${row.size}-${row.axle}`} className={cardBase}>
                <Link to={detailPath} className="block">
                  <div className="aspect-[4/3] bg-gray-50">
                    {normalize(row.main_thumb_url) ? (
                      <img
                        src={row.main_thumb_url}
                        alt={row.shop_title || row.model_line}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-extrabold text-gray-400">
                        NO IMAGE
                      </div>
                    )}
                  </div>
                </Link>

                <div className="space-y-3 p-4">
                  {/* 1행: 차종군 + 재고 */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`${badgeBase} border-orange-200 bg-orange-50 text-orange-700`}>
                      {vehicleGroup}
                    </span>
                    <span className={`${badgeBase} ${stockBadge.className}`}>
                      {stockBadge.label}
                    </span>
                  </div>

                  {/* 2행: 위치 · 사이즈 · 브랜드 · 모델 */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-extrabold leading-6 text-navy-900">
                      {axleLabel} · {normalize(row.size)} · {brandShort} · {normalize(row.model_line)}
                    </div>
                  </div>

                  {/* 3행: 브랜드 / 모델 / 적용차종 */}
                  <div className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">브랜드</span>
                      <span className="font-bold text-right">{normalize(row.brand) || "-"}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">모델</span>
                      <span className="font-bold text-right">{normalize(row.model_line) || "-"}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">적용차종</span>
                      <span className="font-bold text-right">{normalize(row.oe_fitment) || "-"}</span>
                    </div>
                  </div>

                  {/* 4행: 가격 */}
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                    <div className="text-xs font-extrabold text-orange-700">공급가 기준</div>
                    <div className="mt-1 text-lg font-extrabold text-navy-900">
                      {formatPrice(row.price)}
                    </div>
                  </div>

                  {/* 5행: 위치정보 */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="mb-2 text-xs font-extrabold text-gray-500">
                      타이어 위치정보
                    </div>
                    {positionImage ? (
                      <img
                        src={positionImage}
                        alt={`${axleLabel} 위치정보`}
                        className="h-20 w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded-xl bg-gray-50 text-xs font-bold text-gray-400">
                        위치 이미지 없음
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between gap-2">
                    <Link
                      to={detailPath}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 text-sm font-extrabold text-gray-800 transition hover:border-orange-400 hover:text-orange-600"
                    >
                      상세보기
                    </Link>

                    <a
                      href="tel:1551-1873"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-navy-900 px-4 text-sm font-extrabold text-white transition hover:opacity-90"
                    >
                      문의하기
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default TiresShopPage;