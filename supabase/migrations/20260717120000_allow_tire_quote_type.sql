-- tb_quotations.quote_type CHECK 제약조건에 'tire'가 빠져 있어 타이어견적서가
-- 저장될 때마다 제약조건 위반으로 조용히 실패하던 버그 수정.
-- (이 제약조건은 추적된 마이그레이션 없이 생성되어 있었음 — 기존 값 그대로 유지하고 'tire'만 추가)

begin;

alter table public.tb_quotations drop constraint tb_quotations_quote_type_check;

alter table public.tb_quotations
  add constraint tb_quotations_quote_type_check
  check (quote_type = any (array['battery'::text, 'forklift'::text, 'tire'::text, 'installment'::text, 'purchase'::text]));

commit;
