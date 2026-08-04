-- ORIX 인센티브 항목에 일반 비고(note) 필드 추가
--   payment_diff_note는 관리자 전용(실지급금액이 CM지급인센티브와 다를 때 사유)이라
--   영업 입력 단계(신규 등록/수정)에서 자유롭게 남길 메모를 기록할 곳이 없었다.
--   admin/파트너 모두 입력 가능한 일반 비고 컬럼을 추가한다.

alter table public.orix_incentives add column note text;

drop view public.orix_incentives_partner_edit_view;
drop view public.orix_incentives_partner_view;

create view public.orix_incentives_partner_edit_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive, note,
  incentive_recipient_contractor_id, incentive_recipient_pending, created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_edit_view to authenticated;
revoke all on public.orix_incentives_partner_edit_view from anon;

create view public.orix_incentives_partner_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive, oi.note,
  oi.incentive_recipient_contractor_id, oi.incentive_recipient_pending,
  oi.paid_at, oi.actual_paid_amount, oi.payment_diff_note, oi.wire_receipt_path,
  c.name as paid_to_contractor_name,
  oi.created_at, oi.updated_at
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.paid_to_contractor_id
where public.is_orix_admin() or public.is_orix_partner();

grant select on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;
