// lib/renthanaRate.ts — 렌타나 월 렌탈료 계산 (렌타나 계산기 /renthana 와 업무페이지 /renthana/work 공용)
// 월 렌탈료 = 공급가격(VAT 제외) × 1.1 × 1.03(알앤에프 마진 3%) × 월 요율 (렌타나 렌탈정책 기준)

export const VAT_RATE = 1.1;          // 부가세 10% 포함
export const MARGIN_RATE = 1.03;      // 알앤에프 마진 3%
export const RATE_12 = 0.0958755;    // 12개월 월 요율 (100만원 → 마진 포함 월 108,627원)
export const RATE_24 = 0.0522927;    // 24개월 월 요율 (100만원 → 마진 포함 월 59,248원)

export function renthanaMonthlyFee(supplyPrice: number, months: 12 | 24): number {
  return Math.round(supplyPrice * VAT_RATE * MARGIN_RATE * (months === 12 ? RATE_12 : RATE_24));
}
