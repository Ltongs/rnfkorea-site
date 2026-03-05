import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { fetchTireRows } from "../../lib/tiresCsv";
import type { TireCsvRow } from "../../lib/tiresCsv";
import { TIRE_CSV_URL, buildProductNoMap } from "./config";

type VehicleTab = "ALL" | "CARGO" | "DUMP" | "BUS" | "TRAILER";
type AxleTab = "ALL" | "STEER" | "DRIVE" | "TRAILER";

/**
 * ✅ 톤급 버킷
 * - CARGO: 4버킷
 * - DUMP: 2버킷
 * - BUS/TRAILER: 없음
 */
type TonBucket =
  | "ALL"
  | "LT3"
  | "B3_5"
  | "B5_10"
  | "GE10"
  | "DUMP_15"
  | "DUMP_25P";

function fmtKRW(n?: number) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "가격문의";
  return `${new Intl.NumberFormat("ko-KR").format(v)}원`;
}

function parseTonValue(tonClass: any): number | null {
  if (tonClass == null) return null;

  if (typeof tonClass === "number") {
    return Number.isFinite(tonClass) ? tonClass : null;
  }

  const s = String(tonClass).trim();
  if (!s) return null;

  const m = s.match(/(\d+(\.\d+)?)/);
  if (!m) return null;

  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/**
 * ✅ 차종별 톤급 판정
 */
function inTonBucketByVehicle(
  tonClass: any,
  vehicle: VehicleTab,
  bucket: TonBucket
): boolean {
  if (bucket === "ALL") return true;
  if (vehicle === "ALL") return true;

  // BUS & TRAILER → 톤급 필터 없음
  if (vehicle === "BUS" || vehicle === "TRAILER") return true;

  const v = parseTonValue(tonClass);
  if (v == null) return false;

  if (vehicle === "DUMP") {
    if (bucket === "DUMP_15") return v >= 15 && v < 25;
    if (bucket === "DUMP_25P") return v >= 25;
    return true;
  }

  if (vehicle === "CARGO") {
    switch (bucket) {
      case "LT3":
        return v < 3;
      case "B3_5":
        return v >= 3 && v < 5;
      case "B5_10":
        return v >= 5 && v < 10;
      case "GE10":
        return v >= 10;
      default:
        return true;
    }
  }

  return true;
}

/**
 * ✅ 차종별 톤 옵션
 */
const TON_OPTIONS: Record<
  Exclude<VehicleTab, "ALL">,
  { value: TonBucket; label: string }[]
> = {
  CARGO: [
    { value: "ALL", label: "전체" },
    { value: "LT3", label: "3톤 미만" },
    { value: "B3_5", label: "3~5톤" },
    { value: "B5_10", label: "5~10톤" },
    { value: "GE10", label: "10톤 이상" },
  ],
  DUMP: [
    { value: "ALL", label: "전체" },
    { value: "DUMP_15", label: "15톤" },
    { value: "DUMP_25P", label: "25톤+" },
  ],
  BUS: [{ value: "ALL", label: "톤급 없음" }],
  TRAILER: [{ value: "ALL", label: "톤급 없음" }],
};

export default function TireShopPage() {
  const [rows, setRows] = useState<TireCsvRow[]>([]);
  const [productMap, setProductMap] = useState<Map<string, string>>(new Map());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [vehicle, setVehicle] = useState<VehicleTab>("ALL");
  const [axle, setAxle] = useState<AxleTab>("ALL");
  const [ton, setTon] = useState<TonBucket>("ALL");
  const [q, setQ] = useState("");

  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`상품번호 복사됨: ${text}`);
    } catch {
      setToast("복사 실패 (브라우저 권한 확인)");
    }
  }

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchTireRows(TIRE_CSV_URL);
      const commercial = data.filter((x) => x.is_active);
      setRows(commercial);
      setProductMap(buildProductNoMap(commercial));
    } catch (e: any) {
      setErr(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ✅ vehicle 변경 시 ton 자동 보정
  useEffect(() => {
    if (vehicle === "BUS" || vehicle === "TRAILER" || vehicle === "ALL") {
      if (ton !== "ALL") setTon("ALL");
      return;
    }

    const allowed = new Set((TON_OPTIONS[vehicle] ?? []).map((o) => o.value));
    if (!allowed.has(ton)) setTon("ALL");
  }, [vehicle, ton]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (vehicle !== "ALL" && r.vehicle_type !== vehicle) return false;
      if (axle !== "ALL" && r.axle !== axle) return false;
      if (!inTonBucketByVehicle(r.ton_class, vehicle, ton)) return false;

      if (q) {
        const productNo = productMap.get(r.sku) ?? "";
        const hay = `${productNo} ${r.model_line} ${r.size} ${r.tags ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }

      return true;
    });
  }, [rows, vehicle, axle, ton, q, productMap]);

  return (
    <div className="container mx-auto px-4 py-16 space-y-10">
      <h1 className="text-4xl font-extrabold text-navy-900">타이어 쇼핑몰</h1>

      {/* 검색/필터/톤급 */}
      {(() => {
        const BOX_H = "h-[92px]";
        const CONTROL_H = "h-12";

        const box =
          `${BOX_H} rounded-2xl border border-gray-200 bg-white ` +
          `px-4 py-3 shadow-sm flex flex-col justify-between`;

        const control =
          `${CONTROL_H} w-full rounded-xl border border-gray-200 bg-white ` +
          `px-3 text-sm font-bold text-navy-900 outline-none ` +
          `focus:border-orange-400 focus:ring-4 focus:ring-orange-200/40`;

        const tonDisabled =
          vehicle === "BUS" || vehicle === "TRAILER" || vehicle === "ALL";

        const tonOptions =
          vehicle !== "ALL"
            ? TON_OPTIONS[vehicle]
            : [{ value: "ALL" as TonBucket, label: "차종 선택 필요" }];

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* 검색 */}
            <div className={box}>
              <div className="text-xs font-extrabold text-gray-500">검색</div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="모델/사이즈/상품번호"
                  className={`${control} pl-10`}
                />
              </div>
            </div>

            {/* 차종 */}
            <div className={box}>
              <div className="text-xs font-extrabold text-gray-500">차종</div>
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value as VehicleTab)}
                className={control}
              >
                <option value="ALL">전체</option>
                <option value="CARGO">카고</option>
                <option value="DUMP">덤프</option>
                <option value="BUS">버스</option>
                <option value="TRAILER">트레일러</option>
              </select>
            </div>

            {/* 톤급 */}
            <div className={box}>
              <div className="text-xs font-extrabold text-gray-500">
                {vehicle === "BUS" || vehicle === "TRAILER"
                  ? "톤급 없음"
                  : "톤급"}
              </div>

              <select
                value={ton}
                onChange={(e) => setTon(e.target.value as TonBucket)}
                className={`${control} ${
                  tonDisabled ? "bg-gray-50 text-gray-400" : ""
                }`}
                disabled={tonDisabled}
              >
                {tonOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })()}

      {/* 상품 리스트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((p) => {
          const productNo = productMap.get(p.sku) ?? p.sku;
          const price = p.price ?? p.supply_price;

          return (
            <Link
              key={p.sku}
              to={`/tires-shop/${encodeURIComponent(p.sku)}`}
              className="group border border-gray-200 rounded-2xl bg-white overflow-hidden hover:shadow-md"
            >
              <div className="relative h-44 bg-gray-50">
                {p.main_thumb_url ? (
                  <img src={p.main_thumb_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 font-bold">
                    NO IMAGE
                  </div>
                )}
              </div>

              <div className="p-5 space-y-2">
                <div className="text-lg font-extrabold text-navy-900">
                  {p.model_line} ({p.size})
                </div>
                <div className="text-lg font-extrabold text-orange-600">
                  {fmtKRW(price)}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    copyToClipboard(productNo);
                  }}
                  className="text-xs font-bold text-gray-500 hover:text-orange-600"
                >
                  상품번호: <span className="text-navy-900">{productNo}</span>
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="px-4 py-3 rounded-xl bg-navy-900 text-white font-extrabold shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}