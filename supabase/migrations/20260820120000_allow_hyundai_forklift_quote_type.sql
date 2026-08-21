-- 견적서·발주서 화면(pages/work/QuotationPage.tsx)에 "지게차(현대판매)" 탭을 추가하면서
-- 현대건설기계 경기북부판매㈜ 명의로 발행하는 견적서 유형(hyundai_forklift)을 새로 저장해야 한다.
-- tb_quotations.quote_type CHECK 제약조건에 값을 추가하지 않으면 tire 때와 같은 방식으로
-- 저장이 조용히 실패한다 (20260717120000_allow_tire_quote_type.sql 참고).

begin;

alter table public.tb_quotations drop constraint tb_quotations_quote_type_check;

alter table public.tb_quotations
  add constraint tb_quotations_quote_type_check
  check (quote_type = any (array['battery'::text, 'forklift'::text, 'hyundai_forklift'::text, 'tire'::text, 'installment'::text, 'purchase'::text]));

commit;
