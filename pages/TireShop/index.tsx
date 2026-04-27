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

const SHIPPING_PER_UNIT = 10000;

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

function splitList(value: string) {
  return normalize(value)
    .split(/[|,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getShippingFee(_row: TireRow, quantity: number) {
  return SHIPPING_PER_UNIT * quantity;
}

function buildConsultMemo(row: TireRow, quantity: number) {
  const unitPrice = toNumber(row.price);
  const productTotal = unitPrice * quantity;
  const shippingTotal = getShippingFee(row, quantity);
  const estimatedTotal = productTotal + shippingTotal;
  const title = normalize(row.shop_title) || `${normalize(row.brand)} ${normalize(row.model_line)} ${normalize(row.size)}`;

  return [
    `[타이어 상담] ${title} / ${quantity}개`,
    "",
    "타이어 상담 요청드립니다.",
    "",
    "[상품 정보]",
    `상품명: ${title}`,
    `SKU: ${normalize(row.sku) || "-"}`,
    `브랜드: ${normalize(row.brand) || "-"}`,
    `모델: ${normalize(row.model_line) || "-"}`,
    `사이즈: ${normalize(row.size) || "-"}`,
    `PR: ${normalize(row.pr) || "-"}`,
    `위치: ${getAxleLabel(row.axle)}`,
    `적용차종: ${normalizeFitmentText(row.oe_fitment) || "-"}`,
    "",
    "[예상 금액]",
    `수량: ${quantity}개`,
    `단가: ${formatPrice(unitPrice)}`,
    `상품금액: ${formatPrice(productTotal)}`,
    `배송비: ${formatPrice(shippingTotal)} (10,000원/개)`,
    `예상합계: ${formatPrice(estimatedTotal)}`,
  ].join("\n");
}

export default function TiresShop() {
  const [rows, setRows] = useState<TireRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicleFilter, setVehicleFilter] = useState<VehicleGroup>("전체");
  const [axleFilter, setAxleFilter] = useState<AxleFilter>("전체");
  const [sizeFilter, setSizeFilter] = useState("전체");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<TireRow | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false);
  const [consultForm, setConsultForm] = useState({
    name: "",
    phone: "",
    region: "",
    vehicle: "",
    memo: "",
  });

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

  const selectedPrice = selectedRow ? toNumber(selectedRow.price) : 0;
  const selectedProductTotal = selectedPrice * quantity;
  const selectedShippingTotal = selectedRow ? getShippingFee(selectedRow, quantity) : 0;
  const selectedEstimatedTotal = selectedProductTotal + selectedShippingTotal;

  const handleConsultInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setConsultForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConsultSubmit = async () => {
    if (!selectedRow) return;

    if (!consultForm.phone.trim()) {
      alert("연락처를 입력해주세요.");
      return;
    }

    const productMemo = buildConsultMemo(selectedRow, quantity);
    const customerMemo = [
      "",
      "",
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: "TIRES",
          name: consultForm.name,
          phone: consultForm.phone,
          email: "",
          memo: `${productMemo}${customerMemo}`,
        }),
      });

      if (!response.ok) {
        throw new Error("상담 신청 전송 실패");
      }

      alert("상담 신청이 접수되었습니다.\n담당자가 확인 후 연락드리겠습니다.");
      setConsultForm({
        name: "",
        phone: "",
        region: "",
        vehicle: "",
        memo: "",
      });
      setSelectedRow(null);
    } catch (error) {
      console.error("Consult submit error:", error);
      alert("전송에 실패했습니다.\n대표번호 1551-1873 으로 문의 부탁드립니다.");
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  return (
    <div className="bg-white text-navy-900">
      <PageHero
        eyebrow="Tire Shop"
        title="상용차 타이어 쇼핑몰"
        description="필요한 제품을 빠르게 찾고, 수량과 배송비를 포함한 예상금액 확인 후 바로 상담을 요청할 수 있습니다."
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
                  <button
                    key={normalize(row.sku) || `${normalize(row.model_line)}-${i}`}
                    type="button"
                    onClick={() => {
                      setSelectedRow(row);
                      setQuantity(1);
                    }}
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-orange-200/60"
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

                        <span className={`px-3 py-1 text-xs font-bold rounded-full border ${stockBadge.className}`}>
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
                          <span className="font-semibold text-right">{normalizeFitmentText(row.oe_fitment) || "-"}</span>
                        </div>
                      </div>

                      <div className="text-center bg-orange-50 border border-orange-100 rounded-xl p-2.5 md:p-3">
                        <div className="text-xs font-semibold text-orange-700">공급가 기준</div>
                        <div className="text-lg md:text-xl font-semibold">{formatPrice(row.price)}</div>
                        <div className="text-xs text-gray-500">배송비 10,000원/개 / 장착비 별도</div>
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

                      <div className="mt-auto block text-center bg-navy-900 text-white rounded-xl py-2.5 md:py-3 font-semibold text-base md:text-lg">
                        상세보기 / 상담하기
                      </div>
                    </div>
                  </button>
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

      {selectedRow && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 px-4 py-4 md:items-center" onClick={() => setSelectedRow(null)}>
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur md:px-7">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-500">Tire Detail</div>
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
                  <div className="text-sm font-extrabold text-navy-900">상세정보</div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["사이즈", normalize(selectedRow.size) || "-"],
                      ["PR", normalize(selectedRow.pr) || "-"],
                      ["브랜드", normalize(selectedRow.brand) || "-"],
                      ["모델", normalize(selectedRow.model_line) || "-"],
                      ["위치", getAxleLabel(selectedRow.axle)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-gray-50 p-3">
                        <div className="text-xs font-semibold text-gray-500">{label}</div>
                        <div className="mt-1 font-semibold text-navy-900 break-keep">{value}</div>
                      </div>
                    ))}
                  </div>

                  {splitList(selectedRow.features).length > 0 && (
                    <div className="mt-3 rounded-2xl bg-gray-50 p-3">
                      <div className="text-xs font-semibold text-gray-500">특징</div>
                      <div className="mt-2 space-y-1.5 text-sm font-semibold text-navy-900">
                        {splitList(selectedRow.features).map((feature) => (
                          <div key={feature} className="break-keep">{feature}</div>
                        ))}
                      </div>
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
                      <div className="text-sm font-extrabold text-navy-900">구매수량 선택</div>
                      <div className="mt-1 text-xs text-gray-500">배송비 포함 예상가격을 자동 산출합니다.</div>
                    </div>

                    <div className="flex items-center overflow-hidden rounded-2xl border border-orange-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="h-11 w-11 text-xl font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        −
                      </button>
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
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="h-11 w-11 text-xl font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl bg-white p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">단가</span>
                      <span className="font-semibold">{formatPrice(selectedPrice)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">상품금액</span>
                      <span className="font-semibold">{formatPrice(selectedProductTotal)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500">배송비</span>
                      <span className="font-semibold">{formatPrice(selectedShippingTotal)}</span>
                    </div>
                    <div className="border-t border-gray-100 pt-3 flex justify-between gap-3 text-base">
                      <span className="font-extrabold text-navy-900">예상합계</span>
                      <span className="font-extrabold text-orange-600">{formatPrice(selectedEstimatedTotal)}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs leading-5 text-gray-500 break-keep">
                    ※ 배송비는 10,000원/개 기준으로 산출됩니다. 예상금액은 공급가 기준이며, 실제 견적은 재고·배송지역·장착 여부에 따라 달라질 수 있습니다.
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
                  <div className="text-sm font-extrabold text-navy-900">상담 정보 입력</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      name="name"
                      value={consultForm.name}
                      onChange={handleConsultInputChange}
                      placeholder="성함"
                      className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                      disabled={isSubmittingConsult}
                    />
                    <input
                      name="phone"
                      value={consultForm.phone}
                      onChange={handleConsultInputChange}
                      placeholder="연락처"
                      className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                      disabled={isSubmittingConsult}
                    />
                    <input
                      name="region"
                      value={consultForm.region}
                      onChange={handleConsultInputChange}
                      placeholder="장착 지역"
                      className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                      disabled={isSubmittingConsult}
                    />
                    <input
                      name="vehicle"
                      value={consultForm.vehicle}
                      onChange={handleConsultInputChange}
                      placeholder="차종/톤수"
                      className="h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-orange-400"
                      disabled={isSubmittingConsult}
                    />
                    <textarea
                      name="memo"
                      value={consultForm.memo}
                      onChange={handleConsultInputChange}
                      placeholder="요청사항"
                      rows={3}
                      className="rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-orange-400 sm:col-span-2"
                      disabled={isSubmittingConsult}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">연락처는 필수입니다.</div>
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
                  >
                    전화 상담 1551-1873
                  </a>
                </div>

                {normalize(selectedRow.notes) && (
                  <div className="rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-500 break-keep">
                    {normalize(selectedRow.notes)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
