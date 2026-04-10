import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";


type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="pt-16 pb-14 md:pt-20 md:pb-16 border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-sm text-gray-500">
            <Link to="/" className="hover:text-orange-500 transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700 font-semibold">타이어 쇼핑몰</span>
          </div>

          {eyebrow && (
            <div className="mt-4 text-sm font-medium tracking-[0.12em] uppercase text-orange-500">
              {eyebrow}
            </div>
          )}

          <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] text-navy-900 break-keep">
            {title}
          </h1>

          {description && (
            <p className="mt-4 text-base md:text-lg leading-7 text-gray-600 max-w-3xl break-keep">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

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

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=306191113&single=true&output=csv";

const vehicleGroups: VehicleGroup[] = [
  "전체",
  "1톤~3.5톤 이하",
  "5톤~10톤 이하",
  "11톤 초과",
  "트레일러",
  "덤프",
  "버스",
];

const axleOptions: AxleFilter[] = ["전체", "전륜", "후륜", "All"];

const popularSizes = ["12R22.5", "385/65R22.5"];

const FALLBACK_POSITION_IMAGE_MAP: Record<string, string> = {
  STEER: "https://www.rnfkorea.co.kr/asset/tire-position/steer.png",
  DRIVE: "https://www.rnfkorea.co.kr/asset/tire-position/drive.png",
  ALL: "https://www.rnfkorea.co.kr/asset/tire-position/all.png",
};

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

export default function TiresShop() {
  const [rows, setRows] = useState<TireRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicleFilter, setVehicleFilter] = useState<VehicleGroup>("전체");
  const [axleFilter, setAxleFilter] = useState<AxleFilter>("전체");
  const [sizeFilter, setSizeFilter] = useState("전체");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    fetch(CSV_URL)
      .then((res) => res.text())
      .then((text) => {
        if (!alive) return;
        const data = parseCSV(text).filter((row) => {
          return (
            normalize(row.model_line) !== "" &&
            normalize(row.size) !== "" &&
            normalize(row.vehicle_type) !== "" &&
            normalize(row.ton_class) !== ""
          );
        });
        const deduped = Array.from(
          new Map(
            data.map((row) => {
              const key = [
                normalize(row.size),
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
      .catch((err) => {
        console.error("CSV load error:", err);
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const sizeOptions = useMemo(() => {
    const scoped = rows.filter((row) => {
      if (vehicleFilter !== "전체" && getVehicleGroup(row) !== vehicleFilter) return false;
      if (!matchesAxleFilter(row, axleFilter)) return false;
      return true;
    });

    const sizes = Array.from(new Set(scoped.map((row) => normalize(row.size)))).sort((a, b) =>
      a.localeCompare(b, "ko")
    );

    return ["전체", ...sizes];
  }, [rows, vehicleFilter, axleFilter]);

  useEffect(() => {
    if (!sizeOptions.includes(sizeFilter)) {
      setSizeFilter("전체");
    }
  }, [sizeOptions, sizeFilter]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (vehicleFilter !== "전체") {
      result = result.filter((row) => getVehicleGroup(row) === vehicleFilter);
    }

    result = result.filter((row) => matchesAxleFilter(row, axleFilter));

    if (sizeFilter !== "전체") {
      result = result.filter((row) => normalize(row.size) === sizeFilter);
    }

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
  }, [rows, vehicleFilter, axleFilter, sizeFilter, search]);

  return (
    <div className="bg-white text-navy-900">
      <PageHero
        eyebrow="Tire Shop"
        title="상용차 타이어 쇼핑몰"
        description="규필요한 제품을 빠르게 찾을 수 있도록 정리했습니다. 비교견적 후 바로 상담으로 연결할 수 있습니다."
      />

      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 space-y-8">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium tracking-[0.12em] uppercase text-orange-500">Popular Sizes</span>

        {popularSizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setSizeFilter(size)}
            className="h-10 px-4 rounded-full border border-orange-300 bg-orange-50 text-orange-700 font-semibold hover:bg-orange-500 hover:text-white"
          >
            {size}
          </button>
        ))}
      </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center gap-2">
        {vehicleGroups.map((v) => {
          const active = vehicleFilter === v;

          return (
            <button
              key={v}
              type="button"
              onClick={() => setVehicleFilter(v)}
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

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {axleOptions.map((v) => {
          const active = axleFilter === v;

          return (
            <button
              key={v}
              type="button"
              onClick={() => setAxleFilter(v)}
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

      <div className="flex flex-wrap gap-2">
        {sizeOptions.map((size) => {
          const active = sizeFilter === size;

          return (
            <button
              key={size}
              type="button"
              onClick={() => setSizeFilter(size)}
              className={`h-10 px-4 rounded-full text-sm font-semibold border ${
                active
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        placeholder="사이즈 또는 모델 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full md:w-96 h-11 px-4 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-orange-200/50"
      />

          </div>

          {loading ? (
        <div className="text-sm text-gray-500">상품 정보를 불러오는 중입니다...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filteredRows.map((row, i) => {
            const isBestModel = upper(row.model_line) === "KRS55";
            const isHotSize = popularSizes.includes(normalize(row.size));
            const stockBadge = getStockBadge(row.stock_qty);
            const brandShort = getBrandShortName(row.brand);
            const positionImage = getPositionImage(row);

            return (
              <div
                key={normalize(row.sku) || `${normalize(row.model_line)}-${i}`}
                className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md hover:-translate-y-1"
              >
                <div className="group relative h-40 md:aspect-[4/3] md:h-auto overflow-hidden bg-gray-50">
                  {normalize(row.main_thumb_url) ? (
                    <>
                      <img
                        src={row.main_thumb_url}
                        alt={normalize(row.shop_title) || normalize(row.model_line)}
                        className="h-full w-full object-contain p-2.5 md:p-3"
                      />

                      <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-white">
                        <img
                          src={row.main_thumb_url}
                          alt={normalize(row.shop_title) || normalize(row.model_line)}
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
                  <div className="flex flex-wrap gap-2">
                    {isBestModel && (
                      <span className="px-3 py-1 text-xs font-bold bg-red-50 border border-red-200 text-red-600 rounded-full">
                        BEST
                      </span>
                    )}

                    {!isBestModel && isHotSize && (
                      <span className="px-3 py-1 text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-600 rounded-full">
                        HOT
                      </span>
                    )}

                    <span className="px-3 py-1 text-xs font-semibold bg-orange-50 border border-orange-200 text-orange-600 rounded-full">
                      {getVehicleGroup(row)}
                    </span>

                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full border ${stockBadge.className}`}
                    >
                      {stockBadge.label}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                  <div className="text-base md:text-lg font-semibold text-navy-900 leading-tight">{normalize(row.size)}</div>
                  {normalize(row.pr) && (
                    <div className="text-sm md:text-base font-semibold text-gray-500">{normalize(row.pr)}</div>
                  )}
                </div>

                  <div className="text-xs md:text-sm font-bold text-gray-600 leading-snug">
                    {getAxleLabel(row.axle)} · {brandShort} · {normalize(row.model_line)}
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-2.5 md:p-3 text-xs md:text-sm text-gray-700 space-y-1.5 md:space-y-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">브랜드</span>
                      <span className="font-semibold text-right">{normalize(row.brand) || "-"}</span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">모델</span>
                      <span className="font-semibold text-right">{normalize(row.model_line) || "-"}</span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">적용차종</span>
                      <span className="font-semibold text-right">
                        {normalizeFitmentText(row.oe_fitment) || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="text-center bg-orange-50 border border-orange-100 rounded-xl p-2.5 md:p-3">
                    <div className="text-xs font-semibold text-orange-700">공급가 기준</div>
                    <div className="text-lg md:text-xl font-semibold">{formatPrice(row.price)}</div>
                    <div className="text-xs text-gray-500">배송비 별도 / 장착비 별도</div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-2.5 md:p-3">
                    <div className="mb-2 text-xs font-extrabold text-gray-500">타이어 위치정보</div>
                    <div className="flex justify-center">
                      <img
                        src={positionImage}
                        alt={`${getAxleLabel(row.axle)} 위치정보`}
                        className="h-12 md:h-14 object-contain"
                      />
                    </div>
                  </div>

                  <a
                    href="tel:1551-1873"
                    className="mt-auto block text-center bg-navy-900 text-white rounded-xl py-2.5 md:py-3 font-semibold text-base md:text-lg"
                  >
                    ☎ 타이어 상담 1551-1873
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-orange-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <a
              href="tel:1551-1873"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-orange-500 text-base font-semibold text-white shadow-lg"
            >
              ☎ 상담연결 1551-1873
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}