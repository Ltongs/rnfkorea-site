-- 경기북부(김서정 과장, hj5321006@naver.com) 전용 지게차(현대판매) 견적서 (/brother/quote)
-- tb_quotations는 관리자만 쓰던 테이블 — 경기북부 계정은 자기 명의(created_by) 지게차(현대판매) 견적만 보고·만들고·고치고·지울 수 있게 한다.
-- (관리자 정책 quotations_all 은 그대로라 관리자는 전체를 본다)
begin;
create policy quotations_gbn_select on public.tb_quotations
  for select using (public.is_brother_sales_rep() and created_by = 'hj5321006@naver.com' and quote_type = 'hyundai_forklift');
create policy quotations_gbn_insert on public.tb_quotations
  for insert with check (public.is_brother_sales_rep() and created_by = 'hj5321006@naver.com' and quote_type = 'hyundai_forklift');
create policy quotations_gbn_update on public.tb_quotations
  for update using (public.is_brother_sales_rep() and created_by = 'hj5321006@naver.com' and quote_type = 'hyundai_forklift')
  with check (public.is_brother_sales_rep() and created_by = 'hj5321006@naver.com' and quote_type = 'hyundai_forklift');
create policy quotations_gbn_delete on public.tb_quotations
  for delete using (public.is_brother_sales_rep() and created_by = 'hj5321006@naver.com' and quote_type = 'hyundai_forklift');
commit;
