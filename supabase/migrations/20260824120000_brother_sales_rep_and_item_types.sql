-- 현대지게차 경기북부(Brother) 페이지: 딜별 담당 영업사원 연락처 + 타이어/배터리/기타 항목 접수 지원.
--
-- 1) consultation_cases에 담당자 연락처 컬럼 추가.
--    타이어/배터리/기타 항목은 brother_tasks가 아니라 회사 전체 집계 파이프라인인
--    consultation_cases(+ consultation_tire_details/consultation_battery_details)에 저장해서
--    AI비서(통합상담)/CallManagement/FinanceHub의 기존 타이어·배터리 집계에 자동으로 잡히게 한다.
--    그런데 consultation_cases에는 담당자 연락처를 저장할 곳이 없어 추가한다(전사 공용이라 다른 업무에도 재사용 가능).
--
-- 2) 경기북부 담당자(김서정, is_brother_staff())는 is_internal_staff()에 포함되어 있지 않아
--    consultation_cases / consultation_tire_details / consultation_battery_details / tb_orders의
--    기존 "is_internal_staff()만 허용" 정책에 막혀 타이어/배터리 접수 시 RLS 위반으로 조용히 실패한다.
--    이 네 테이블의 all 정책에 is_brother_staff()를 추가해서 브라더 페이지에서도 쓸 수 있게 한다.

begin;

alter table public.consultation_cases
  add column if not exists sales_rep text,
  add column if not exists sales_rep_phone text;

drop policy if exists consultation_cases_internal_all on public.consultation_cases;
create policy consultation_cases_internal_all on public.consultation_cases for all
  using (public.is_internal_staff() or public.is_brother_staff())
  with check (public.is_internal_staff() or public.is_brother_staff());

drop policy if exists consultation_tire_details_internal_all on public.consultation_tire_details;
create policy consultation_tire_details_internal_all on public.consultation_tire_details for all
  using (public.is_internal_staff() or public.is_brother_staff())
  with check (public.is_internal_staff() or public.is_brother_staff());

drop policy if exists consultation_battery_details_internal_all on public.consultation_battery_details;
create policy consultation_battery_details_internal_all on public.consultation_battery_details for all
  using (public.is_internal_staff() or public.is_brother_staff())
  with check (public.is_internal_staff() or public.is_brother_staff());

drop policy if exists tb_orders_internal_all on public.tb_orders;
create policy tb_orders_internal_all on public.tb_orders for all
  using (public.is_internal_staff() or public.is_brother_staff())
  with check (public.is_internal_staff() or public.is_brother_staff());

commit;
