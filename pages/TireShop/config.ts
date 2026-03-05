// pages/TireShop/config.ts
import type { TireCsvRow } from "../../lib/tiresCsv";

// ✅ CSV URL 1번만 넣으세요
export const TIRE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vStUJkHotLlVECjJPyaxIWnYTl45_0Fw9IAtgIUzkRjScPYWE_lYJfk2_38Uqn9Y40kP-5pv3UXeRJf/pub?gid=306191113&single=true&output=csv";

/**
 * ✅ B안(차종 + 사이즈) 기반 상품번호
 * - 브랜드는 금호타이어만 취급(고정) 가정
 * - 차량: C/D/B/T
 * - 사이즈: 12R22.5 => 12R225, 385/65R22.5 => 38565R225
 * - 중복이면 -2, -3 ... 자동 부여
 */

// --------------------
// helpers
// --------------------
const vehicleCode = (v: TireCsvRow["vehicle_type"]) => {
  switch (v) {
    case "CARGO":
      return "C";
    case "DUMP":
      return "D";
    case "BUS":
      return "B";
    case "TRAILER":
      return "T";
    default:
      return "C";
  }
};

const sizeCode = (size: string) => {
  const s = (size ?? "").trim().toUpperCase();
  if (!s) return "SIZE";
  // 숫자/문자/./ 만 남기고, "." 제거, "/" 제거
  const cleaned = s.replace(/[^0-9A-Z./]/g, "");
  return cleaned.replace(/\./g, "").replace(/\//g, "");
};

export function productNoBase(row: TireCsvRow) {
  return `${vehicleCode(row.vehicle_type)}-${sizeCode(row.size)}`;
}

/**
 * rows 전체를 보고 sku -> 상품번호 맵 생성
 * 같은 base가 여러 개면 -2, -3 ... 붙임
 */
export function buildProductNoMap(rows: TireCsvRow[]) {
  const map = new Map<string, string>();

  // ✅ 안정적인 중복 처리(정렬 후 카운팅)
  const sorted = [...rows].sort((a, b) => {
    const x = productNoBase(a);
    const y = productNoBase(b);
    if (x !== y) return x.localeCompare(y);
    return (a.sku ?? "").localeCompare(b.sku ?? "");
  });

  const counts = new Map<string, number>();

  for (const r of sorted) {
    const base = productNoBase(r);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);

    const finalNo = n === 1 ? base : `${base}-${n}`;
    map.set(r.sku, finalNo);
  }

  return map;
}

/**
 * ✅ 기존 코드(index/detail)가 `productNo(item)`를 import 하고 쓰는 구조면
 * "함수"를 export 해줘야 런타임 에러가 안납니다.
 *
 * 단, 중복(-2/-3)은 rows 전체를 봐야 결정되므로,
 * index/detail에서 buildProductNoMap(rows)로 만든 map을 쓰는 걸 권장.
 *
 * 그래도 안전하게: productNo(item)는 base만 반환(단독 호출 대비)
 */
export function productNo(item: TireCsvRow) {
  return productNoBase(item);
}