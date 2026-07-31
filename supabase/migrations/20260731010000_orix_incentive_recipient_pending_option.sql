-- ORIX 인센티브 "지급대상" 드롭다운에 "미정" 선택지 추가
--   업무위수탁 계약 체결 전인 영업사원은 아직 tb_contractors(수탁인)에 등록할 수 없으므로,
--   지급대상을 특정 수탁인으로 확정하지 못한 채로도 인센티브 항목 자체는 먼저 등록할 수
--   있어야 한다. 가짜 수탁인 row를 만들면 원천징수관리(수탁인 관리) 화면에 실제 인물이
--   아닌 항목이 섞여 보이므로, 별도의 boolean 플래그로 "미정" 상태를 표현한다.
--   (incentive_recipient_contractor_id와는 상호배타적 — 미정이면 FK는 null로 유지)

alter table public.orix_incentives
  add column incentive_recipient_pending boolean not null default false;

drop view public.orix_incentives_partner_edit_view;
drop view public.orix_incentives_partner_view;

create view public.orix_incentives_partner_edit_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive,
  incentive_recipient_contractor_id, incentive_recipient_pending, created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_edit_view to authenticated;
revoke all on public.orix_incentives_partner_edit_view from anon;

create view public.orix_incentives_partner_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive,
  oi.incentive_recipient_contractor_id, oi.incentive_recipient_pending,
  oi.paid_at, oi.actual_paid_amount, oi.payment_diff_note, oi.wire_receipt_path,
  c.name as paid_to_contractor_name,
  oi.created_at, oi.updated_at
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.paid_to_contractor_id
where public.is_orix_admin() or public.is_orix_partner();

grant select on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;
