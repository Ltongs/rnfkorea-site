// lib/featureFlags.ts
// 사업 항목 노출 스위치 — 사업을 잠시 쉬는 동안 홈페이지에서 숨길 때 false로 둔다.

// 중고장비 수출(장비 재상품화 프로그램) — 2026-10-30부터 당분간 사업 보류로 숨김.
// false면: 첫 화면 사업영역 카드·납품실적 카드, 상단/하단 메뉴, 사이트맵에서 빠지고
//         /export, /export-shop, /export-shop/inquiry 는 일반 방문자에게 첫 화면으로 돌려보낸다
//         (admin·ltongs7은 AI비서 수출장비 탭에서 계속 열람·관리 가능).
// 다시 열 때: true로 바꾸고 vite.config.ts 프리렌더 목록과 public/sitemap.xml 에 /export·/export-shop 을 되돌린다.
export const EXPORT_BUSINESS_VISIBLE = false;
