-- ORIX 인센티브: RNF(수컴퍼니)가 ORIX로부터 인센티브를 입금받았는지 확인하는
-- "수령확인" 상태 추가.
--   기존 paid_at은 RNF → 수탁인(지급대상)으로 나가는 흐름을 기록하는 반면,
--   이 컬럼은 그 반대 방향(ORIX → RNF)의 입금을 확인하는 별개의 상태다.
--   관리자만 체크/해제할 수 있고, 파트너(조용백)에게는 기존 관리자 전용 필드들과
--   동일하게 읽기전용으로 노출한다(쓰기는 orix_incentives_partner_edit_view에 없으므로 불가).

alter table public.orix_incentives add column received_from_orix_at timestamptz;

drop view public.orix_incentives_partner_view;

create view public.orix_incentives_partner_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive, oi.note,
  oi.incentive_recipient_contractor_id, oi.incentive_recipient_pending,
  oi.received_from_orix_at,
  oi.paid_at, oi.actual_paid_amount, oi.payment_diff_note, oi.wire_receipt_path,
  c.name as paid_to_contractor_name,
  oi.created_at, oi.updated_at
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.paid_to_contractor_id
where public.is_orix_admin() or public.is_orix_partner();

grant select on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;
