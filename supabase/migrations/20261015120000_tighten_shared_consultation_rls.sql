-- 회사 공용 상담·주문 테이블 권한 정리 (2026-10-15)
--
-- 문제
--  1) consultation_cases_{select,insert,update,delete}_policy 는 "인향(보험 담당) 계정은 보험 상담만"을
--     의도했지만 PERMISSIVE(허용) 정책으로 만들어져, 인향을 뺀 "로그인한 모든 계정"(나르미·현대CM·NH캐피탈·
--     태산·Rental O/S·ORIX·경기북부 등 외부 파트너 포함)에게 전체 상담의 조회·등록·수정·삭제를 열어 두고 있었다.
--  2) *_internal_all 정책이 경기북부(is_brother_staff) 계정에 상담·상세·주문 "전체 행"을 열어 두고 있었다.
--     (경기북부 화면은 region='경기북부' / inbound_channel='brother_gbn' 행만 다룬다)
--
-- 변경
--  · 내부 직원(is_internal_staff: admin·부관리자·나르미·롯데·인향·AI비서Ins): 기존과 동일하게 전체
--  · 인향: 보험 상담(work_type='registration_insurance')만 — RESTRICTIVE 정책으로 실제로 강제
--  · 경기북부(김서정): region='경기북부' 상담과 그 상세, inbound_channel='brother_gbn' 주문만 조회·등록·수정 (삭제 불가)
--  · Rental O/S: work_type='rentalos' 상담 "등록"만 (RentalOS 화면의 통합상담 기록용)
--  · 그 외 로그인 계정: 접근 불가
-- (엣지함수는 service_role로 RLS를 우회하므로 영향 없음)

begin;

-- ── consultation_cases ─────────────────────────────────────────
drop policy if exists consultation_cases_select_policy on public.consultation_cases;
drop policy if exists consultation_cases_insert_policy on public.consultation_cases;
drop policy if exists consultation_cases_update_policy on public.consultation_cases;
drop policy if exists consultation_cases_delete_policy on public.consultation_cases;
drop policy if exists consultation_cases_internal_all on public.consultation_cases;

create policy consultation_cases_internal_all on public.consultation_cases
  for all using (public.is_internal_staff()) with check (public.is_internal_staff());

-- 인향(보험 담당)은 보험 상담만 — 다른 허용 정책과 AND로 걸리는 제한 정책
create policy consultation_cases_insurance_mgr_scope on public.consultation_cases
  as restrictive for all
  using (coalesce(auth.jwt()->>'email','') <> 'inhyang1004@hanmail.net' or work_type = 'registration_insurance')
  with check (coalesce(auth.jwt()->>'email','') <> 'inhyang1004@hanmail.net' or work_type = 'registration_insurance');

create policy consultation_cases_brother_select on public.consultation_cases
  for select using (public.is_brother_sales_rep() and region = '경기북부');
create policy consultation_cases_brother_insert on public.consultation_cases
  for insert with check (public.is_brother_sales_rep() and region = '경기북부');
create policy consultation_cases_brother_update on public.consultation_cases
  for update using (public.is_brother_sales_rep() and region = '경기북부')
  with check (public.is_brother_sales_rep() and region = '경기북부');

create policy consultation_cases_rentalos_insert on public.consultation_cases
  for insert with check (public.is_rental_os_staff() and work_type = 'rentalos');

-- ── consultation_tire_details / consultation_battery_details ──
drop policy if exists consultation_tire_details_internal_all on public.consultation_tire_details;
create policy consultation_tire_details_internal_all on public.consultation_tire_details
  for all using (public.is_internal_staff()) with check (public.is_internal_staff());
create policy consultation_tire_details_brother on public.consultation_tire_details
  for select using (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'));
create policy consultation_tire_details_brother_insert on public.consultation_tire_details
  for insert with check (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'));
create policy consultation_tire_details_brother_update on public.consultation_tire_details
  for update using (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'))
  with check (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'));

drop policy if exists consultation_battery_details_internal_all on public.consultation_battery_details;
create policy consultation_battery_details_internal_all on public.consultation_battery_details
  for all using (public.is_internal_staff()) with check (public.is_internal_staff());
create policy consultation_battery_details_brother on public.consultation_battery_details
  for select using (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'));
create policy consultation_battery_details_brother_insert on public.consultation_battery_details
  for insert with check (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'));
create policy consultation_battery_details_brother_update on public.consultation_battery_details
  for update using (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'))
  with check (public.is_brother_sales_rep() and exists (
    select 1 from public.consultation_cases c where c.id = consultation_id and c.region = '경기북부'));

-- ── tb_orders ─────────────────────────────────────────────────
drop policy if exists tb_orders_internal_all on public.tb_orders;
create policy tb_orders_internal_all on public.tb_orders
  for all using (public.is_internal_staff()) with check (public.is_internal_staff());
create policy tb_orders_brother_select on public.tb_orders
  for select using (public.is_brother_sales_rep() and inbound_channel = 'brother_gbn');
create policy tb_orders_brother_insert on public.tb_orders
  for insert with check (public.is_brother_sales_rep() and inbound_channel = 'brother_gbn');
create policy tb_orders_brother_update on public.tb_orders
  for update using (public.is_brother_sales_rep() and inbound_channel = 'brother_gbn')
  with check (public.is_brother_sales_rep() and inbound_channel = 'brother_gbn');

commit;
